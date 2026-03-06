import { t } from "../../../i18n";
import "./add-simulation.css";
import {
  fetchBusModels,
  fetchShifts,
  fetchBuses,
  fetchStopsByTripId,
} from "../../../api";
import { createOptimizationRun } from "../../../api/simulation";
import { fetchShiftById } from "../../../api/shifts";
import { isAuthenticated } from "../../../api/session";
import { getCurrentUserId } from "../../../store";
import { triggerPartialLoad } from "../../../events";
import { textContent, resolveModelFields } from "../../../ui-helpers";
import { saveRunIds } from "./simulation-runs";

const text = (value) =>
  value === null || value === undefined ? "" : String(value);

const setFeedback = (section, message, tone = "error") => {
  const el = section.querySelector('[data-role="feedback"]');
  if (!el) return;
  if (message) {
    el.textContent = message;
    el.dataset.tone = tone;
    el.hidden = false;
  } else {
    el.textContent = "";
    el.hidden = true;
  }
};

const renderShiftRows = (tbody, shifts = []) => {
  if (!tbody) return;
  if (!shifts.length) {
    tbody.innerHTML = `<tr><td colspan="3">No shifts found.</td></tr>`;
    return;
  }

  tbody.innerHTML = shifts
    .map((shift) => {
      const busModelName = text(shift._resolved_bus_model ?? "—");
      return `
        <tr data-id="${text(shift?.id)}">
          <td class="checkbox">
            <input type="checkbox" aria-label="Select shift" />
          </td>
          <td>${textContent(shift?.name ?? "")}</td>
          <td>${textContent(busModelName)}</td>
        </tr>`;
    })
    .join("");
};

// ── Stop extraction ─────────────────────────────────────────────────

const shiftCache = new Map();
const tripStopsCache = new Map();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID = (v) => UUID_RE.test(v);

/**
 * Fetch GTFS stops for a trip, returning them sorted by stop_sequence.
 * Results are cached per trip_id.
 */
const fetchTripStops = async (tripId) => {
  if (tripStopsCache.has(tripId)) return tripStopsCache.get(tripId);
  try {
    const raw = await fetchStopsByTripId(tripId);
    const stops = Array.isArray(raw) ? raw : [];
    stops.sort((a, b) => (a?.stop_sequence ?? 0) - (b?.stop_sequence ?? 0));
    tripStopsCache.set(tripId, stops);
    return stops;
  } catch {
    tripStopsCache.set(tripId, []);
    return [];
  }
};

/**
 * From a GTFS stop object, pick the database UUID.
 * `id` is the DB primary key (UUID); `stop_id` is the GTFS string identifier.
 */
const resolveStopUUID = (stop) => {
  const candidates = [stop?.id, stop?.stop_id];
  return candidates.map((v) => text(v)).find(isUUID) ?? "";
};

/**
 * Load unique end-stops for the given shift IDs.
 *
 * The shift object (from GET /shifts/{id}) has a `structure` array where each
 * item represents a trip.  Regular trip items carry a `trip_id` (GTFS ID) that
 * we can pass to the /gtfs-stops/by-trip/ endpoint.  Depot / auxiliary items
 * are included using the shift-level start_depot_id / end_depot_id.
 */
