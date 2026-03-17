import { fetchShiftYearlyDistance } from "../api/shifts";
import { getCurrentLang } from "../i18n";

const DAILY_DISTANCE_RECURRENCE = "daily";
const DAILY_RECURRENCE_DAYS_PER_YEAR = 365;

const toFiniteNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const firstFiniteValue = (...values) =>
  values.map((value) => toFiniteNumber(value)).find((value) => value != null) ?? null;

const firstFiniteKilometers = (...valuesInKm) => firstFiniteValue(...valuesInKm);

const firstFiniteMetersAsKilometers = (...valuesInMeters) => {
  const meters = firstFiniteValue(...valuesInMeters);
  return meters != null ? meters / 1000 : null;
};

const stopSequenceDistanceKm = (stops = []) => {
  if (!Array.isArray(stops) || !stops.length) {
    return null;
  }

  const distances = stops
    .map((stop = {}) =>
      firstFiniteKilometers(
        stop?.cumulative_distance_km,
        stop?.cumulativeDistanceKm,
        stop?.shape_dist_traveled_km,
        stop?.shapeDistTraveledKm
      ) ??
      firstFiniteMetersAsKilometers(
        stop?.cumulative_distance_m,
        stop?.cumulativeDistanceM,
        stop?.shape_dist_traveled_m,
        stop?.shapeDistTraveledM
      )
    )
    .filter((value) => value != null);

  if (!distances.length) {
    return null;
  }

  const minDistance = Math.min(...distances);
  const maxDistance = Math.max(...distances);
  return maxDistance >= minDistance ? maxDistance - minDistance : null;
};

const isDepotTrip = (trip = {}) => {
  if (
    trip?.status === "depot" ||
    trip?.trip?.status === "depot" ||
    trip?.trip_type === "auxiliary" ||
    trip?.trip?.trip_type === "auxiliary"
  ) {
    return true;
  }

  const start = String(trip?.start_stop_name ?? trip?.startStopName ?? "").trim();
  const end = String(trip?.end_stop_name ?? trip?.endStopName ?? "").trim();
  return Boolean(start && end && start === end);
};

const extractTripDistanceKm = (trip = {}) =>
  firstFiniteKilometers(
    trip?.distance_km,
    trip?.distanceKm,
    trip?.trip_distance_km,
    trip?.tripDistanceKm,
    trip?.total_distance_km,
    trip?.totalDistanceKm,
    trip?.length_km,
    trip?.lengthKm,
    trip?.trip?.distance_km,
    trip?.trip?.distanceKm,
    trip?.trip?.trip_distance_km,
    trip?.trip?.tripDistanceKm,
    trip?.trip?.total_distance_km,
    trip?.trip?.totalDistanceKm,
    trip?.trip?.length_km,
    trip?.trip?.lengthKm
  ) ??
  firstFiniteMetersAsKilometers(
    trip?.distance_m,
    trip?.distanceM,
    trip?.trip_distance_m,
    trip?.tripDistanceM,
    trip?.total_distance_m,
    trip?.totalDistanceM,
    trip?.length_m,
    trip?.lengthM,
    trip?.trip?.distance_m,
    trip?.trip?.distanceM,
    trip?.trip?.trip_distance_m,
    trip?.trip?.tripDistanceM,
    trip?.trip?.total_distance_m,
    trip?.trip?.totalDistanceM,
    trip?.trip?.length_m,
    trip?.trip?.lengthM
  ) ??
  stopSequenceDistanceKm(trip?.stop_times) ??
  stopSequenceDistanceKm(trip?.trip?.stop_times) ??
  stopSequenceDistanceKm(trip?.stops) ??
  stopSequenceDistanceKm(trip?.trip?.stops);

