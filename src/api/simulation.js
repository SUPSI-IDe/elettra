import { authHeaders, API_ROOT } from "./client";
import { fetchBusModelById } from "./bus-models";
import {
  DEFAULT_PASSENGER_WEIGHT_KG,
  DEFAULT_PREDICTION_MODEL_NAME,
  DEFAULT_PREDICTION_QUANTILES,
  GREYBOX_PARAMS,
} from "../config/simulation-defaults";

const SIMULATION_PATH = `${API_ROOT}/api/v1/simulation`;

const text = (value) =>
  value === null || value === undefined ? "" : String(value);

const toFiniteNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseSpecs = (specs) => {
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

const computeBatteryPackCases = (specs = {}) => {
  const minBatteryPacksRaw = toFiniteNumber(specs.min_battery_packs);
  const maxBatteryPacksRaw = toFiniteNumber(specs.max_battery_packs);
  const minBatteryPacks =
    minBatteryPacksRaw == null ? null : Math.round(minBatteryPacksRaw);
  const maxBatteryPacks =
    maxBatteryPacksRaw == null ? null : Math.round(maxBatteryPacksRaw);

  if (
    !Number.isFinite(minBatteryPacks) ||
    !Number.isFinite(maxBatteryPacks) ||
    minBatteryPacks <= 0 ||
    maxBatteryPacks < minBatteryPacks
  ) {
    throw new Error("Selected bus model is missing battery pack limits.");
  }

  const batteryPackCases = [];
  for (let packs = minBatteryPacks; packs <= maxBatteryPacks; packs += 2) {
    batteryPackCases.push(packs);
  }
  if (batteryPackCases[batteryPackCases.length - 1] !== maxBatteryPacks) {
    batteryPackCases.push(maxBatteryPacks);
  }

  return [...new Set(batteryPackCases)];
};

const buildContextualParameters = ({
  specs,
  occupancyPercent,
  quantiles,
  numBatteryPacks,
}) => {
  const busLengthM = toFiniteNumber(specs.bus_length_m);
  const batteryPackSizeKwh = toFiniteNumber(specs.battery_pack_size_kwh);
  const emptyWeightKg = toFiniteNumber(specs.empty_weight_kg);
  const batteryPackWeightKg = toFiniteNumber(specs.battery_pack_weight_kg);
  const maxPassengers = toFiniteNumber(specs.max_passengers);
  const passengerCount =
    maxPassengers == null
      ? null
      : (maxPassengers * Number(occupancyPercent || 0)) / 100;
  const passengerWeightKg =
    passengerCount == null
      ? null
      : passengerCount * DEFAULT_PASSENGER_WEIGHT_KG;
  const totalWeightKg =
    emptyWeightKg == null ||
    batteryPackWeightKg == null ||
    passengerWeightKg == null
      ? null
      : emptyWeightKg +
        batteryPackWeightKg * numBatteryPacks +
        passengerWeightKg;

  return {
    quantiles,
    ...(busLengthM != null ? { bus_length_m: busLengthM } : {}),
    greybox_params: { ...GREYBOX_PARAMS },
    ...(totalWeightKg != null
      ? { total_weight_kg: Number(totalWeightKg.toFixed(3)) }
      : {}),
    num_battery_packs: numBatteryPacks,
    ...(batteryPackSizeKwh != null
      ? { battery_capacity_kwh: batteryPackSizeKwh * numBatteryPacks }
      : {}),
  };
};

const POLL_INTERVAL_MS = 3000;
const MAX_POLL_ATTEMPTS = 60;

const waitForPredictionRuns = async (runIds) => {
  const pending = new Set(runIds);

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const checks = await Promise.all(
      [...pending].map((id) => fetchPredictionRun(id))
    );

    for (const run of checks) {
      const id = text(run?.id ?? "");
      const status = text(run?.status ?? "").toLowerCase();

      if (status === "completed" || status === "done") {
        pending.delete(id);
      } else if (status === "failed" || status === "error") {
        throw new Error(`Prediction run ${id} failed.`);
      }
    }

    if (pending.size === 0) return;

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `Prediction runs did not complete in time (${pending.size} still running).`
  );
};