const loadEndStopsForShifts = async (shiftIds) => {
  const seen = new Map();

  // 1. Fetch all shift details in parallel
  const shiftPromises = shiftIds.map(async (id) => {
    if (shiftCache.has(id)) return shiftCache.get(id);
    try {
      const s = await fetchShiftById(id);
      shiftCache.set(id, s);
      return s;
    } catch {
      return null;
    }
  });
  const shifts = await Promise.all(shiftPromises);

  // 2. Collect unique trip_ids we need to fetch stops for
  const tripIdSet = new Set();
  for (const shift of shifts) {
    if (!shift) continue;
    const structure = Array.isArray(shift.structure) ? shift.structure : [];
    for (const item of structure) {
      const isDepot =
        item?.status === "depot" ||
        item?.trip?.status === "depot" ||
        item?.trip_type === "auxiliary" ||
        item?.trip?.trip_type === "auxiliary";
      if (isDepot) continue;

      const tripId = text(
        item?.trip_id ?? item?.trip?.trip_id ?? item?.id ?? ""
      );
      if (tripId) tripIdSet.add(tripId);
    }
  }

  // 3. Fetch stops for all unique trips in parallel
  const tripIds = [...tripIdSet];
  await Promise.all(tripIds.map(fetchTripStops));

  // 4. Extract end-stop (last by sequence) from each trip, deduplicate
  for (const tripId of tripIds) {
    const stops = tripStopsCache.get(tripId) ?? [];
    if (!stops.length) continue;
    const last = stops[stops.length - 1];
    const id = resolveStopUUID(last);
    const name = text(last?.stop_name ?? last?.name ?? id);
    if (id && !seen.has(id)) {
      seen.set(id, { stop_id: id, stop_name: name, isCustom: false });
    }
  }

  // 5. Include depot / custom stops using the shift-level depot UUIDs
  for (const shift of shifts) {
    if (!shift) continue;

    const depotPairs = [
      {
        id: text(shift?.start_depot_id ?? shift?.start_depot?.id ?? ""),
        name: text(shift?.start_depot?.name ?? shift?.start_depot_name ?? ""),
      },
      {
        id: text(shift?.end_depot_id ?? shift?.end_depot?.id ?? ""),
        name: text(shift?.end_depot?.name ?? shift?.end_depot_name ?? ""),
      },
    ];

    for (const depot of depotPairs) {
      if (!depot.id || !isUUID(depot.id)) continue;
      if (seen.has(depot.id)) continue;
      seen.set(depot.id, {
        stop_id: depot.id,
        stop_name: depot.name || depot.id,
        isCustom: true,
      });
    }
  }

  return [...seen.values()];
};

// ── Charging-stations table rendering ────────────────────────────────

const COLUMN_DEFS = {
  battery_only: [
    { key: "num_slots", label: "simulation.cs_num_plugs", fallback: "Plugs", min: 0, step: 1, defaultVal: 2 },
    { key: "max_power_per_slot_kw", label: "simulation.cs_power_per_plug", fallback: "kW / plug", min: 0, step: 10, defaultVal: 150 },
  ],
  charging: [
    { key: "slot_cost_chf", label: "simulation.cs_cost_per_plug", fallback: "CHF / plug", min: 0, step: 1000, defaultVal: 150000 },
    { key: "num_slots", label: "simulation.cs_num_plugs", fallback: "Plugs", min: 0, step: 1, defaultVal: 2 },
    { key: "max_power_per_slot_kw", label: "simulation.cs_power_per_plug", fallback: "kW / plug", min: 0, step: 10, defaultVal: 150 },
  ],
  joint: [
    { key: "num_slots", label: "simulation.cs_num_plugs", fallback: "Plugs", min: 0, step: 1, defaultVal: 2 },
    { key: "max_power_per_slot_kw", label: "simulation.cs_power_per_plug", fallback: "kW / plug", min: 0, step: 10, defaultVal: 150 },
    { key: "slot_cost_chf", label: "simulation.cs_cost_per_plug", fallback: "CHF / plug", min: 0, step: 1000, defaultVal: 150000 },
  ],
};

