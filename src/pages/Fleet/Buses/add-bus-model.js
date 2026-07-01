import "./buses.css";
import {
  createBusModel,
  updateBusModel,
  createBus,
  fetchBusModelById,
} from "../../../api";
import { fetchLcaVehicles } from "../../../api/environmental";
import { getBusModelDefaultsForLength } from "../../../config/bus-model-defaults";
import { AUXILIARY_CONSUMPTION_KW_DEFAULTS } from "../../../config/auxiliary-consumption-defaults";
import {
  buildVehicleCategorySpecs,
  getCuratedLcaVehicle,
  getVehicleCategoryByKey,
  inferVehicleCategoryFromSpecs,
} from "../../../config/vehicle-categories";
import { resolveUserId } from "../../../api/session";
import { triggerPartialLoad } from "../../../events";
import { writeFlash, addOwnedBus } from "../../../store";
import { toggleFormDisabled, updateFeedback } from "../../../ui-helpers";
import { I18N_CHANGE_EVENT, t } from "../../../i18n";

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
  if (typeof specs === "object") {
    return specs;
  }
  return {};
};

const SPEC_FIELDS = [
  "cost",
  "bus_length_m",
  "max_passengers",
  "empty_weight_kg",
  "max_battery_packs",
  "min_battery_packs",
  "battery_pack_size_kwh",
  "battery_pack_cost_chf",
  "max_charging_power_kw",
  "battery_pack_weight_kg",
  "battery_pack_lifetime",
  "bus_lifetime",
];

