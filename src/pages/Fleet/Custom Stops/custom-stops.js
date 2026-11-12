import { t } from "../../../i18n";
import "./custom-stops.css";
import { deleteDepot, fetchAllDepots, fetchDepotById } from "../../../api";
import {
  resolveCustomStopDeleteFailure,
} from "../../../utils/custom-stop-deletion";
import {
  formatBatchDeletionFeedback,
  settleBatchDeletion,
} from "../../../utils/batch-delete";
import { resolveUserId, isAuthenticated } from "../../../api/session";
import { bindSelectAll } from "../../../dom/tables";
import { triggerPartialLoad } from "../../../events";
import { textContent } from "../../../ui-helpers";
import {
  initializeEntityDetailsDialog,
  renderEntityRowActions,
} from "../../../dom/entity-details";

const text = (value) =>
  value === null || value === undefined ? "" : String(value);

const detailValue = (value) =>
  value === null || value === undefined || value === "" ? "—" : String(value);

const typeLabel = (type) => {
  const key = {
    depot: "custom_stops.type_depot",
    charging: "custom_stops.type_charging",
    hub: "custom_stops.type_hub",
  }[type];
  return key ? t(key) : detailValue(type);
};

export const buildCustomStopDetailGroups = (depot = {}) => [
  {
    title: t("custom_stops.information_heading"),
    rows: [
      {
        label: t("custom_stops.field_name"),
        value: detailValue(depot?.name),
      },
      {
        label: t("custom_stops.field_type"),
        value: typeLabel(depot?.features?.type),
      },
      {
        label: t("custom_stops.field_address"),
        value: detailValue(depot?.address),
      },
      {
        label: t("custom_stops.field_city"),
        value: detailValue(depot?.features?.city),
      },
      {
        label: t("custom_stops.field_notes"),
        value: detailValue(depot?.features?.notes),
      },
    ],
  },
  {
    title: t("custom_stops.location_heading"),
    rows: [
      {
        label: t("custom_stops.field_latitude"),
        value: detailValue(depot?.latitude),
      },
      {
        label: t("custom_stops.field_longitude"),
        value: detailValue(depot?.longitude),
      },
    ],
  },
];

const getSelectedIdsFrom = (container) =>
  Array.from(
    container?.querySelectorAll('tbody input[type="checkbox"]:checked') ?? []
  )
    .map((input) => input.closest("tr")?.dataset?.id)
    .filter(Boolean);

export const renderCustomStopRows = (tbody, depots = []) => {
  if (!tbody) {
    return;
  }

  if (!Array.isArray(depots) || depots.length === 0) {
    tbody.innerHTML = `
            <tr class="table-state-row">
                <td class="checkbox"></td>
                <td class="id table-state-cell table-empty" colspan="4">${textContent(t("custom_stops.no_stops_found"))}</td>
            </tr>
        `;
    return;
  }

  const rows = depots
    .map(
      (depot = {}) => {
        const actions = renderEntityRowActions({
          details: t("common.details"),
          duplicate: t("common.duplicate"),
          edit: t("common.edit"),
          remove: t("common.delete"),
        });
        return `
                <tr data-id="${textContent(depot?.id)}">
                    <td class="checkbox"><input type="checkbox" aria-label="${textContent(t("custom_stops.select_stop"))}"></td>

                    <td class="name">${textContent(depot?.name)}</td>
                    <td class="type">${textContent(typeLabel(depot?.features?.type))}</td>
                    <td class="address">${textContent(depot?.address)}</td>
                    <td class="actions">${actions}</td>
                </tr>
            `;
      }
    )
    .join("");

  tbody.innerHTML = rows;
};