const renderStopsTable = (thead, tbody, stops, mode) => {
  if (!thead || !tbody) return;
  const cols = COLUMN_DEFS[mode] ?? COLUMN_DEFS.battery_only;

  thead.innerHTML = `<tr>
    <th class="checkbox"><input type="checkbox" data-role="select-all-stops" aria-label="Select all stops" /></th>
    <th>${t("simulation.cs_stop_name") || "Stop"}</th>
    ${cols.map((c) => `<th>${t(c.label) || c.fallback}</th>`).join("")}
  </tr>`;

  if (!stops.length) {
    tbody.innerHTML = `<tr><td colspan="${2 + cols.length}">
      ${t("simulation.no_stops_for_shifts") || "No stops found for the selected shifts."}
    </td></tr>`;
    return;
  }

  tbody.innerHTML = stops
    .map(
      (stop) => `<tr data-stop-id="${textContent(stop.stop_id)}">
        <td class="checkbox"><input type="checkbox" ${stop.isCustom ? "checked" : ""} aria-label="Select stop" /></td>
        <td class="stop-name" title="${textContent(stop.stop_id)}">${textContent(stop.stop_name || stop.stop_id)}</td>
        ${cols
          .map(
            (c) =>
              `<td><input type="number" data-field="${c.key}" min="${c.min}" step="${c.step}" value="${c.defaultVal}" /></td>`
          )
          .join("")}
      </tr>`
    )
    .join("");

  // Sync the select-all checkbox with the initial state
  const selectAll = thead.querySelector('[data-role="select-all-stops"]');
  if (selectAll) {
    const allBoxes = tbody.querySelectorAll('input[type="checkbox"]');
    const checkedCount = tbody.querySelectorAll('input[type="checkbox"]:checked').length;
    selectAll.checked = allBoxes.length > 0 && checkedCount === allBoxes.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < allBoxes.length;
  }
};

const collectChargingStations = (tbody, mode) => {
  if (!tbody) return [];
  const cols = COLUMN_DEFS[mode] ?? COLUMN_DEFS.battery_only;
  const rows = tbody.querySelectorAll("tr[data-stop-id]");
  const stations = [];

  for (const row of rows) {
    const cb = row.querySelector('input[type="checkbox"]');
    if (!cb?.checked) continue;

    const stopId = row.dataset.stopId;
    if (!stopId || !isUUID(stopId)) continue;

    const values = {};
    for (const col of cols) {
      const input = row.querySelector(`input[data-field="${col.key}"]`);
      values[col.key] = input ? Number(input.value) : col.defaultVal;
    }

    const numSlots = values.num_slots ?? 2;
    const powerPerSlot = values.max_power_per_slot_kw ?? 450;

    const station = {
      stop_id: stopId,
      num_slots: numSlots,
      max_power_per_slot_kw: powerPerSlot,
      max_total_power_kw: numSlots * powerPerSlot,
    };

    if (values.slot_cost_chf != null) {
      const costPerPlug = values.slot_cost_chf;
      station.slot_costs_chf = Array.from(
        { length: numSlots + 1 },
        (_, i) => (i === 0 ? costPerPlug * 2 : costPerPlug)
      );
    }

    stations.push(station);
  }
  return stations;
};

// ── Main initializer ─────────────────────────────────────────────────

