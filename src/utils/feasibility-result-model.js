export const FEASIBILITY_DECISION = Object.freeze({
  FIXED: "fixed",
  OPTIMIZED: "optimized",
  UNKNOWN: "unknown",
});

export const FEASIBILITY_STATION_STATUS = Object.freeze({
  FIXED: "fixed",
  CANDIDATE: "candidate",
  INSTALLED: "installed",
  REJECTED: "rejected",
  CONFIGURED: "configured",
});

const MODE_DECISIONS = Object.freeze({
  battery_only: Object.freeze({
    battery: FEASIBILITY_DECISION.OPTIMIZED,
    infrastructure: FEASIBILITY_DECISION.FIXED,
  }),
  charging_only: Object.freeze({
    battery: FEASIBILITY_DECISION.FIXED,
    infrastructure: FEASIBILITY_DECISION.OPTIMIZED,
  }),
  joint: Object.freeze({
    battery: FEASIBILITY_DECISION.OPTIMIZED,
    infrastructure: FEASIBILITY_DECISION.OPTIMIZED,
  }),
});

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const hasOwn = (value, key) =>
  isRecord(value) && Object.prototype.hasOwnProperty.call(value, key);

const firstText = (...values) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return null;
};

const toFiniteNumber = (value) => {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
};

const toNonNegativeNumber = (value) => {
  const normalized = toFiniteNumber(value);
  return normalized !== null && normalized >= 0 ? normalized : null;
};

const toBoolean = (value) =>
  typeof value === "boolean" ? value : null;

const toRecordsById = (value, idKeys) => {
  const records = [];

  if (Array.isArray(value)) {
    for (const entry of value) {
      if (!isRecord(entry)) continue;
      const id = firstText(...idKeys.map((key) => entry[key]));
      if (id) records.push([id, entry]);
    }
    return records;
  }

  if (!isRecord(value)) return records;
  for (const [key, entry] of Object.entries(value)) {
    if (!isRecord(entry)) continue;
    const id = firstText(...idKeys.map((idKey) => entry[idKey]), key);
    if (id) records.push([id, entry]);
  }
  return records;
};

const uniqueIds = (...groups) => {
  const result = [];
  const seen = new Set();
  for (const group of groups) {
    for (const value of group) {
      const id = firstText(value);
      if (!id || seen.has(id)) continue;
      seen.add(id);
      result.push(id);
    }
  }
  return result;
};

const maximum = (values) => {
  const valid = values.filter((value) => value !== null);
  return valid.length ? Math.max(...valid) : null;
};

const decisionForMode = (mode) =>
  MODE_DECISIONS[mode] ?? {
    battery: FEASIBILITY_DECISION.UNKNOWN,
    infrastructure: FEASIBILITY_DECISION.UNKNOWN,
  };

const derivePackSizeKwh = (batteryEntries) => {
  const ratios = [
    ["base_kwh", "base_packs"],
    ["max_physical_kwh", "max_physical_packs"],
    ["optimized_kwh", "required_total_packs"],
    ["optimized_kwh", "optimized_packs"],
  ];

  for (const [, battery] of batteryEntries) {
    for (const [energyKey, packKey] of ratios) {
      const energy = toNonNegativeNumber(battery[energyKey]);
      const packs = toNonNegativeNumber(battery[packKey]);
      if (energy !== null && packs !== null && packs > 0) {
        return energy / packs;
      }
    }
  }
  return null;
};

const normalizeChargingSessions = (sessions) => {
  if (!Array.isArray(sessions)) return [];

  return sessions
    .filter(isRecord)
    .map((session, index) => ({
      startMinute: toNonNegativeNumber(session.start_minute),
      endMinute: toNonNegativeNumber(session.end_minute),
      durationMinutes: toNonNegativeNumber(session.duration_minutes),
      stationStopId: firstText(session.station_stop_id, session.stop_id),
      stationName: firstText(session.station_name, session.stop_name),
      energyKwh: toNonNegativeNumber(session.energy_kwh),
      _sourceIndex: index,
    }))
    .sort((left, right) => {
      const leftStart = left.startMinute ?? Number.POSITIVE_INFINITY;
      const rightStart = right.startMinute ?? Number.POSITIVE_INFINITY;
      return leftStart - rightStart || left._sourceIndex - right._sourceIndex;
    })
    .map(({ _sourceIndex, ...session }) => session);
};

const resolveStationStatus = ({
  infrastructureDecision,
  hasInput,
  hasInstalledResult,
  installedSlots,
}) => {
  if (
    infrastructureDecision === FEASIBILITY_DECISION.FIXED &&
    (hasInput || hasInstalledResult)
  ) {
    return FEASIBILITY_STATION_STATUS.FIXED;
  }
  if (hasInstalledResult && installedSlots !== null) {
    return installedSlots > 0
      ? FEASIBILITY_STATION_STATUS.INSTALLED
      : FEASIBILITY_STATION_STATUS.REJECTED;
  }
  if (infrastructureDecision === FEASIBILITY_DECISION.OPTIMIZED && hasInput) {
    return FEASIBILITY_STATION_STATUS.CANDIDATE;
  }
  if (hasInstalledResult) return FEASIBILITY_STATION_STATUS.CONFIGURED;
  return FEASIBILITY_STATION_STATUS.CONFIGURED;
};

