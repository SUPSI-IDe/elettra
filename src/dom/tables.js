import { resolveModelFields, textContent } from "../ui-helpers";

export const renderLoadingRow = (tbody) => {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
        <tr>
            <td class="checkbox"></td>
            <td class="model" colspan="3">Loading…</td>
            <td class="actions"></td>
        </tr>
    `;
};

export const renderErrorRow = (
  tbody,
  message = "Unable to load bus models."
) => {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
        <tr>
            <td class="checkbox"></td>
            <td class="model" colspan="3">${textContent(message)}</td>
            <td class="actions"></td>
        </tr>
    `;
};

export const renderModels = (tbody, models = []) => {
  if (!tbody) {
    return;
  }

  if (!Array.isArray(models) || models.length === 0) {
    tbody.innerHTML = `
            <tr>
                <td class="checkbox"></td>
                <td class="model" colspan="3">No bus models found.</td>
                <td class="actions"></td>
            </tr>
        `;
    return;
  }

  const rows = models
    .map((raw) => {
      const { model, manufacturer, description } = resolveModelFields(raw);
      return `
                <tr data-id="${String(raw?.id ?? "")}">
                    <td class="checkbox"><input type="checkbox" aria-label="Select bus model"></td>
                    <td class="model">${model}</td>
                    <td class="manufacturer">${manufacturer}</td>
                    <td class="description">${description}</td>
                    <td class="actions"><button type="button" data-action="add-bus" data-bus-model-id="${String(
                      raw?.id ?? ""
                    )}">Add to fleet</button></td>
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
            <tr>
                <td class="checkbox"></td>
                <td class="name" colspan="3">No buses found.</td>
            </tr>
        `;
    return;
  }

  const rows = buses
    .map((bus = {}) => {
      const model = modelsById[bus?.bus_model_id];
      const { model: modelName, description: modelDescription } =
        resolveModelFields(model);
      const description =
        bus?.description ?? bus?.specs?.description ?? modelDescription ?? "";

      return `
                <tr data-id="${String(bus?.id ?? "")}">
                    <td class="checkbox"><input type="checkbox" aria-label="Select bus"></td>
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
        <tr>
            <td class="checkbox"></td>
            <td class="name" colspan="3">Loading…</td>
        </tr>
    `;
};

export const renderBusesErrorRow = (
  tbody,
  message = "Unable to load buses."
) => {
  if (!tbody) {
    return;
  }

  tbody.innerHTML = `
        <tr>
            <td class="checkbox"></td>
            <td class="name" colspan="3">${textContent(message)}</td>
        </tr>
    `;
};

export const updateActionButtons = (table) => {
  if (!table) {
    return;
  }

  const checkboxes = Array.from(
    table.querySelectorAll('tbody input[type="checkbox"]')
  );
  const hasSelection = checkboxes.some((input) => input.checked);

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
    if (hasSelection) {
      button.classList.add("active");
    } else {
      button.classList.remove("active");
    }
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