const toBusModelPayload = (formData) => {
  const name = formData.get("name")?.toString().trim();
  const description = formData.get("description")?.toString().trim() ?? "";
  const vehicleReferenceKey =
    formData.get("vehicle_reference_key")?.toString().trim() ?? "";

  const specs = {};
  for (const field of SPEC_FIELDS) {
    const raw = formData.get(field)?.toString().trim();
    if (raw !== undefined && raw !== "") {
      specs[field] = Number(raw);
    }
  }

  return { name, description, vehicleReferenceKey, specs };
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

  const isEditMode = !!currentModel?.id;

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
  const busLengthInput = form.querySelector("#bus_length_m");
  const passengerCapacityInput = form.querySelector("#max_passengers");
  let selectedVehicleCategory = null;

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

  const applyVehicleCategory = (
    category,
    { preserveEditableValues = false } = {}
  ) => {
    if (!category) return;

    const defaults = getBusModelDefaultsForLength(category.defaultSpecLength);
    if (defaults) {
      for (const [field, value] of Object.entries(defaults)) {
        const el = form.querySelector(`#${field}`);
        if (!el) continue;
        if (preserveEditableValues && el.value !== "") continue;
        el.value = value;
      }
    }

    if (busLengthInput) {
      busLengthInput.value = category.lengthM;
    }

    if (
      passengerCapacityInput &&
      (!preserveEditableValues || passengerCapacityInput.value === "")
    ) {
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
    if (!costInfo) return;
    const text = t("buses.cost_tooltip");
    costInfo.dataset.tooltip = text;
    costInfo.setAttribute("aria-label", text);
    costInfo.setAttribute("title", text);
  };

  if (vehicleCategorySelect) {
    const handleVehicleCategoryChange = () => {
      const category = getVehicleCategoryByKey(vehicleCategorySelect.value);
      selectedVehicleCategory = category;
      applyVehicleCategory(category);
      updateVehicleCategoryTooltip(category);
    };
    vehicleCategorySelect.addEventListener("change", handleVehicleCategoryChange);
    cleanupHandlers.push(() =>
      vehicleCategorySelect.removeEventListener("change", handleVehicleCategoryChange)
    );
  }

  updateVehicleCategoryTooltip(null);
  updateCostTooltip();

  const handleI18nChange = () => {
    updateVehicleCategoryTooltip(selectedVehicleCategory);
    updateCostTooltip();
  };
  document.addEventListener(I18N_CHANGE_EVENT, handleI18nChange);
  cleanupHandlers.push(() => {
    document.removeEventListener(I18N_CHANGE_EVENT, handleI18nChange);
  });

  /* ── Edit mode pre-fill ── */
  if (isEditMode) {
    if (header) {
      header.textContent = t("buses.edit_model");
    }

    const specs = parseSpecs(currentModel.specs);
    const category = inferVehicleCategoryFromSpecs(specs);

    if (nameInput)
      nameInput.value = currentModel.name || currentModel.model || "";
    if (descriptionInput)
      descriptionInput.value = currentModel.description || "";

    for (const field of SPEC_FIELDS) {
      const input = form.querySelector(`#${field}`);
      if (input && specs?.[field] != null) {
        input.value = specs[field];
      }
    }

    if (category && vehicleCategorySelect) {
      selectedVehicleCategory = category;
      vehicleCategorySelect.value = category.key;
      applyVehicleCategory(category, { preserveEditableValues: true });
      updateVehicleCategoryTooltip(category);
    }
  }

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
    const { name, description, vehicleReferenceKey, specs } =
      toBusModelPayload(formData);
    const currentSpecs = parseSpecs(currentModel.specs);
    const category = getVehicleCategoryByKey(vehicleReferenceKey);

    if (!name) {
      updateFeedback(feedback, t("buses.name_required"), "error");
      return;
    }

    if (!category) {
      updateFeedback(feedback, t("buses.vehicle_category_required"), "error");
      return;
    }

    const requiredSpecs = [
      { key: "cost", label: t("buses.field_cost") },
      { key: "bus_length_m", label: t("buses.field_bus_length") },
      { key: "max_passengers", label: t("buses.field_passenger_capacity") },
      { key: "empty_weight_kg", label: t("buses.field_empty_weight") },
      { key: "max_battery_packs", label: t("buses.field_max_battery_packs") },
      { key: "min_battery_packs", label: t("buses.field_min_battery_packs") },
      { key: "battery_pack_size_kwh", label: t("buses.field_battery_pack_size") },
      { key: "battery_pack_cost_chf", label: t("buses.field_battery_pack_cost") },
      { key: "max_charging_power_kw", label: t("buses.field_max_charging_power") },
      { key: "battery_pack_weight_kg", label: t("buses.field_battery_pack_weight") },
      { key: "battery_pack_lifetime", label: t("buses.field_battery_pack_lifetime") },
      { key: "bus_lifetime", label: t("buses.field_bus_lifetime") },
    ];

    for (const { key, label } of requiredSpecs) {
      if (specs[key] == null || isNaN(specs[key])) {
        updateFeedback(feedback, t("buses.spec_required", { label }), "error");
        return;
      }
    }

    toggleFormDisabled(form, true);
    updateFeedback(feedback, isEditMode ? t("buses.updating") : t("buses.saving"), "info");

    try {
      const userId = await resolveUserId();
      await curatedLcaVehiclesReady;
      const lcaVehicle = getCuratedLcaVehicle(curatedLcaVehicles, category);
      const categorySpecs = buildVehicleCategorySpecs(
        category,
        specs.max_passengers,
        lcaVehicle
      );
      const mergedSpecs = {
        ...currentSpecs,
        ...specs,
        ...categorySpecs,
        model_type: category.label,
      };
      mergedSpecs.auxiliary_consumption_kw = AUXILIARY_CONSUMPTION_KW_DEFAULTS;
      const manufacturerToSend = GENERIC_MANUFACTURER;
      const modelToSend = category.label;

      if (isEditMode) {
        await updateBusModel(currentModel.id, {
          name,
          manufacturer: manufacturerToSend,
          model: modelToSend,
          description,
          specs: mergedSpecs,
          userId,
        });
        writeFlash(t("buses.model_updated"));
      } else {
        const createdModel = await createBusModel({
          name,
          manufacturer: manufacturerToSend,
          model: modelToSend,
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
        error?.message ??
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
