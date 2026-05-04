import { t } from "../../../i18n";
import "./buses.css";
import {
  deleteBusModel,
  fetchAllBusModels,
  fetchBusModels,
  fetchBusModelById,
} from "../../../api";
import { isAuthenticated, resolveUserId } from "../../../api/session";
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
import { installPaginationControl } from "../../../dom/pagination";
import { DEFAULT_PAGE_SIZE } from "../../../api/pagination";
import { triggerPartialLoad } from "../../../events";

const text = (value) => (value === null || value === undefined ? "" : String(value));

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
      const cached = getModelsById()[id] ?? null;

      // The list endpoint is lightweight — fetch full specs before
      // handing the bus model off to the edit form so existing values
      // show up correctly.
      let busModel = cached;
      if (!cached?.specs) {
        try {
          busModel = await fetchBusModelById(id);
        } catch (error) {
          console.error("Failed to load bus model detail", error);
        }
      }

      if (busModel) {
        triggerPartialLoad("add-bus-model", { busModel });
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

  // ── Pagination state ──────────────────────────────────────────────
  let skip = 0;
  let limit = DEFAULT_PAGE_SIZE;
  let pendingHydrationToken = 0;
  const specsCache = new Map();
  let cachedUserId = "";

  const paginationContainer = section.querySelector(
    '[data-role="bus-models-pagination"]'
  );
  const pagination = installPaginationControl(paginationContainer, {
    onPageChange: (nextSkip) => {
      skip = Math.max(0, nextSkip);
      void load();
    },
    onPageSizeChange: (nextLimit) => {
      limit = nextLimit;
      skip = 0;
      void load();
    },
  });
  if (pagination) {
    cleanupHandlers.push(() => pagination.destroy());
  }

  // ── Hydrate specs for the visible rows ────────────────────────────
  // The list endpoint only returns lightweight items; we lazily fetch
  // each model's full specs so the existing table columns (size, cost,
  // battery pack, etc.) keep working without re-downloading everything.
  const hydrateSpecs = async (models, token) => {
    const targets = models.filter((model) => model?.id && !model?.specs);
    await Promise.allSettled(
      targets.map(async (model) => {
        const id = text(model.id);
        if (!id) return;
        try {
          let detail = specsCache.get(id);
          if (!detail) {
            detail = await fetchBusModelById(id);
            specsCache.set(id, detail);
          }
          if (token !== pendingHydrationToken) return;
          Object.assign(model, detail);
        } catch (error) {
          console.warn(`Failed to load detail for bus model ${id}`, error);
        }
      })
    );
    if (token === pendingHydrationToken) {
      renderModels(modelsTbody, models);
      bindSelectAll(modelsHeaderCheckbox, modelsTable);
    }
  };

  const load = async () => {
    renderLoadingRow(modelsTbody);
    pagination?.setBusy(true);

    if (!isAuthenticated()) {
      const authMessage =
        t("buses.login_required") || "Please login to view your fleet data.";
      renderErrorRow(modelsTbody, authMessage);
      pagination?.setBusy(false);
      return;
    }

    try {
      if (!cachedUserId) {
        cachedUserId = text(
          (await resolveUserId().catch(() => "")) || getCurrentUserId()
        ).trim();
      }

      const currentUserId = cachedUserId;
      if (!currentUserId) {
        throw new Error("Unable to resolve current user.");
      }
      const envelope = await fetchBusModels({
        skip,
        limit,
        userId: currentUserId,
      });
      const items = Array.isArray(envelope?.items) ? envelope.items : [];

      const pageItems =
        currentUserId && items.length
          ? items.filter((model) => text(model?.user_id) === currentUserId)
          : items;

      let pageEnvelope = envelope;
      let visibleModels = pageItems;

      if (currentUserId && pageItems.length !== items.length) {
        // Some environments still return unscoped pages even when user_id
        // is sent. If we filter only the current backend page, the user can
        // see too few owned models. Page through with valid page sizes,
        // filter locally, then paginate the filtered result in the UI.
        const ownedModels = (await fetchAllBusModels({ userId: currentUserId }))
          .filter((model) => text(model?.user_id) === currentUserId);
        visibleModels = ownedModels.slice(skip, skip + limit);
        pageEnvelope = {
          items: visibleModels,
          total: ownedModels.length,
          skip,
          limit,
          count: visibleModels.length,
          has_next: skip + limit < ownedModels.length,
          has_previous: skip > 0,
        };
      }

      const sortedModels = [...visibleModels].sort((a, b) => {
        const left = String(a?.name ?? "").toLocaleLowerCase();
        const right = String(b?.name ?? "").toLocaleLowerCase();
        return left.localeCompare(right);
      });

      cacheCollections({ models: sortedModels, buses: [], owned: [] });

      renderModels(modelsTbody, sortedModels);
      bindSelectAll(modelsHeaderCheckbox, modelsTable);
      initializeModelControls(section, cleanupHandlers);

      pagination?.update(pageEnvelope);

      pendingHydrationToken += 1;
      const token = pendingHydrationToken;
      void hydrateSpecs(sortedModels, token);
    } catch (error) {
      console.error("Failed to load bus models", error);
      renderErrorRow(
        modelsTbody,
        error?.message ?? t("buses.unable_to_load_models")
      );
    } finally {
      pagination?.setBusy(false);
    }
  };

  await load();

  return () => {
    cleanupHandlers.forEach((handler) => handler());
  };
};