export const initializeAddSimulation = async (
  root = document,
  options = {}
) => {
  const section = root.querySelector("section.add-simulation");
  if (!section) return null;

  const cleanupHandlers = [];
  const form = section.querySelector("form");
  const shiftTbody = section.querySelector(
    'tbody[data-role="shift-selection-body"]'
  );
  const shiftFilter = section.querySelector("#sim-shift-filter");
  const modeSelect = section.querySelector("#var-optimization-mode");

  const csSection = section.querySelector(
    '[data-role="charging-stations-section"]'
  );
  const batteryPacksGroup = section.querySelector(
    '[data-role="battery-packs-group"]'
  );
  const stopsHint = section.querySelector('[data-role="stops-hint"]');
  const stopsWrapper = section.querySelector(
    '[data-role="stops-table-wrapper"]'
  );
  const stopsThead = section.querySelector('[data-role="stops-thead"]');
  const stopsTbody = section.querySelector('[data-role="stops-tbody"]');

  let allShifts = [];
  let currentStops = [];

  const getSelectedShiftIds = () =>
    Array.from(
      shiftTbody?.querySelectorAll('input[type="checkbox"]:checked') ?? []
    )
      .map((input) => input.closest("tr")?.dataset?.id)
      .filter(Boolean);

  // ── Rebuild the charging-stations panel ───────────────────────────
  let rebuildSeq = 0;

  const rebuildStopsTable = async () => {
    const mode = (modeSelect?.value ?? "").trim();

    if (!mode) {
      if (csSection) csSection.hidden = true;
      currentStops = [];
      return;
    }

    if (csSection) csSection.hidden = false;

    const needsBatteryInput = mode === "charging";
    if (batteryPacksGroup) {
      if (needsBatteryInput) {
        batteryPacksGroup.removeAttribute("hidden");
      } else {
        batteryPacksGroup.setAttribute("hidden", "");
      }
    }

    const selectedIds = getSelectedShiftIds();

    if (!selectedIds.length) {
      currentStops = [];
      if (stopsHint) {
        stopsHint.textContent =
          t("simulation.select_shifts_for_stops") ||
          "Select shifts above to see available stops.";
        stopsHint.hidden = false;
      }
      if (stopsWrapper) stopsWrapper.hidden = true;
      return;
    }

    // Show loading feedback while fetching
    const seq = ++rebuildSeq;
    if (stopsHint) {
      stopsHint.textContent =
        t("common.loading") || "Loading…";
      stopsHint.hidden = false;
    }
    if (stopsWrapper) stopsWrapper.hidden = true;

    currentStops = await loadEndStopsForShifts(selectedIds);

    // Guard against stale results if user changed selection while loading
    if (seq !== rebuildSeq) return;

    if (currentStops.length) {
      if (stopsHint) stopsHint.hidden = true;
      if (stopsWrapper) stopsWrapper.hidden = false;
      renderStopsTable(stopsThead, stopsTbody, currentStops, mode);
    } else {
      if (stopsHint) {
        stopsHint.textContent =
          t("simulation.no_stops_for_shifts") ||
          "No stops found for the selected shifts.";
        stopsHint.hidden = false;
      }
      if (stopsWrapper) stopsWrapper.hidden = true;
    }
  };

  // ── Load initial data ────────────────────────────────────────────
  if (isAuthenticated()) {
    try {
      const [shiftsPayload, busesPayload, modelsPayload] = await Promise.all([
        fetchShifts({ skip: 0, limit: 1000 }),
        fetchBuses({ skip: 0, limit: 1000 }),
        fetchBusModels({ skip: 0, limit: 1000 }),
      ]);

      const shifts = Array.isArray(shiftsPayload)
        ? shiftsPayload
        : (shiftsPayload?.items ?? shiftsPayload?.results ?? []);

      const buses = Array.isArray(busesPayload)
        ? busesPayload
        : (busesPayload?.items ?? busesPayload?.results ?? []);

      const models = Array.isArray(modelsPayload)
        ? modelsPayload
        : (modelsPayload?.items ?? modelsPayload?.results ?? []);

      const currentUserId = getCurrentUserId() ?? "";

      const userBuses =
        currentUserId && Array.isArray(buses)
          ? buses.filter((b) => b?.user_id === currentUserId)
          : (buses ?? []);

      const userModels =
        currentUserId && Array.isArray(models)
          ? models.filter((m) => m?.user_id === currentUserId)
          : (models ?? []);

      const modelsById = Object.fromEntries(
        userModels.filter((m) => m?.id).map((m) => [text(m.id), m])
      );

      const busToModelIdMap = new Map(
        userBuses
          .filter((b) => b?.id)
          .map((bus) => [text(bus.id), text(bus?.bus_model_id ?? "")])
      );

      const busModelMap = new Map(
        userBuses
          .filter((b) => b?.id)
          .map((bus) => {
            const modelId = text(bus?.bus_model_id ?? "");
            const resolved = resolveModelFields(modelsById[modelId]);
            return [text(bus.id), resolved.model || ""];
          })
      );

      allShifts = (Array.isArray(shifts) ? shifts : []).map((shift) => {
        const busId = text(
          shift?.bus?.id ?? shift?.bus_id ?? shift?.busId ?? ""
        );
        const directModelId = text(
          shift?.bus?.bus_model_id ??
            shift?.bus_model_id ??
            shift?.busModelId ??
            ""
        );
        const resolvedModelId =
          directModelId || busToModelIdMap.get(busId) || "";
        const modelFromBus = busModelMap.get(busId) || "";
        const modelFromDirect = resolveModelFields(
          modelsById[resolvedModelId]
        ).model;
        const busModelName =
          modelFromBus || modelFromDirect || shift?.bus_model_name || "";

        return {
          ...shift,
          _resolved_bus_model: busModelName,
          _resolved_bus_model_id: resolvedModelId,
        };
      });

      renderShiftRows(shiftTbody, allShifts);

      if (options.prefill?.shiftId) {
        applyPrefill(options.prefill);
      }
    } catch (error) {
      console.error("Failed to load form data", error);
      setFeedback(section, error?.message ?? "Failed to load form data.");
    }
  }

  // ── Prefill ──────────────────────────────────────────────────────
  function applyPrefill(prefill = {}) {
    const {
      shiftId,
      optimizationMode,
      externalTempCelsius,
      occupancyPercent,
      heatingType,
    } = prefill;

    if (shiftId && shiftTbody) {
      const row = shiftTbody.querySelector(`tr[data-id="${shiftId}"]`);
      if (row) {
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (checkbox) {
          checkbox.checked = true;
          row.scrollIntoView({ block: "nearest" });
        }
      }
    }

    if (optimizationMode && modeSelect) modeSelect.value = optimizationMode;

    if (externalTempCelsius != null) {
      const tempInput = section.querySelector("#var-external-temp");
      if (tempInput) tempInput.value = externalTempCelsius;
    }

    if (occupancyPercent != null) {
      const occupancyInput = section.querySelector("#var-occupancy");
      if (occupancyInput) occupancyInput.value = occupancyPercent;
    }

    if (heatingType) {
      const heatingSelect = section.querySelector("#var-heating-type");
      if (heatingSelect) heatingSelect.value = heatingType;
    }

    rebuildStopsTable();
  }

  // ── Shift filter ─────────────────────────────────────────────────
  const applyShiftFilter = () => {
    const query = (shiftFilter?.value ?? "").toLowerCase().trim();
    const filtered = query
      ? allShifts.filter(
          (s) =>
            text(s?.name).toLowerCase().includes(query) ||
            text(s?._resolved_bus_model).toLowerCase().includes(query)
        )
      : allShifts;
    renderShiftRows(shiftTbody, filtered);
  };

  if (shiftFilter) {
    shiftFilter.addEventListener("input", applyShiftFilter);
    cleanupHandlers.push(() =>
      shiftFilter.removeEventListener("input", applyShiftFilter)
    );
  }

  // ── Shift checkbox & mode change → rebuild stops ─────────────────
  const handleSelectionChange = () => {
    rebuildStopsTable();
  };

  if (shiftTbody) {
    shiftTbody.addEventListener("change", handleSelectionChange);
    cleanupHandlers.push(() =>
      shiftTbody.removeEventListener("change", handleSelectionChange)
    );
  }

  if (modeSelect) {
    modeSelect.addEventListener("change", handleSelectionChange);
    cleanupHandlers.push(() =>
      modeSelect.removeEventListener("change", handleSelectionChange)
    );
  }

  // ── Select-all / individual stop checkbox sync ─────────────────────
  const syncSelectAll = () => {
    const selectAll = stopsThead?.querySelector('[data-role="select-all-stops"]');
    if (!selectAll) return;
    const boxes = stopsTbody?.querySelectorAll('input[type="checkbox"]') ?? [];
    const total = boxes.length;
    let checked = 0;
    boxes.forEach((cb) => { if (cb.checked) checked++; });
    selectAll.checked = total > 0 && checked === total;
    selectAll.indeterminate = checked > 0 && checked < total;
  };

  const handleStopsTableChange = (e) => {
    const target = e.target;
    if (target.dataset.role === "select-all-stops") {
      const boxes = stopsTbody?.querySelectorAll('input[type="checkbox"]') ?? [];
      boxes.forEach((cb) => { cb.checked = target.checked; });
    } else if (target.type === "checkbox") {
      syncSelectAll();
    }
  };

  if (stopsThead) {
    stopsThead.addEventListener("change", handleStopsTableChange);
    cleanupHandlers.push(() =>
      stopsThead.removeEventListener("change", handleStopsTableChange)
    );
  }
  if (stopsTbody) {
    stopsTbody.addEventListener("change", handleStopsTableChange);
    cleanupHandlers.push(() =>
      stopsTbody.removeEventListener("change", handleStopsTableChange)
    );
  }

  // ── Cancel ───────────────────────────────────────────────────────
  const handleCancel = () => {
    triggerPartialLoad("simulation-runs");
  };

  section.querySelectorAll('[data-action="cancel"]').forEach((btn) => {
    btn.addEventListener("click", handleCancel);
    cleanupHandlers.push(() =>
      btn.removeEventListener("click", handleCancel)
    );
  });

  // ── Submit ───────────────────────────────────────────────────────
  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback(section, "");

    const selectedShiftIds = getSelectedShiftIds();

    if (!selectedShiftIds.length) {
      setFeedback(
        section,
        t("simulation.shift_required") || "Select at least one shift."
      );
      return;
    }

    const selectedShifts = allShifts.filter((s) =>
      selectedShiftIds.includes(text(s?.id))
    );
    const selectedModelIds = [
      ...new Set(
        selectedShifts
          .map((shift) =>
            text(
              shift?._resolved_bus_model_id ??
                shift?.bus?.bus_model_id ??
                shift?.bus_model_id ??
                shift?.busModelId ??
                ""
            )
          )
          .filter(Boolean)
      ),
    ];

    if (!selectedModelIds.length) {
      setFeedback(
        section,
        "Could not resolve bus model from selected shifts."
      );
      return;
    }

    if (selectedModelIds.length > 1) {
      setFeedback(
        section,
        "Please select shifts that use the same bus model."
      );
      return;
    }

    const formData = new FormData(form);
    const optimizationMode = text(
      formData.get("optimization_mode") ?? ""
    ).trim();

    if (!optimizationMode) {
      setFeedback(
        section,
        t("simulation.mode_required") || "Select an optimization mode."
      );
      return;
    }

    const externalTemp = Number(formData.get("external_temp_celsius") ?? 15);
    const occupancy = Number(formData.get("occupancy_percent") ?? 50);
    const heatingType =
      text(formData.get("auxiliary_heating_type") ?? "default").trim() ||
      "default";

    const chargingStations = collectChargingStations(
      stopsTbody,
      optimizationMode
    );

    const predictionParams = {
      model_name: "greybox_qrf_production_crps_optimized_3",
      external_temp_celsius: externalTemp,
      occupancy_percent: occupancy,
      auxiliary_heating_type: heatingType,
      quantiles: [0.05, 0.5, 0.95],
      num_battery_packs: 12,
    };

    if (optimizationMode === "charging") {
      const packs = Number(formData.get("num_battery_packs"));
      if (packs > 0) predictionParams.num_battery_packs = packs;
    }

    const confirmMessage =
      t("simulation.run_confirm") || "Launch this simulation?";
    if (!confirm(confirmMessage)) return;

    const submitBtn = form?.querySelector('[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const response = await createOptimizationRun({
        mode: optimizationMode,
        shift_ids: selectedShiftIds,
        bus_model_id: selectedModelIds[0],
        prediction_params: predictionParams,
        charging_stations: chargingStations,
        min_soc: 0.4,
        max_soc: 0.9,
      });

      const runId = response?.id ?? response?.optimization_run_id ?? "";
      if (runId) saveRunIds([runId]);

      triggerPartialLoad("simulation-runs", {
        flashMessage:
          t("simulation.completed") || "Simulation submitted successfully.",
      });
    } catch (error) {
      console.error("Failed to submit simulation", error);
      setFeedback(section, error?.message ?? "Failed to submit simulation.");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  };

  if (form) {
    form.addEventListener("submit", handleSubmit);
    cleanupHandlers.push(() =>
      form.removeEventListener("submit", handleSubmit)
    );
  }

  return () => {
    cleanupHandlers.forEach((handler) => handler());
  };
};
