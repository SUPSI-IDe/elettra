import { normalizeTrip, resolveTripId } from './shift-utils.js';
import { splitServicePeriods, periodBounds } from './shift-depot-stays.js';

export const serviceMinutes = value => {
  const match = /^(\d{2}):([0-5]\d)(?::([0-5]\d))?$/.exec(value || '');
  return match ? Number(match[1]) * 60 + Number(match[2]) + Number(match[3] || 0) / 60 : NaN;
};
export const serviceTime = minutes => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.floor(minutes % 60)).padStart(2, '0')}`;

export const mapWithLimit = async (items, work, limit = 4) => {
  const result = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      result[index] = await work(items[index], index);
    }
  }));
  return result;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** Project a requested stay onto fixed GTFS trips; never change GTFS times. */
export const adjustStayProgramme = async ({ trips, stays, index, field, explicitDay = false,
  depots, startTime, endTime, travelMinutes }) => {
  const stay = stays[index];
  if (!stay) return { status: 'error', key: 'shifts.stay_invalid_anchor' };
  const lower = serviceMinutes(startTime), upper = serviceMinutes(endTime);
  const requested = { arrivalTime: stay.arrivalTime, departureTime: stay.departureTime };
  let arrival = serviceMinutes(stay.arrivalTime), departure = serviceMinutes(stay.departureTime);
  if (![lower, upper, arrival, departure].every(Number.isFinite)) return { status: 'incomplete' };
  // A clock edit crossing midnight follows the service day. An explicit day
  // selection remains authoritative.
  if (!explicitDay && upper >= 1440) {
    if (field === 'arrivalTime' && arrival < lower && arrival < 1440) arrival += 1440;
    if (field === 'departureTime' && departure < lower && departure < 1440) departure += 1440;
  }
  arrival = Math.ceil(arrival);
  departure = Math.floor(departure);
  const periods = splitServicePeriods(trips, stays);
  const before = periods[index], after = periods[index + 1];
  if (!before?.trips.length) {
    if (lower + 1 > upper) return { status: 'error', key: 'shifts.stay_no_window' };
    if (field === 'departureTime') {
      departure = clamp(departure, lower + 1, upper);
      arrival = clamp(arrival, lower, departure - 1);
    } else {
      arrival = clamp(arrival, lower, upper - 1);
      departure = clamp(departure, arrival + 1, upper);
    }
    return { status: 'incomplete', stays: stays.map((item, i) => i === index
      ? { ...item, arrivalTime: serviceTime(arrival), departureTime: serviceTime(departure) } : item) };
  }
  const stop = depots.find(item => item.id === stay.depotId);
  if (!stop?.stop_id) return { status: 'error', key: 'shifts.stay_depot_required' };
  const inbound = await mapWithLimit(before.trips, trip => travelMinutes(trip, stop, 'from_stop'));
  const afterTrips = after?.trips || [];
  const outbound = await mapWithLimit(afterTrips, trip => travelMinutes(trip, stop, 'to_stop'));
  if (![...inbound, ...outbound].every(value => Number.isFinite(value) && value >= 0)) {
    return { status: 'error', key: 'shifts.stay_routing_error' };
  }
  const minArrival = Math.ceil(Math.max(lower,
    serviceMinutes(periodBounds(before, { startTime, endTime }).startTime),
    Math.min(...before.trips.map((trip, i) => serviceMinutes(trip.arrival_time) + inbound[i]))));
  const maxDeparture = Math.floor(Math.min(upper,
    serviceMinutes(periodBounds(after, { startTime, endTime }).endTime),
    afterTrips.length ? Math.max(...afterTrips.map((trip, i) => serviceMinutes(trip.departure_time) - outbound[i])) : upper));
  if (!Number.isFinite(minArrival) || !Number.isFinite(maxDeparture) || minArrival + 1 > maxDeparture) {
    return { status: 'error', key: 'shifts.stay_no_window' };
  }
  if (field === 'departureTime') {
    departure = clamp(departure, minArrival + 1, maxDeparture);
    arrival = clamp(arrival, minArrival, departure - 1);
  } else {
    arrival = clamp(arrival, minArrival, maxDeparture - 1);
    departure = clamp(departure, arrival + 1, maxDeparture);
  }
  let lastBefore = 0;
  before.trips.forEach((trip, i) => {
    if (serviceMinutes(trip.arrival_time) + inbound[i] <= arrival) lastBefore = i;
  });
  const firstAfter = afterTrips.length ? afterTrips.findIndex((trip, i) => departure + outbound[i] <= serviceMinutes(trip.departure_time)) : 0;
  if (firstAfter < 0) return { status: 'error', key: 'shifts.stay_no_window' };
  const removed = [...before.trips.slice(lastBefore + 1), ...afterTrips.slice(0, firstAfter)];
  const nextStays = stays.map((item, i) => i === index ? { ...item,
    afterTripId: before.trips[lastBefore].id, arrivalTime: serviceTime(arrival), departureTime: serviceTime(departure) } : { ...item });
  const nextTrips = periods.flatMap((period, i) => i === index ? period.trips.slice(0, lastBefore + 1)
    : i === index + 1 ? period.trips.slice(firstAfter) : period.trips);
  const adjustedTimes = Object.entries(requested).filter(([key, value]) => serviceMinutes(value) !== serviceMinutes(nextStays[index][key]))
    .map(([key, value]) => ({ field: key, requested: value, applied: nextStays[index][key] }));
  return { status: 'ready', trips: nextTrips, stays: nextStays, removedTrips: removed, adjustedTimes };
};

const stopName = value => String(value || '').trim().toLocaleLowerCase();

/** Find a compatible insertion slot, including the start of a later period. */
export const periodTripInsertion = ({ trip, period, selectedTripIds = new Set(), startTime, endTime }) => {
  const candidate = normalizeTrip(trip);
  if (!resolveTripId(candidate) || selectedTripIds.has(resolveTripId(candidate))) return -1;
  const departure = serviceMinutes(candidate.departure_time), arrival = serviceMinutes(candidate.arrival_time);
  const start = serviceMinutes(startTime), end = serviceMinutes(endTime);
  if (![departure, arrival, start, end].every(Number.isFinite) || arrival < departure || departure < start || arrival > end) return -1;
  let index = period.trips.findIndex(item => serviceMinutes(item.departure_time) > departure);
  if (index < 0) index = period.trips.length;
  const previous = period.trips[index - 1], next = period.trips[index];
  if (previous && (serviceMinutes(previous.arrival_time) > departure || stopName(previous.end_stop_name) !== stopName(candidate.start_stop_name))) return -1;
  if (next && (arrival > serviceMinutes(next.departure_time) || stopName(candidate.end_stop_name) !== stopName(next.start_stop_name))) return -1;
  return index;
};

/** Keep the largest compatible prefix and suffix around an explicitly chosen
 * trip. Replacements are confined to this period and retain fixed GTFS times. */
export const planPeriodTripInsertion = (options) => {
  const { period, selectedTripIds = new Set(), startTime, endTime } = options;
  const { programmeInsertion, ...candidate } = options.trip || {};
  const trip = normalizeTrip(candidate);
  const departure = serviceMinutes(trip.departure_time), arrival = serviceMinutes(trip.arrival_time);
  if (!resolveTripId(trip) || selectedTripIds.has(resolveTripId(trip))
    || ![departure, arrival, serviceMinutes(startTime), serviceMinutes(endTime)].every(Number.isFinite)
    || arrival < departure || departure < serviceMinutes(startTime) || arrival > serviceMinutes(endTime)
    || period.trips.some(item => serviceMinutes(item.departure_time) === departure && serviceMinutes(item.arrival_time) === arrival
      && stopName(item.start_stop_name) === stopName(trip.start_stop_name) && stopName(item.end_stop_name) === stopName(trip.end_stop_name))) return null;
  let previous = -1;
  period.trips.forEach((item, index) => {
    if (serviceMinutes(item.arrival_time) <= departure && stopName(item.end_stop_name) === stopName(trip.start_stop_name)) previous = index;
  });
  let next = period.trips.findIndex((item, index) => index > previous
    && serviceMinutes(item.departure_time) >= arrival && stopName(item.start_stop_name) === stopName(trip.end_stop_name));
  if (next < 0) next = period.trips.length;
  return { index: previous + 1, removedTrips: period.trips.slice(previous + 1, next),
    trips: [...period.trips.slice(0, previous + 1), trip, ...period.trips.slice(next)] };
};
