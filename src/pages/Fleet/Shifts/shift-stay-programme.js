import { filterServiceTripsForSave, normalizeTrip } from './shift-utils.js';
import { splitServicePeriods } from './shift-depot-stays.js';
import { mapWithLimit, serviceMinutes, serviceTime } from './shift-stay-adjustment.js';

const same = (a, b, field) => !a && !b || Boolean(a && b && a.depotId === b.depotId
  && serviceMinutes(a[field]) === serviceMinutes(b[field]));
const connects = (a, b) => a.end_stop_name?.trim().toLowerCase() === b.start_stop_name?.trim().toLowerCase()
  && serviceMinutes(a.arrival_time) <= serviceMinutes(b.departure_time);
const better = (a, b) => a && (!b || a.kept > b.kept || a.kept === b.kept && a.path.length > b.path.length);

// A proposal is immutable. Keep existing work first, then fill the changed
// windows with the largest connected sequence of fixed GTFS trips.
export const rebuildStayProgramme = async ({ trips, candidates, stays, previousStays, depots,
  startDepotId, endDepotId, startTime, endTime, travelMinutes, existingConnections = [] }) => {
  const start = serviceMinutes(startTime), end = serviceMinutes(endTime);
  if (![start, end].every(Number.isFinite) || end <= start) return { status: 'error', key: 'shifts.editor_invalid_times' };
  const ordered = stays.map(stay => ({ ...stay })).sort((a, b) => serviceMinutes(a.arrivalTime) - serviceMinutes(b.arrivalTime));
  let previousEnd = start;
  for (const stay of ordered) {
    const arrival = serviceMinutes(stay.arrivalTime), departure = serviceMinutes(stay.departureTime);
    if (![start, end, arrival, departure].every(Number.isFinite) || arrival <= previousEnd || departure <= arrival || departure >= end) {
      return { status: 'error', key: 'shifts.editor_invalid_times' };
    }
    if (!depots.some(stop => stop.id === stay.depotId && stop.stop_id)) return { status: 'error', key: 'shifts.stay_depot_required' };
    previousEnd = departure;
  }
  const oldPeriods = splitServicePeriods(trips, previousStays);
  const selected = new Set(trips.map(trip => trip.id));
  const pool = [...new Map(filterServiceTripsForSave([...candidates, ...trips]).map(trip => [trip.id, normalizeTrip(trip)])).values()]
    .sort((a, b) => serviceMinutes(a.departure_time) - serviceMinutes(b.departure_time) || String(a.id).localeCompare(String(b.id)));
  const knownOuterConnection = (trip, stop, time, direction) => existingConnections.some(connection => direction === 'start'
    ? connection.start_stop_name === stop.name && connection.end_stop_name === trip.start_stop_name
      && serviceMinutes(connection.departure_time) === serviceMinutes(time)
      && serviceMinutes(connection.arrival_time) === serviceMinutes(trip.departure_time)
    : connection.end_stop_name === stop.name && connection.start_stop_name === trip.end_stop_name
      && serviceMinutes(connection.arrival_time) === serviceMinutes(time)
      && serviceMinutes(connection.departure_time) === serviceMinutes(trip.arrival_time));
  const periods = [];
  for (let i = 0; i <= ordered.length; i++) {
    const left = ordered[i - 1], right = ordered[i];
    const from = left?.departureTime || startTime, to = right?.arrivalTime || endTime;
    const unchanged = oldPeriods.find(period => same(left, period.precedingStay, 'departureTime')
      && same(right, period.followingStay, 'arrivalTime'));
    if (unchanged?.trips.length) { periods.push(unchanged.trips); continue; }
    const fromStop = depots.find(stop => stop.id === (left?.depotId || startDepotId));
    const toStop = depots.find(stop => stop.id === (right?.depotId || endDepotId));
    if (!fromStop?.stop_id || !toStop?.stop_id) return { status: 'error', key: 'shifts.stay_depot_required' };
    const available = pool.filter(trip => serviceMinutes(trip.departure_time) >= serviceMinutes(from)
      && serviceMinutes(trip.arrival_time) <= serviceMinutes(to)
      && serviceMinutes(trip.arrival_time) > serviceMinutes(trip.departure_time));
    const transfers = await mapWithLimit(available, async trip => [
      await travelMinutes(trip, fromStop, 'to_stop'), await travelMinutes(trip, toStop, 'from_stop'),
    ]);
    const paths = [];
    let best = null;
    for (let j = 0; j < available.length; j++) {
      const trip = available[j], [inbound, outbound] = transfers[j];
      if (![inbound, outbound].every(value => Number.isFinite(value) && value >= 0)) throw new Error('Invalid routing duration');
      // Retain an unchanged, persisted outer connection even when a new route
      // estimate differs from the original. Never extend this to new boundaries.
      const oldStart = !left && trip.id === trips[0]?.id && existingConnections.some(leg =>
        leg.start_stop_name === fromStop.name && leg.end_stop_name === trip.start_stop_name
        && serviceMinutes(leg.departure_time) === start && serviceMinutes(leg.arrival_time) === serviceMinutes(trip.departure_time));
      const oldEnd = !right && trip.id === trips.at(-1)?.id && existingConnections.some(leg =>
        leg.end_stop_name === toStop.name && leg.start_stop_name === trip.end_stop_name
        && serviceMinutes(leg.arrival_time) === end && serviceMinutes(leg.departure_time) === serviceMinutes(trip.arrival_time));
      let path = oldStart || serviceMinutes(from) + inbound <= serviceMinutes(trip.departure_time)
        ? { path: [trip], kept: selected.has(trip.id) ? 1 : 0 } : null;
      for (let k = 0; k < j; k++) {
        if (!paths[k] || !connects(available[k], trip)) continue;
        const next = { path: [...paths[k].path, trip], kept: paths[k].kept + (selected.has(trip.id) ? 1 : 0) };
        if (better(next, path)) path = next;
      }
      paths.push(path);
      if (path && (oldEnd || serviceMinutes(trip.arrival_time) + outbound <= serviceMinutes(to)) && better(path, best)) best = path;
    }
    if (!best) return { status: 'error', key: 'shifts.editor_no_trips', period: i + 1, start: from, end: to };
    periods.push(best.path);
  }
  const resultTrips = periods.flat();
  const ids = new Set(resultTrips.map(trip => trip.id));
  return { status: 'ready', trips: resultTrips,
    stays: ordered.map((stay, i) => ({ ...stay, afterTripId: periods[i].at(-1).id,
      arrivalTime: serviceTime(serviceMinutes(stay.arrivalTime)), departureTime: serviceTime(serviceMinutes(stay.departureTime)) })),
    periods, addedTrips: resultTrips.filter(trip => !selected.has(trip.id)), removedTrips: trips.filter(trip => !ids.has(trip.id)) };
};
