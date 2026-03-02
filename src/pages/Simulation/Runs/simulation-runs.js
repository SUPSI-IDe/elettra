import { t } from "../../../i18n";
import "./simulation-runs.css";
import { fetchBusModels } from "../../../api";
import { fetchPredictionRun } from "../../../api/simulation";
import { fetchShiftById } from "../../../api/shifts";
import { isAuthenticated } from "../../../api/session";
import { bindSelectAll } from "../../../dom/tables";
import { triggerPartialLoad } from "../../../events";
import { resolveModelFields, textContent } from "../../../ui-helpers";

const STORAGE_KEY = "simulation.predictionRunIds";

const text = (value) =>
  value === null || value === undefined ? "" : String(value);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const looksLikeUuid = (value) => UUID_RE.test(text(value).trim());

const readStoredRunIds = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveRunIds = (ids = []) => {
  try {
    const existing = readStoredRunIds();
    const merged = [...new Set([...existing, ...ids])];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // non-fatal
  }
};

const removeRunIds = (idsToRemove = []) => {
  try {
    const existing = readStoredRunIds();
    const filtered = existing.filter((id) => !idsToRemove.includes(id));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    // non-fatal
  }
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
      <td colspan="5">Loading…</td>
    </tr>`;
};

const renderError = (tbody, message = "Unable to load simulation runs.") => {
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td class="checkbox"></td>
      <td colspan="5">${textContent(message)}</td>
    </tr>`;
};

