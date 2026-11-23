/** Per-editor cache: only read-only stop and routing requests are issued. */
export const createShiftTransferResolver = ({ fetchStops, fetchDuration }) => {
  const stops = new Map(), routes = new Map();
  const memo = (cache, key, work) => {
    if (!cache.has(key)) {
      const promise = Promise.resolve().then(work).catch(error => { cache.delete(key); throw error; });
      cache.set(key, promise);
    }
    return cache.get(key);
  };
  return async (trip, customStop, direction) => {
    const times = trip.stop_times?.length ? trip.stop_times : await memo(stops, trip.id, () => fetchStops(trip.id));
    const endpoint = direction === 'from_stop' ? times?.at(-1) : times?.[0];
    const stopId = endpoint?.id || endpoint?.stop?.id || endpoint?.stop_id;
    if (!stopId) throw Object.assign(new Error('Missing trip endpoint'), { code: 'invalid_trip_stops' });
    if (stopId === customStop.stop_id) return 0;
    const lat = customStop.latitude ?? customStop.stop_lat ?? customStop.stop?.stop_lat;
    const lon = customStop.longitude ?? customStop.stop_lon ?? customStop.stop?.stop_lon;
    if (lat == null || lon == null || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
      throw Object.assign(new Error('Missing custom stop coordinates'), { code: 'invalid_custom_stop_coordinates' });
    }
    const key = JSON.stringify([stopId, Number(lat), Number(lon), direction]);
    return memo(routes, key, async () => {
      const seconds = await fetchDuration({ stopId, lat: Number(lat), lon: Number(lon), direction });
      if (!Number.isFinite(seconds) || seconds < 0) throw new Error('Invalid routing duration');
      return Math.max(1, Math.ceil(seconds / 60));
    });
  };
};
