const TOLERANCE = 1e-12;

const HISTORICAL_BATTERY_DEFAULTS = Object.freeze({
  battery_soc_policy: 'residual_soc',
  state_of_health: 1,
  min_soc: 0.4,
  max_soc: 0.9,
  allowed_min_soc: 0.1,
  allowed_max_soc: 0.95,
  session_connection_minutes: 0,
  layover_reduction_minutes: 0,
});

export const NEW_BATTERY_DEFAULTS = Object.freeze({
  ...HISTORICAL_BATTERY_DEFAULTS,
  state_of_health: 0.7,
  session_connection_minutes: 1,
});

// The form edits energy fractions. The API keeps its established SOC contract.
export function batteryUsageControls(params = NEW_BATTERY_DEFAULTS) {
  const p = historicalBatteryParams(params);
  return {
    state_of_health: p.state_of_health,
    battery_soc_policy: p.battery_soc_policy,
    usable_capacity_fraction: p.max_soc - p.min_soc,
    max_residual_usage_fraction: p.allowed_max_soc - p.allowed_min_soc,
    session_connection_minutes: p.session_connection_minutes,
    layover_reduction_minutes: p.layover_reduction_minutes,
  };
}

export class BatteryUsageLimitError extends RangeError {
  constructor(stateOfHealth, requestedInitialUsage, maximumResidualUsage) {
    super('Requested initial capacity exceeds maximum residual usage');
    this.name = 'BatteryUsageLimitError';
    this.stateOfHealth = stateOfHealth;
    this.requestedInitialUsage = requestedInitialUsage;
    this.requiredResidualUsage = requestedInitialUsage / stateOfHealth;
    this.maximumResidualUsage = maximumResidualUsage;
    this.maximumInitialUsage = stateOfHealth * maximumResidualUsage;
  }
}

export function batteryParamsFromUsage(controls, savedParams = null) {
  requireObject(controls, 'controls');
  const h = finiteNumber(controls.state_of_health, 'state_of_health');
  const u = finiteNumber(controls.usable_capacity_fraction, 'usable_capacity_fraction');
  const constant = controls.battery_soc_policy === 'constant_initial_usable';
  const limit = constant ? finiteNumber(controls.max_residual_usage_fraction, 'max_residual_usage_fraction') : Math.max(.85, u);
  if (h <= 0 || h > 1 || u <= 0 || u > 1 || limit <= 0 || limit > 1) {
    throw new RangeError('Capacity fractions and SOH must be within (0, 1]');
  }
  if (constant && u / h > limit + TOLERANCE) {
    throw new BatteryUsageLimitError(h, u, limit);
  }
  let bounds;
  // An unchanged duplicate must preserve its exact historical SOC placement.
  if (savedParams) {
    const previous = batteryUsageControls(savedParams);
    const same = ['state_of_health', 'usable_capacity_fraction', 'max_residual_usage_fraction']
      .every(key => Math.abs(previous[key] - controls[key]) <= TOLERANCE)
      && previous.battery_soc_policy === controls.battery_soc_policy;
    if (same) {
      const saved = historicalBatteryParams(savedParams);
      bounds = Object.fromEntries(['min_soc', 'max_soc', 'allowed_min_soc', 'allowed_max_soc'].map(key => [key, saved[key]]));
    }
  }
  if (!bounds) {
    // Default 85% allowance -> 10–95%. Larger allowances can reach 0–100%.
    const high = Math.max(.95, limit);
    const low = high - limit;
    const maximum = Math.min(high, Math.max(.9, low + u));
    bounds = { min_soc: Math.max(low, maximum - u), max_soc: maximum,
      allowed_min_soc: low, allowed_max_soc: high };
  }
  const params = { ...bounds, state_of_health: h, battery_soc_policy: controls.battery_soc_policy,
    session_connection_minutes: controls.session_connection_minutes,
    layover_reduction_minutes: controls.layover_reduction_minutes };
  resolveBatteryPolicy(params); // Same validation and expansion used by results.
  return params;
}

