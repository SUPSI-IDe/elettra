import { filterServiceTripsForSave, mergeStructureWithInfoTrips, normalizeTrip, parseTimeToMinutes, text } from './shift-utils.js';

const stopId = stop => text(stop?.id || stop?.stop?.id || stop?.stop_id);
const edge = (trip, side) => {
  const stops = trip?.stop_times || [];
  const stop = side === 'start' ? stops[0] : stops.at(-1);
  return { id: stopId(stop), name: side === 'start' ? trip?.start_stop_name : trip?.end_stop_name };
};
const atDepot = (trip, side, depot) => {
  const endpoint = edge(trip, side);
  return endpoint.id ? endpoint.id === depot.stop_id : endpoint.name === depot.name;
};
const sameEndpoint = (left, leftSide, right, rightSide) => {
  const from = edge(left, leftSide), to = edge(right, rightSide);
  return from.id && to.id ? from.id === to.id : Boolean(from.name && from.name === to.name);
};
const minutes = time => /^\d{2}:[0-5]\d(?::[0-5]\d)?$/.test(time || '') ? parseTimeToMinutes(time) : null;

// Anchors use database trip IDs, independently of the currently selected line.
export const splitServicePeriods = (trips = [], stays = []) => {
  const byAnchor = new Map(stays.map(stay => [stay.afterTripId, stay]));
  const periods = [{ trips: [], precedingStay: null, followingStay: null }];
  for (const trip of trips) {
    const current = periods.at(-1);
    current.trips.push(trip);
    const stay = byAnchor.get(trip.id);
    if (stay) {
      current.followingStay = stay;
      periods.push({ trips: [], precedingStay: stay, followingStay: null });
    }
  }
  return periods;
};

export const readShiftDepotStays = ({ shift, shiftInfo, depots = [] }) => {
  const info = new Map((shiftInfo?.trips || []).map(trip => [trip.id, trip]));
  const movements = mergeStructureWithInfoTrips(shift?.structure, shiftInfo?.trips).map(leg => normalizeTrip({
    ...info.get(leg.trip_db_id), ...leg, id: leg.trip_db_id, trip_id: leg.gtfs_trip_id,
  }));
  const services = filterServiceTripsForSave(movements);
  const serviceIds = new Set(services.map(trip => trip.id));
  const stays = [];
  for (let index = 0; index < services.length - 1; index++) {
    const previous = services[index], next = services[index + 1];
    const allBetween = movements.slice(movements.indexOf(previous) + 1, movements.indexOf(next));
    const findDepot = legs => legs.length === 2
      && sameEndpoint(previous, 'end', legs[0], 'start')
      && sameEndpoint(legs[1], 'end', next, 'start')
      && depots.find(item => atDepot(legs[0], 'end', item) && atDepot(legs[1], 'start', item));
    // Preserve complete arrival/departure pairs even at the same physical
    // stop; discard only unpaired historical same-stop dwell records.
    const between = findDepot(allBetween) ? allBetween : allBetween.filter(trip => !sameEndpoint(trip, 'start', trip, 'end'));
    if (!between.length) continue;
    const [inbound, outbound] = between;
    const depot = findDepot(between);
    if (!depot) throw new Error('unrecoverable_depot_stay');
    stays.push({ afterTripId: previous.id, depotId: depot.id,
      arrivalTime: inbound.arrival_time, departureTime: outbound.departure_time });
  }
  return { trips: services, stays, connections: movements.filter(trip => !serviceIds.has(trip.id)) };
};

export const validateDepotStays = ({ trips = [], stays = [], depots = [], startTime, endTime }) => {
  const ids = new Set(trips.map(trip => trip.id));
  if (new Set(stays.map(stay => stay.afterTripId)).size !== stays.length || stays.some(stay => !ids.has(stay.afterTripId))) {
    return 'shifts.stay_invalid_anchor';
  }
  const periods = splitServicePeriods(trips, stays);
  if (stays.length && periods.some(period => !period.trips.length)) return 'shifts.stay_empty_period';
  for (const period of periods) {
    const stay = period.followingStay;
    if (!stay) continue;
    const depot = depots.find(item => item.id === stay.depotId);
    if (!depot?.stop_id) return 'shifts.stay_depot_required';
    const arrival = minutes(stay.arrivalTime), departure = minutes(stay.departureTime);
    const previous = period.trips.at(-1);
    const next = periods[periods.indexOf(period) + 1]?.trips[0];
    const previousArrival = parseTimeToMinutes(previous?.arrival_time);
    const nextDeparture = parseTimeToMinutes(next?.departure_time);
    if (![arrival, departure, previousArrival, nextDeparture].every(Number.isFinite)
      || arrival < previousArrival || departure <= arrival || departure > nextDeparture
      || arrival < parseTimeToMinutes(startTime) || departure > parseTimeToMinutes(endTime)
      || (arrival === previousArrival && !atDepot(previous, 'end', depot))
      || (departure === nextDeparture && !atDepot(next, 'start', depot))) return 'shifts.stay_times_invalid';
  }
  return '';
};

