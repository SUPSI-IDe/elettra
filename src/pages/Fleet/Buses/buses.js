import { t } from "../../../i18n";
import "./buses.css";
import {
  deleteBusModel,
  fetchBusModels,
} from "../../../api";
import { isAuthenticated } from "../../../api/session";
import {
  cacheCollections,
  getCurrentUserId,
  getModelsById,
  readFlash,
  writeFlash,
} from "../../../store";
import {
  bindSelectAll,
  renderErrorRow,
  renderLoadingRow,
  renderModels,
} from "../../../dom/tables";
import { triggerPartialLoad } from "../../../events";

const getSelectedIdsFrom = (container) =>
  Array.from(
    container?.querySelectorAll('input[type="checkbox"]:checked') ?? []
  )
    .map((input) => input.closest("tr")?.dataset?.id)
    .filter(Boolean);

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

export const initializeBuses = async (root = document, options = {}) => {
  const section = root.querySelector("section.buses");
  if (!section) {
    return null;
  }

  const cleanupHandlers = [];

  const modelsTable = section.querySelector(".bus-models table");
  const modelsTbody = modelsTable?.querySelector("tbody");

  const modelsHeaderCheckbox = modelsTable?.querySelector(
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

  // Check if user is authenticated before making API calls
  if (!isAuthenticated()) {
    const authMessage = t("buses.login_required") || "Please login to view your fleet data.";
    renderErrorRow(modelsTbody, authMessage);
    return () => {
      cleanupHandlers.forEach((handler) => handler());
    };
  }

  try {
    const modelsPayload = await fetchBusModels({ skip: 0, limit: 100 });

    const models =
      Array.isArray(modelsPayload) ? modelsPayload : (
        (modelsPayload?.items ?? modelsPayload?.results ?? [])
      );

    const currentUserId = getCurrentUserId() ?? "";

    // Filter bus models by user_id to ensure data isolation between users
    const userModels =
      currentUserId && Array.isArray(models) ?
        models.filter((model) => model?.user_id === currentUserId)
      : (models ?? []);

    cacheCollections({ models: userModels, buses: [], owned: [] });

    renderModels(modelsTbody, userModels);

    bindSelectAll(modelsHeaderCheckbox, modelsTable);

    initializeModelControls(section, cleanupHandlers);
  } catch (error) {
    console.error("Failed to load bus models", error);
    renderErrorRow(modelsTbody, error?.message ?? "Unable to load bus models.");
  }

  return () => {
    cleanupHandlers.forEach((handler) => handler());
  };
};
