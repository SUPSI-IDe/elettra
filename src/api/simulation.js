import { authHeaders, API_ROOT } from "./client";

const SIMULATION_PATH = `${API_ROOT}/api/v1/simulation`;

// ── Prediction Runs ──────────────────────────────────────────────────

export const createPredictionRuns = async ({
  shift_ids,
  bus_model_id,
  model_name = "greybox_qrf_production_crps_optimized_3",
  external_temp_celsius = 15,
  occupancy_percent = 50,
  auxiliary_heating_type = "default",
  quantiles,
  num_battery_packs,
} = {}) => {
  if (!Array.isArray(shift_ids) || !shift_ids.length) {
    throw new Error("At least one shift is required.");
  }
  if (!bus_model_id) {
    throw new Error("Bus model is required.");
  }

  const headers = {
    ...authHeaders(),
    "Content-Type": "application/json",
  };

  const body = {
    shift_ids,
    bus_model_id,
    model_name,
    external_temp_celsius: Number(external_temp_celsius),
    occupancy_percent: Number(occupancy_percent),
    auxiliary_heating_type,
  };
  if (Array.isArray(quantiles) && quantiles.length) body.quantiles = quantiles;
  if (num_battery_packs != null) body.num_battery_packs = Number(num_battery_packs);

  const response = await fetch(`${SIMULATION_PATH}/prediction-runs/`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to create prediction runs.";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return payload;
};

export const fetchPredictionRun = async (runId) => {
  if (!runId) throw new Error("Missing runId");
  const headers = authHeaders();
  const response = await fetch(
    `${SIMULATION_PATH}/prediction-runs/${encodeURIComponent(runId)}`,
    { method: "GET", headers }
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to load prediction run.";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return payload;
};

export const fetchPredictionRunPredictions = async (runId) => {
  if (!runId) throw new Error("Missing runId");
  const headers = authHeaders();
  const response = await fetch(
    `${SIMULATION_PATH}/prediction-runs/${encodeURIComponent(runId)}/predictions`,
    { method: "GET", headers }
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to load predictions.";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return payload;
};

// ── Optimization Runs ────────────────────────────────────────────────

export const createOptimizationRun = async ({
  mode = "charging_only",
  shift_ids,
  bus_model_id,
  prediction_run_ids,
  prediction_params,
  charging_stations,
  min_soc = 0.4,
  max_soc = 0.9,
  state_of_health = 1.0,
  quantile_consumption = "mean",
  ...rest
} = {}) => {
  if (!Array.isArray(shift_ids) || !shift_ids.length) {
    throw new Error("At least one shift is required.");
  }

  const headers = {
    ...authHeaders(),
    "Content-Type": "application/json",
  };

  const body = { mode, shift_ids, min_soc, max_soc, state_of_health, quantile_consumption };
  if (bus_model_id) body.bus_model_id = bus_model_id;
  if (Array.isArray(prediction_run_ids) && prediction_run_ids.length) {
    body.prediction_run_ids = prediction_run_ids;
  }
  if (prediction_params) body.prediction_params = prediction_params;
  if (Array.isArray(charging_stations) && charging_stations.length) {
    body.charging_stations = charging_stations;
  }
  Object.assign(body, rest);

  const response = await fetch(`${SIMULATION_PATH}/optimization-runs/`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to create optimization run.";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return payload;
};

export const fetchOptimizationRun = async (runId) => {
  if (!runId) throw new Error("Missing runId");
  const headers = authHeaders();
  const response = await fetch(
    `${SIMULATION_PATH}/optimization-runs/${encodeURIComponent(runId)}`,
    { method: "GET", headers }
  );
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to load optimization run.";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return payload;
};

// ── Trip Statistics ──────────────────────────────────────────────────

export const computeTripStatistics = async (tripIds = []) => {
  if (!Array.isArray(tripIds) || !tripIds.length) {
    throw new Error("At least one trip ID is required.");
  }

  const headers = {
    ...authHeaders(),
    "Content-Type": "application/json",
  };

  const response = await fetch(`${SIMULATION_PATH}/trip-statistics/`, {
    method: "POST",
    headers,
    body: JSON.stringify({ trip_ids: tripIds }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to compute trip statistics.";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return payload;
};
