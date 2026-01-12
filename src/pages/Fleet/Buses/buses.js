import { t } from "../../../i18n";
import "./buses.css";
import {
  createBus,
  deleteBus,
  deleteBusModel,
  fetchBusModels,
  fetchBuses,
  updateBus,
  updateBusModel,
} from "../../../api";
import { resolveUserId } from "../../../api/session";
import {
  addOwnedBus,
  cacheCollections,
  getBusesById,
  getCurrentUserId,
  getModelsById,
  nextBusName,
  readFlash,
  setOwnedBuses,
  writeFlash,
} from "../../../store";
import {
  bindSelectAll,
  renderBusesErrorRow,
  renderBusesList,
  renderBusesLoadingRow,
  renderErrorRow,
  renderLoadingRow,
  renderModels,
} from "../../../dom/tables";
import { triggerPartialLoad } from "../../../events";
import { resolveModelFields, textContent } from "../../../ui-helpers";

const renderModelFilter = (select, models = []) => {
  if (!select) {
    return;
  }

  const options = [
    `<option value="">${t("buses.all_models")}</option>`,
    ...models
      .filter((model) => model?.id)
      .map((model) => {
        const { model: label, manufacturer } = resolveModelFields(model);
        const name = label || "Untitled model";
        const suffix = manufacturer ? ` — ${manufacturer}` : "";
        return `<option value="${String(model.id)}">${textContent(
          `${name}${suffix}`
        )}</option>`;
      }),
  ].join("");

  select.innerHTML = options;
};

const getSelectedIdsFrom = (container) =>
  Array.from(
    container?.querySelectorAll('input[type="checkbox"]:checked') ?? []
  )
    .map((input) => input.closest("tr")?.dataset?.id)
    .filter(Boolean);

const bindBusModelActions = (tbody, cleanupHandlers) => {
  if (!tbody || tbody.dataset.busActionsBound === "true") {
    return;
  }

  const handleBusModelsClick = async (event) => {
    const button = event.target.closest('button[data-action="add-bus"]');
    if (!button || button.disabled) {
      return;
    }

    const busModelId = button.dataset.busModelId?.trim();
    if (!busModelId) {
      console.error("Missing bus model reference.");
      return;
    }

    const name = nextBusName();

    const previousLabel = button.textContent;
    button.disabled = true;
    button.textContent = "Adding…";

    try {
      const userId = await resolveUserId();
      await createBus({
        name,
        busModelId,
        userId,
        specs: {},
      });
      addOwnedBus({ name, bus_model_id: busModelId, user_id: userId });
      writeFlash(t("buses.added_bus") || "Bus added.");
      triggerPartialLoad("buses");
    } catch (error) {
      console.error("Failed to create bus", error);
      button.disabled = false;
      button.textContent = previousLabel;
    }
  };

  tbody.addEventListener("click", handleBusModelsClick);
  tbody.dataset.busActionsBound = "true";

  cleanupHandlers.push(() => {
    tbody.removeEventListener("click", handleBusModelsClick);
    delete tbody.dataset.busActionsBound;
  });
};

const setFlashMessage = (section, message) => {
  const flashElement = section.querySelector('[data-role="flash"]');
  if (!flashElement) {
    return;
  }

  if (message) {
    flashElement.textContent = message;
    flashElement.hidden = false;
  } else {
    flashElement.textContent = "";
    flashElement.hidden = true;
  }
};

const initializeModelControls = (section, cleanupHandlers) => {
  const controls = section.querySelector(
    ".bus-models .table-controls .actions"
  );
  if (!controls || controls.dataset.bound === "true") {
    return;
  }

  const handleControlsClick = async (event) => {
    const actionButton = event.target.closest("button[data-action]");
    if (!actionButton) {
      return;
    }
    const action = actionButton.dataset.action;
    const selectedIds = getSelectedIdsFrom(
      section.querySelector(".bus-models table")
    );
    if (!selectedIds.length) {
      console.error(t("buses.select_min_model"));
      return;
    }

    if (action === "delete-selected-models") {
      const confirmDelete = confirm(
        t("buses.delete_confirm_models", { count: selectedIds.length })
      );
      if (!confirmDelete) {
        return;
      }
      try {
        await Promise.all(selectedIds.map((id) => deleteBusModel(id)));
        writeFlash(t("buses.deleted_models"));
        triggerPartialLoad("buses");
      } catch (error) {
        console.error("Failed to delete bus model(s)", error);
      }
      return;
    }

    if (action === "edit-selected-model") {
      if (selectedIds.length !== 1) {
        console.error(t("buses.select_single_model"));
        return;
      }
      const id = selectedIds[0];
      const current = getModelsById()[id] ?? null;

      if (current) {
        triggerPartialLoad("add-bus-model", { busModel: current });
      }
    }
  };

  controls.dataset.bound = "true";
  controls.addEventListener("click", handleControlsClick);

  cleanupHandlers.push(() => {
    controls.removeEventListener("click", handleControlsClick);
    delete controls.dataset.bound;
  });
};

