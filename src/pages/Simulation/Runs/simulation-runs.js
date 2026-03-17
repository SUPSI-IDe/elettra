import { t } from "../../../i18n";
import "./simulation-runs.css";
import { fetchBusModels } from "../../../api";
import {
  fetchOptimizationRuns,
  deleteOptimizationRun,
  fetchPredictionRun,
} from "../../../api/simulation";
import { fetchShiftById } from "../../../api/shifts";
import { isAuthenticated } from "../../../api/session";
import { bindSelectAll } from "../../../dom/tables";
import { triggerPartialLoad } from "../../../events";
import { resolveModelFields, textContent } from "../../../ui-helpers";

const text = (value) =>
  value === null || value === undefined ? "" : String(value);

const toFiniteNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const looksLikeUuid = (value) => UUID_RE.test(text(value).trim());

/** @deprecated Runs are now persisted server-side; kept for backward compat with callers. */
export const saveRunIds = () => {};

const DISMISSED_KEY = "elettra_dismissed_runs";

const getDismissedIds = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
};

const addDismissedIds = (ids = []) => {
  const current = getDismissedIds();
  ids.forEach((id) => current.add(id));
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...current]));
};

const setFlashMessage = (section, message) => {
  const flashElement = section.querySelector('[data-role="flash"]');
  if (!flashElement) return;

  if (message) {
    flashElement.textContent = message;
    flashElement.hidden = false;
  } else {
    flashElement.textContent = "";
    flashElement.hidden = true;
  }
};

const renderLoading = (tbody) => {
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td class="checkbox"></td>
      <td colspan="8">${textContent(t("common.loading") || "Loading…")}</td>
    </tr>`;
};

const renderError = (
  tbody,
  message = t("simulation.failed_load_runs") || "Unable to load simulation runs."
) => {
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td class="checkbox"></td>
      <td colspan="8">${textContent(message)}</td>
    </tr>`;
};

