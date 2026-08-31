export const BUS_MODEL_SPEC_FIELDS = Object.freeze([
  "cost",
  "bus_length_m",
  "max_passengers",
  "empty_weight_kg",
  "max_battery_packs",
  "min_battery_packs",
  "battery_pack_size_kwh",
  "battery_pack_cost_chf",
  "max_charging_power_kw",
  "battery_pack_weight_kg",
  "battery_pack_lifetime",
  "bus_lifetime",
]);

export const BUS_MODEL_SPEC_FIELD_LABEL_KEYS = Object.freeze({
  cost: "buses.field_cost",
  bus_length_m: "buses.field_bus_length",
  max_passengers: "buses.field_passenger_capacity",
  empty_weight_kg: "buses.field_empty_weight",
  max_battery_packs: "buses.field_max_battery_packs",
  min_battery_packs: "buses.field_min_battery_packs",
  battery_pack_size_kwh: "buses.field_battery_pack_size",
  battery_pack_cost_chf: "buses.field_battery_pack_cost",
  max_charging_power_kw: "buses.field_max_charging_power",
  battery_pack_weight_kg: "buses.field_battery_pack_weight",
  battery_pack_lifetime: "buses.field_battery_pack_lifetime",
  bus_lifetime: "buses.field_bus_lifetime",
  specs: "buses.physical_specs",
});

const POSITIVE_FIELDS = new Set([
  "bus_length_m",
  "max_passengers",
  "empty_weight_kg",
  "max_battery_packs",
  "min_battery_packs",
  "battery_pack_size_kwh",
  "max_charging_power_kw",
  "battery_pack_weight_kg",
  "battery_pack_lifetime",
  "bus_lifetime",
]);

const NON_NEGATIVE_FIELDS = new Set(["cost", "battery_pack_cost_chf"]);

const INTEGER_FIELDS = new Set([
  "max_passengers",
  "max_battery_packs",
  "min_battery_packs",
  "battery_pack_lifetime",
  "bus_lifetime",
]);

const isMissing = (value) =>
  value === undefined || value === null ||
  (typeof value === "string" && value.trim() === "");

const parseNumericValue = (value) => {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  const trimmed = value.trim();
  return trimmed === "" ? Number.NaN : Number(trimmed);
};

export const normalizeBusModelSpecValues = (rawValues = {}) => {
  const specs = {};
  for (const field of BUS_MODEL_SPEC_FIELDS) {
    const value = rawValues?.[field];
    if (!isMissing(value)) {
      specs[field] = parseNumericValue(value);
    }
  }
  return specs;
};

/**
 * Validate the complete form contract without depending on DOM APIs.
 *
 * The returned issue is deliberately semantic so the UI can translate it.
 */
export const validateBusModelSpecs = (specs, { expectedLengthM } = {}) => {
  if (!specs || typeof specs !== "object" || Array.isArray(specs)) {
    return { ok: false, issue: { code: "required", field: "specs" } };
  }

  for (const field of BUS_MODEL_SPEC_FIELDS) {
    if (!Object.hasOwn(specs, field) || isMissing(specs[field])) {
      return { ok: false, issue: { code: "required", field } };
    }

    const value = specs[field];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { ok: false, issue: { code: "finite", field } };
    }
    if (POSITIVE_FIELDS.has(field) && value <= 0) {
      return { ok: false, issue: { code: "positive", field } };
    }
    if (NON_NEGATIVE_FIELDS.has(field) && value < 0) {
      return { ok: false, issue: { code: "non_negative", field } };
    }
    if (INTEGER_FIELDS.has(field) && !Number.isInteger(value)) {
      return { ok: false, issue: { code: "integer", field } };
    }
  }

  if (specs.min_battery_packs > specs.max_battery_packs) {
    return {
      ok: false,
      issue: { code: "pack_range", field: "min_battery_packs" },
    };
  }

  if (
    expectedLengthM !== undefined &&
    (!Number.isFinite(expectedLengthM) ||
      Math.abs(specs.bus_length_m - expectedLengthM) > 1e-9)
  ) {
    return {
      ok: false,
      issue: {
        code: "category_length",
        field: "bus_length_m",
        expectedLengthM,
      },
    };
  }

  return { ok: true, issue: null };
};

const canonicalFormValue = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

export const captureBusModelSpecFormState = (
  rawValues = {},
  vehicleReferenceKey = ""
) => ({
  vehicleReferenceKey: canonicalFormValue(vehicleReferenceKey),
  fields: Object.fromEntries(
    BUS_MODEL_SPEC_FIELDS.map((field) => [
      field,
      canonicalFormValue(rawValues?.[field]),
    ])
  ),
});

export const haveBusModelSpecsChanged = (initialState, currentState) => {
  if (!initialState || !currentState) return true;
  if (initialState.vehicleReferenceKey !== currentState.vehicleReferenceKey) {
    return true;
  }
  return BUS_MODEL_SPEC_FIELDS.some(
    (field) => initialState.fields?.[field] !== currentState.fields?.[field]
  );
};

export const shouldSubmitBusModelSpecs = ({
  isEditMode,
  initialState,
  currentState,
}) =>
  !isEditMode || haveBusModelSpecsChanged(initialState, currentState);

const STANDARD_VEHICLE_CATEGORY_KEY = "standard_electric_bus_12_13m";

export const resolveExpectedBusLengthM = ({
  isEditMode,
  categoryLengthM,
  initialState,
  currentState,
  categoryWasTouched = false,
}) => {
  const keepsLegacyStandardCategory =
    isEditMode &&
    !categoryWasTouched &&
    initialState?.vehicleReferenceKey === STANDARD_VEHICLE_CATEGORY_KEY &&
    currentState?.vehicleReferenceKey === STANDARD_VEHICLE_CATEGORY_KEY;
  const keepsLegacyTwelveMetreLength =
    initialState?.fields?.bus_length_m === "12" &&
    currentState?.fields?.bus_length_m === "12";

  return keepsLegacyStandardCategory && keepsLegacyTwelveMetreLength
    ? 12
    : categoryLengthM;
};

export const mergeBusModelSpecs = ({
  currentSpecs = {},
  formSpecs = {},
  categorySpecs = {},
  modelType,
  defaultAuxiliaryConsumption,
} = {}) => {
  const safeCurrentSpecs =
    currentSpecs && typeof currentSpecs === "object" && !Array.isArray(currentSpecs)
      ? currentSpecs
      : {};
  const merged = {
    ...safeCurrentSpecs,
    ...formSpecs,
    ...categorySpecs,
  };
  const lcaSources = [
    safeCurrentSpecs.lca,
    formSpecs?.lca,
    categorySpecs?.lca,
  ].filter(
    (value) => value && typeof value === "object" && !Array.isArray(value)
  );
  if (lcaSources.length > 0) {
    merged.lca = Object.assign({}, ...lcaSources);
  }

  if (modelType !== undefined) merged.model_type = modelType;
  if (
    !Object.hasOwn(merged, "auxiliary_consumption_kw") &&
    defaultAuxiliaryConsumption !== undefined
  ) {
    merged.auxiliary_consumption_kw = defaultAuxiliaryConsumption;
  }
  return merged;
};
