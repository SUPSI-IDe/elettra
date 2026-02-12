import { t } from "../../../i18n";
import "./buses.css";
import { deleteBusModel, fetchBusModels, updateBusModel } from "../../../api";
import { resolveUserId } from "../../../api/session";
import {
  cacheCollections,
  getModelsById,
  readFlash,
  writeFlash,
} from "../../../store";
import {
  bindSelectAll,
  renderErrorRow,
  renderLoadingRow,
  renderModels,
  getSelectedIds,
  setFlashMessage,
} from "../../../dom/tables";
import { openSidePanel, getSidePanelRoot } from "../../../dom/side-panel";
import { triggerPartialLoad } from "../../../events";
import { resolveModelFields, textContent, escapeAttr, normalizeApiList } from "../../../ui-helpers";
import addBusModelTemplate from "./add-bus-model.html?raw"; // Use ?raw to import HTML string
import { initializeAddBusModel } from "./add-bus-model";

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
        return `<option value="${escapeAttr(model.id)}">${textContent(
          `${name}${suffix}`,
        )}</option>`;
      }),
  ].join("");

  select.innerHTML = options;
};

const initializeModelControls = (section, cleanupHandlers) => {
  const controls = section.querySelector(
    ".bus-models .table-controls .actions",
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
    const selectedIds = getSelectedIds(
      section.querySelector(".bus-models table"),
    );
    if (!selectedIds.length) {
      console.error(t("buses.select_min_model"));
      return;
    }

    if (action === "delete-selected-models") {
      const confirmDelete = confirm(
        t("buses.delete_confirm_models", { count: selectedIds.length }),
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
        openSidePanel(addBusModelTemplate);
        const panelRoot = getSidePanelRoot();
        const cleanup = initializeAddBusModel(panelRoot, { busModel: current });
        // We push cleanup to handlers but we might need to handle cleanup on panel close specifically if we want to be clean.
        // For now, global cleanup works but it might accumulate if not careful.
        // Better: initializeAddBusModel manages its own lifecycle or we need a way to cleanup when panel closes.
        // Assuming initializeAddBusModel returns a cleanup that removes its own listeners.
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
    'thead .checkbox input[type="checkbox"]',
  );

  const message = options.flashMessage ?? readFlash();
  setFlashMessage(section, message);

  const addModelButton = section.querySelector('[data-action="add-bus-model"]');
  const handleAddModelClick = () => {
    openSidePanel(addBusModelTemplate);
    const panelRoot = getSidePanelRoot();
    const cleanup = initializeAddBusModel(panelRoot);
    if (cleanup) {
      cleanupHandlers.push(cleanup);
    }
  };
  addModelButton?.addEventListener("click", handleAddModelClick);
  if (addModelButton) {
    cleanupHandlers.push(() => {
      addModelButton.removeEventListener("click", handleAddModelClick);
    });
  }

  renderLoadingRow(modelsTbody);

  try {
    const [modelsPayload] = await Promise.all([
      fetchBusModels({ skip: 0, limit: 100 }),
    ]);

    const models = normalizeApiList(modelsPayload);

    cacheCollections({ models });

    renderModels(modelsTbody, models);

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
