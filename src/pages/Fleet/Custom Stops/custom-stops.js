import { t } from "../../../i18n";
import "./custom-stops.css";
import { deleteDepot, fetchDepots } from "../../../api";
import { resolveUserId } from "../../../api/session";
import { bindSelectAll } from "../../../dom/tables";
import { triggerPartialLoad } from "../../../events";

const text = (value) =>
  value === null || value === undefined ? "" : String(value);

const getSelectedIdsFrom = (container) =>
  Array.from(
    container?.querySelectorAll('tbody input[type="checkbox"]:checked') ?? []
  )
    .map((input) => input.closest("tr")?.dataset?.id)
    .filter(Boolean);

const renderRows = (tbody, depots = []) => {
  if (!tbody) {
    return;
  }

  if (!Array.isArray(depots) || depots.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td class="checkbox"></td>
                <td class="id" colspan="4">No custom stops found.</td>
            </tr>
        `;
    return;
  }

  const rows = depots
    .map(
      (depot = {}) => `
                <tr data-id="${text(depot?.id)}">
                    <td class="checkbox"><input type="checkbox" aria-label="Select custom stop"></td>
                    <td class="id">${text(depot?.id)}</td>
                    <td class="name">${text(depot?.name)}</td>
                    <td class="type">Depot</td>
                    <td class="address">${text(depot?.address)}</td>
                </tr>
            `
    )
    .join("");

  tbody.innerHTML = rows;
};

const renderLoading = (tbody) => {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
        <tr>
            <td class="checkbox"></td>
            <td class="id" colspan="4">Loading…</td>
        </tr>
    `;
};

const renderError = (tbody, message = "Unable to load custom stops.") => {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
        <tr>
            <td class="checkbox"></td>
            <td class="id" colspan="4">${text(message)}</td>
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
    return;
  }

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
  const addButton = section.querySelector(".custom-stops-header button");

  setFlashMessage(section, options.flashMessage ?? "");

  if (!table || !tbody) {
    return;
  }

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

    renderRows(tbody, filtered);
    bindSelectAll(headerCheckbox, table);
  };

  const reload = async () => {
    renderLoading(tbody);

    try {
      const [payload, userId] = await Promise.all([
        fetchDepots({ skip: 0, limit: 100 }),
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

      applyFilter();
    } catch (error) {
      console.error("Failed to load custom stops", error);
      renderError(tbody, error?.message ?? "Unable to load custom stops.");
    }
  };

  searchInput?.addEventListener("input", applyFilter);

  deleteButton?.addEventListener("click", async () => {
    const ids = getSelectedIdsFrom(table);
    if (!ids.length) {
      alert("Select at least one custom stop.");
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
      alert("Custom stop(s) deleted.");
      await reload();
    } catch (error) {
      console.error("Failed to delete custom stop(s)", error);
      alert(error?.message ?? "Unable to delete custom stop(s).");
    }
  });

  editButton?.addEventListener("click", async () => {
    const ids = getSelectedIdsFrom(table);
    if (ids.length !== 1) {
      alert(t("custom_stops.select_single"));
      return;
    }

    const id = ids[0];
    const current = allDepots.find((depot) => depot?.id === id) ?? {};

    triggerPartialLoad("add-custom-stop", { depot: current });
  });

  addButton?.addEventListener("click", () => {
    triggerPartialLoad("add-custom-stop");
  });

  bindSelectAll(headerCheckbox, table);
  await reload();
};
