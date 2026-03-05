import { t } from "../../../i18n";
import "./custom-stops.css";
import { deleteDepot, fetchDepots } from "../../../api";
import { resolveUserId } from "../../../api/session";
import {
  bindSelectAll,
  renderStatusRow,
  getSelectedIds,
  setFlashMessage,
} from "../../../dom/tables";
import { triggerPartialLoad } from "../../../events";
import { text, escapeHtml, escapeAttr, normalizeApiList } from "../../../ui-helpers";
import { createTablePagination } from "../../../dom/pagination";

const STOPS_COLSPAN = 3;

const renderRows = (tbody, depots = []) => {
  if (!tbody) {
    return;
  }

  if (!Array.isArray(depots) || depots.length === 0) {
    renderStatusRow(tbody, "No custom stops found.", STOPS_COLSPAN);
    return;
  }

  const rows = depots
    .map(
      (depot = {}) => `
                <tr data-id="${escapeAttr(depot?.id)}">
                    <td class="checkbox"><input type="checkbox" aria-label="Select custom stop"></td>

                    <td class="name">${escapeHtml(depot?.name)}</td>
                    <td class="type">Depot</td>
                    <td class="address">${escapeHtml(depot?.address)}</td>
                </tr>
            `
    )
    .join("");

  tbody.innerHTML = rows;
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
  const editButton = section.querySelector(
    '[data-action="edit-selected-stops"]'
  );
  const addButton = section.querySelector('[data-action="add-custom-stop"]');

  setFlashMessage(section, options.flashMessage ?? "");

  if (!table || !tbody) {
    return null;
  }

  const mainEl = section.querySelector(".custom-stops-main");
  const pagination = createTablePagination(mainEl, {
    tableWrapper: ".table-wrapper",
    table: "table",
    paginationContainer: '[data-role="pagination"]',
    renderRows: (visibleDepots) => renderRows(tbody, visibleDepots),
    onPageRender: () => bindSelectAll(headerCheckbox, table),
    defaultPerPage: 6,
  });
  cleanupHandlers.push(() => pagination.destroy());

  let allDepots = [];

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

    pagination.update(filtered);
  };

  const reload = async () => {
    renderStatusRow(tbody, "Loading…", STOPS_COLSPAN);

    try {
      const [payload, userId] = await Promise.all([
        fetchDepots({ skip: 0, limit: 100 }),
        resolveUserId().catch(() => null),
      ]);

      const depots = normalizeApiList(payload);

      allDepots =
        userId && userId.length ?
          depots.filter((depot) => depot?.user_id === userId)
        : (depots ?? []);

      applyFilter();
    } catch (error) {
      console.error("Failed to load custom stops", error);
      renderStatusRow(tbody, error?.message ?? "Unable to load custom stops.", STOPS_COLSPAN);
    }
  };

  if (searchInput) {
    searchInput.addEventListener("input", applyFilter);
    cleanupHandlers.push(() => {
      searchInput.removeEventListener("input", applyFilter);
    });
  }

  const handleDeleteClick = async () => {
    const ids = getSelectedIds(table);
    if (!ids.length) {
      console.error("Select at least one custom stop.");
      return;
    }

    const confirmDelete = confirm(
      t("custom_stops.delete_confirm", { count: ids.length })
    );
    if (!confirmDelete) {
      return;
    }

    try {
      await Promise.all(ids.map((id) => deleteDepot(id)));
      console.log("Custom stop(s) deleted.");
      await reload();
    } catch (error) {
      console.error("Failed to delete custom stop(s)", error);
    }
  };
  if (deleteButton) {
    deleteButton.addEventListener("click", handleDeleteClick);
    cleanupHandlers.push(() => {
      deleteButton.removeEventListener("click", handleDeleteClick);
    });
  }

  const handleEditClick = async () => {
    const ids = getSelectedIds(table);
    if (ids.length !== 1) {
      console.error(t("custom_stops.select_single"));
      return;
    }

    const id = ids[0];
    const current = allDepots.find((depot) => depot?.id === id) ?? {};

    triggerPartialLoad("add-custom-stop", { depot: current });
  };
  if (editButton) {
    editButton.addEventListener("click", handleEditClick);
    cleanupHandlers.push(() => {
      editButton.removeEventListener("click", handleEditClick);
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

  bindSelectAll(headerCheckbox, table);
  await reload();

  return () => {
    cleanupHandlers.forEach((handler) => handler());
  };
};
