import "./buses.css";
import {
  createBusModel,
  updateBusModel,
  createBus,
  fetchBusModelById,
  buildBusModelEditRequestBody,
} from "../../../api";
import { fetchLcaVehicles } from "../../../api/environmental";
import { getBusModelDefaultsForLength, INFRAS_BUS_COST_REFERENCE } from "../../../config/bus-model-defaults";
import { AUXILIARY_CONSUMPTION_KW_DEFAULTS } from "../../../config/auxiliary-consumption-defaults";
import {
  buildVehicleCategorySpecsForSubmission,
  getCuratedLcaVehicle,
  getVehicleCategoryByKey,
  inferVehicleCategoryFromSpecs,
} from "../../../config/vehicle-categories";
import { resolveUserId } from "../../../api/session";
import { triggerPartialLoad } from "../../../events";
import { writeFlash, addOwnedBus } from "../../../store";
import { toggleFormDisabled, updateFeedback } from "../../../ui-helpers";
import { I18N_CHANGE_EVENT, t } from "../../../i18n";
import {
  BUS_MODEL_SPEC_FIELDS,
  BUS_MODEL_SPEC_FIELD_LABEL_KEYS,
  captureBusModelSpecFormState,
  mergeBusModelSpecs,
  normalizeBusModelSpecValues,
  resolveExpectedBusLengthM,
  shouldSubmitBusModelSpecs,
  validateBusModelSpecs,
} from "../../../utils/bus-model-specs";

const GENERIC_MANUFACTURER = "Generic";

const generateBusNameFromModel = (modelName = "Bus") => {
  return `${modelName.trim().replace(/\s+/g, "_")}_01`;
};