const normalizeStations = ({ inputParams, results, infrastructureDecision }) => {
  const inputEntries = toRecordsById(inputParams.charging_stations, ["stop_id", "id"]);
  const installedEntries = toRecordsById(results.installed_chargers, ["stop_id", "id"]);
  const utilizationEntries = toRecordsById(results.station_utilization, ["stop_id", "id"]);
  const inputById = new Map(inputEntries);
  const installedById = new Map(installedEntries);
  const utilizationById = new Map(utilizationEntries);
  const stopIds = uniqueIds(
    inputEntries.map(([id]) => id),
    installedEntries.map(([id]) => id),
    utilizationEntries.map(([id]) => id),
  );

  return stopIds.map((stopId) => {
    const input = inputById.get(stopId) ?? {};
    const installed = installedById.get(stopId) ?? {};
    const utilization = utilizationById.get(stopId) ?? {};
    const hasInput = inputById.has(stopId);
    const hasInstalledResult = installedById.has(stopId);
    const configuredSlots = toNonNegativeNumber(input.num_slots ?? input.slots);
    const installedSlots = toNonNegativeNumber(installed.num_slots ?? installed.slots);
    const slots = hasInstalledResult
      ? installedSlots
      : configuredSlots;
    const powerPerSlotKw = toNonNegativeNumber(
      installed.max_power_per_slot_kw ??
        installed.power_per_slot_kw ??
        input.max_power_per_slot_kw ??
        input.power_per_slot_kw,
    );
    const installedTotalPowerKw = toNonNegativeNumber(
      installed.max_total_power_kw ??
        installed.total_power_kw ??
        installed.max_power_kw,
    );
    const configuredTotalPowerKw = toNonNegativeNumber(
      input.max_total_power_kw ??
        input.total_power_kw ??
        input.max_power_kw,
    );
    const slotLimitedPowerKw =
      slots !== null && powerPerSlotKw !== null
        ? slots * powerPerSlotKw
        : null;
    const totalPowerKw = hasInstalledResult
      ? installedSlots === 0
        ? 0
        : installedTotalPowerKw ?? (
          slotLimitedPowerKw !== null && configuredTotalPowerKw !== null
            ? Math.min(slotLimitedPowerKw, configuredTotalPowerKw)
            : slotLimitedPowerKw ?? configuredTotalPowerKw
        )
      : configuredTotalPowerKw ?? slotLimitedPowerKw;
    const status = resolveStationStatus({
      infrastructureDecision,
      hasInput,
      hasInstalledResult,
      installedSlots,
    });

    return {
      stopId,
      stopName: firstText(
        installed.stop_name,
        utilization.stop_name,
        input.stop_name,
        input.name,
        stopId,
      ),
      status,
      selected:
        status === FEASIBILITY_STATION_STATUS.INSTALLED ||
        status === FEASIBILITY_STATION_STATUS.FIXED
          ? slots === null ? null : slots > 0
          : status === FEASIBILITY_STATION_STATUS.REJECTED
            ? false
            : null,
      configuredSlots,
      installedSlots,
      slots,
      powerPerSlotKw,
      totalPowerKw,
      slotCostsChf: Array.isArray(installed.slot_costs_chf ?? input.slot_costs_chf)
        ? (installed.slot_costs_chf ?? input.slot_costs_chf)
            .map(toNonNegativeNumber)
            .filter((value) => value !== null)
        : [],
      installationCostChf: toNonNegativeNumber(installed.cost_chf),
      peakConcurrentBuses: toNonNegativeNumber(utilization.peak_concurrent_buses),
      totalEnergyKwh: toNonNegativeNumber(utilization.total_energy_kwh),
    };
  });
};

/**
 * Converts an optimization response into a UI-oriented feasibility model.
 *
 * The model deliberately represents one common bus configuration and one
 * shared charging infrastructure. Per-shift battery values remain diagnostics:
 * they never become independent bus configurations.
 */