export const extractShiftDistanceKm = (shift = {}) => {
  const directDistanceKm =
    firstFiniteKilometers(
      shift?.distance_km,
      shift?.distanceKm,
      shift?.daily_distance_km,
      shift?.dailyDistanceKm,
      shift?.shift_distance_km,
      shift?.shiftDistanceKm,
      shift?.total_distance_km,
      shift?.totalDistanceKm,
      shift?.length_km,
      shift?.lengthKm
    ) ??
    firstFiniteMetersAsKilometers(
      shift?.distance_m,
      shift?.distanceM,
      shift?.daily_distance_m,
      shift?.dailyDistanceM,
      shift?.shift_distance_m,
      shift?.shiftDistanceM,
      shift?.total_distance_m,
      shift?.totalDistanceM,
      shift?.length_m,
      shift?.lengthM
    );

  if (directDistanceKm != null) {
    return directDistanceKm;
  }

  const structure = Array.isArray(shift?.structure) ? shift.structure : [];
  const trips =
    structure.length ? structure : Array.isArray(shift?.trips) ? shift.trips : [];

  if (!trips.length) {
    return null;
  }

  const totalDistanceKm = trips.reduce((sum, trip = {}) => {
    if (isDepotTrip(trip)) {
      return sum;
    }

    const tripDistanceKm = extractTripDistanceKm(trip);
    return tripDistanceKm != null ? sum + tripDistanceKm : sum;
  }, 0);

  return totalDistanceKm > 0 ? totalDistanceKm : null;
};

const extractYearlyDistanceKm = (payload) =>
  firstFiniteKilometers(
    payload,
    payload?.yearly_distance_km,
    payload?.yearlyDistanceKm,
    payload?.yearly_distance,
    payload?.yearlyDistance,
    payload?.annual_distance_km,
    payload?.annualDistanceKm,
    payload?.distance_km,
    payload?.distanceKm,
    payload?.km,
    payload?.value,
    payload?.data?.yearly_distance_km,
    payload?.data?.yearlyDistanceKm,
    payload?.data?.yearly_distance,
    payload?.data?.distance_km,
    payload?.data?.distanceKm,
    payload?.data?.km
  );

const dailyDistancePromiseCache = new Map();

export const fetchShiftDailyDistanceKm = async (shiftId) => {
  if (!shiftId) {
    return null;
  }

  const cacheKey = String(shiftId);
  if (!dailyDistancePromiseCache.has(cacheKey)) {
    const pendingDistance = fetchShiftYearlyDistance(cacheKey, {
      recurrence: DAILY_DISTANCE_RECURRENCE,
    })
      .then((payload) => {
        const yearlyDistanceKm = extractYearlyDistanceKm(payload);
        if (yearlyDistanceKm == null || yearlyDistanceKm <= 0) {
          return null;
        }
        return yearlyDistanceKm / DAILY_RECURRENCE_DAYS_PER_YEAR;
      })
      .catch((error) => {
        dailyDistancePromiseCache.delete(cacheKey);
        throw error;
      });

    dailyDistancePromiseCache.set(cacheKey, pendingDistance);
  }

  return dailyDistancePromiseCache.get(cacheKey);
};

export const resolveShiftDailyDistanceKm = async (shift = {}) => {
  const knownDistanceKm = extractShiftDistanceKm(shift);
  if (knownDistanceKm != null) {
    return knownDistanceKm;
  }

  const shiftId = String(shift?.id ?? shift?.shift_id ?? shift?.shiftId ?? "").trim();
  if (!shiftId) {
    return null;
  }

  try {
    return await fetchShiftDailyDistanceKm(shiftId);
  } catch (error) {
    console.warn(`[elettra] Unable to load daily distance for shift ${shiftId}`, error);
    return null;
  }
};

export const formatDistanceKm = (distanceKm, lang = getCurrentLang()) => {
  const numericDistance = toFiniteNumber(distanceKm);
  if (numericDistance == null) {
    return "—";
  }

  return `${new Intl.NumberFormat(lang, {
    maximumFractionDigits: 1,
  }).format(numericDistance)} km`;
};