const renderLoading = (tbody) => {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
        <tr class="table-state-row">
            <td class="checkbox"></td>
            <td class="id table-state-cell table-empty" colspan="4">${textContent(t("common.loading"))}</td>
        </tr>
    `;
};

const renderError = (tbody, message = t("custom_stops.unable_to_load")) => {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
        <tr class="table-state-row">
            <td class="checkbox"></td>
            <td class="id table-state-cell table-empty" colspan="4">${textContent(message)}</td>
        </tr>
    `;
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

export const initializeCustomStops = async (root = document, options = {}) => {
  const section = root.querySelector("section.custom-stops");
  if (!section) {
    return null;
  }

  const cleanupHandlers = [];

  const table = section.querySelector("table");
  const tbody = table?.querySelector("tbody");
  const headerCheckbox = table?.querySelector(
    'thead .checkbox input[type="checkbox"]'
  );
  const searchInput = section.querySelector(
    '.table-controls input[type="search"]'
  );
  const deleteButton = section.querySelector(
    '[data-action="delete-selected-stops"]'
  );
  const addButton = section.querySelector('[data-action="add-custom-stop"]');

  setFlashMessage(section, options.flashMessage ?? "");

  const detailsDialog = initializeEntityDetailsDialog(
    section.querySelector('[data-role="custom-stop-details-dialog"]')
  );
  if (detailsDialog) cleanupHandlers.push(() => detailsDialog.destroy());

  if (!table || !tbody) {
    return null;
  }

  let allDepots = [];
  const depotDetailsCache = new Map();
  const depotDetailRequests = new Map();

  const loadDepotDetail = async (id) => {
    const normalizedId = text(id);
    if (!normalizedId) throw new Error("Missing custom stop id");
    const cached =
      depotDetailsCache.get(normalizedId) ??
      allDepots.find((depot) => text(depot?.id) === normalizedId);
    if (cached?.features && cached?.latitude != null && cached?.longitude != null) {
      return cached;
    }

    let request = depotDetailRequests.get(normalizedId);
    if (!request) {
      request = fetchDepotById(normalizedId)
        .then((detail) => {
          depotDetailsCache.set(normalizedId, detail);
          return detail;
        })
        .finally(() => depotDetailRequests.delete(normalizedId));
      depotDetailRequests.set(normalizedId, request);
    }
    return request;
  };

  const applyFilter = () => {
    const query = (searchInput?.value ?? "").toLowerCase().trim();
    const filtered =
      query ?
        allDepots.filter(
          (depot = {}) =>
            text(depot?.name).toLowerCase().includes(query) ||
            text(depot?.address).toLowerCase().includes(query)
        )
      : allDepots;

    renderCustomStopRows(tbody, filtered);
    bindSelectAll(headerCheckbox, table);
  };

  const reload = async () => {
    renderLoading(tbody);

    // Check if user is authenticated before making API calls
    if (!isAuthenticated()) {
      const authMessage = t("custom_stops.login_required") || "Please login to view your custom stops.";
      renderError(tbody, authMessage);
      return;
    }

    try {
      const [payload, userId] = await Promise.all([
        fetchAllDepots(),
        resolveUserId().catch(() => null),
      ]);

      const depots =
        Array.isArray(payload) ? payload : (
          (payload?.items ?? payload?.results ?? [])
        );

      allDepots =
        userId && userId.length ?
          depots.filter((depot) => depot?.user_id === userId)
        : (depots ?? []);

      allDepots.forEach((depot) => {
        if (depot?.id) depotDetailsCache.set(text(depot.id), depot);
      });

      applyFilter();
    } catch (error) {
      console.error("Failed to load custom stops", error);
      renderError(tbody, error?.message ?? t("custom_stops.unable_to_load"));
    }
  };

  if (searchInput) {
    searchInput.addEventListener("input", applyFilter);
    cleanupHandlers.push(() => {
      searchInput.removeEventListener("input", applyFilter);
    });
  }

  const deleteStops = async (ids, actionButton) => {
    if (!ids.length) return;
    if (actionButton) actionButton.disabled = true;
    try {
      const confirmDelete = confirm(
        t("custom_stops.delete_confirm", { count: ids.length })
      );
      if (!confirmDelete) {
        return;
      }

      const result = await settleBatchDeletion(ids, deleteDepot);
      setFlashMessage(
        section,
        result.failedCount
          ? formatBatchDeletionFeedback(result, t, (error) =>
              resolveCustomStopDeleteFailure(error, t)
            )
          : t("custom_stops.deleted")
      );
      await reload();
    } catch (error) {
      const resolved = resolveCustomStopDeleteFailure(error, t);
      setFlashMessage(section, resolved.message);
    } finally {
      if (actionButton) actionButton.disabled = false;
    }
  };

  const handleDeleteClick = async () => {
    const ids = getSelectedIdsFrom(table);
    if (!ids.length) {
      setFlashMessage(section, t("custom_stops.select_min"));
      return;
    }
    await deleteStops(ids, deleteButton);
  };
  if (deleteButton) {
    deleteButton.addEventListener("click", handleDeleteClick);
    cleanupHandlers.push(() => {
      deleteButton.removeEventListener("click", handleDeleteClick);
    });
  }

  const handleAddClick = () => {
    triggerPartialLoad("add-custom-stop");
  };
  if (addButton) {
    addButton.addEventListener("click", handleAddClick);
    cleanupHandlers.push(() => {
      addButton.removeEventListener("click", handleAddClick);
    });
  }

  const handleRowAction = async (event) => {
    const button = event.target.closest("button[data-row-action]");
    if (!button || !table.contains(button)) return;
    const id = button.closest("tr")?.dataset?.id;
    if (!id) return;

    const action = button.dataset.rowAction;
    if (action === "delete") {
      await deleteStops([id], button);
      return;
    }

    button.disabled = true;
    try {
      const depot = await loadDepotDetail(id);
      if (action === "edit") {
        triggerPartialLoad("add-custom-stop", { depot });
      } else if (action === "duplicate") {
        triggerPartialLoad("add-custom-stop", {
          depot: {
            ...depot,
            name: `${depot?.name ?? ""} ${t("common.copy_suffix")}`.trim(),
          },
          duplicate: true,
        });
      } else if (action === "details") {
        detailsDialog?.open({
          title: t("custom_stops.details_title", {
            name: detailValue(depot?.name),
          }),
          groups: buildCustomStopDetailGroups(depot),
        });
      }
    } catch (error) {
      console.error("Failed to load custom stop detail", error);
      setFlashMessage(section, t("custom_stops.unable_to_load_details"));
    } finally {
      button.disabled = false;
    }
  };
  table.addEventListener("click", handleRowAction);
  cleanupHandlers.push(() => table.removeEventListener("click", handleRowAction));

  bindSelectAll(headerCheckbox, table);
  await reload();

  return () => {
    cleanupHandlers.forEach((handler) => handler());
  };
};
