import "./buses.css";
import {
  createBusModel,
  updateBusModel,
  createBus,
  fetchBusModelById,
  buildBusModelEditRequestBody,
} from "../../../api";
import { fetchLcaVehicles } from "../../../api/environmental";
import { fetchEconomicDefaults } from "../../../api/simulation";
import { getBusModelDefaultsForLength, ESTIMATED_SPEC_FIELDS, estimateBusSpecs } from "../../../config/bus-model-defaults";
import { AUXILIARY_CONSUMPTION_KW_DEFAULTS } from "../../../config/auxiliary-consumption-defaults";
import {
  buildVehicleCategorySpecsForSubmission,
  getCuratedLcaVehicle,
  getVehicleCategoryForLength,
  inferVehicleCategoryFromSpecs,
} from "../../../config/vehicle-categories";
import { resolveUserId } from "../../../api/session";
import { triggerPartialLoad } from "../../../events";
import { writeFlash, addOwnedBus } from "../../../store";
import { toggleFormDisabled, updateFeedback } from "../../../ui-helpers";
import { formatNumber } from "../../../utils/number-format";
import { I18N_CHANGE_EVENT, t } from "../../../i18n";
import {
  BUS_MODEL_SPEC_FIELDS,
  BUS_MODEL_SPEC_FIELD_LABEL_KEYS,
  captureBusModelSpecFormState,
  mergeBusModelSpecs,
  normalizeBusModelSpecValues,
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
  const rawSpecs = readRawSpecValues(formData);
  const specs = normalizeBusModelSpecValues(rawSpecs);

  return { name, description, rawSpecs, specs };
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
    length_ranges: "buses.length_ranges",
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
  const chemistryInput = form.elements.battery_chemistry;
  const original = parseSpecs(currentModel.specs);
  const copyingSpecs = isEditMode || isDuplicateMode;
  const savedChemistry = original.battery_chemistry ?? original.batteryChemistry;
  // Existing unlabelled models used NMC in annual LCA. A new model starts in LFP.
  if (savedChemistry && !Array.from(chemistryInput.options).some(o => o.value === savedChemistry)) {
    chemistryInput.add(new Option(savedChemistry, savedChemistry));
  }
  chemistryInput.value = savedChemistry || (copyingSpecs ? "NMC" : "LFP");
  const suggested = new Set(copyingSpecs
    ? original.suggested_spec_fields ?? ESTIMATED_SPEC_FIELDS.filter(field => original[field] == null)
    : ESTIMATED_SPEC_FIELDS);
  let selectedVehicleCategory = null;
  let lastCategoryWithDefaults = null;
  let pricing;
  const pendingEstimates = new Set();
  const listen = (element, event, handler) => {
    element.addEventListener(event, handler);
    cleanupHandlers.push(() => element.removeEventListener(event, handler));
  };
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

  const setTooltip = (element, key) => {
    if (!element) return;
    const value = t(key);
    element.dataset.tooltip = value;
    element.title = value;
    element.setAttribute("aria-label", value);
  };
  const updateTooltips = () => {
    setTooltip(vehicleCategoryInfo, selectedVehicleCategory?.tooltipI18nKey || "buses.vehicle_category_tooltip_default");
    setTooltip(form.querySelector('[data-role="length-info"]'), "buses.length_vecto_tooltip");
    setTooltip(emptyWeightInfo, "buses.empty_weight_tooltip");
    setTooltip(costInfo, "buses.price_body_reference");
    setTooltip(batteryCostInfo, "buses.price_pack_reference");
    setTooltip(form.querySelector('[data-role="pack-weight-info"]'), "buses.pack_weight_reference");
  };

  if (copyingSpecs) {
    if (header) {
      header.dataset.i18n = isEditMode ? "buses.edit_model" : "buses.add_model";
      header.textContent = t(header.dataset.i18n);
    }
    nameInput.value = currentModel.name || currentModel.model || "";
    descriptionInput.value = currentModel.description || "";
    for (const field of BUS_MODEL_SPEC_FIELDS) {
      if (original[field] != null) form.elements[field].value = original[field];
    }
  }

  const updateCategory = (applyDefaults = false) => {
    const next = getVehicleCategoryForLength(busLengthInput.value);
    const previous = lastCategoryWithDefaults;
    selectedVehicleCategory = next;
    vehicleCategorySelect.value = next?.key ?? "";
    if (applyDefaults && next && next !== previous) {
      const defaultsFor = category => category ? {
        ...getBusModelDefaultsForLength(category.defaultSpecLength),
        max_passengers: category.defaultPassengerCapacity,
      } : {};
      const oldDefaults = defaultsFor(previous);
      for (const [field, value] of Object.entries(defaultsFor(next))) {
        const input = form.elements[field];
        if (!input.value || (!copyingSpecs && Number(input.value) === oldDefaults[field])) {
          input.value = value;
        }
      }
    }
    if (next) lastCategoryWithDefaults = next;
    updateTooltips();
  };

  const updateBatterySummary = () => {
    const fields = form.elements;
    // valueAsNumber preserves the distinction between an empty price and zero.
    const read = input => input.validity.valid ? input.valueAsNumber : NaN;
    const size = read(fields.battery_pack_size_kwh);
    const min = read(fields.min_battery_packs);
    const max = read(fields.max_battery_packs);
    const price = read(fields.battery_pack_cost_chf);
    const show = (output, value, unit, decimals) => {
      const text = Number.isFinite(value) ? `${formatNumber(value, decimals)} ${unit}` : "—";
      if (output.value !== text) output.value = text;
    };
    const reversed = min > max;
    show(fields.battery_capacity_min, reversed ? NaN : min * size, "kWh", 3);
    show(fields.battery_capacity_max, reversed ? NaN : max * size, "kWh", 3);
    show(fields.battery_price_per_kwh, price / size, "CHF/kWh", 2);
  };

  const estimate = () => estimateBusSpecs(pricing,
    selectedVehicleCategory && Number(busLengthInput.value),
    Number(form.elements.battery_pack_size_kwh.value), chemistryInput.value);
  const updateEstimates = (fields = ESTIMATED_SPEC_FIELDS) => {
    if (!pricing) {
      for (const field of fields) pendingEstimates.add(field);
      updateBatterySummary();
      return;
    }
    const values = estimate();
    for (const field of fields) {
      if (suggested.has(field)) form.elements[field].value = values[field] ?? "";
      const restore = form.querySelector('[data-restore-field="' + field + '"]');
      restore.hidden = suggested.has(field) || values[field] == null;
    }
    updateBatterySummary();
  };
  updateCategory();
  updateBatterySummary();
  const initialChemistry = chemistryInput.value;
  const initialSuggested = [...suggested].sort().join(",");
  const initialSpecFormState = captureBusModelSpecFormState(
    readRawSpecValues(new FormData(form)), vehicleCategorySelect.value
  );
  const pricingReady = fetchEconomicDefaults().then(data => {
    if (!data?.battery_chemistries || !data?.bus_body_price_points?.length) {
      throw new Error(t("buses.unable_to_load_defaults"));
    }
    pricing = data;
    // Restoring a saved form must not reprice it merely by opening it.
    const current = estimate();
    for (const field of ESTIMATED_SPEC_FIELDS) {
      if (suggested.has(field) && (!copyingSpecs || pendingEstimates.has(field))) {
        form.elements[field].value = current[field] ?? "";
      }
      form.querySelector('[data-restore-field="' + field + '"]').hidden =
        suggested.has(field) || current[field] == null;
    }
    updateBatterySummary();
  }).catch(() => {
    updateFeedback(feedback, t("buses.unable_to_load_defaults"), "error");
  });

  for (const field of ["min_battery_packs", "max_battery_packs", "battery_pack_cost_chf"]) {
    listen(form.elements[field], "input", updateBatterySummary);
  }
  listen(busLengthInput, "input", () => {
    updateCategory(true);
    updateEstimates();
  });
  listen(chemistryInput, "change", () => updateEstimates(["battery_pack_weight_kg", "battery_pack_cost_chf"]));
  listen(form.elements.battery_pack_size_kwh, "input", () => updateEstimates(["battery_pack_weight_kg", "battery_pack_cost_chf"]));
  for (const field of ESTIMATED_SPEC_FIELDS) {
    const restore = form.querySelector('[data-restore-field="' + field + '"]');
    listen(form.elements[field], "input", () => {
      suggested.delete(field);
      restore.hidden = estimate()[field] == null;
    });
    listen(restore, "click", () => {
      suggested.add(field);
      updateEstimates([field]);
    });
  }
  listen(document, I18N_CHANGE_EVENT, updateTooltips);

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

    await pricingReady;
    const formData = new FormData(form);
    const { name, description, rawSpecs, specs } =
      toBusModelPayload(formData);
    const currentSpecs = parseSpecs(currentModel.specs);
    const category = getVehicleCategoryForLength(specs.bus_length_m);
    const currentSpecFormState = captureBusModelSpecFormState(
      rawSpecs,
      category?.key ?? ""
    );
    const specsChanged = shouldSubmitBusModelSpecs({
      isEditMode,
      initialState: initialSpecFormState,
      currentState: currentSpecFormState,
    }) || chemistryInput.value !== initialChemistry || [...suggested].sort().join(",") !== initialSuggested;

    if (!name) {
      updateFeedback(feedback, t("buses.name_required"), "error");
      return;
    }

    if (specsChanged) {
      const validation = validateBusModelSpecs(specs);
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
        copyingSpecs && Number(currentSpecs.bus_length_m) === 12 && specs.bus_length_m === 12 &&
        inferVehicleCategoryFromSpecs(currentSpecs)?.lengthM === 13;
      const categorySpecs = buildVehicleCategorySpecsForSubmission(
        category,
        specs.max_passengers,
        lcaVehicle,
        {
          currentSpecs,
          physicalLength: specs.bus_length_m,
          preserveLegacyTwelveMetres: preservesLegacyTwelveMetreMetadata,
        }
      );
      const mergedSpecs = mergeBusModelSpecs({
        currentSpecs,
        formSpecs: { ...specs, battery_chemistry: chemistryInput.value, suggested_spec_fields: [...suggested] },
        categorySpecs,
        modelType: preservesLegacyTwelveMetreMetadata
          ? currentSpecs.model_type
          : category.label,
        defaultAuxiliaryConsumption: AUXILIARY_CONSUMPTION_KW_DEFAULTS,
      });
      if (currentSpecs.lca?.vehicle_id && !lcaVehicle && inferVehicleCategoryFromSpecs(currentSpecs)?.key !== category.key) {
        delete mergedSpecs.lca.vehicle_id;
      }
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
      vehicleCategorySelect.disabled = true;
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
