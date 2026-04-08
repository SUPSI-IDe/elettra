import { t } from "../../../i18n";
import { textContent } from "../../../ui-helpers";
import { fetchShiftById } from "../../../api/shifts";
import { fetchStopsByTripId } from "../../../api";

const text = (value) =>
  value === null || value === undefined ? "" : String(value);

const toFiniteNumber = (value) => {
  if (value === "" || (typeof value === "string" && value.trim() === ""))
    return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUUID = (v) => UUID_RE.test(v);

const shiftCache = new Map();
const tripStopsCache = new Map();

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

const resolveStopUUID = (stop) => {
  const candidates = [stop?.id, stop?.stop_id];
  return candidates.map((v) => text(v)).find(isUUID) ?? "";
};

export const loadEndStopsForShifts = async (shiftIds) => {
  const seen = new Map();

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

  const tripIds = [...tripIdSet];
  await Promise.all(tripIds.map(fetchTripStops));

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

// ── Charging-stations table ──────────────────────────────────────────

export const COLUMN_DEFS = {
  battery_only: [
    { key: "num_slots", label: "simulation.cs_num_plugs", fallback: "Plugs", min: 0, step: 1, defaultVal: 2 },
    { key: "max_power_per_slot_kw", label: "simulation.cs_power_per_plug", fallback: "kW / plug", min: 0, step: 10, defaultVal: 150 },
  ],
  charging_only: [
    { key: "slot_cost_chf", label: "simulation.cs_cost_per_plug", fallback: "CHF / plug", min: 0, step: 1000, defaultVal: 150000 },
    { key: "num_slots", label: "simulation.cs_num_plugs", fallback: "Max plugs", min: 1, step: 1, defaultVal: 2 },
    { key: "max_power_per_slot_kw", label: "simulation.cs_power_per_plug", fallback: "kW / plug", min: 0, step: 10, defaultVal: 450 },
  ],
  joint: [
    { key: "slot_cost_chf", label: "simulation.cs_cost_per_plug", fallback: "CHF / plug", min: 0, step: 1000, defaultVal: 150000 },
    { key: "num_slots", label: "simulation.cs_num_plugs", fallback: "Max plugs", min: 1, step: 1, defaultVal: 2 },
    { key: "max_power_per_slot_kw", label: "simulation.cs_power_per_plug", fallback: "kW / plug", min: 0, step: 10, defaultVal: 450 },
  ],
};

export const syncSelectAllCheckbox = (thead, tbody) => {
  const selectAll = thead?.querySelector('[data-role="select-all-stops"]');
  if (!selectAll) return;
  const boxes = tbody?.querySelectorAll('input[type="checkbox"]') ?? [];
  const total = boxes.length;
  let checked = 0;
  boxes.forEach((cb) => {
    if (cb.checked) checked += 1;
  });
  selectAll.checked = total > 0 && checked === total;
  selectAll.indeterminate = checked > 0 && checked < total;
};

export const renderStopsTable = (thead, tbody, stops, mode) => {
  if (!thead || !tbody) return;
  const cols = COLUMN_DEFS[mode] ?? COLUMN_DEFS.battery_only;

  thead.innerHTML = `<tr>
    <th class="checkbox"><input type="checkbox" data-role="select-all-stops" aria-label="${textContent(t("simulation.select_all_stops") || "Select all stops")}" /></th>
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
        <td class="checkbox"><input type="checkbox" ${stop.isCustom ? "checked" : ""} aria-label="${textContent(t("simulation.select_stop") || "Select stop")}" /></td>
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

  syncSelectAllCheckbox(thead, tbody);
};

export const collectChargingStations = (tbody, mode) => {
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

    const station = { stop_id: stopId };
    if (mode === "battery_only") {
      const numSlots = values.num_slots ?? 2;
      const powerPerSlot = values.max_power_per_slot_kw ?? 150;
      station.num_slots = numSlots;
      station.max_total_power_kw = numSlots * powerPerSlot;
      station.max_power_per_slot_kw = powerPerSlot;
    } else {
      const numSlots = values.num_slots ?? 2;
      const costPerPlug = values.slot_cost_chf ?? 150000;
      const powerPerSlot = values.max_power_per_slot_kw ?? 450;
      station.num_slots = numSlots;
      station.slot_costs_chf = Array.from(
        { length: numSlots },
        (_, i) => (i === 0 ? costPerPlug * 2 : costPerPlug)
      );
      station.max_total_power_kw = numSlots * powerPerSlot;
      station.max_power_per_slot_kw = powerPerSlot;
    }
    stations.push(station);
  }
  return stations;
};
