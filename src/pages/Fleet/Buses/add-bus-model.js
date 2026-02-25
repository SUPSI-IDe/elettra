import "./buses.css";
import {
  createBusModel,
  updateBusModel,
  createBus,
  fetchBusManufacturers,
  fetchBusModelsByManufacturer,
} from "../../../api";
import { getBusModelDefaultsForLength } from "../../../config/bus-model-defaults";
import { AUXILIARY_CONSUMPTION_KW_DEFAULTS } from "../../../config/auxiliary-consumption-defaults";
import { resolveUserId } from "../../../api/session";
import { triggerPartialLoad } from "../../../events";
import { writeFlash, addOwnedBus } from "../../../store";
import { toggleFormDisabled, updateFeedback } from "../../../ui-helpers";

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
  "max_charging_power_kw",
  "battery_pack_weight_kg",
  "battery_pack_lifetime",
  "bus_lifetime",
];

const toBusModelPayload = (formData) => {
  const name = formData.get("name")?.toString().trim();
  const manufacturer = formData.get("manufacturer")?.toString().trim() ?? "";
  const model = formData.get("model")?.toString().trim() ?? "";
  const description = formData.get("description")?.toString().trim() ?? "";

  const specs = {};
  for (const field of SPEC_FIELDS) {
    const raw = formData.get(field)?.toString().trim();
    if (raw !== undefined && raw !== "") {
      specs[field] = Number(raw);
    }
  }

  return { name, manufacturer, model, description, specs };
};

/* ── Autocomplete helpers ───────────────────────────────── */

const normalizeList = (data) =>
  Array.isArray(data) ? data : data?.items || data?.results || [];

const filterItems = (items, searchTerm, nameKey = "name") => {
  if (!searchTerm || searchTerm.length < 1) {
    return items.slice(0, 20);
  }
  const term = searchTerm.toLowerCase();
  return items
    .filter((item) => (item[nameKey] || "").toLowerCase().includes(term))
    .slice(0, 20);
};

const renderDropdownItems = (listEl, items, nameKey, onSelect) => {
  listEl.innerHTML = "";
  if (items.length === 0) {
    const li = document.createElement("li");
    li.className = "autocomplete-item autocomplete-empty";
    li.textContent = "No results found";
    listEl.appendChild(li);
    return;
  }
  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "autocomplete-item";
    li.dataset.itemId = item.id || "";
    li.dataset.itemName = item[nameKey] || "";
    li.textContent = item[nameKey] || "Unknown";
    li.addEventListener("click", () => onSelect(item));
    listEl.appendChild(li);
  });
};

/**
 * Generic autocomplete wiring for an input + hidden-id + dropdown.
 * Returns { reset(), setItems() } so the caller can force a reload.
 */
const setupAutocomplete = ({
  input,
  hiddenInput,
  dropdown,
  list,
  loadItems,
  nameKey = "name",
  onSelect,
  canOpen = () => true,
  shouldClearOnBlur = () => !hiddenInput.value && !!input.value,
  onClear,
}) => {
  let allItems = [];
  let selectedIndex = -1;
  let loaded = false;

  const show = () => {
    dropdown.hidden = false;
  };
  const hide = () => {
    dropdown.hidden = true;
    selectedIndex = -1;
  };

  const update = (searchTerm) => {
    const filtered = filterItems(allItems, searchTerm, nameKey);
    renderDropdownItems(list, filtered, nameKey, (item) => {
      input.value = item[nameKey] || "";
      hiddenInput.value = item.id || "";
      hide();
      if (onSelect) onSelect(item);
    });
    show();
  };

  const ensureLoaded = async () => {
    if (!loaded) {
      allItems = await loadItems();
      loaded = true;
    }
  };

  const highlightItem = (index) => {
    const items = list.querySelectorAll(
      ".autocomplete-item:not(.autocomplete-empty)"
    );
    items.forEach((el, i) => el.classList.toggle("highlighted", i === index));
  };

  input.addEventListener("focus", async () => {
    if (!canOpen()) return;
    await ensureLoaded();
    update(input.value);
  });

  input.addEventListener("input", () => {
    hiddenInput.value = "";
    if (!canOpen()) return;
    update(input.value);
  });

  input.addEventListener("blur", () => {
    setTimeout(() => {
      hide();
      if (shouldClearOnBlur()) {
        input.value = "";
        if (onClear) onClear();
      }
    }, 200);
  });

  input.addEventListener("keydown", (event) => {
    if (!canOpen()) return;
    const items = list.querySelectorAll(
      ".autocomplete-item:not(.autocomplete-empty)"
    );
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      highlightItem(selectedIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      highlightItem(selectedIndex);
    } else if (event.key === "Enter" && selectedIndex >= 0) {
      event.preventDefault();
      const el = items[selectedIndex];
      if (el) {
        const item = { id: el.dataset.itemId, [nameKey]: el.dataset.itemName };
        input.value = item[nameKey] || "";
        hiddenInput.value = item.id || "";
        hide();
        if (onSelect) onSelect(item);
      }
    } else if (event.key === "Escape") {
      hide();
    }
  });

  return {
    reset: () => {
      allItems = [];
      loaded = false;
    },
    setItems: (items) => {
      allItems = items;
      loaded = true;
    },
  };
};

