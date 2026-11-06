import {
  resolveBusModelDisplayName,
  resolveModelFields,
  textContent,
} from "../ui-helpers";
import { t } from "../i18n";
import { inferVehicleCategoryFromSpecs } from "../config/vehicle-categories";
import { renderEntityRowActions } from "./entity-details";

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

export const renderLoadingRow = (tbody) => {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
        <tr class="table-state-row">
            <td class="checkbox"></td>
            <td class="model table-state-cell table-empty" colspan="4">${textContent(t("common.loading"))}</td>
        </tr>
    `;
};

export const renderErrorRow = (
  tbody,
  message = t("buses.unable_to_load_models")
) => {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
        <tr class="table-state-row">
            <td class="checkbox"></td>
            <td class="model table-state-cell table-empty" colspan="4">${textContent(message)}</td>
        </tr>
    `;
};

export const renderModels = (tbody, models = []) => {
  if (!tbody) {
    return;
  }

  if (!Array.isArray(models) || models.length === 0) {
    tbody.innerHTML = `
            <tr class="table-state-row">
                <td class="checkbox"></td>
                <td class="model table-state-cell table-empty" colspan="4">${textContent(t("buses.no_models"))}</td>
            </tr>
        `;
    return;
  }

  const rows = models
    .map((raw) => {
      const specs = parseSpecs(raw?.specs);
      const vehicleCategory = inferVehicleCategoryFromSpecs(specs);
      const name = textContent(raw?.name ?? "");
      const categoryLabel = textContent(
        vehicleCategory?.labelI18nKey
          ? t(vehicleCategory.labelI18nKey)
          : specs?.model_type ?? raw?.model ?? ""
      );
      const size = textContent(specs?.bus_length_m ?? "");
      const actions = renderEntityRowActions({
        details: t("common.details"),
        edit: t("common.edit"),
        remove: t("common.delete"),
      });

      return `
                <tr data-id="${textContent(raw?.id ?? "")}">
                    <td class="checkbox"><input type="checkbox" aria-label="${textContent(t("buses.select_bus_model"))}"></td>
                    <td class="name">${name}</td>
                    <td class="model">${categoryLabel}</td>
                    <td class="size">${size}</td>
                    <td class="actions">${actions}</td>
                </tr>
            `;
    })
    .join("");
  tbody.innerHTML = rows;
};

export const renderBusesList = (tbody, buses = [], modelsById = {}) => {
  if (!tbody) {
    return;
  }

  if (!Array.isArray(buses) || buses.length === 0) {
    tbody.innerHTML = `
            <tr class="table-state-row">
                <td class="checkbox"></td>
                <td class="name table-state-cell table-empty" colspan="3">${textContent(t("buses.no_buses"))}</td>
            </tr>
        `;
    return;
  }

  const rows = buses
    .map((bus = {}) => {
      const model = modelsById[bus?.bus_model_id];
      const { description: modelDescription } = resolveModelFields(model);
      const modelName = resolveBusModelDisplayName(model);
      const description =
        bus?.description ?? bus?.specs?.description ?? modelDescription ?? "";

      return `
                <tr data-id="${textContent(bus?.id ?? "")}">
                    <td class="checkbox"><input type="checkbox" aria-label="${textContent(t("buses.select_bus"))}"></td>
                    <td class="name">${textContent(bus?.name ?? "")}</td>
                    <td class="model">${textContent(modelName)}</td>
                    <td class="description">${textContent(description)}</td>
                </tr>
            `;
    })
    .join("");

  tbody.innerHTML = rows;
};

export const renderBusesLoadingRow = (tbody) => {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
        <tr class="table-state-row">
            <td class="checkbox"></td>
            <td class="name table-state-cell table-empty" colspan="3">${textContent(t("common.loading"))}</td>
        </tr>
    `;
};

export const renderBusesErrorRow = (
  tbody,
  message = t("buses.unable_to_load_buses")
) => {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
        <tr class="table-state-row">
            <td class="checkbox"></td>
            <td class="name table-state-cell table-empty" colspan="3">${textContent(message)}</td>
        </tr>
    `;
};

const syncSelectionActionState = (button, selectedCount) => {
  if (!button) {
    return;
  }

  button.classList.remove("active");

  const requiresSingleSelection =
    button.classList.contains("requires-single-selection");
  const requiresSelection =
    requiresSingleSelection || button.classList.contains("requires-selection");

  if (!requiresSelection) {
    return;
  }

  button.disabled = requiresSingleSelection
    ? selectedCount !== 1
    : selectedCount < 1;
};

export const updateActionButtons = (table) => {
  if (!table) {
    return;
  }

  const checkboxes = Array.from(
    table.querySelectorAll('tbody input[type="checkbox"]')
  );
  const selectedCount = checkboxes.filter((input) => input.checked).length;

  // Find the closest section that contains both the table and its controls
  // For buses page: .bus-models or .buses-list sections
  // For other pages: the main section like .shifts or .custom-stops
  const parentSection = table.closest("section");
  if (!parentSection) {
    return;
  }

  // Find action buttons within the same section's .table-controls
  const buttons = parentSection.querySelectorAll(
    ".table-controls button[data-action]"
  );

  buttons.forEach((button) => {
    syncSelectionActionState(button, selectedCount);
  });
};

export const bindSelectAll = (headerCheckbox, targetTable) => {
  if (!headerCheckbox || !targetTable) {
    return;
  }

  const getRowCheckboxes = () =>
    Array.from(targetTable.querySelectorAll('tbody input[type="checkbox"]'));

  const updateHeaderState = () => {
    const checkboxes = getRowCheckboxes().filter((input) => !input.disabled);
    const total = checkboxes.length;
    const checkedCount = checkboxes.filter((input) => input.checked).length;

    if (total === 0 || checkedCount === 0) {
      headerCheckbox.checked = false;
      headerCheckbox.indeterminate = false;
    } else if (checkedCount === total) {
      headerCheckbox.checked = true;
      headerCheckbox.indeterminate = false;
    } else {
      headerCheckbox.checked = false;
      headerCheckbox.indeterminate = true;
    }

    updateActionButtons(targetTable);
  };

  if (targetTable.dataset.selectAllBound !== "true") {
    headerCheckbox.addEventListener("change", () => {
      const shouldCheck = !!headerCheckbox.checked;
      headerCheckbox.indeterminate = false;
      getRowCheckboxes().forEach((input) => {
        if (input.disabled) {
          return;
        }
        input.checked = shouldCheck;
      });
      updateHeaderState();
    });

    targetTable.addEventListener("change", (event) => {
      const target = event.target;
      if (
        !target ||
        typeof target.matches !== "function" ||
        !target.matches('tbody input[type="checkbox"]')
      ) {
        return;
      }
      updateHeaderState();
    });

    targetTable.dataset.selectAllBound = "true";
  }

  updateHeaderState();
};
