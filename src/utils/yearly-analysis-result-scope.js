export const YEARLY_GENERAL_SCOPE_KEY = "general";

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const text = (value) =>
  value === null || value === undefined ? "" : String(value).trim();

const toFiniteNumber = (value) => {
  if (
    value === null ||
    value === undefined ||
    typeof value === "boolean" ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const uniqueStrings = (values = []) => {
  const seen = new Set();
  return (Array.isArray(values) ? values : []).filter((value) => {
    const normalized = text(value);
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

const fixedShiftMap = (features = {}) =>
  new Map(
    (Array.isArray(features?.config?.fixedConfiguration?.shifts)
      ? features.config.fixedConfiguration.shifts
      : [])
      .map((shift) => [text(shift?.shiftId), shift])
      .filter(([shiftId]) => shiftId),
  );

const metadataShiftMap = (features = {}) =>
  new Map(
    (Array.isArray(features?.meta?.shifts) ? features.meta.shifts : [])
      .map((shift) => [text(shift?.shiftId), shift])
      .filter(([shiftId]) => shiftId),
  );

const resolveShiftLabel = (
  shift,
  index,
  fixedById,
  metadataById,
  legacyNames,
  shiftFallback,
) => {
  const shiftId = text(shift?.shiftId);
  return (
    text(shift?.shiftName) ||
    text(fixedById.get(shiftId)?.shiftName) ||
    text(metadataById.get(shiftId)?.shiftName) ||
    text(legacyNames[index]) ||
    shiftId ||
    `${shiftFallback} ${index + 1}`
  );
};

/**
 * Builds the navigation scopes exposed by a yearly result. Historical
 * analyses have no shiftResults and therefore expose only General.
 */
export const buildYearlyResultScopes = (
  features = {},
  { generalLabel = "General", shiftFallback = "Shift" } = {},
) => {
  const fixedById = fixedShiftMap(features);
  const metadataById = metadataShiftMap(features);
  const legacyNames = Array.isArray(features?.meta?.shiftNames)
    ? features.meta.shiftNames
    : [];
  const shiftResults = Array.isArray(features?.results?.shiftResults)
    ? features.results.shiftResults
    : [];
  const shiftResultsById = new Map(
    shiftResults
      .map((shift) => [text(shift?.shiftId), shift])
      .filter(([shiftId]) => shiftId),
  );
  const shiftIds = uniqueStrings([
    ...(Array.isArray(features?.config?.shift_ids)
      ? features.config.shift_ids
      : []),
    ...(Array.isArray(features?.config?.fixedConfiguration?.shiftIds)
      ? features.config.fixedConfiguration.shiftIds
      : []),
    ...(Array.isArray(features?.config?.fixedConfiguration?.shifts)
      ? features.config.fixedConfiguration.shifts.map((shift) => shift?.shiftId)
      : []),
    ...(Array.isArray(features?.meta?.shifts)
      ? features.meta.shifts.map((shift) => shift?.shiftId)
      : []),
    ...shiftResults.map((shift) => shift?.shiftId),
  ]).map(text);
  const seen = new Set();
  const scopes = [
    {
      key: YEARLY_GENERAL_SCOPE_KEY,
      kind: "general",
      label: text(generalLabel) || "General",
      shiftId: null,
      shiftName: null,
      status: text(features?.results?.status ?? features?.status) || null,
    },
  ];

  shiftIds.forEach((shiftId, index) => {
    if (!shiftId || seen.has(shiftId)) return;
    seen.add(shiftId);
    const shift = shiftResultsById.get(shiftId) ?? { shiftId };
    const shiftName = resolveShiftLabel(
      shift,
      index,
      fixedById,
      metadataById,
      legacyNames,
      shiftFallback,
    );
    scopes.push({
      key: `shift:${shiftId}`,
      kind: "shift",
      label: shiftName,
      shiftId,
      shiftName,
      status: text(shift?.status) || null,
    });
  });

  const labelCounts = new Map();
  scopes.filter((scope) => scope.kind === "shift").forEach((scope) => {
    const normalized = scope.label.toLocaleLowerCase();
    labelCounts.set(normalized, (labelCounts.get(normalized) ?? 0) + 1);
  });
  scopes.filter((scope) => scope.kind === "shift").forEach((scope) => {
    if ((labelCounts.get(scope.label.toLocaleLowerCase()) ?? 0) > 1) {
      scope.label = `${scope.label} (${scope.shiftId})`;
    }
  });

  return scopes;
};

export const resolveYearlyResultScope = (
  scopes = [],
  requestedKey = YEARLY_GENERAL_SCOPE_KEY,
) => {
  const rows = Array.isArray(scopes) ? scopes : [];
  return (
    rows.find((scope) => scope?.key === requestedKey) ??
    rows.find((scope) => scope?.key === YEARLY_GENERAL_SCOPE_KEY) ??
    null
  );
};

/**
 * General describes the one physical configuration shared by all shifts.
 * Annual outcomes are meaningful only after selecting an individual shift.
 */
export const getYearlyScopeSectionVisibility = (scope = {}) => {
  const isShift = scope?.kind === "shift";
  return {
    overview: !isShift,
    efficiency: isShift,
    costs: isShift,
    emissions: isShift,
  };
};

export const resolveYearlyScopeKeyboardTarget = (
  scopes = [],
  currentKey = YEARLY_GENERAL_SCOPE_KEY,
  key = "",
) => {
  const rows = Array.isArray(scopes) ? scopes : [];
  if (!rows.length) return null;
  const currentIndex = Math.max(
    0,
    rows.findIndex((scope) => scope?.key === currentKey),
  );
  if (key === "Home") return rows[0];
  if (key === "End") return rows.at(-1);
  if (key === "ArrowRight" || key === "ArrowDown") {
    return rows[(currentIndex + 1) % rows.length];
  }
  if (key === "ArrowLeft" || key === "ArrowUp") {
    return rows[(currentIndex - 1 + rows.length) % rows.length];
  }
  return null;
};

/**
 * Returns the data view for a navigation scope. The physical configuration is
 * deliberately left intact: only annual outcomes are narrowed to one shift.
 */
export const buildScopedYearlyFeatures = (
  features = {},
  scope = { kind: "general", key: YEARLY_GENERAL_SCOPE_KEY },
) => {
  if (scope?.kind !== "shift") return features;
  const shiftId = text(scope.shiftId);
  const shift = (Array.isArray(features?.results?.shiftResults)
    ? features.results.shiftResults
    : [])
    .find((candidate) => text(candidate?.shiftId) === shiftId);
  if (!shift) {
    const configuredShiftIds = uniqueStrings([
      ...(Array.isArray(features?.config?.shift_ids)
        ? features.config.shift_ids
        : []),
      ...(Array.isArray(features?.config?.fixedConfiguration?.shiftIds)
        ? features.config.fixedConfiguration.shiftIds
        : []),
    ]).map(text);
    if (!configuredShiftIds.includes(shiftId)) {
      return features;
    }
    const shiftName = text(scope.shiftName) || shiftId;
    const exactSingleShift = configuredShiftIds.length === 1;
    return {
      ...features,
      config: { ...(features.config ?? {}), shift_ids: [shiftId] },
      meta: {
        ...(features.meta ?? {}),
        shiftNames: [shiftName],
        selectedShiftId: shiftId,
        selectedShiftName: shiftName,
      },
      results: {
        ...(features.results ?? {}),
        scenarioResults: exactSingleShift && Array.isArray(features?.results?.scenarioResults)
          ? features.results.scenarioResults.map((row) => ({ ...row, shiftId }))
          : [],
        yearlyTotals: exactSingleShift && isRecord(features?.results?.yearlyTotals)
          ? { ...features.results.yearlyTotals }
          : {},
        status: exactSingleShift
          ? text(features?.results?.status ?? features?.status) || null
          : "unavailable",
        selectedShiftId: shiftId,
        selectedShiftName: shiftName,
      },
    };
  }

  const fixedConfiguration = features?.config?.fixedConfiguration ?? {};
  const commonPacks =
    toFiniteNumber(fixedConfiguration?.battery?.packs) ??
    toFiniteNumber(features?.results?.optimizedPacks);
  const scenarioResults = Array.isArray(shift.scenarioResults)
    ? shift.scenarioResults
    : [];
  const yearlyTotals = isRecord(shift.yearlyTotals)
    ? shift.yearlyTotals
    : {};
  const shiftName = text(scope.shiftName) || text(shift.shiftName) || shiftId;

  return {
    ...features,
    config: {
      ...(features.config ?? {}),
      shift_ids: [shiftId],
    },
    meta: {
      ...(features.meta ?? {}),
      shiftNames: [shiftName],
      selectedShiftId: shiftId,
      selectedShiftName: shiftName,
    },
    results: {
      ...(features.results ?? {}),
      scenarioResults,
      yearlyTotals,
      nominalDailyDistanceKm:
        toFiniteNumber(shift.nominalDailyDistanceKm) ?? null,
      optimizedPacks: commonPacks,
      status: text(shift.status) || null,
      selectedShiftId: shiftId,
      selectedShiftName: shiftName,
    },
  };
};

export const getFixedYearlyShift = (features = {}, shiftId = "") =>
  fixedShiftMap(features).get(text(shiftId)) ?? null;

const scaleFinite = (value, factor) => {
  const numeric = toFiniteNumber(value);
  return numeric === null || factor === null ? value : numeric * factor;
};

const scalePhaseRecord = (record, factor) => {
  if (!isRecord(record)) return record;
  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [
      key,
      typeof value === "number" && Number.isFinite(value)
        ? value * factor
        : value,
    ]),
  );
};

const sumVehicleField = (vehicles, field) => {
  const values = vehicles.map((vehicle) => toFiniteNumber(vehicle?.[field]));
  return values.length && values.every((value) => value !== null)
    ? values.reduce((sum, value) => sum + value, 0)
    : null;
};

const sumRecordField = (records, field) => {
  const values = records.map((record) => toFiniteNumber(record?.[field]));
  return values.length && values.every((value) => value !== null)
    ? values.reduce((sum, value) => sum + value, 0)
    : null;
};

const sumPhaseRecords = (records, field) => {
  const phaseRecords = records.map((record) => record?.[field]);
  if (!phaseRecords.length || phaseRecords.some((record) => !isRecord(record))) {
    return null;
  }
  const phaseKeys = Object.keys(phaseRecords[0]);
  if (!phaseKeys.length) return null;
  const result = {};
  for (const phase of phaseKeys) {
    const total = sumRecordField(phaseRecords, phase);
    if (total === null) return null;
    result[phase] = total;
  }
  return result;
};

const ratio = (part, total, fallback = null) =>
  part !== null && total !== null && total > 0 ? part / total : fallback;

/**
 * Attributes a complete parameterized LCA response to one physical shift.
 * Energy operation follows the vehicle DC-energy share, diesel heating follows
 * its fuel share, and remaining lifecycle/comparator impacts follow distance.
 */
export const buildShiftParameterizedLca = (raw = {}, shiftId = "") => {
  if (!isRecord(raw) || !Array.isArray(raw.vehicles)) return null;
  const normalizedShiftId = text(shiftId);
  const selectedVehicles = raw.vehicles.filter(
    (vehicle) => text(vehicle?.shift_id) === normalizedShiftId,
  );
  if (!normalizedShiftId || !selectedVehicles.length) return null;

  const allVehicles = raw.vehicles;
  const annualKm = sumVehicleField(selectedVehicles, "annual_km");
  const totalAnnualKm = toFiniteNumber(raw.annual_km) ??
    sumVehicleField(allVehicles, "annual_km");
  const dcKwh = sumVehicleField(selectedVehicles, "dc_kwh");
  const totalDcKwh = toFiniteNumber(raw?.energy_boundary?.dc_kwh) ??
    sumVehicleField(allVehicles, "dc_kwh");
  const dieselHeatingLiters = sumVehicleField(
    selectedVehicles,
    "diesel_heating_liters",
  );
  const totalDieselHeatingLiters = sumVehicleField(
    allVehicles,
    "diesel_heating_liters",
  );
  const distanceShare = ratio(annualKm, totalAnnualKm, null);
  if (distanceShare === null) return null;
  const energyShare = ratio(dcKwh, totalDcKwh, distanceShare);
  const heatingShare = ratio(
    dieselHeatingLiters,
    totalDieselHeatingLiters,
    distanceShare,
  );

  const indicators = Object.fromEntries(
    Object.entries(isRecord(raw.indicators) ? raw.indicators : {}).map(
      ([key, indicator]) => {
        if (!isRecord(indicator)) return [key, indicator];
        const vehicleIndicators = selectedVehicles
          .map((vehicle) => vehicle?.indicators?.[key]);
        const hasVehicleIndicators =
          vehicleIndicators.length > 0 &&
          vehicleIndicators.every((value) => isRecord(value));
        const exactOrScaled = (field, share) => {
          const exact = hasVehicleIndicators
            ? sumRecordField(vehicleIndicators, field)
            : null;
          return exact ?? scaleFinite(indicator[field], share);
        };
        const electricityOperation = exactOrScaled(
          "electricity_operation",
          energyShare,
        );
        const dieselHeating = exactOrScaled(
          "diesel_heating",
          heatingShare,
        );
        const otherLifecycle = exactOrScaled(
          "other_lifecycle",
          distanceShare,
        );
        const componentValues = [
          toFiniteNumber(electricityOperation),
          toFiniteNumber(dieselHeating),
          toFiniteNumber(otherLifecycle),
        ];
        const total = componentValues.every((value) => value !== null)
          ? componentValues.reduce((sum, value) => sum + value, 0)
          : scaleFinite(indicator.total, distanceShare);
        const originalTotal = toFiniteNumber(indicator.total);
        const totalFactor =
          originalTotal !== null && originalTotal !== 0 &&
          toFiniteNumber(total) !== null
            ? toFiniteNumber(total) / originalTotal
            : distanceShare;
        const dieselComparatorTotal = exactOrScaled(
          "diesel_comparator_total",
          distanceShare,
        );
        const saving =
          toFiniteNumber(dieselComparatorTotal) !== null &&
          toFiniteNumber(total) !== null
            ? toFiniteNumber(dieselComparatorTotal) - toFiniteNumber(total)
            : scaleFinite(indicator.saving, distanceShare);

        return [key, {
          ...indicator,
          electricity_operation: electricityOperation,
          diesel_heating: dieselHeating,
          other_lifecycle: otherLifecycle,
          total,
          diesel_comparator_total: dieselComparatorTotal,
          saving,
          phases:
            (hasVehicleIndicators && sumPhaseRecords(vehicleIndicators, "phases")) ||
            scalePhaseRecord(indicator.phases, totalFactor),
          diesel_comparator_phases:
            (hasVehicleIndicators && sumPhaseRecords(vehicleIndicators, "diesel_comparator_phases")) ||
            scalePhaseRecord(indicator.diesel_comparator_phases, distanceShare),
          diesel_heating_phases:
            (hasVehicleIndicators && sumPhaseRecords(vehicleIndicators, "diesel_heating_phases")) ||
            scalePhaseRecord(indicator.diesel_heating_phases, heatingShare),
        }];
      },
    ),
  );

  const efficiency =
    toFiniteNumber(raw?.energy_boundary?.grid_to_bus_efficiency) ?? 0.94;
  const scopedDcKwh = dcKwh ?? scaleFinite(
    raw?.energy_boundary?.dc_kwh,
    energyShare,
  );
  const gridKwh =
    scopedDcKwh !== null && efficiency > 0
      ? scopedDcKwh / efficiency
      : scaleFinite(raw?.energy_boundary?.grid_kwh, energyShare);
  const chargingLossesKwh =
    toFiniteNumber(gridKwh) !== null && toFiniteNumber(scopedDcKwh) !== null
      ? toFiniteNumber(gridKwh) - toFiniteNumber(scopedDcKwh)
      : scaleFinite(
          raw?.energy_boundary?.charging_losses_kwh,
          energyShare,
        );

  const attributionNote =
    "Shift-level impacts attribute electricity by DC energy, diesel heating by fuel use, and remaining lifecycle impacts by annual distance.";
  const limitations = uniqueStrings([
    ...(Array.isArray(raw.limitations) ? raw.limitations : []),
    attributionNote,
  ]);

  return {
    ...raw,
    annual_km: annualKm,
    vehicle_count: selectedVehicles.length,
    vehicles: selectedVehicles.map((vehicle) => ({ ...vehicle })),
    energy_boundary: {
      ...(raw.energy_boundary ?? {}),
      dc_kwh: scopedDcKwh,
      grid_kwh: gridKwh,
      charging_losses_kwh: chargingLossesKwh,
      grid_to_bus_efficiency: efficiency,
    },
    indicators,
    limitations,
    scope: {
      kind: "shift",
      shift_id: normalizedShiftId,
      attribution: {
        annual_distance_share: distanceShare,
        dc_energy_share: energyShare,
        diesel_heating_share: heatingShare,
      },
    },
  };
};
