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

export const fetchPredictionRuns = async () => {
  const headers = authHeaders();
  const response = await fetch(`${SIMULATION_PATH}/prediction-runs/`, {
    method: "GET",
    headers,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to load prediction runs.";
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

export const createOptimizationRun = async (params = {}) => {
  const { shift_ids, charging_stations, ...rest } = params;

  if (!Array.isArray(shift_ids) || !shift_ids.length) {
    throw new Error("At least one shift is required.");
  }

  const headers = {
    ...authHeaders(),
    "Content-Type": "application/json",
  };

  const body = { shift_ids, ...rest };

  if (Array.isArray(charging_stations) && charging_stations.length) {
    body.charging_stations = charging_stations.map((cs) => {
      const clean = { ...cs };
      if (clean.slot_costs_chf == null) delete clean.slot_costs_chf;
      return clean;
    });
  }

  const OMIT_IF_NULL = [
    "optimality_tol",
    "feasibility_tol",
    "mip_abs_gap",
    "mip_rel_gap",
  ];

  for (const key of OMIT_IF_NULL) {
    if (body[key] == null) delete body[key];
  }

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

export const fetchOptimizationRuns = async () => {
  const headers = authHeaders();
  const response = await fetch(`${SIMULATION_PATH}/optimization-runs/`, {
    method: "GET",
    headers,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to load optimization runs.";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return payload;
};

export const deleteOptimizationRun = async (runId) => {
  if (!runId) throw new Error("Missing runId");
  const headers = authHeaders();
  const response = await fetch(
    `${SIMULATION_PATH}/optimization-runs/${encodeURIComponent(runId)}`,
    { method: "DELETE", headers }
  );
  if (response.status === 405) {
    return { deleted: false, reason: "not_supported" };
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to delete optimization run.";
    throw new Error(typeof message === "string" ? message : JSON.stringify(message));
  }
  return { deleted: true };
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
