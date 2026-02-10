/**
 * Agency location resolver using GTFS data.
 * Calculates the centroid of all stops from the agency's routes.
 */

import { authHeaders, API_ROOT } from "../api/client";

// Default fallback location (center of Switzerland)
export const DEFAULT_LOCATION = { lat: 46.8182, lon: 8.2275, name: "Switzerland" };

// Cache key prefix
const CACHE_KEY_PREFIX = "cache.agencyCentroid.";

/**
 * Calculate the centroid (average) of a set of coordinates.
 * @param {Array<{lat: number, lon: number}>} coordinates
 * @returns {{ lat: number, lon: number } | null}
 */
const calculateCentroid = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return null;
  }

  const validCoords = coordinates.filter(
    (c) =>
      c &&
      typeof c.lat === "number" &&
      typeof c.lon === "number" &&
      Number.isFinite(c.lat) &&
      Number.isFinite(c.lon)
  );

  if (validCoords.length === 0) {
    return null;
  }

  const sumLat = validCoords.reduce((sum, c) => sum + c.lat, 0);
  const sumLon = validCoords.reduce((sum, c) => sum + c.lon, 0);

  return {
    lat: sumLat / validCoords.length,
    lon: sumLon / validCoords.length,
  };
};

/**
 * Fetch routes by agency.
 * @param {string} agencyId - Agency UUID
 * @returns {Promise<Array>}
 */
const fetchRoutesByAgency = async (agencyId) => {
  const headers = authHeaders();
  const url = `${API_ROOT}/api/v1/gtfs/gtfs-routes/by-agency/${encodeURIComponent(agencyId)}`;
  
  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch routes: ${response.status}`);
  }
  
  const payload = await response.json();
  return Array.isArray(payload) ? payload : payload?.items ?? payload?.results ?? [];
};

/**
 * Fetch trips for a route.
 * @param {string} routeUUID - Route UUID (not route_id string)
 * @returns {Promise<Array>}
 */
const fetchTripsForRoute = async (routeUUID) => {
  const headers = authHeaders();
  // Use monday as default day - we just need some trips to get stops
  const url = `${API_ROOT}/api/v1/gtfs/gtfs-trips/by-route/${encodeURIComponent(routeUUID)}?day_of_week=monday`;
  
  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch trips: ${response.status}`);
  }
  
  const payload = await response.json();
  return Array.isArray(payload) ? payload : payload?.items ?? payload?.results ?? [];
};

/**
 * Fetch stops for a trip.
 * @param {string} tripId - Trip UUID
 * @returns {Promise<Array>}
 */
