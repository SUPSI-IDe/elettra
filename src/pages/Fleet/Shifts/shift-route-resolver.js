import {
  firstAvailable,
  resolveRouteId,
  resolveTripId,
  text,
} from "./shift-utils.js";

const routeLabel = (value = {}) =>
  firstAvailable(
    value?.route_label,
    value?.routeLabel,
    value?.route_short_name,
    value?.routeShortName,
    value?.route_long_name,
    value?.routeLongName,
    value?.route?.route_short_name,
    value?.route?.route_long_name,
    value?.route?.short_name,
    value?.route?.long_name,
    value?.route?.name
  );

const stopEntries = (trip = {}) => {
  const candidates = [
    trip?.stop_times,
    trip?.stops,
    trip?.trip?.stop_times,
    trip?.trip?.stops,
  ];
  return candidates.find((entries) => Array.isArray(entries) && entries.length) ?? [];
};

const firstStopDatabaseId = (trip = {}) => {
  const firstStop = stopEntries(trip)[0] ?? {};
  return firstAvailable(
    firstStop?.id,
    firstStop?.pk,
    firstStop?.stop_pk,
    firstStop?.stopPk,
    firstStop?.stop?.id,
    firstStop?.stop?.pk
  );
};

const findTrip = (candidates = [], trip = {}) => {
  const databaseId = text(trip?.id).trim();
  const gtfsTripId = resolveTripId(trip);
  return (
    candidates.find((candidate) => {
      const candidateDatabaseId = text(candidate?.id).trim();
      const candidateGtfsId = resolveTripId(candidate);
      return (
        (databaseId && candidateDatabaseId === databaseId) ||
        (gtfsTripId && candidateGtfsId === gtfsTripId)
      );
    }) ?? null
  );
};

export const createShiftRouteResolver = ({
  fetchTripsByStop,
  fetchRouteById,
  onError = () => {},
} = {}) => {
  const tripsByStopCache = new Map();
  const routesByIdCache = new Map();

  const tripsForStop = async (stopId) => {
    if (!stopId || typeof fetchTripsByStop !== "function") return [];
    if (!tripsByStopCache.has(stopId)) {
      tripsByStopCache.set(
        stopId,
        Promise.resolve(fetchTripsByStop(stopId)).catch((error) => {
          onError(error, { type: "trips-by-stop", id: stopId });
          return [];
        })
      );
    }
    return tripsByStopCache.get(stopId);
  };

  const routeById = async (routeId) => {
    if (!routeId || typeof fetchRouteById !== "function") return null;
    if (!routesByIdCache.has(routeId)) {
      routesByIdCache.set(
        routeId,
        Promise.resolve(fetchRouteById(routeId)).catch((error) => {
          onError(error, { type: "route", id: routeId });
          return null;
        })
      );
    }
    return routesByIdCache.get(routeId);
  };

  return async (trip = {}, { fallbackRoute = null } = {}) => {
    let resolvedRouteId = resolveRouteId(trip);
    let resolvedRouteLabel = routeLabel(trip);

    if (!resolvedRouteId) {
      const stopId = firstStopDatabaseId(trip);
      const candidates = await tripsForStop(stopId);
      const matchedTrip = findTrip(
        Array.isArray(candidates) ? candidates : [],
        trip
      );
      resolvedRouteId = resolveRouteId(matchedTrip ?? {});
      resolvedRouteLabel = resolvedRouteLabel || routeLabel(matchedTrip ?? {});
    }

    if (resolvedRouteId && !resolvedRouteLabel) {
      const route = await routeById(resolvedRouteId);
      resolvedRouteLabel = routeLabel(route ?? {});
    }

    const fallbackRouteId = firstAvailable(fallbackRoute?.id);
    if (!resolvedRouteId) {
      resolvedRouteId = fallbackRouteId;
    }
    if (!resolvedRouteLabel) {
      resolvedRouteLabel =
        resolvedRouteId === fallbackRouteId
          ? firstAvailable(fallbackRoute?.name, resolvedRouteId)
          : resolvedRouteId;
    }

    return {
      ...trip,
      route_id: resolvedRouteId,
      route_label: resolvedRouteLabel,
    };
  };
};