const parseSpecs = (specs) => {
  if (!specs) {
    return {};
  }
  if (typeof specs === "string") {
    try {
      const parsed = JSON.parse(specs);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }
  if (typeof specs === "object" && !Array.isArray(specs)) {
    return specs;
  }
  return {};
};

const readRawSpecValues = (formData) =>
  Object.fromEntries(
    BUS_MODEL_SPEC_FIELDS.map((field) => [
      field,
      formData.get(field)?.toString().trim() ?? "",
    ])
  );

const toBusModelPayload = (formData) => {
  const name = formData.get("name")?.toString().trim();
  const description = formData.get("description")?.toString().trim() ?? "";
  const vehicleReferenceKey =
    formData.get("vehicle_reference_key")?.toString().trim() ?? "";

  const rawSpecs = readRawSpecValues(formData);
  const specs = normalizeBusModelSpecValues(rawSpecs);

  return { name, description, vehicleReferenceKey, rawSpecs, specs };
};

const specIssueMessage = (issue) => {
  const labelKey =
    BUS_MODEL_SPEC_FIELD_LABEL_KEYS[issue?.field] ?? "buses.physical_specs";
  const label = t(labelKey);
  const keyByCode = {
    required: "buses.spec_required",
    finite: "buses.spec_finite",
    positive: "buses.spec_positive",
    non_negative: "buses.spec_non_negative",
    integer: "buses.spec_integer",
    pack_range: "buses.spec_pack_range",
    category_length: "buses.spec_category_length",
  };
  const messageKey = keyByCode[issue?.code] ?? "buses.spec_invalid";
  return t(messageKey, {
    label,
    length: issue?.expectedLengthM ?? "",
  });
};

const apiErrorMessage = (error) => {
  if (error?.status !== 422) return error?.message || "";

  const labels = (error.validationFields || []).map((field) =>
    t(BUS_MODEL_SPEC_FIELD_LABEL_KEYS[field] ?? "buses.physical_specs")
  );
  const uniqueLabels = [...new Set(labels)];
  return t("buses.api_validation_error", {
    fields: uniqueLabels.join(", ") || t("buses.physical_specs"),
  });
};

/* ── Main initializer ───────────────────────────────────── */

export const initializeAddBusModel = async (root = document, options = {}) => {
  const section = root.querySelector("section.add-bus-model");
  if (!section) {
    return null;
  }

  const cleanupHandlers = [];

  const header = section.querySelector("header h1");
  const form = section.querySelector('form[data-form="add-bus-model"]');
  if (!form) {
    return null;
  }

  let currentModel = options.busModel || {};
  if (!currentModel?.id && options.busModelId) {
    try {
      currentModel = await fetchBusModelById(options.busModelId);
    } catch (error) {
      console.error("Failed to load bus model for editing:", error);
      currentModel = {};
    }
  }

  const isDuplicateMode = options.duplicate === true && !!currentModel?.id;
  const isEditMode = !isDuplicateMode && !!currentModel?.id;

  const feedback = form.querySelector('[data-role="feedback"]');
  const cancelButton = form.querySelector('[data-action="cancel"]');
  const closeButton = section.querySelector('[data-action="close"]');
  const nameInput = form.querySelector("#name");
  const descriptionInput = form.querySelector("#description");
  const vehicleCategorySelect = form.querySelector("#vehicle_reference_key");
  const vehicleCategoryInfo = form.querySelector(
    '[data-role="vehicle-category-info"]'
  );
  const costInfo = form.querySelector('[data-role="cost-info"]');
  const batteryCostInfo = form.querySelector('[data-role="battery-cost-info"]');
  const emptyWeightInfo = form.querySelector('[data-role="empty-weight-info"]');
  const busLengthInput = form.querySelector("#bus_length_m");
  const passengerCapacityInput = form.querySelector("#max_passengers");
  let selectedVehicleCategory = null;
  let vehicleCategoryWasTouched = false;

  let curatedLcaVehicles = [];
  const curatedLcaVehiclesReady = fetchLcaVehicles()
    .then((data) => {
      curatedLcaVehicles = Array.isArray(data)
        ? data
        : data?.items || data?.results || [];
      return curatedLcaVehicles;
    })
    .catch((error) => {
      console.warn("Failed to load curated LCA vehicles:", error);
      return [];
    });

  const applyVehicleCategory = (category) => {
    if (!category) return;

    const defaults = getBusModelDefaultsForLength(category.defaultSpecLength);
    if (defaults) {
      for (const [field, value] of Object.entries(defaults)) {
        const el = form.querySelector(`#${field}`);
        if (!el) continue;
        el.value = value;
      }
    }

    if (busLengthInput) {
      busLengthInput.value = category.lengthM;
    }

    if (passengerCapacityInput) {
      passengerCapacityInput.value = category.defaultPassengerCapacity;
    }
  };

  const updateVehicleCategoryTooltip = (category) => {
    if (!vehicleCategoryInfo) return;
    const text = category?.tooltipI18nKey
      ? t(category.tooltipI18nKey)
      : t("buses.vehicle_category_tooltip_default");
    vehicleCategoryInfo.dataset.tooltip = text;
    vehicleCategoryInfo.setAttribute("aria-label", text);
    vehicleCategoryInfo.setAttribute("title", text);
  };

  const updateCostTooltip = () => {
    const length = Number(busLengthInput?.value);
    const defaults = getBusModelDefaultsForLength(selectedVehicleCategory?.defaultSpecLength || length);
    const source = t('buses.cost_infras_source');
    const categoryKey = length === 9 ? 'buses.cost_infras_midi'
      : length === 18 ? 'buses.cost_infras_articulated'
      : length === 12 || length === 13 ? 'buses.cost_infras_standard' : '';
    const setReference = (element, description) => {
      if (!element) return;
      const text = `${description} ${source} ${t('buses.cost_infras_open')}`;
      element.href = INFRAS_BUS_COST_REFERENCE.url;
      element.dataset.tooltip = text;
      element.setAttribute('aria-label', text);
      element.setAttribute('title', text);
    };
    setReference(costInfo, `${t('buses.cost_tooltip')} ${categoryKey ? t(categoryKey, { cost: defaults?.cost?.toLocaleString('de-CH') || '—' }) : ''}`);
    setReference(batteryCostInfo, t('buses.battery_cost_infras_tooltip', {
      cost: (defaults?.battery_pack_cost_chf ?? 40 * INFRAS_BUS_COST_REFERENCE.batteryChfPerKwh).toLocaleString('de-CH'),
      capacity: defaults?.battery_pack_size_kwh ?? 40,
      rate: INFRAS_BUS_COST_REFERENCE.batteryChfPerKwh,
    }));
  };

  const updateEmptyWeightTooltip = () => {
    if (!emptyWeightInfo) return;
    const text = t("buses.empty_weight_tooltip");
    emptyWeightInfo.dataset.tooltip = text;
    emptyWeightInfo.setAttribute("aria-label", text);
    emptyWeightInfo.setAttribute("title", text);
  };

  if (vehicleCategorySelect) {
    const handleVehicleCategoryChange = () => {
      vehicleCategoryWasTouched = true;
      const category = getVehicleCategoryByKey(vehicleCategorySelect.value);
      selectedVehicleCategory = category;
      applyVehicleCategory(category);
      updateVehicleCategoryTooltip(category);
      updateCostTooltip();
    };
    vehicleCategorySelect.addEventListener("change", handleVehicleCategoryChange);
    cleanupHandlers.push(() =>
      vehicleCategorySelect.removeEventListener("change", handleVehicleCategoryChange)
    );
  }

  updateVehicleCategoryTooltip(null);
  updateCostTooltip();
  updateEmptyWeightTooltip();

  const handleI18nChange = () => {
    updateVehicleCategoryTooltip(selectedVehicleCategory);
    updateCostTooltip();
    updateEmptyWeightTooltip();
  };
  document.addEventListener(I18N_CHANGE_EVENT, handleI18nChange);
  cleanupHandlers.push(() => {
    document.removeEventListener(I18N_CHANGE_EVENT, handleI18nChange);
  });

  /* ── Edit and duplicate mode pre-fill ── */
  if (isEditMode || isDuplicateMode) {
    if (header) {
      header.dataset.i18n = isEditMode ? "buses.edit_model" : "buses.add_model";
      header.textContent = t(header.dataset.i18n);
    }

    const specs = parseSpecs(currentModel.specs);
    const category = inferVehicleCategoryFromSpecs(specs);

    if (nameInput)
      nameInput.value = currentModel.name || currentModel.model || "";
    if (descriptionInput)
      descriptionInput.value = currentModel.description || "";

    for (const field of BUS_MODEL_SPEC_FIELDS) {
      const input = form.querySelector(`#${field}`);
      if (input && specs?.[field] != null) {
        input.value = specs[field];
      }
    }

    if (category && vehicleCategorySelect) {
      selectedVehicleCategory = category;
      vehicleCategorySelect.value = category.key;
      updateVehicleCategoryTooltip(category);
    }
  }

  updateCostTooltip();

  const initialSpecFormState = captureBusModelSpecFormState(
    readRawSpecValues(new FormData(form)),
    vehicleCategorySelect?.value ?? ""
  );

  /* ── Close / Cancel ── */
  const handleCloseClick = () => {
    triggerPartialLoad("buses");
  };
  if (closeButton) {
    closeButton.addEventListener("click", handleCloseClick);
    cleanupHandlers.push(() => {
      closeButton.removeEventListener("click", handleCloseClick);
    });
  }

  const handleCancelClick = () => {
    triggerPartialLoad("buses");
  };
  if (cancelButton) {
    cancelButton.addEventListener("click", handleCancelClick);
    cleanupHandlers.push(() => {
      cancelButton.removeEventListener("click", handleCancelClick);
    });
  }

  /* ── Submit ── */
  const handleSubmit = async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const { name, description, vehicleReferenceKey, rawSpecs, specs } =
      toBusModelPayload(formData);
    const currentSpecs = parseSpecs(currentModel.specs);
    const category = getVehicleCategoryByKey(vehicleReferenceKey);
    const currentSpecFormState = captureBusModelSpecFormState(
      rawSpecs,
      vehicleReferenceKey
    );
    let expectedBusLengthM = category?.lengthM;
    const specsChanged = shouldSubmitBusModelSpecs({
      isEditMode,
      initialState: initialSpecFormState,
      currentState: currentSpecFormState,
    });

    if (!name) {
      updateFeedback(feedback, t("buses.name_required"), "error");
      return;
    }

    if (specsChanged) {
      if (!category) {
        updateFeedback(feedback, t("buses.vehicle_category_required"), "error");
        vehicleCategorySelect?.focus();
        return;
      }

      expectedBusLengthM = resolveExpectedBusLengthM({
        isEditMode: isEditMode || isDuplicateMode,
        categoryLengthM: category.lengthM,
        initialState: initialSpecFormState,
        currentState: currentSpecFormState,
        categoryWasTouched: vehicleCategoryWasTouched,
      });
      const validation = validateBusModelSpecs(specs, {
        expectedLengthM: expectedBusLengthM,
      });
      if (!validation.ok) {
        updateFeedback(feedback, specIssueMessage(validation.issue), "error");
        form.querySelector(`#${validation.issue.field}`)?.focus();
        return;
      }
    }

    toggleFormDisabled(form, true);
    updateFeedback(feedback, isEditMode ? t("buses.updating") : t("buses.saving"), "info");

    try {
      if (isEditMode && !specsChanged) {
        await updateBusModel(
          currentModel.id,
          buildBusModelEditRequestBody({ name, description })
        );
        writeFlash(t("buses.model_updated"));
        triggerPartialLoad("buses");
        return;
      }

      await curatedLcaVehiclesReady;
      const lcaVehicle = getCuratedLcaVehicle(curatedLcaVehicles, category);
      const preservesLegacyTwelveMetreMetadata =
        expectedBusLengthM === 12 && category.lengthM === 13;
      const categorySpecs = buildVehicleCategorySpecsForSubmission(
        category,
        specs.max_passengers,
        lcaVehicle,
        {
          currentSpecs,
          preserveLegacyTwelveMetres: preservesLegacyTwelveMetreMetadata,
        }
      );
      const mergedSpecs = mergeBusModelSpecs({
        currentSpecs,
        formSpecs: specs,
        categorySpecs,
        modelType: preservesLegacyTwelveMetreMetadata
          ? currentSpecs.model_type
          : category.label,
        defaultAuxiliaryConsumption: AUXILIARY_CONSUMPTION_KW_DEFAULTS,
      });
      if (isEditMode) {
        await updateBusModel(
          currentModel.id,
          buildBusModelEditRequestBody({
            name,
            description,
            specs: mergedSpecs,
          })
        );
        writeFlash(t("buses.model_updated"));
      } else {
        const userId = await resolveUserId();
        const createdModel = await createBusModel({
          name,
          manufacturer: GENERIC_MANUFACTURER,
          model: category.label,
          description,
          specs: mergedSpecs,
          userId,
        });

        const busName = generateBusNameFromModel(name);
        const busModelId = createdModel?.id;

        if (busModelId) {
          try {
            const createdBus = await createBus({
              name: busName,
              busModelId,
              description: t("buses.auto_created_bus_description", { name }),
              specs: {},
              userId,
            });
            addOwnedBus({
              ...createdBus,
              name: busName,
              bus_model_id: busModelId,
              user_id: userId,
            });
          } catch (busError) {
            console.warn("Failed to auto-create bus for model", busError);
          }
        }

        writeFlash(t("buses.model_added"));
      }

      triggerPartialLoad("buses");
    } catch (error) {
      console.error(
        isEditMode
          ? "Failed to update bus model"
          : "Failed to create bus model",
        error
      );
      updateFeedback(
        feedback,
        apiErrorMessage(error) ||
          (isEditMode
            ? t("buses.unable_to_update_model")
            : t("buses.unable_to_save_model")),
        "error"
      );
    } finally {
      toggleFormDisabled(form, false);
    }
  };

  form.addEventListener("submit", handleSubmit);
  cleanupHandlers.push(() => {
    form.removeEventListener("submit", handleSubmit);
  });

  return () => {
    cleanupHandlers.forEach((handler) => handler());
  };
};
