import { API_ROOT, authHeaders } from './client';

export const fetchShiftTransferDuration = async ({ stopId, lat, lon, direction }, { timeoutMs = 10000 } = {}) => {
  const params = new URLSearchParams({ stop_uuid: stopId, lat: String(lat), lon: String(lon), direction, coord_sys: 'wgs84' });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API_ROOT}/api/v1/gtfs/osrm/driving-distance?${params}`, {
      headers: authHeaders(), signal: controller.signal,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !Number.isFinite(payload?.duration_seconds) || payload.duration_seconds < 0) {
      throw new Error('Unable to calculate transfer duration');
    }
    return payload.duration_seconds;
  } finally { clearTimeout(timeout); }
};