const initializeBusControls = (section, cleanupHandlers) => {
  const controls = section.querySelector(
    ".buses-list .table-controls .actions"
  );
  if (!controls || controls.dataset.bound === "true") {
    return;
  }

  const handleControlsClick = async (event) => {
    const actionButton = event.target.closest("button[data-action]");
    if (!actionButton) {
      return;
    }
    const action = actionButton.dataset.action;
    const selectedIds = getSelectedIdsFrom(
      section.querySelector(".buses-list table")
    );
    if (!selectedIds.length) {
      console.error(t("buses.select_min_bus"));
      return;
    }

    if (action === "delete-selected-buses") {
      const confirmDelete = confirm(
        t("buses.delete_confirm_buses", { count: selectedIds.length })
      );
      if (!confirmDelete) {
        return;
      }
      try {
        await Promise.all(selectedIds.map((id) => deleteBus(id)));
        writeFlash(t("buses.deleted_buses"));
        triggerPartialLoad("buses");
      } catch (error) {
        console.error("Failed to delete bus(es)", error);
      }
      return;
    }

    if (action === "edit-selected-bus") {
      if (selectedIds.length !== 1) {
        console.error(t("buses.select_single_bus"));
        return;
      }
      const id = selectedIds[0];
      const current = getBusesById()[id] ?? null;

      if (current) {
        triggerPartialLoad("add-bus", { bus: current });
      }
    }
  };

  controls.dataset.bound = "true";
  controls.addEventListener("click", handleControlsClick);

  cleanupHandlers.push(() => {
    controls.removeEventListener("click", handleControlsClick);
    delete controls.dataset.bound;
  });
};

export const initializeBuses = async (root = document, options = {}) => {
  const section = root.querySelector("section.buses");
  if (!section) {
    return null;
  }

  const cleanupHandlers = [];

  const modelsTable = section.querySelector(".bus-models table");
  const busesTable = section.querySelector(".buses-list table");
  const modelsTbody = modelsTable?.querySelector("tbody");
  const busesTbody = busesTable?.querySelector("tbody");
  const modelFilter = section.querySelector("#model-filter");

  bindBusModelActions(modelsTbody, cleanupHandlers);

  const modelsHeaderCheckbox = modelsTable?.querySelector(
    'thead .checkbox input[type="checkbox"]'
  );
  const busesHeaderCheckbox = busesTable?.querySelector(
    'thead .checkbox input[type="checkbox"]'
  );

  const message = options.flashMessage ?? readFlash();
  setFlashMessage(section, message);

  const addModelButton = section.querySelector('[data-action="add-bus-model"]');
  const handleAddModelClick = () => {
    triggerPartialLoad("add-bus-model");
  };
  addModelButton?.addEventListener("click", handleAddModelClick);
  if (addModelButton) {
    cleanupHandlers.push(() => {
      addModelButton.removeEventListener("click", handleAddModelClick);
    });
  }

  renderLoadingRow(modelsTbody);
  renderBusesLoadingRow(busesTbody);

  try {
    const [modelsPayload, busesPayload, userId] = await Promise.all([
      fetchBusModels({ skip: 0, limit: 100 }),
      fetchBuses({ skip: 0, limit: 100 }),
      resolveUserId().catch(() => null),
    ]);

    const models =
      Array.isArray(modelsPayload) ? modelsPayload : (
        (modelsPayload?.items ?? modelsPayload?.results ?? [])
      );
    const buses =
      Array.isArray(busesPayload) ? busesPayload : (
        (busesPayload?.items ?? busesPayload?.results ?? [])
      );

    const currentUserId = userId ?? getCurrentUserId() ?? "";
    const userBuses =
      currentUserId && Array.isArray(buses) ?
        buses.filter((bus) => bus?.user_id === currentUserId)
      : (buses ?? []);

    setOwnedBuses(userBuses);
    cacheCollections({ models, buses, owned: userBuses });

    renderModels(modelsTbody, models);
    if (modelFilter) {
      renderModelFilter(modelFilter, models);
    }

    const modelsById = getModelsById();

    const applyBusFilter = (modelId = "") => {
      const filtered =
        modelId && Array.isArray(userBuses) ?
          userBuses.filter((bus) => bus?.bus_model_id === modelId)
        : userBuses;
      renderBusesList(busesTbody, filtered, modelsById);
    };

    bindSelectAll(modelsHeaderCheckbox, modelsTable);
    bindSelectAll(busesHeaderCheckbox, busesTable);

    initializeModelControls(section, cleanupHandlers);
    initializeBusControls(section, cleanupHandlers);

    if (modelFilter) {
      modelFilter.value = "";
      const handleFilterChange = (event) => {
        applyBusFilter(event.target.value ?? "");
      };
      modelFilter.addEventListener("change", handleFilterChange);
      cleanupHandlers.push(() => {
        modelFilter.removeEventListener("change", handleFilterChange);
      });
    }

    applyBusFilter("");
  } catch (error) {
    console.error("Failed to load bus models", error);
    renderErrorRow(modelsTbody, error?.message ?? "Unable to load bus models.");
    renderBusesErrorRow(busesTbody, error?.message ?? "Unable to load buses.");
  }

  return () => {
    cleanupHandlers.forEach((handler) => handler());
  };
};