function finiteNumber(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  return value;
}

function requireObject(value, name) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object`);
  }
}

export function resolveBatteryPolicy(params = {}) {
  requireObject(params, 'params');
  const values = { ...HISTORICAL_BATTERY_DEFAULTS };
  for (const key of Object.keys(values)) {
    if (params[key] !== undefined) values[key] = params[key];
  }
  const { battery_soc_policy: policy } = values;
  if (policy !== 'residual_soc' && policy !== 'constant_initial_usable') {
    throw new RangeError('battery_soc_policy must be residual_soc or constant_initial_usable');
  }
  const h = finiteNumber(values.state_of_health, 'state_of_health');
  const a = finiteNumber(values.min_soc, 'min_soc');
  const b = finiteNumber(values.max_soc, 'max_soc');
  const low = finiteNumber(values.allowed_min_soc, 'allowed_min_soc');
  const high = finiteNumber(values.allowed_max_soc, 'allowed_max_soc');
  if (h <= 0 || h > 1) throw new RangeError('state_of_health must satisfy 0 < value <= 1');
  if (a < 0 || a >= b || b > 1) throw new RangeError('SOC reference bounds must satisfy 0 <= min_soc < max_soc <= 1');
  if (low < 0 || low >= high || high > 1) throw new RangeError('SOC allowed bounds must satisfy 0 <= allowed_min_soc < allowed_max_soc <= 1');

  let min = a;
  let max = b;
  if (policy === 'constant_initial_usable') {
    if (a < low - TOLERANCE || b > high + TOLERANCE) {
      throw new RangeError('SOC reference bounds must be inside allowed bounds for constant_initial_usable');
    }
    const width = (b - a) / h;
    min = b - width;
    if (min < low) {
      min = low;
      max = low + width;
    }
    if (max > high + TOLERANCE) {
      throw new RangeError(`Requested usable fraction ${b - a} exceeds available fraction ${h * (high - low)} at state_of_health ${h}`);
    }
    max = Math.min(max, high);
  }
  return {
    battery_soc_policy: policy,
    state_of_health: h,
    reference_min_soc: a,
    reference_max_soc: b,
    allowed_min_soc: low,
    allowed_max_soc: high,
    min_soc: min,
    max_soc: max,
    low_soc_warning: min < 0.2 - TOLERANCE,
    preferred_max_soc_exceeded: max > b + TOLERANCE,
    usable_fraction_initial: h * (max - min),
  };
}

export function batteryEnergy(nominalKwh, policy) {
  finiteNumber(nominalKwh, 'nominal_capacity_kwh');
  if (nominalKwh < 0) throw new RangeError('nominal_capacity_kwh must be nonnegative');
  requireObject(policy, 'policy');
  const resolved = resolveBatteryPolicy({
    ...policy,
    min_soc: policy.reference_min_soc ?? policy.min_soc,
    max_soc: policy.reference_max_soc ?? policy.max_soc,
  });
  const residual = nominalKwh * resolved.state_of_health;
  return {
    nominal_capacity_kwh: nominalKwh,
    residual_capacity_kwh: residual,
    usable_capacity_kwh: nominalKwh * resolved.usable_fraction_initial,
    min_energy_kwh: residual * resolved.min_soc,
    max_energy_kwh: residual * resolved.max_soc,
  };
}

export function historicalBatteryParams(input = {}) {
  requireObject(input, 'input');
  const result = { ...input };
  for (const [key, value] of Object.entries(HISTORICAL_BATTERY_DEFAULTS)) {
    result[key] ??= value;
  }
  return result;
}

// Saved operating bounds are authoritative; do not expand an already expanded window.
export function resultBatteryPolicy(run = {}) {
  const input = historicalBatteryParams(run.input_params ?? {});
  const saved = run.results?.operating_assumptions ?? input.operating_assumptions;
  if (saved?.version === 'battery-timing-v1') return { ...input, ...saved };
  return { ...input, ...resolveBatteryPolicy(input) };
}
