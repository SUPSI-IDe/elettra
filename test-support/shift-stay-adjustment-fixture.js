import { readFileSync } from 'node:fs';
import { edition } from './shift-composer-fixture.js';

export const shift00000 = JSON.parse(readFileSync(new URL('./shift-00000.json', import.meta.url)));
export const shift00000Trips = shift00000.shiftInfo.trips.filter(trip => trip.status === 'gtfs').map(trip => ({ ...trip, route_id: 'line' }));
export const shift0000 = JSON.parse(readFileSync(new URL('./shift-0000.json', import.meta.url)));
export const adjustmentOptionsFor = (data, options = {}) => ({ edit: true, trips: [...new Map([...data.shiftInfo.trips.filter(trip => trip.status === 'gtfs'), ...(data.candidateTrips || [])].map(trip => [trip.id, { ...trip, route_id: 'line' }])).values()],
  depots: data.depots.map(stop => ({ ...stop, user_id: 'user' })),
  ...options,
  respond: async args => {
    const override = await options.respond?.(args);
    if (override) return override;
    const { path, url, method } = args;
    if (options.application && path.endsWith('/buses/bus')) return { json: { id: 'bus', user_id: 'user', bus_model_id: 'model' } };
    if (options.application && path.endsWith('/shifts/old/yearly-distance')) return { json: { daily_distance_km: 12 } };
    if (options.application && options.edit !== false && path.endsWith('/shifts/') && method === 'GET') return { json: [{ ...data.shift, id: 'old', bus_id: 'bus', trip_count: data.shift.structure.length, gtfs_datasets: [edition] }] };
    if (path.includes('/osrm/driving-distance')) {
      const stopId = url.searchParams.get('stop_uuid');
      const name = [...data.shift.structure, ...(data.candidateTrips || [])].flatMap(leg => leg.stop_times || []).find(stop => stop.id === stopId)?.stop_name;
      const observation = data.routing_observations.find(item => item.name === name && item.direction === url.searchParams.get('direction'));
      return { json: { duration_seconds: observation?.seconds ?? 120, distance_meters: 1000 } };
    }
    if (path.includes('/gtfs-stops/by-trip/')) return { json: data.shift.structure.find(leg => path.endsWith(leg.trip_id))?.stop_times || data.candidateTrips?.find(trip => path.endsWith(trip.id))?.stop_times || [] };
    if (path.endsWith('/shifts/old/info')) return { json: { ...data.shiftInfo,
      trips: data.shiftInfo.trips.map(trip => ({ ...trip, route_id: 'line' })),
      route_id: 'line', days_of_week: ['monday'] } };
    if (path.endsWith('/shifts/old') && method === 'GET') return { json: { ...data.shift,
      id: 'old', bus_id: 'bus', gtfs_datasets: [edition] } };
  },
});

export const adjustmentOptions = options => adjustmentOptionsFor(shift00000, options);