/* ── Main initializer ───────────────────────────────────── */

export const initializeAddBusModel = (root = document, options = {}) => {
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

  const isEditMode = !!options.busModel;
  const currentModel = options.busModel || {};

  const feedback = form.querySelector('[data-role="feedback"]');
  const cancelButton = form.querySelector('[data-action="cancel"]');
  const closeButton = section.querySelector('[data-action="close"]');

  /* ── Manufacturer autocomplete elements ── */
  const manufacturerInput = form.querySelector("#manufacturer");
  const manufacturerIdInput = form.querySelector("#manufacturer-id");
  const customManufacturerInput = form.querySelector("#custom_manufacturer");
  const manufacturerDropdown = form.querySelector(
    '[data-role="manufacturer-dropdown"]'
  );
  const manufacturerListEl = form.querySelector(
    '[data-role="manufacturer-list"]'
  );

  /* ── Model autocomplete elements ── */
  const modelInput = form.querySelector("#model");
  const modelIdInput = form.querySelector("#model-id");
  const modelDropdown = form.querySelector('[data-role="model-dropdown"]');
  const modelListEl = form.querySelector('[data-role="model-list"]');

  let isOtherManufacturer = false;
  let selectedManufacturerId = null;

  const hideCustomManufacturer = () => {
    if (!customManufacturerInput) return;
    customManufacturerInput.hidden = true;
    customManufacturerInput.value = "";
  };

  const showCustomManufacturer = (value = "") => {
    if (!customManufacturerInput) return;
    customManufacturerInput.hidden = false;
    customManufacturerInput.value = value;
  };

  const resetModel = () => {
    if (modelInput) modelInput.value = "";
    if (modelIdInput) modelIdInput.value = "";
    if (modelInput) {
      modelInput.disabled = true;
      modelInput.placeholder = "Select a model…";
    }
    isOtherManufacturer = false;
    selectedManufacturerId = null;
  };

  /* ── Model autocomplete (set up first so manufacturer onSelect can reference it) ── */
  let modelAutocomplete = null;
  if (modelInput && modelIdInput && modelDropdown && modelListEl) {
    modelAutocomplete = setupAutocomplete({
      input: modelInput,
      hiddenInput: modelIdInput,
      dropdown: modelDropdown,
      list: modelListEl,
      nameKey: "name",
      loadItems: async () => {
        if (isOtherManufacturer || !selectedManufacturerId) return [];
        try {
          const data = await fetchBusModelsByManufacturer(
            selectedManufacturerId
          );
          return normalizeList(data);
        } catch (err) {
          console.error("Failed to load models for manufacturer:", err);
          return [];
        }
      },
      canOpen: () => !isOtherManufacturer && !!selectedManufacturerId,
      shouldClearOnBlur: () =>
        !isOtherManufacturer && !modelIdInput.value && !!modelInput.value,
      onSelect: () => {},
    });
  }

  /* ── Manufacturer autocomplete ── */
  if (
    manufacturerInput &&
    manufacturerIdInput &&
    manufacturerDropdown &&
    manufacturerListEl
  ) {
    setupAutocomplete({
      input: manufacturerInput,
      hiddenInput: manufacturerIdInput,
      dropdown: manufacturerDropdown,
      list: manufacturerListEl,
      nameKey: "name",
      loadItems: async () => {
        try {
          const data = await fetchBusManufacturers();
          return normalizeList(data);
        } catch (err) {
          console.error("Failed to load bus manufacturers:", err);
          return [];
        }
      },
      shouldClearOnBlur: () =>
        !manufacturerIdInput.value && !!manufacturerInput.value,
      onClear: () => resetModel(),
      onSelect: (item) => {
        selectedManufacturerId = item.id;
        const itemName = (item.name || "").toLowerCase();
        isOtherManufacturer = itemName.includes("other");

        if (isOtherManufacturer) {
          showCustomManufacturer();
        } else {
          hideCustomManufacturer();
        }

        if (modelInput) {
          modelInput.value = "";
          modelInput.disabled = false;
          modelInput.placeholder = isOtherManufacturer
            ? "Type a model name…"
            : "Select a model…";
        }
        if (modelIdInput) modelIdInput.value = "";
        if (modelAutocomplete) modelAutocomplete.reset();
      },
    });

    // When user types in manufacturer, reset model (selection invalidated)
    const handleManufacturerInput = () => {
      hideCustomManufacturer();
      if (modelInput) {
        modelInput.value = "";
        modelInput.disabled = true;
        modelInput.placeholder = "Select a model…";
      }
      if (modelIdInput) modelIdInput.value = "";
      isOtherManufacturer = false;
      selectedManufacturerId = null;
      if (modelAutocomplete) modelAutocomplete.reset();
    };
    manufacturerInput.addEventListener("input", handleManufacturerInput);
    cleanupHandlers.push(() =>
      manufacturerInput.removeEventListener("input", handleManufacturerInput)
    );
  }

  /* ── Bus-length change → pre-fill defaults ── */
  const busLengthSelect = form.querySelector("#bus_length_m");
  if (busLengthSelect) {
    const handleLengthChange = () => {
      const defaults = getBusModelDefaultsForLength(busLengthSelect.value);
      if (!defaults) return;
      for (const [field, value] of Object.entries(defaults)) {
        const el = form.querySelector(`#${field}`);
        if (el) el.value = value;
      }
    };
    busLengthSelect.addEventListener("change", handleLengthChange);
    cleanupHandlers.push(() =>
      busLengthSelect.removeEventListener("change", handleLengthChange)
    );
  }

  /* ── Edit mode pre-fill ── */
  if (isEditMode) {
    if (header) {
      header.textContent = "Edit bus model";
    }

    const nameInput = form.querySelector("#name");
    const descriptionInput = form.querySelector("#description");
    const specs = parseSpecs(currentModel.specs);

    if (nameInput)
      nameInput.value = currentModel.name || currentModel.model || "";
    if (manufacturerInput) {
      manufacturerInput.value = currentModel.manufacturer || "";
      if (manufacturerIdInput) {
        manufacturerIdInput.value =
          currentModel.manufacturer_id || currentModel.manufacturer || "";
      }
    }

    // If the stored manufacturer is custom (not in the manufacturers list),
    // show it in the custom box while selecting "Other manufacturer".
    if (manufacturerInput && customManufacturerInput) {
      const storedManufacturer = (currentModel.manufacturer || "").trim();
      (async () => {
        try {
          const manufacturers = normalizeList(await fetchBusManufacturers());
          const names = new Set(
            manufacturers
              .map((m) => (m?.name || "").toString().trim().toLowerCase())
              .filter(Boolean)
          );
          const otherItem = manufacturers.find((m) =>
            (m?.name || "").toString().toLowerCase().includes("other")
          );

          if (!storedManufacturer) {
            hideCustomManufacturer();
            return;
          }

          const isInList = names.has(storedManufacturer.toLowerCase());
          if (isInList) {
            hideCustomManufacturer();
            return;
          }

          // Custom manufacturer: switch UI to "Other" and show stored value.
          isOtherManufacturer = true;
          selectedManufacturerId = otherItem?.id ?? null;
          if (manufacturerIdInput) {
            manufacturerIdInput.value = otherItem?.id ?? "";
          }
          manufacturerInput.value = otherItem?.name || "Other manufacturer";
          showCustomManufacturer(storedManufacturer);
        } catch (err) {
          // If detection fails, fall back to showing stored manufacturer in the main input.
          hideCustomManufacturer();
        }
      })();
    }
    const modelValue = specs.model_type || "";
    if (modelInput && modelValue) {
      modelInput.value = modelValue;
      modelInput.disabled = true;
      if (modelIdInput) {
        modelIdInput.value =
          currentModel.model_id || currentModel.model || "";
      }
    }
    if (descriptionInput)
      descriptionInput.value = currentModel.description || "";

    for (const field of SPEC_FIELDS) {
      const input = form.querySelector(`#${field}`);
      if (input && specs?.[field] != null) {
        input.value = specs[field];
      }
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
    const { name, manufacturer, model, description, specs } =
      toBusModelPayload(formData);

    if (!name) {
      updateFeedback(feedback, "Name is required.", "error");
      return;
    }

    const customManufacturer = customManufacturerInput?.value?.toString().trim();
    const manufacturerToSend =
      isOtherManufacturer && customManufacturer ? customManufacturer : manufacturer;

    if (isOtherManufacturer && !customManufacturer) {
      updateFeedback(
        feedback,
        "Please enter a custom manufacturer name.",
        "error"
      );
      return;
    }

    const requiredSpecs = [
      { key: "cost", label: "Cost (CHF)" },
      { key: "bus_length_m", label: "Bus length (m)" },
      { key: "max_passengers", label: "Max passengers" },
      { key: "empty_weight_kg", label: "Empty weight (kg)" },
      { key: "max_battery_packs", label: "Max battery packs" },
      { key: "min_battery_packs", label: "Min battery packs" },
      { key: "battery_pack_size_kwh", label: "Battery pack size (kWh)" },
      { key: "max_charging_power_kw", label: "Max charging power (kW)" },
      { key: "battery_pack_weight_kg", label: "Battery pack weight (kg)" },
      { key: "battery_pack_lifetime", label: "Battery pack lifetime (years)" },
      { key: "bus_lifetime", label: "Bus lifetime (years)" },
    ];

    for (const { key, label } of requiredSpecs) {
      if (specs[key] == null || isNaN(specs[key])) {
        updateFeedback(feedback, `${label} is required.`, "error");
        return;
      }
    }

    toggleFormDisabled(form, true);
    updateFeedback(feedback, isEditMode ? "Updating…" : "Saving…", "info");

    try {
      const userId = await resolveUserId();
      const mergedSpecs = { ...specs };
      if (model) {
        mergedSpecs.model_type = model;
      }
      mergedSpecs.auxiliary_consumption_kw = AUXILIARY_CONSUMPTION_KW_DEFAULTS;

      if (isEditMode) {
        await updateBusModel(currentModel.id, {
          name,
          manufacturer: manufacturerToSend,
          model,
          description,
          specs: mergedSpecs,
          userId,
        });
        writeFlash("Bus model updated.");
      } else {
        const createdModel = await createBusModel({
          name,
          manufacturer: manufacturerToSend,
          model,
          description,
          specs: mergedSpecs,
          userId,
        });

        const busName = generateBusNameFromModel(name, manufacturer);
        const busModelId = createdModel?.id;

        if (busModelId) {
          try {
            const createdBus = await createBus({
              name: busName,
              busModelId,
              description: `Auto-created bus for model: ${name}`,
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

        writeFlash("Bus model added (with associated bus).");
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
            ? "Unable to update bus model."
            : "Unable to save bus model."),
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
