import { t } from "../../../i18n";
import "./buses.css";
import {
  deleteBusModel,
  fetchAllBusModels,
  fetchBusModels,
  fetchBusModelById,
} from "../../../api";
import {
  resolveBusModelDeleteFailure,
} from "../../../utils/bus-model-deletion";
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
import {
  formatBatchDeletionFeedback,
  settleBatchDeletion,
} from "../../../utils/batch-delete";
import { inferVehicleCategoryFromSpecs } from "../../../config/vehicle-categories";
import { initializeEntityDetailsDialog } from "../../../dom/entity-details";

const text = (value) => (value === null || value === undefined ? "" : String(value));

const parseSpecs = (specs) => {
  if (!specs) return {};
  if (typeof specs === "object" && !Array.isArray(specs)) return specs;
  if (typeof specs !== "string") return {};
  try {
    const parsed = JSON.parse(specs);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
};

const detailValue = (value) => {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
};

export const buildBusModelDetailGroups = (busModel = {}) => {
  const specs = parseSpecs(busModel?.specs);
  const category = inferVehicleCategoryFromSpecs(specs);
  const categoryLabelKey = category?.labelI18nKey;
  const categoryLabel = categoryLabelKey
    ? t(categoryLabelKey)
    : specs?.model_type ?? busModel?.model;

  return [
    {
      title: t("buses.section_general_info"),
      rows: [
        { label: t("buses.model_name"), value: detailValue(busModel?.name) },
        {
          label: t("buses.vehicle_category"),
          value: detailValue(categoryLabel),
        },
        {
          label: t("buses.field_description"),
          value: detailValue(busModel?.description),
        },
      ],
    },
    {
      title: t("buses.section_vehicle_specs"),
      rows: [
        {
          label: t("buses.field_bus_length"),
          value: detailValue(specs?.bus_length_m),
        },
        { label: t("buses.field_cost"), value: detailValue(specs?.cost) },
        {
          label: t("buses.field_passenger_capacity"),
          value: detailValue(
            specs?.passenger_capacity ?? specs?.max_passengers
          ),
        },
        {
          label: t("buses.field_empty_weight"),
          value: detailValue(specs?.empty_weight_kg),
        },
        {
          label: t("buses.field_bus_lifetime"),
          value: detailValue(specs?.bus_lifetime),
        },
      ],
    },
    {
      title: t("buses.section_battery_system"),
      rows: [
        {
          label: t("buses.field_min_battery_packs"),
          value: detailValue(specs?.min_battery_packs),
        },
        {
          label: t("buses.field_max_battery_packs"),
          value: detailValue(specs?.max_battery_packs),
        },
        {
          label: t("buses.field_battery_pack_size"),
          value: detailValue(specs?.battery_pack_size_kwh),
        },
        {
          label: t("buses.field_battery_pack_cost"),
          value: detailValue(specs?.battery_pack_cost_chf),
        },
        {
          label: t("buses.field_max_charging_power"),
          value: detailValue(specs?.max_charging_power_kw),
        },
        {
          label: t("buses.field_battery_pack_weight"),
          value: detailValue(specs?.battery_pack_weight_kg),
        },
        {
          label: t("buses.field_battery_pack_lifetime"),
          value: detailValue(specs?.battery_pack_lifetime),
        },
      ],
    },
  ];
};

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

const initializeModelControls = (
  section,
  cleanupHandlers,
  { deleteModels }
) => {
  const controls = section.querySelector(
    ".table-controls .actions"
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
      setFlashMessage(section, t("buses.select_min_model"));
      return;
    }

    if (action === "delete-selected-models") {
      await deleteModels(selectedIds, actionButton);
      return;
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

  const detailsDialog = initializeEntityDetailsDialog(
    section.querySelector('[data-role="bus-model-details-dialog"]')
  );
  if (detailsDialog) cleanupHandlers.push(() => detailsDialog.destroy());

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
  const modelDetailsCache = new Map();
  const modelDetailRequests = new Map();
  let cachedUserId = "";

  const loadBusModelDetail = async (id) => {
    const normalizedId = text(id);
    if (!normalizedId) throw new Error("Missing model id");

    const cached =
      modelDetailsCache.get(normalizedId) ?? getModelsById()[normalizedId];
    if (cached?.specs) return cached;

    let request = modelDetailRequests.get(normalizedId);
    if (!request) {
      request = fetchBusModelById(normalizedId)
        .then((detail) => {
          modelDetailsCache.set(normalizedId, detail);
          return detail;
        })
        .finally(() => modelDetailRequests.delete(normalizedId));
      modelDetailRequests.set(normalizedId, request);
    }
    return request;
  };

  const deleteModels = async (selectedIds, actionButton) => {
    if (!selectedIds.length) return;
    if (actionButton) actionButton.disabled = true;
    try {
      if (!confirm(t("buses.delete_confirm_models", { count: selectedIds.length }))) {
        return;
      }
      const result = await settleBatchDeletion(selectedIds, deleteBusModel);
      const deletionMessage = result.failedCount
        ? formatBatchDeletionFeedback(result, t, (error) =>
            resolveBusModelDeleteFailure(error, t)
          )
        : t("buses.deleted_models");
      writeFlash(deletionMessage);
      triggerPartialLoad("buses");
    } catch (error) {
      const resolved = resolveBusModelDeleteFailure(error, t);
      setFlashMessage(section, resolved.message);
    } finally {
      if (actionButton) actionButton.disabled = false;
    }
  };

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
  // The list endpoint only returns lightweight items; hydrate the visible
  // rows so category and size remain available in the compact table. The
  // same cache supplies the detail and edit actions without duplicate calls.
  const hydrateSpecs = async (models, token) => {
    const targets = models.filter((model) => model?.id && !model?.specs);
    await Promise.allSettled(
      targets.map(async (model) => {
        const id = text(model.id);
        if (!id) return;
        try {
          const detail = await loadBusModelDetail(id);
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
      initializeModelControls(section, cleanupHandlers, {
        deleteModels,
      });

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

  const handleRowAction = async (event) => {
    const button = event.target.closest("button[data-row-action]");
    if (!button || !modelsTable?.contains(button)) return;
    const id = button.closest("tr")?.dataset?.id;
    if (!id) return;

    const action = button.dataset.rowAction;
    if (action === "delete") {
      await deleteModels([id], button);
      return;
    }

    button.disabled = true;
    try {
      const busModel = await loadBusModelDetail(id);
      if (action === "edit") {
        triggerPartialLoad("add-bus-model", { busModel });
      } else if (action === "duplicate") {
        triggerPartialLoad("add-bus-model", {
          busModel: {
            ...busModel,
            name: `${busModel?.name ?? ""} ${t("common.copy_suffix")}`.trim(),
          },
          duplicate: true,
        });
      } else if (action === "details") {
        detailsDialog?.open({
          title: t("buses.details_title", {
            name: detailValue(busModel?.name),
          }),
          groups: buildBusModelDetailGroups(busModel),
        });
      }
    } catch (error) {
      console.error("Failed to load bus model detail", error);
      setFlashMessage(section, t("buses.unable_to_load_model_details"));
    } finally {
      button.disabled = false;
    }
  };

  modelsTable?.addEventListener("click", handleRowAction);
  if (modelsTable) {
    cleanupHandlers.push(() =>
      modelsTable.removeEventListener("click", handleRowAction)
    );
  }

  await load();

  return () => {
    cleanupHandlers.forEach((handler) => handler());
  };
};