export const periodBounds = (period, { startTime, endTime }) => ({
  startTime: period.precedingStay?.departureTime || startTime,
  endTime: period.followingStay?.arrivalTime || endTime,
});

// Preview and persistence share the exact same ordered itinerary.
export const buildProgrammeMovements = ({ trips, stays, depots, startDepotId, endDepotId, startTime, endTime }) => {
  const movements = [];
  for (const period of splitServicePeriods(trips, stays)) {
    if (!period.trips.length) continue;
    const first = period.trips[0], last = period.trips.at(-1);
    const startDepot = depots.find(depot => depot.id === (period.precedingStay?.depotId || startDepotId));
    const endDepot = depots.find(depot => depot.id === (period.followingStay?.depotId || endDepotId));
    const bounds = periodBounds(period, { startTime, endTime });
    const connection = (from, to, departure, arrival, adjacentTrip, direction) => ({
      kind: 'connection', adjacentTrip, direction,
      status: 'depot', route_id: adjacentTrip.route_id,
      start_stop_name: from.name, end_stop_name: to.name,
      departure_time: departure, arrival_time: arrival,
      departureStopId: from.id, arrivalStopId: to.id,
    });
    movements.push(connection({ id: startDepot?.stop_id, name: startDepot?.name }, edge(first, 'start'), bounds.startTime, first.departure_time, first, 'departure'));
    movements.push(...period.trips.map(trip => ({ ...trip, kind: 'service' })));
    movements.push(connection(edge(last, 'end'), { id: endDepot?.stop_id, name: endDepot?.name }, last.arrival_time, bounds.endTime, last, 'return'));
  }
  return movements;
};

export const matchesDepotConnection = (existing, planned) =>
  (!existing?.route_id || existing.route_id === planned.route_id)
  && edge(existing, 'start').id === planned.departureStopId
  && edge(existing, 'end').id === planned.arrivalStopId
  && parseTimeToMinutes(existing.departure_time) === parseTimeToMinutes(planned.departure_time)
  && parseTimeToMinutes(existing.arrival_time) === parseTimeToMinutes(planned.arrival_time);

const failure = code => Object.assign(new Error(code), { code });

export const persistProgrammeMovements = async ({ movements, existingConnections = [], fetchEdges, createConnection, routeId }) => {
  const tripIds = [];
  for (const movement of movements) {
    if (movement.kind === 'service') {
      tripIds.push(movement.id);
      continue;
    }
    const departing = movement.direction === 'departure';
    if (!(departing ? movement.departureStopId : movement.arrivalStopId)) throw failure('invalid_depot_stop');
    const edges = await fetchEdges(movement.adjacentTrip.id, movement);
    const serviceStopId = departing ? edges?.firstStopId : edges?.lastStopId;
    if (!serviceStopId) throw failure('invalid_trip_stops');
    const planned = { ...movement, route_id: movement.route_id || routeId,
      departureStopId: departing ? movement.departureStopId : serviceStopId,
      arrivalStopId: departing ? serviceStopId : movement.arrivalStopId,
      departure_time: departing ? movement.departure_time : edges.lastStopDeparture || movement.departure_time,
      arrival_time: departing ? edges.firstStopArrival || movement.arrival_time : movement.arrival_time };
    const existing = existingConnections.find(trip => matchesDepotConnection(trip, planned));
    let id = existing?.id;
    if (!id) {
      const created = await createConnection({ departureStopId: planned.departureStopId, arrivalStopId: planned.arrivalStopId,
        departureTime: planned.departure_time, arrivalTime: planned.arrival_time,
        routeId: planned.route_id, status: 'depot', direction: movement.direction });
      id = text(created?.id).trim();
      if (!id) throw failure('invalid_auxiliary_trip_response');
    }
    tripIds.push(id);
  }
  if (!tripIds.length || tripIds.some(id => !id) || new Set(tripIds).size !== tripIds.length) throw failure('invalid_shift_trip');
  return tripIds;
};