const extractPredictionRunIds = (payload) => {
  if (!payload || typeof payload !== "object") return [];

  const ids =
    payload.prediction_run_ids ??
    payload.predictionRunIds ??
    [];

  if (Array.isArray(ids) && ids.length) {
    return ids.map((id) => text(id)).filter(Boolean);
  }

  return [];
};

const createPredictionRunVariants = async ({
  shift_ids,
  bus_model_id,
  prediction_params = {},
}) => {
  const busModel = await fetchBusModelById(bus_model_id);
  const specs = parseSpecs(busModel?.specs);
  const quantiles =
    Array.isArray(prediction_params.quantiles) &&
    prediction_params.quantiles.length
      ? prediction_params.quantiles
      : DEFAULT_PREDICTION_QUANTILES;
  const occupancyPercent =
    prediction_params.occupancy_percent == null
      ? 50
      : Number(prediction_params.occupancy_percent);
  const modelName =
    text(prediction_params.model_name).trim() ||
    DEFAULT_PREDICTION_MODEL_NAME;
  const batteryPackCases = computeBatteryPackCases(specs);

  const createdIds = [];

  for (const numBatteryPacks of batteryPackCases) {
    const contextualParameters = buildContextualParameters({
      specs,
      occupancyPercent,
      quantiles,
      numBatteryPacks,
    });

    const payload = await createPredictionRuns({
      shift_ids,
      bus_model_id,
      model_name: modelName,
      external_temp_celsius:
        prediction_params.external_temp_celsius ?? 15,
      occupancy_percent: occupancyPercent,
      auxiliary_heating_type:
        prediction_params.auxiliary_heating_type ?? "default",
      quantiles,
      num_battery_packs: numBatteryPacks,
      contextual_parameters: contextualParameters,
    });

    const ids = extractPredictionRunIds(payload);
    if (!ids.length) {
      throw new Error(
        `Unable to retrieve the created prediction run IDs for ${numBatteryPacks} battery packs.`
      );
    }
    createdIds.push(...ids);
  }

  const uniqueIds = [...new Set(createdIds)];
  await waitForPredictionRuns(uniqueIds);
  return uniqueIds;
};

// ── Prediction Runs ──────────────────────────────────────────────────

export const createPredictionRuns = async ({
  shift_ids,
  bus_model_id,
  model_name = DEFAULT_PREDICTION_MODEL_NAME,
  external_temp_celsius = 15,
  occupancy_percent = 50,
  auxiliary_heating_type = "default",
  quantiles,
  num_battery_packs,
  contextual_parameters,
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
  if (contextual_parameters && typeof contextual_parameters === "object") {
    body.contextual_parameters = contextual_parameters;
  }

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

  const predictionRunIds = await createPredictionRunVariants({
    shift_ids,
    bus_model_id: rest.bus_model_id,
    prediction_params: rest.prediction_params,
  });

  const { prediction_params: _discarded, ...restWithoutPrediction } = rest;
  const body = {
    shift_ids,
    prediction_run_ids: predictionRunIds,
    ...restWithoutPrediction,
  };

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

  const bodyJson = JSON.stringify(body);
  console.info("[elettra] POST /optimization-runs/ body:", bodyJson);

  let response;
  try {
    response = await fetch(`${SIMULATION_PATH}/optimization-runs/`, {
      method: "POST",
      headers,
      body: bodyJson,
    });
  } catch (networkErr) {
    console.error("[elettra] optimization-runs fetch failed:", networkErr);
    throw new Error("Network error creating optimization run: " + networkErr.message);
  }

  const payload = await response.json().catch(() => null);
  console.info(
    "[elettra] POST /optimization-runs/ status:", response.status,
    "payload:", JSON.stringify(payload)
  );

  if (!response.ok) {
    const message =
      payload?.detail?.[0]?.msg ??
      payload?.detail ??
      "Unable to create optimization run.";
    const errorStr = typeof message === "string" ? message : JSON.stringify(message);
    console.error("[elettra] optimization-runs error:", errorStr);
    throw new Error(errorStr);
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
