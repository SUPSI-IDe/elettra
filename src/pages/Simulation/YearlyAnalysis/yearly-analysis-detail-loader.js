import { fetchBusModelById } from "../../../api/bus-models";
import {
  fetchYearlyAnalysis,
  fetchYearlyAnalysisEnergySummary,
  fetchYearlyAnalysisCosts,
  fetchYearlyAnalysisEmissions,
} from "../../../api/simulation";
import {
  adaptYearlyAnalysisMeta,
  adaptYearlyAnalysisEnergySummary,
  adaptYearlyAnalysisCosts,
  adaptYearlyAnalysisEmissions,
} from "../../../adapters/yearly-analysis";

const text = (value) =>
  value === null || value === undefined ? "" : String(value);

const toFiniteNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
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

const toSectionState = (result, adapt) => {
  if (result.status === "fulfilled") {
    return {
      status: "ready",
      data: adapt(result.value),
      error: null,
    };
  }

  return {
    status: "error",
    data: null,
    error:
      result.reason instanceof Error
        ? result.reason
        : new Error(text(result.reason) || "Unknown error."),
  };
};

export const resolveYearlyAnalysisId = (options = {}) =>
  text(
    options.yearlyAnalysisId ??
      options.yearly_analysis_id ??
      options.analysisId ??
      options.analysis_id ??
      options.id
  ).trim();

const resolveBusModelId = (meta = {}) =>
  text(
    meta?.features?.config?.busModelId ??
      meta?.features?.config?.bus_model_id ??
      meta?.features?.meta?.busModelId ??
      meta?.features?.meta?.bus_model_id
  ).trim();

const normalizeBusModel = (busModel = {}) => {
  const specs = parseSpecs(busModel.specs);

  return {
    raw: busModel,
    id: text(busModel.id).trim(),
    name: text(busModel.name).trim(),
    model: text(busModel.model).trim(),
    busLengthM: toFiniteNumber(specs.bus_length_m ?? busModel.bus_length_m),
    batteryPackSizeKwh: toFiniteNumber(
      specs.battery_pack_size_kwh ?? busModel.battery_pack_size_kwh
    ),
  };
};

const buildBusLengthError = (busModelId = "") =>
  new Error(
    busModelId
      ? "Bus model length is missing, so yearly costs and emissions cannot be loaded."
      : "Bus model reference is missing, so yearly costs and emissions cannot be loaded."
  );

export const loadYearlyAnalysisDetail = async (yearlyAnalysisId) => {
  if (!yearlyAnalysisId) {
    throw new Error("No yearly analysis ID provided.");
  }

  const rawMeta = await fetchYearlyAnalysis(yearlyAnalysisId);
  const meta = adaptYearlyAnalysisMeta(rawMeta);
  const energyPromise = fetchYearlyAnalysisEnergySummary(yearlyAnalysisId);

  const busModelId = resolveBusModelId(meta);
  let busModel = null;
  let busLengthM = null;
  let busLengthError = null;

  if (busModelId) {
    try {
      busModel = normalizeBusModel(await fetchBusModelById(busModelId));
      busLengthM = busModel.busLengthM;
      if (busLengthM == null || busLengthM <= 0) {
        busLengthError = buildBusLengthError(busModelId);
      }
    } catch (error) {
      busLengthError =
        error instanceof Error
          ? error
          : new Error("Unable to load the bus model for this yearly analysis.");
    }
  } else {
    busLengthError = buildBusLengthError();
  }

  const energyResult = await Promise.allSettled([energyPromise]).then(
    ([result]) => toSectionState(result, adaptYearlyAnalysisEnergySummary)
  );

  let costsResult;
  let emissionsResult;

  if (busLengthError) {
    costsResult = {
      status: "error",
      data: null,
      error: busLengthError,
    };
    emissionsResult = {
      status: "error",
      data: null,
      error: busLengthError,
    };
  } else {
    const [costsRaw, emissionsRaw] = await Promise.allSettled([
      fetchYearlyAnalysisCosts(yearlyAnalysisId, { bus_length_m: busLengthM }),
      fetchYearlyAnalysisEmissions(yearlyAnalysisId, { bus_length_m: busLengthM }),
    ]);

    costsResult = toSectionState(costsRaw, adaptYearlyAnalysisCosts);
    emissionsResult = toSectionState(emissionsRaw, adaptYearlyAnalysisEmissions);
  }

  return {
    yearlyAnalysisId,
    meta,
    busModel,
    busLengthM,
    sections: {
      energySummary: energyResult,
      costs: costsResult,
      emissions: emissionsResult,
    },
  };
};