const fetchStopsForTrip = async (tripId) => {
  const headers = authHeaders();
  const url = `${API_ROOT}/api/v1/gtfs/gtfs-stops/by-trip/${encodeURIComponent(tripId)}`;
  
  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch stops: ${response.status}`);
  }
  
  const payload = await response.json();
  return Array.isArray(payload) ? payload : payload?.items ?? payload?.results ?? [];
};

/**
 * Get cached centroid for an agency.
 * @param {string} agencyId
 * @returns {{ lat: number, lon: number, name: string } | null}
 */
const getCachedCentroid = (agencyId) => {
  if (!agencyId) return null;

  try {
    const cached = localStorage.getItem(`${CACHE_KEY_PREFIX}${agencyId}`);
    if (!cached) return null;

    const parsed = JSON.parse(cached);
    if (
      parsed &&
      typeof parsed.lat === "number" &&
      typeof parsed.lon === "number" &&
      Number.isFinite(parsed.lat) &&
      Number.isFinite(parsed.lon)
    ) {
      return parsed;
    }
  } catch {
    // Ignore parse errors
  }
  return null;
};

/**
 * Cache centroid for an agency.
 * @param {string} agencyId
 * @param {{ lat: number, lon: number, name?: string }} location
 */
const cacheCentroid = (agencyId, location) => {
  if (!agencyId || !location) return;

  try {
    localStorage.setItem(
      `${CACHE_KEY_PREFIX}${agencyId}`,
      JSON.stringify(location)
    );
  } catch {
    // Ignore storage errors
  }
};

/**
 * Calculate and return the centroid of an agency's stops.
 * Flow: routes → trips → stops → extract coordinates → calculate centroid
 * Results are cached in localStorage.
 *
 * @param {string} agencyId - The agency UUID
 * @returns {Promise<{ lat: number, lon: number, name: string }>}
 */
export const getAgencyCentroid = async (agencyId) => {
  if (!agencyId) {
    console.log("[AgencyCentroid] No agencyId provided, using default");
    return DEFAULT_LOCATION;
  }

  // Check cache first
  const cached = getCachedCentroid(agencyId);
  if (cached) {
    console.log("[AgencyCentroid] Using cached centroid:", cached);
    return cached;
  }

  try {
    console.log("[AgencyCentroid] Fetching routes for agency:", agencyId);
    
    // Step 1: Get routes for the agency
    const routes = await fetchRoutesByAgency(agencyId);
    console.log("[AgencyCentroid] Found", routes.length, "routes");
    
    if (routes.length === 0) {
      console.log("[AgencyCentroid] No routes found, using default");
      return DEFAULT_LOCATION;
    }

    // Step 2: Collect stops from a few routes (limit to avoid too many requests)
    const allCoordinates = [];
    const seenStops = new Set();
    const maxRoutes = Math.min(routes.length, 3); // Sample up to 3 routes
    
    for (let i = 0; i < maxRoutes; i++) {
      const route = routes[i];
      const routeUUID = route.id; // Use UUID, not route_id
      
      if (!routeUUID) continue;
      
      try {
        console.log(`[AgencyCentroid] Fetching trips for route ${i + 1}/${maxRoutes}:`, routeUUID);
        const trips = await fetchTripsForRoute(routeUUID);
        
        if (trips.length === 0) continue;
        
        // Get stops from first trip of this route
        const tripId = trips[0].id || trips[0].trip_id;
        if (!tripId) continue;
        
        console.log(`[AgencyCentroid] Fetching stops for trip:`, tripId);
        const stops = await fetchStopsForTrip(tripId);
        
        for (const stop of stops) {
          const lat = parseFloat(stop.stop_lat);
          const lon = parseFloat(stop.stop_lon);
          const stopId = stop.stop_id || stop.id || `${lat},${lon}`;
          
          if (Number.isFinite(lat) && Number.isFinite(lon) && !seenStops.has(stopId)) {
            seenStops.add(stopId);
            allCoordinates.push({ lat, lon });
          }
        }
      } catch (routeErr) {
        console.warn(`[AgencyCentroid] Error processing route ${routeUUID}:`, routeErr);
        // Continue with next route
      }
    }

    console.log("[AgencyCentroid] Collected", allCoordinates.length, "unique stop coordinates");
    
    if (allCoordinates.length > 0) {
      console.log("[AgencyCentroid] Sample coordinates:", allCoordinates.slice(0, 3));
    }

    // Step 3: Calculate centroid
    const centroid = calculateCentroid(allCoordinates);
    console.log("[AgencyCentroid] Calculated centroid:", centroid);

    if (centroid) {
      const location = { ...centroid, name: "Agency Area" };
      cacheCentroid(agencyId, location);
      return location;
    }
  } catch (error) {
    console.warn("[AgencyCentroid] Failed to calculate agency centroid:", error);
  }

  console.log("[AgencyCentroid] Returning default location");
  return DEFAULT_LOCATION;
};

/**
 * Get the current user's agency centroid.
 * Uses the agency ID stored in localStorage.
 *
 * @returns {Promise<{ lat: number, lon: number, name: string }>}
 */
export const getUserAgencyCentroid = async () => {
  const agencyId = localStorage.getItem("cache.currentUser.agencyId") || "";
  return getAgencyCentroid(agencyId);
};

/**
 * Synchronous fallback - returns cached centroid or default.
 * Use this when you need a sync value immediately (e.g., initial map render).
 *
 * @returns {{ lat: number, lon: number, name: string }}
 */
export const getUserAgencyCentroidSync = () => {
  const agencyId = localStorage.getItem("cache.currentUser.agencyId") || "";
  if (!agencyId) {
    return DEFAULT_LOCATION;
  }

  const cached = getCachedCentroid(agencyId);
  return cached || DEFAULT_LOCATION;
};

/**
 * Clear cached centroid for an agency (useful on logout).
 * @param {string} agencyId
 */
export const clearCachedCentroid = (agencyId) => {
  if (!agencyId) return;
  try {
    localStorage.removeItem(`${CACHE_KEY_PREFIX}${agencyId}`);
  } catch {
    // Ignore
  }
};

/**
 * Clear all cached centroids.
 */
export const clearAllCachedCentroids = () => {
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore
  }
};