const renderEmpty = (tbody) => {
  if (!tbody) return;
  tbody.innerHTML = `
    <tr>
      <td class="checkbox"></td>
      <td colspan="5" data-i18n="simulation.no_runs">No simulation runs found.</td>
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

const resolveShiftName = (run = {}) => {
  return (
    run?._resolved_shift_name ??
    run?.shift_name ??
    run?.shiftName ??
    run?.shift?.name ??
    ""
  );
};

const resolveBusModelId = (run = {}) => {
  return (
    run?._resolved_bus_model_id ??
    run?.bus_model_id ??
    run?.busModelId ??
    run?.shift?.bus?.bus_model_id ??
    run?.shift?.bus_model_id ??
    run?.shift?.busModelId ??
    ""
  );
};

const resolveBusModelName = (run = {}) => {
  return (
    run?._resolved_bus_model_name ??
    run?.bus_model_name ??
    run?.busModelName ??
    run?.shift?.bus_model_name ??
    ""
  );
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
      const shiftId = text(run?.shift_id ?? "");
      const shiftName = resolveShiftName(run) || (shiftId ? `${shiftId.slice(0, 8)}…` : "—");
      const busModelId = text(resolveBusModelId(run)).trim();
      const busModelName = text(resolveBusModelName(run)).trim();
      const busModelLabel = busModelName || busModelId || "—";

      const resultsLink = `<a class="results-link" href="#" data-action="view-results" data-run-id="${rowId}">${t("simulation.col_results") || "Results"}</a>`;

      return `
        <tr data-id="${rowId}">
          <td class="checkbox">
            <input type="checkbox" aria-label="Select run" />
          </td>
          <td class="actions">${textContent(created)}</td>
          <td class="day" title="${textContent(busModelId || "")}">${textContent(
            busModelLabel
          )}</td>
          <td class="name" title="${shiftId || rowId}">${textContent(shiftName)}</td>
          <td class="status">
            <span class="status-badge ${status}">${textContent(status)}</span>
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
  const addButton = section.querySelector('[data-action="add-simulation"]');

  setFlashMessage(section, options.flashMessage ?? "");

  if (!table || !tbody) return null;

  let allRuns = [];
  const shiftMetaCache = new Map();
  let busModelsById = {};

  const hydrateRunModelNamesFromId = (runs = []) => {
    runs.forEach((run) => {
      const currentName = text(resolveBusModelName(run)).trim();
      if (currentName && !looksLikeUuid(currentName)) {
        return;
      }
      const modelId = text(resolveBusModelId(run)).trim();
      if (!modelId) {
        return;
      }
      const model = busModelsById?.[modelId];
      const modelName = text(resolveModelFields(model).model).trim();
      if (modelName) {
        run._resolved_bus_model_name = modelName;
      }
    });
  };

  const enrichShiftNames = async (runs = []) => {
    const missing = runs
      .map((r) => ({
        run: r,
        shiftId: text(r?.shift_id ?? ""),
        hasName: Boolean(resolveShiftName(r)),
        hasBusModelId: Boolean(resolveBusModelId(r)),
        hasBusModelName:
          Boolean(resolveBusModelName(r)) &&
          !looksLikeUuid(resolveBusModelName(r)),
      }))
      .filter(
        (x) =>
          x.shiftId && (!x.hasName || !x.hasBusModelId || !x.hasBusModelName)
      );

    if (!missing.length) return;

    const uniqueShiftIds = [...new Set(missing.map((m) => m.shiftId))];
    const toFetch = uniqueShiftIds.filter((id) => !shiftMetaCache.has(id));

    if (toFetch.length) {
      const results = await Promise.allSettled(toFetch.map((id) => fetchShiftById(id)));
      results.forEach((res, idx) => {
        const id = toFetch[idx];
        if (res.status === "fulfilled") {
          const shift = res.value ?? {};
          const name = text(shift?.name ?? "").trim();
          const busModelId = text(
            shift?.bus?.bus_model_id ?? shift?.bus_model_id ?? shift?.busModelId ?? ""
          ).trim();
          const busModelName = text(
            shift?.bus_model_name ??
              shift?.busModelName ??
              shift?.bus?.model ??
              shift?.bus?.bus_model_name ??
              ""
          ).trim();
          if (name || busModelId) {
            shiftMetaCache.set(id, { name, busModelId, busModelName });
          }
        }
      });
    }

    missing.forEach(({ run, shiftId }) => {
      const meta = shiftMetaCache.get(shiftId);
      if (!meta) return;
      if (meta.name) run._resolved_shift_name = meta.name;
      if (meta.busModelId) run._resolved_bus_model_id = meta.busModelId;
      const resolvedModel = busModelsById?.[text(meta.busModelId)];
      const label = text(resolveModelFields(resolvedModel).model).trim();
      if (label) {
        run._resolved_bus_model_name = label;
      } else if (meta.busModelName && !looksLikeUuid(meta.busModelName)) {
        run._resolved_bus_model_name = meta.busModelName;
      }
    });
  };

  const applyFilter = () => {
    const query = (searchInput?.value ?? "").toLowerCase().trim();
    const filtered = query
      ? allRuns.filter(
          (run = {}) =>
            text(resolveShiftName(run)).toLowerCase().includes(query) ||
            text(resolveBusModelId(run)).toLowerCase().includes(query) ||
            text(resolveBusModelName(run)).toLowerCase().includes(query) ||
            text(run?.status).toLowerCase().includes(query) ||
            text(run?.id).toLowerCase().includes(query)
        )
      : allRuns;

    renderRows(tbody, filtered);
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

    const storedIds = readStoredRunIds();
    if (!storedIds.length) {
      allRuns = [];
      applyFilter();
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

      const results = await Promise.allSettled(
        storedIds.map((id) => fetchPredictionRun(id))
      );

      allRuns = results
        .filter((r) => r.status === "fulfilled" && r.value)
        .map((r) => r.value);

      hydrateRunModelNamesFromId(allRuns);
      await enrichShiftNames(allRuns);
      hydrateRunModelNamesFromId(allRuns);

      const validIds = allRuns.map((r) => text(r.id));
      const staleIds = storedIds.filter((id) => !validIds.includes(id));
      if (staleIds.length) removeRunIds(staleIds);

      applyFilter();
    } catch (error) {
      console.error("Failed to load simulation runs", error);
      renderError(
        tbody,
        error?.message ?? "Unable to load simulation runs."
      );
    }
  };

  if (searchInput) {
    searchInput.addEventListener("input", applyFilter);
    cleanupHandlers.push(() =>
      searchInput.removeEventListener("input", applyFilter)
    );
  }

  const handleAddClick = () => {
    triggerPartialLoad("add-simulation");
  };
  if (addButton) {
    addButton.addEventListener("click", handleAddClick);
    cleanupHandlers.push(() =>
      addButton.removeEventListener("click", handleAddClick)
    );
  }

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
        shiftId: text(run?.shift_id ?? ""),
        occupancyPercent: run?.occupancy_percent ?? run?.occupancyPercent ?? 50,
        heatingType:
          run?.auxiliary_heating_type ??
          run?.auxiliaryHeatingType ??
          "hp",
        numBatteryPacks:
          run?.num_battery_packs ?? run?.numBatteryPacks ?? "",
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
      console.error("Select at least one simulation.");
      return;
    }

    const confirmDelete = confirm(
      `Remove ${ids.length} simulation(s) from list?`
    );
    if (!confirmDelete) return;

    removeRunIds(ids);
    await loadRuns();
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
      shiftName: resolveShiftName(run),
      busModelName: resolveBusModelName(run),
      busModelId: modelId,
      status: text(run?.status ?? ""),
      createdAt: formatDate(resolveCreatedAt(run)),
      shiftId: text(run?.shift_id ?? ""),
      occupancyPercent: run?.occupancy_percent ?? run?.occupancyPercent,
      externalTemp: run?.external_temp_celsius ?? run?.externalTempCelsius,
      heatingType: run?.auxiliary_heating_type ?? run?.auxiliaryHeatingType,
      numBatteryPacks: run?.num_battery_packs ?? run?.numBatteryPacks,
      busModelData: {
        manufacturer: busModel?.manufacturer ?? busModel?.manufacturer_name ?? "",
        cost: specs?.cost ?? "",
        bus_length_m: specs?.bus_length_m ?? "",
        max_passengers: specs?.max_passengers ?? "",
        bus_lifetime: specs?.bus_lifetime ?? "",
        battery_pack_size_kwh: specs?.battery_pack_size_kwh ?? "",
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
        const shift = resolveShiftName(run) || id.slice(0, 8);
        const bus = resolveBusModelName(run) || "—";
        const created = formatDate(resolveCreatedAt(run));
        const label = `${shift} — ${bus} — ${created}`;
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
        shiftName: resolveShiftName(run),
        busModelName: resolveBusModelName(run),
        busModelId: modelId,
        status: text(run?.status ?? ""),
        createdAt: formatDate(resolveCreatedAt(run)),
        occupancyPercent: run?.occupancy_percent ?? run?.occupancyPercent,
        externalTemp: run?.external_temp_celsius ?? run?.externalTempCelsius,
        heatingType: run?.auxiliary_heating_type ?? run?.auxiliaryHeatingType,
        numBatteryPacks: run?.num_battery_packs ?? run?.numBatteryPacks,
        busModelData: {
          manufacturer: busModel?.manufacturer ?? busModel?.manufacturer_name ?? "",
          cost: specs?.cost ?? "",
          bus_length_m: specs?.bus_length_m ?? "",
          max_passengers: specs?.max_passengers ?? "",
          bus_lifetime: specs?.bus_lifetime ?? "",
          battery_pack_size_kwh: specs?.battery_pack_size_kwh ?? "",
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