const renderEmpty = (tbody) => {
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td class="checkbox"></td>
      <td colspan="8" data-i18n="simulation.no_runs">No simulation runs found.</td>
    </tr>`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("de-CH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

const formatObjectiveValue = (value) => {
  const numericValue = toFiniteNumber(value);
  if (numericValue == null) return "—";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 3,
  }).format(numericValue);
};

const formatCompactNumber = (value, suffix = "") => {
  const numericValue = toFiniteNumber(value);
  if (numericValue == null) return "—";

  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Number.isInteger(numericValue) ? 0 : 1,
  }).format(numericValue);

  return `${formatted}${suffix}`;
};

const resolveCreatedAt = (run = {}) => {
  const candidates = [
    run?.optimization_runs,
    run?.optimisation_runs,
    run?.optimizationRun,
    run?.optimisationRun,
    run?.optimization_run,
    run?.optimisation_run,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (Array.isArray(candidate) && candidate.length) {
      const created = candidate[0]?.created_at ?? candidate[0]?.createdAt;
      if (created) return created;
    } else if (typeof candidate === "object") {
      const created = candidate?.created_at ?? candidate?.createdAt;
      if (created) return created;
    }
  }

  return run?.created_at ?? run?.createdAt ?? "";
};

const resolveShiftId = (run = {}) => {
  const direct = run?.shift_id ?? run?.shiftId ?? "";
  if (direct) return text(direct);
  const ids = run?.input_params?.shift_ids ?? run?.inputParams?.shift_ids ?? [];
  return Array.isArray(ids) && ids.length ? text(ids[0]) : "";
};

const resolveShiftIds = (run = {}) => {
  const directIds = [
    run?.shift_ids,
    run?.shiftIds,
    run?.input_params?.shift_ids,
    run?.inputParams?.shift_ids,
  ].find((value) => Array.isArray(value) && value.length);

  if (Array.isArray(directIds) && directIds.length) {
    return directIds.map((id) => text(id).trim()).filter(Boolean);
  }

  const direct = text(run?.shift_id ?? run?.shiftId ?? "").trim();
  return direct ? [direct] : [];
};

const resolvePredictionRunIds = (run = {}) => {
  const directIds = [
    run?.prediction_run_ids,
    run?.predictionRunIds,
    run?.results?.prediction_run_ids,
    run?.results?.predictionRunIds,
  ].find((value) => Array.isArray(value) && value.length);

  if (Array.isArray(directIds) && directIds.length) {
    return directIds.map((id) => text(id).trim()).filter(Boolean);
  }

  const direct = text(run?.prediction_run_id ?? run?.predictionRunId ?? "").trim();
  return direct ? [direct] : [];
};

const resolveShiftName = (run = {}) => {
  return (
    run?._resolved_shift_name ??
    run?.shift_name ??
    run?.shiftName ??
    run?.shift?.name ??
    ""
  );
};

const resolveShiftNames = (run = {}) => {
  const resolved = Array.isArray(run?._resolved_shift_names)
    ? run._resolved_shift_names
    : [];
  if (resolved.length) return resolved.map((name) => text(name).trim()).filter(Boolean);

  const directNames = [
    run?.shift_names,
    run?.shiftNames,
    run?.shift?.names,
  ].find((value) => Array.isArray(value) && value.length);

  if (Array.isArray(directNames) && directNames.length) {
    return directNames.map((name) => text(name).trim()).filter(Boolean);
  }

  const primary = text(resolveShiftName(run)).trim();
  return primary ? [primary] : [];
};

const resolveShiftLabel = (run = {}) => {
  const names = resolveShiftNames(run);
  if (names.length) return names.join(", ");

  const ids = resolveShiftIds(run);
  if (ids.length) {
    return ids.map((id) => `${id.slice(0, 8)}…`).join(", ");
  }

  return "—";
};

const resolveRunName = (run = {}) =>
  text(
    run?.input_params?.name ??
    run?.inputParams?.name ??
    run?.name ??
    ""
  ).trim();

const resolveBusModelId = (run = {}) => {
  return text(
    run?._resolved_bus_model_id ??
    run?.bus_model_id ??
    run?.busModelId ??
    ""
  );
};

const resolveBusModelName = (run = {}) => {
  return text(
    run?._resolved_bus_model_name ??
    run?.bus_model_name ??
    run?.busModelName ??
    ""
  );
};

const parseModelSpecs = (specs) => {
  if (!specs) return {};
  if (typeof specs === "string") {
    try {
      const parsed = JSON.parse(specs);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof specs === "object" ? specs : {};
};

const buildBusModelTooltip = (model = {}) => {
  const specs = parseModelSpecs(model?.specs);
  const lines = [
    [
      t("buses.field_min_battery_packs") || "Min battery packs",
      toFiniteNumber(specs?.min_battery_packs),
    ],
    [
      t("buses.field_max_battery_packs") || "Max battery packs",
      toFiniteNumber(specs?.max_battery_packs),
    ],
    [
      t("buses.field_battery_pack_size") || "Battery pack size (kWh)",
      toFiniteNumber(specs?.battery_pack_size_kwh),
    ],
    [
      t("simulation.bus_length_m_label") || "Bus length (m)",
      toFiniteNumber(specs?.bus_length_m),
    ],
  ]
    .filter(([, value]) => value != null)
    .map(([label, value]) => `${label}: ${formatCompactNumber(value)}`);

  return lines.join("\n");
};

const resolveRunMode = (run = {}) =>
  text(
    run?.input_params?.mode ??
    run?.inputParams?.mode ??
    run?.optimization_mode ??
    run?.optimizationMode ??
    run?.mode ??
    ""
  ).trim();

const resolveExternalTemp = (run = {}) =>
  toFiniteNumber(
    run?.external_temp_celsius ??
      run?.externalTempCelsius ??
      run?._resolved_prediction_run?.external_temp_celsius ??
      run?._resolved_prediction_run?.externalTempCelsius ??
      run?.input_params?.prediction_params?.external_temp_celsius ??
      run?.inputParams?.prediction_params?.external_temp_celsius ??
      run?.prediction_params?.external_temp_celsius ??
      run?.predictionParams?.external_temp_celsius
  );

const resolveOccupancyPercent = (run = {}) =>
  toFiniteNumber(
    run?.occupancy_percent ??
      run?.occupancyPercent ??
      run?._resolved_prediction_run?.occupancy_percent ??
      run?._resolved_prediction_run?.occupancyPercent ??
      run?.input_params?.prediction_params?.occupancy_percent ??
      run?.inputParams?.prediction_params?.occupancy_percent ??
      run?.prediction_params?.occupancy_percent ??
      run?.predictionParams?.occupancy_percent
  );

const resolveSocPercent = (value) => {
  const numericValue = toFiniteNumber(value);
  if (numericValue == null) return null;
  return numericValue <= 1 ? numericValue * 100 : numericValue;
};

const resolveMinSocPercent = (run = {}) =>
  resolveSocPercent(
    run?.min_soc ??
      run?.minSoc ??
      run?.input_params?.min_soc ??
      run?.inputParams?.min_soc
  );

const resolveMaxSocPercent = (run = {}) =>
  resolveSocPercent(
    run?.max_soc ??
      run?.maxSoc ??
      run?.input_params?.max_soc ??
      run?.inputParams?.max_soc
  );

const formatMainParameters = (run = {}) => {
  const externalTemp = resolveExternalTemp(run);
  const occupancyPercent = resolveOccupancyPercent(run);
  const minSocPercent = resolveMinSocPercent(run);
  const maxSocPercent = resolveMaxSocPercent(run);

  const parts = [];
  if (externalTemp != null) {
    parts.push(formatCompactNumber(externalTemp, " °C"));
  }
  if (occupancyPercent != null) {
    parts.push(formatCompactNumber(occupancyPercent, "%"));
  }
  if (minSocPercent != null && maxSocPercent != null) {
    parts.push(
      `[${formatCompactNumber(minSocPercent)}-${formatCompactNumber(maxSocPercent)}]%`
    );
  }

  return parts.length ? parts.join(", ") : "—";
};

const resolveObjectiveValue = (run = {}) => {
  const directValue = toFiniteNumber(
    run?.objective_value ?? run?.objectiveValue ?? run?.results?.objective_value
  );
  if (directValue != null) return directValue;

  const nestedCandidates = [
    run?.optimization_runs,
    run?.optimisation_runs,
    run?.optimizationRun,
    run?.optimisationRun,
    run?.optimization_run,
    run?.optimisation_run,
  ];

  for (const candidate of nestedCandidates) {
    if (!candidate) continue;

    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        const value = toFiniteNumber(
          item?.objective_value ?? item?.objectiveValue ?? item?.results?.objective_value
        );
        if (value != null) return value;
      }
      continue;
    }

    const value = toFiniteNumber(
      candidate?.objective_value ??
        candidate?.objectiveValue ??
        candidate?.results?.objective_value
    );
    if (value != null) return value;
  }

  return null;
};

const formatStatusLabel = (status) => {
  const normalized = text(status).trim().toLowerCase();
  const key = ({
    pending: "simulation.status_pending",
    running: "simulation.status_running",
    completed: "simulation.status_completed",
    done: "simulation.status_completed",
    failed: "simulation.status_failed",
    error: "simulation.status_error",
  })[normalized];

  return (key && t(key)) || status || "—";
};

const DEFAULT_SORT = {
  key: "created_at",
  direction: "desc",
};

const compareNullableNumbers = (left, right) => {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return left - right;
};

const compareTexts = (left, right) =>
  text(left).localeCompare(text(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });

const getSortValue = (run = {}, key = "") => {
  switch (key) {
    case "created_at": {
      const timestamp = Date.parse(resolveCreatedAt(run));
      return Number.isNaN(timestamp) ? null : timestamp;
    }
    case "bus_model":
      return resolveBusModelName(run) || resolveBusModelId(run) || "—";
    case "shift":
      return resolveShiftLabel(run) || resolveRunName(run) || "—";
    case "objective_value":
      return resolveObjectiveValue(run);
    case "main_parameters":
      return [
        resolveExternalTemp(run) ?? Number.POSITIVE_INFINITY,
        resolveOccupancyPercent(run) ?? Number.POSITIVE_INFINITY,
        resolveMinSocPercent(run) ?? Number.POSITIVE_INFINITY,
        resolveMaxSocPercent(run) ?? Number.POSITIVE_INFINITY,
      ].join("|");
    case "optimization_mode":
      return resolveRunMode(run) || "—";
    case "status":
      return formatStatusLabel(run?.status ?? "pending");
    default:
      return text(run?.id);
  }
};

const sortRuns = (runs = [], sortState = DEFAULT_SORT) => {
  const directionMultiplier = sortState.direction === "asc" ? 1 : -1;

  return [...runs].sort((left, right) => {
    const leftValue = getSortValue(left, sortState.key);
    const rightValue = getSortValue(right, sortState.key);

    const comparison =
      typeof leftValue === "number" || typeof rightValue === "number"
        ? compareNullableNumbers(
            typeof leftValue === "number" ? leftValue : null,
            typeof rightValue === "number" ? rightValue : null
          )
        : compareTexts(leftValue, rightValue);

    if (comparison !== 0) {
      return comparison * directionMultiplier;
    }

    const leftCreated = Date.parse(resolveCreatedAt(left));
    const rightCreated = Date.parse(resolveCreatedAt(right));
    const fallbackComparison = compareNullableNumbers(
      Number.isNaN(leftCreated) ? null : leftCreated,
      Number.isNaN(rightCreated) ? null : rightCreated
    );
    if (fallbackComparison !== 0) {
      return fallbackComparison * -1;
    }

    return compareTexts(text(left?.id), text(right?.id));
  });
};

const updateSortHeaders = (table, sortState) => {
  table?.querySelectorAll("thead th[data-sort-key]").forEach((header) => {
    const key = header.dataset.sortKey;
    const isActive = key === sortState.key;
    const arrow = header.querySelector(".sort-arrow");
    header.setAttribute(
      "aria-sort",
      isActive
        ? sortState.direction === "asc"
          ? "ascending"
          : "descending"
        : "none"
    );
    if (arrow) {
      arrow.textContent = !isActive ? "↕" : sortState.direction === "asc" ? "↑" : "↓";
    }
  });
};

const updateMainParametersTooltip = (section) => {
  const label = section?.querySelector('[data-role="main-parameters-label"]');
  if (!label) return;

  label.title =
    t("simulation.main_parameters_help") ||
    "Temperature, occupancy, and minimum/maximum SoC used for the simulation.";
};

const renderRows = (tbody, runs = []) => {
  if (!tbody) return;

  if (!Array.isArray(runs) || runs.length === 0) {
    renderEmpty(tbody);
    return;
  }

  const rows = runs
    .map((run = {}) => {
      const rowId = text(run?.id);
      const status = text(run?.status ?? "pending");
      const created = formatDate(resolveCreatedAt(run));
      const shiftIds = resolveShiftIds(run);
      const shiftTitle = shiftIds.length ? shiftIds.join(", ") : rowId;
      const shiftName = resolveShiftLabel(run);
      const shiftLabel = shiftName !== "—" ? shiftName : resolveRunName(run) || "—";
      const busModelId = text(resolveBusModelId(run)).trim();
      const busModelName = text(resolveBusModelName(run)).trim();
      const busModelLabel = busModelName || busModelId || "—";
      const busModelTooltip =
        text(run?._resolved_bus_model_tooltip).trim() || busModelLabel;
      const mode = resolveRunMode(run) || "—";
      const objectiveValue = formatObjectiveValue(resolveObjectiveValue(run));
      const mainParameters = formatMainParameters(run);

      const resultsLink = `<a class="results-link" href="#" data-action="view-results" data-run-id="${rowId}">${t("simulation.col_results") || "Results"}</a>`;

      return `
        <tr data-id="${rowId}">
          <td class="checkbox">
            <input type="checkbox" aria-label="${textContent(t("simulation.select_run") || "Select run")}" />
          </td>
          <td class="actions">${textContent(created)}</td>
          <td class="day" title="${textContent(busModelTooltip)}">${textContent(
            busModelLabel
          )}</td>
          <td class="name" title="${textContent(shiftLabel || shiftTitle)}">${textContent(shiftLabel)}</td>
          <td class="objective">${textContent(objectiveValue)}</td>
          <td class="main-parameters">${textContent(mainParameters)}</td>
          <td class="type">${textContent(mode)}</td>
          <td class="status">
            <span class="status-badge ${status}">${textContent(formatStatusLabel(status))}</span>
          </td>
          <td class="results">${resultsLink}</td>
        </tr>`;
    })
    .join("");

  tbody.innerHTML = rows;
};

const getSelectedIdsFrom = (table) =>
  Array.from(
    table?.querySelectorAll('tbody input[type="checkbox"]:checked') ?? []
  )
    .map((input) => input.closest("tr")?.dataset?.id)
    .filter(Boolean);

export const initializeSimulationRuns = async (
  root = document,
  options = {}
) => {
  const section = root.querySelector("section.simulation-runs");
  if (!section) return null;

  const cleanupHandlers = [];

  const table = section.querySelector("table");
  const tbody = table?.querySelector(
    'tbody[data-role="simulation-runs-body"]'
  );
  const headerCheckbox = table?.querySelector(
    'thead .checkbox input[type="checkbox"]'
  );
  const searchInput = section.querySelector("#simulation-filter");
  const deleteButton = section.querySelector(
    '[data-action="delete-selected-simulations"]'
  );
  const duplicateButton = section.querySelector(
    '[data-action="duplicate-simulation"]'
  );
  setFlashMessage(section, options.flashMessage ?? "");
  updateMainParametersTooltip(section);

  if (!table || !tbody) return null;

  let allRuns = [];
  let sortState = { ...DEFAULT_SORT };
  const shiftMetaCache = new Map();
  const predictionRunCache = new Map();
  let busModelsById = {};

  const hydrateRunModelNamesFromId = (runs = []) => {
    runs.forEach((run) => {
      const currentName = text(resolveBusModelName(run)).trim();
      const modelId = text(resolveBusModelId(run)).trim();
      if (!modelId) {
        return;
      }
      const model = busModelsById?.[modelId];
      const tooltip = buildBusModelTooltip(model);
      if (tooltip) {
        run._resolved_bus_model_tooltip = tooltip;
      }
      if (currentName && !looksLikeUuid(currentName)) {
        return;
      }
      const modelName = text(resolveModelFields(model).model).trim();
      if (modelName) {
        run._resolved_bus_model_name = modelName;
      }
    });
  };

  const enrichShiftNames = async (runs = []) => {
    const missing = runs.map((run) => ({
      run,
      shiftIds: resolveShiftIds(run),
      resolvedNames: resolveShiftNames(run),
    }));

    const idsToResolve = missing.flatMap(({ shiftIds, resolvedNames }) =>
      resolvedNames.length >= shiftIds.length ? [] : shiftIds
    );
    if (!idsToResolve.length) return;

    const uniqueShiftIds = [...new Set(idsToResolve)];
    const toFetch = uniqueShiftIds.filter((id) => !shiftMetaCache.has(id));

    if (toFetch.length) {
      const results = await Promise.allSettled(toFetch.map((id) => fetchShiftById(id)));
      results.forEach((res, idx) => {
        const id = toFetch[idx];
        if (res.status === "fulfilled") {
          const shift = res.value ?? {};
          const name = text(shift?.name ?? "").trim();
          if (name) shiftMetaCache.set(id, { name });
        }
      });
    }

    missing.forEach(({ run, shiftIds, resolvedNames }) => {
      const fetchedNames = shiftIds
        .map((shiftId) => shiftMetaCache.get(shiftId)?.name)
        .filter(Boolean);
      const allNames = [...resolvedNames, ...fetchedNames].filter(Boolean);

      if (allNames.length) {
        run._resolved_shift_names = [...new Set(allNames)];
        run._resolved_shift_name = run._resolved_shift_names[0];
      }
    });
  };

  const enrichPredictionRunParameters = async (runs = []) => {
    const predictionRunIdsToResolve = [
      ...new Set(
        runs
          .flatMap((run) => resolvePredictionRunIds(run))
          .filter((id) => id && !predictionRunCache.has(id))
      ),
    ];

    if (predictionRunIdsToResolve.length) {
      const results = await Promise.allSettled(
        predictionRunIdsToResolve.map((id) => fetchPredictionRun(id))
      );

      results.forEach((result, index) => {
        const runId = predictionRunIdsToResolve[index];
        if (result.status === "fulfilled") {
          predictionRunCache.set(runId, result.value ?? null);
        }
      });
    }

    runs.forEach((run) => {
      if (resolveExternalTemp(run) != null && resolveOccupancyPercent(run) != null) {
        return;
      }

      const firstPredictionRunId = resolvePredictionRunIds(run)[0];
      if (!firstPredictionRunId) {
        return;
      }

      const predictionRun = predictionRunCache.get(firstPredictionRunId);
      if (predictionRun) {
        run._resolved_prediction_run = predictionRun;
      }
    });
  };

  const applyFilter = () => {
    const query = (searchInput?.value ?? "").toLowerCase().trim();
    const filtered = query
        ? allRuns.filter(
          (run = {}) =>
            text(resolveRunName(run)).toLowerCase().includes(query) ||
            text(resolveShiftLabel(run)).toLowerCase().includes(query) ||
            text(resolveBusModelId(run)).toLowerCase().includes(query) ||
            text(resolveBusModelName(run)).toLowerCase().includes(query) ||
            text(run?.status).toLowerCase().includes(query) ||
            text(run?.id).toLowerCase().includes(query)
        )
      : allRuns;

    renderRows(tbody, sortRuns(filtered, sortState));
    updateSortHeaders(table, sortState);
    bindSelectAll(headerCheckbox, table);
  };

  const loadRuns = async () => {
    renderLoading(tbody);

    if (!isAuthenticated()) {
      const authMessage =
        t("simulation.login_required") ||
        "Please login to view your simulations.";
      renderError(tbody, authMessage);
      return;
    }

    try {
      if (!Object.keys(busModelsById).length) {
        const modelsPayload = await fetchBusModels({ skip: 0, limit: 1000 });
        const models = Array.isArray(modelsPayload)
          ? modelsPayload
          : (modelsPayload?.items ?? modelsPayload?.results ?? []);

        busModelsById = Object.fromEntries(
          (models ?? []).filter((m) => m?.id).map((m) => [text(m.id), m])
        );
      }

      const runsPayload = await fetchOptimizationRuns();
      const rawRuns = Array.isArray(runsPayload)
        ? runsPayload
        : (runsPayload?.items ?? runsPayload?.results ?? []);

      const dismissed = getDismissedIds();
      allRuns = rawRuns.filter((r) => !dismissed.has(text(r?.id)));

      hydrateRunModelNamesFromId(allRuns);
      await enrichShiftNames(allRuns);
      await enrichPredictionRunParameters(allRuns);

      applyFilter();
    } catch (error) {
      console.error("Failed to load simulation runs", error);
      renderError(
        tbody,
        error?.message ??
          t("simulation.failed_load_runs") ??
          "Unable to load simulation runs."
      );
    }
  };

  if (searchInput) {
    searchInput.addEventListener("input", applyFilter);
    cleanupHandlers.push(() =>
      searchInput.removeEventListener("input", applyFilter)
    );
  }

  const handleSortClick = (event) => {
    const button = event.target.closest("button[data-sort-key]");
    if (!button) return;

    const nextKey = text(button.dataset.sortKey).trim();
    if (!nextKey) return;

    sortState =
      sortState.key === nextKey
        ? {
            key: nextKey,
            direction: sortState.direction === "asc" ? "desc" : "asc",
          }
        : {
            key: nextKey,
            direction: nextKey === DEFAULT_SORT.key ? DEFAULT_SORT.direction : "asc",
          };

    applyFilter();
  };
  table.querySelector("thead")?.addEventListener("click", handleSortClick);
  cleanupHandlers.push(() =>
    table.querySelector("thead")?.removeEventListener("click", handleSortClick)
  );

  const handleDuplicateClick = () => {
    const ids = getSelectedIdsFrom(table);
    if (ids.length !== 1) {
      setFlashMessage(
        section,
        t("simulation.duplicate_select_one") ||
          "Select exactly one simulation to duplicate."
      );
      return;
    }

    const run = allRuns.find((r) => text(r?.id) === ids[0]);
    if (!run) return;

    triggerPartialLoad("add-simulation", {
      prefill: {
        name: resolveRunName(run),
        shiftId: resolveShiftId(run),
        optimizationMode:
          run?.mode ?? run?.optimization_mode ?? "battery_only",
        externalTempCelsius: resolveExternalTemp(run) ?? -5,
        occupancyPercent: resolveOccupancyPercent(run) ?? 50,
        heatingType:
          run?.auxiliary_heating_type ??
          run?.auxiliaryHeatingType ??
          "hp",
      },
    });
  };
  if (duplicateButton) {
    duplicateButton.addEventListener("click", handleDuplicateClick);
    cleanupHandlers.push(() =>
      duplicateButton.removeEventListener("click", handleDuplicateClick)
    );
  }

  const handleDeleteClick = async () => {
    const ids = getSelectedIdsFrom(table);
    if (!ids.length) {
      setFlashMessage(
        section,
        t("simulation.select_to_delete") ||
          "Select at least one simulation to delete."
      );
      return;
    }

    const msg = (t("simulation.delete_confirm") || "Delete {count} simulation(s)?")
      .replace("{count}", ids.length);
    if (!confirm(msg)) return;

    let serverDeleted = 0;
    let serverFailed = 0;
    const notSupported = [];

    for (const id of ids) {
      try {
        const result = await deleteOptimizationRun(id);
        if (result.deleted) {
          serverDeleted++;
        } else {
          notSupported.push(id);
        }
      } catch {
        serverFailed++;
        notSupported.push(id);
      }
    }

    if (notSupported.length) {
      addDismissedIds(notSupported);
    }

    allRuns = allRuns.filter((r) => !ids.includes(text(r?.id)));
    applyFilter();
    populateCompareSelects();

    setFlashMessage(
      section,
      t("simulation.removed", { count: ids.length }) ||
        `${ids.length} simulation(s) removed.`
    );
  };
  if (deleteButton) {
    deleteButton.addEventListener("click", handleDeleteClick);
    cleanupHandlers.push(() =>
      deleteButton.removeEventListener("click", handleDeleteClick)
    );
  }

  const handleResultsClick = (event) => {
    const link = event.target.closest('[data-action="view-results"]');
    if (!link) return;
    event.preventDefault();
    const runId = link.dataset.runId;
    if (!runId) return;
    const run = allRuns.find((r) => text(r?.id) === runId);
    const modelId = text(resolveBusModelId(run)).trim();
    const busModel = busModelsById?.[modelId] ?? {};
    const specs = (() => {
      const raw = busModel?.specs;
      if (!raw) return {};
      if (typeof raw === "string") {
        try { return JSON.parse(raw); } catch { return {}; }
      }
      return typeof raw === "object" ? raw : {};
    })();
    triggerPartialLoad("simulation-results", {
      runId,
      simulationName: resolveRunName(run),
      shiftName: resolveShiftName(run),
      busModelName: resolveBusModelName(run),
      busModelId: modelId,
      status: text(run?.status ?? ""),
      createdAt: formatDate(resolveCreatedAt(run)),
      shiftId: resolveShiftId(run),
      occupancyPercent: resolveOccupancyPercent(run),
      externalTemp: resolveExternalTemp(run),
      heatingType: run?.auxiliary_heating_type ?? run?.auxiliaryHeatingType,
      numBatteryPacks: run?.num_battery_packs ?? run?.numBatteryPacks,
      busModelData: {
        manufacturer: busModel?.manufacturer ?? busModel?.manufacturer_name ?? "",
        cost: specs?.cost ?? "",
        bus_length_m: specs?.bus_length_m ?? "",
        max_passengers: specs?.max_passengers ?? "",
        bus_lifetime: specs?.bus_lifetime ?? "",
        battery_pack_size_kwh: specs?.battery_pack_size_kwh ?? "",
        battery_pack_cost: specs?.battery_pack_cost_chf ?? "",
        max_charging_power_kw: specs?.max_charging_power_kw ?? "",
        empty_weight_kg: specs?.empty_weight_kg ?? "",
        min_battery_packs: specs?.min_battery_packs ?? "",
        max_battery_packs: specs?.max_battery_packs ?? "",
        battery_pack_lifetime: specs?.battery_pack_lifetime ?? "",
      },
    });
  };
  if (table) {
    table.addEventListener("click", handleResultsClick);
    cleanupHandlers.push(() =>
      table.removeEventListener("click", handleResultsClick)
    );
  }

  const compareSelectA = section.querySelector('[data-role="compare-sim-a"]');
  const compareSelectB = section.querySelector('[data-role="compare-sim-b"]');
  const compareBtn = section.querySelector('[data-action="compare-simulations"]');

  const populateCompareSelects = () => {
    const placeholder = t("simulation.compare_select_placeholder") || "Select a simulation…";
    [compareSelectA, compareSelectB].forEach((sel) => {
      if (!sel) return;
      sel.innerHTML = `<option value="" disabled selected>${textContent(placeholder)}</option>`;
      allRuns.forEach((run) => {
        const id = text(run?.id);
        const runName = resolveRunName(run) || resolveShiftLabel(run) || id.slice(0, 8);
        const bus = resolveBusModelName(run) || "—";
        const created = formatDate(resolveCreatedAt(run));
        const label = `${runName} — ${bus} — ${created}`;
        const opt = document.createElement("option");
        opt.value = id;
        opt.textContent = label;
        sel.appendChild(opt);
      });
    });
  };

  const origLoadRuns = loadRuns;
  const loadRunsAndPopulate = async () => {
    await origLoadRuns();
    populateCompareSelects();
  };

  const handleCompareClick = () => {
    const idA = compareSelectA?.value;
    const idB = compareSelectB?.value;
    if (!idA || !idB) return;
    if (idA === idB) {
      setFlashMessage(section, t("simulation.compare_same_error") || "Please select two different simulations.");
      return;
    }
    const runA = allRuns.find((r) => text(r?.id) === idA);
    const runB = allRuns.find((r) => text(r?.id) === idB);
    if (!runA || !runB) return;

    const buildOptions = (run) => {
      const modelId = text(resolveBusModelId(run)).trim();
      const busModel = busModelsById?.[modelId] ?? {};
      const specs = (() => {
        const raw = busModel?.specs;
        if (!raw) return {};
        if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return {}; } }
        return typeof raw === "object" ? raw : {};
      })();
      return {
        runId: text(run?.id),
        simulationName: resolveRunName(run),
        shiftName: resolveShiftName(run),
        busModelName: resolveBusModelName(run),
        busModelId: modelId,
        status: text(run?.status ?? ""),
        createdAt: formatDate(resolveCreatedAt(run)),
        occupancyPercent: resolveOccupancyPercent(run),
        externalTemp: resolveExternalTemp(run),
        heatingType: run?.auxiliary_heating_type ?? run?.auxiliaryHeatingType,
        numBatteryPacks: run?.num_battery_packs ?? run?.numBatteryPacks,
        busModelData: {
          manufacturer: busModel?.manufacturer ?? busModel?.manufacturer_name ?? "",
          cost: specs?.cost ?? "",
          bus_length_m: specs?.bus_length_m ?? "",
          max_passengers: specs?.max_passengers ?? "",
          bus_lifetime: specs?.bus_lifetime ?? "",
          battery_pack_size_kwh: specs?.battery_pack_size_kwh ?? "",
          battery_pack_cost: specs?.battery_pack_cost_chf ?? "",
          battery_pack_lifetime: specs?.battery_pack_lifetime ?? "",
        },
      };
    };

    triggerPartialLoad("simulation-comparison", {
      simA: buildOptions(runA),
      simB: buildOptions(runB),
    });
  };

  if (compareBtn) {
    compareBtn.addEventListener("click", handleCompareClick);
    cleanupHandlers.push(() => compareBtn.removeEventListener("click", handleCompareClick));
  }

  bindSelectAll(headerCheckbox, table);
  await loadRunsAndPopulate();

  return () => {
    cleanupHandlers.forEach((handler) => handler());
  };
};