export function buildFeasibilityResultModel(optimizationRun = {}) {
  const run = isRecord(optimizationRun) ? optimizationRun : {};
  const inputParams = isRecord(run.input_params) ? run.input_params : {};
  const results = isRecord(run.results) ? run.results : {};
  const mode = firstText(
    inputParams.mode,
    inputParams.optimization_mode,
    run.mode,
    run.optimization_mode,
  );
  const decisions = decisionForMode(mode);

  const batteryEntries = toRecordsById(results.battery_results, ["shift_id", "id"]);
  const summaryEntries = toRecordsById(results.per_bus_summary, ["shift_id", "id"]);
  const batteryByShift = new Map(batteryEntries);
  const summaryByShift = new Map(summaryEntries);
  const requestedShiftIds = Array.isArray(inputParams.shift_ids)
    ? inputParams.shift_ids
    : [];
  const shiftIds = uniqueIds(
    requestedShiftIds,
    batteryEntries.map(([id]) => id),
    summaryEntries.map(([id]) => id),
  );

  const optimizedPackValues = batteryEntries
    .map(([, battery]) => toNonNegativeNumber(battery.optimized_packs));
  const optimizedFleetPacks = maximum(optimizedPackValues);
  const fixedFleetPacks = toNonNegativeNumber(inputParams.fixed_battery_packs);
  const fleetPacks =
    decisions.battery === FEASIBILITY_DECISION.FIXED && fixedFleetPacks !== null
      ? fixedFleetPacks
      : optimizedFleetPacks;
  const packSizeKwh = derivePackSizeKwh(batteryEntries);

  const shifts = shiftIds.map((shiftId) => {
    const battery = batteryByShift.get(shiftId) ?? {};
    const summary = summaryByShift.get(shiftId) ?? {};
    const optimizedPacks = toNonNegativeNumber(battery.optimized_packs);
    const requiredPacks = toNonNegativeNumber(
      battery.required_total_packs ?? summary.required_total_packs,
    );
    const chargingSessions = normalizeChargingSessions(summary.charging_sessions);

    return {
      shiftId,
      shiftName: firstText(summary.shift_name, battery.shift_name, shiftId),
      battery: {
        referencePacks: toNonNegativeNumber(battery.reference_packs),
        basePacks: toNonNegativeNumber(battery.base_packs),
        optimizedPacks,
        requiredPacks,
        maxPhysicalPacks: toNonNegativeNumber(battery.max_physical_packs),
        excessPacks: toNonNegativeNumber(battery.excess_packs),
        baseKwh: toNonNegativeNumber(battery.base_kwh),
        optimizedKwh: toNonNegativeNumber(battery.optimized_kwh),
        maxPhysicalKwh: toNonNegativeNumber(battery.max_physical_kwh),
        physicalFeasible: toBoolean(battery.physical_feasible),
        feasibilityStatus: firstText(battery.feasibility_status),
        commonPacks: fleetPacks,
        commonPackMargin:
          fleetPacks !== null && requiredPacks !== null
            ? fleetPacks - requiredPacks
            : null,
        isSizing:
          decisions.battery === FEASIBILITY_DECISION.OPTIMIZED &&
          fleetPacks !== null &&
          optimizedPacks === fleetPacks,
      },
      operation: {
        minSocKwh: toNonNegativeNumber(summary.min_soc_kwh),
        maxSocKwh: toNonNegativeNumber(summary.max_soc_kwh),
        totalChargedKwh: toNonNegativeNumber(summary.total_charged_kwh),
        numChargingSessions:
          toNonNegativeNumber(summary.num_charging_sessions) ?? chargingSessions.length,
        chargingSessions,
      },
    };
  });

  const requiredMaximum = maximum(
    shifts.map((shift) => shift.battery.requiredPacks),
  );
  const sizingShifts = shifts.filter((shift) => shift.battery.isSizing);
  const mostDemandingShifts = requiredMaximum === null
    ? []
    : shifts.filter((shift) => shift.battery.requiredPacks === requiredMaximum);
  const stations = normalizeStations({
    inputParams,
    results,
    infrastructureDecision: decisions.infrastructure,
  });
  const infrastructureInputAvailable = hasOwn(inputParams, "charging_stations");
  const infrastructureResultAvailable = hasOwn(results, "installed_chargers");
  const infrastructureDataAvailable =
    infrastructureInputAvailable ||
    infrastructureResultAvailable ||
    hasOwn(results, "station_utilization");
  const infrastructureSelectionComplete =
    decisions.infrastructure === FEASIBILITY_DECISION.FIXED
      ? infrastructureInputAvailable && stations.every((station) => station.selected !== null)
      : decisions.infrastructure === FEASIBILITY_DECISION.OPTIMIZED
        ? infrastructureResultAvailable && stations.every((station) => station.selected !== null)
        : false;

  return {
    mode,
    electrificationFeasible: toBoolean(results.electrification_feasible),
    fleet: {
      scope: "common",
      busModelId: firstText(inputParams.bus_model_id, run.bus_model_id),
      battery: {
        decision: decisions.battery,
        packs: fleetPacks,
        packSizeKwh,
        nominalKwh:
          fleetPacks !== null && packSizeKwh !== null
            ? fleetPacks * packSizeKwh
            : null,
        sizingShiftIds: sizingShifts.map((shift) => shift.shiftId),
        sizingShiftNames: sizingShifts.map((shift) => shift.shiftName),
        mostDemandingShiftIds: mostDemandingShifts.map((shift) => shift.shiftId),
        mostDemandingShiftNames: mostDemandingShifts.map((shift) => shift.shiftName),
      },
    },
    infrastructure: {
      scope: "shared",
      decision: decisions.infrastructure,
      dataAvailable: infrastructureDataAvailable,
      resultAvailable: infrastructureResultAvailable,
      selectionComplete: infrastructureSelectionComplete,
      totalInstallationCostChf: toNonNegativeNumber(
        results.total_installation_cost_chf,
      ),
      stations,
    },
    shifts,
  };
}
