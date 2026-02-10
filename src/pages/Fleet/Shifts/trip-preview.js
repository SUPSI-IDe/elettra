import { fetchElevationByTripId, fetchStopsByTripId } from "../../../api";

// Cache to avoid refetching the same trip data
const previewCache = new Map();

let currentPreviewRow = null;
let currentTripId = null;
let hideTimeout = null;
let mapInstance = null;
let polylineLayer = null;
let markersLayer = null;
let isHoveringPreview = false;

// Create the preview row content that will be inserted below the trip row
const createPreviewContent = () => {
  const content = document.createElement("td");
  content.colSpan = 100; // Span all columns
  content.className = "trip-preview-cell";
  content.innerHTML = `
    <div class="trip-preview-inline">
      <div class="trip-preview-inline__content">
        <div class="trip-preview-inline__map" data-role="map">
          <div class="trip-preview-inline__loading">Loading map...</div>
        </div>
        <div class="trip-preview-inline__elevation" data-role="elevation">
          <div class="trip-preview-inline__loading">Loading elevation...</div>
        </div>
      </div>
    </div>
  `;
  return content;
};

// Map uses coordinates from elevation profile (which has detailed lat/lng for the route)
const renderMap = async (container, elevationData, stops) => {
  // Extract coordinates from elevation profile records
  const records = elevationData?.records || elevationData;
  const coordinates = Array.isArray(records) 
    ? records
        .filter(r => r.latitude && r.longitude)
        .map(r => [parseFloat(r.latitude), parseFloat(r.longitude)])
    : [];
  
  if (coordinates.length === 0) {
    container.innerHTML = '<div class="trip-preview-inline__empty">No route data available</div>';
    return;
  }
  
  console.log(`[TripPreview] Rendering map with ${coordinates.length} coordinates`);
  
  // Check if Leaflet is loaded
  if (typeof L === "undefined") {
    try {
      await loadLeaflet();
      console.log("[TripPreview] Leaflet loaded successfully");
    } catch (e) {
      console.error("[TripPreview] Failed to load Leaflet:", e);
      container.innerHTML = '<div class="trip-preview-inline__empty">Failed to load map library</div>';
      return;
    }
  }
  
  // Clean up existing map if any
  if (mapInstance) {
    try {
      mapInstance.remove();
    } catch (e) {
      // Ignore errors when removing
    }
    mapInstance = null;
  }
  
  // Create map container div
  container.innerHTML = '<div class="trip-preview-map-container"></div>';
  const mapDiv = container.querySelector(".trip-preview-map-container");
  mapDiv.style.width = "100%";
  mapDiv.style.height = "180px";
  
  try {
    // Create new map instance
    mapInstance = L.map(mapDiv, {
      zoomControl: false,
      attributionControl: false,
    });
    
    // Use CartoDB light tiles like TripShiftPlanner
    L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(mapInstance);
    
    // Add polyline for the route
    polylineLayer = L.polyline(coordinates, {
      color: "#2563eb",
      weight: 3,
      opacity: 0.9,
    }).addTo(mapInstance);
    
    // Add markers for start and end
    markersLayer = L.layerGroup().addTo(mapInstance);
    
    // Start marker (green)
    L.circleMarker(coordinates[0], {
      radius: 8,
      fillColor: "#10b981",
      color: "#065f46",
      weight: 2,
      fillOpacity: 1,
    }).addTo(markersLayer);
    
    // End marker (red)
    L.circleMarker(coordinates[coordinates.length - 1], {
      radius: 8,
      fillColor: "#ef4444",
      color: "#7f1d1d",
      weight: 2,
      fillOpacity: 1,
    }).addTo(markersLayer);
    
    // Fit bounds with a small delay to ensure container is sized
    setTimeout(() => {
      if (mapInstance && polylineLayer) {
        mapInstance.invalidateSize();
        mapInstance.fitBounds(polylineLayer.getBounds(), { padding: [20, 20] });
      }
    }, 100);
    
    console.log("[TripPreview] Map rendered successfully");
  } catch (e) {
    console.error("[TripPreview] Error rendering map:", e);
    container.innerHTML = '<div class="trip-preview-inline__empty">Failed to render map</div>';
  }
};

const renderElevation = (container, elevationData) => {
  // Handle both { records: [...] } and flat array formats
  const records = elevationData?.records || elevationData;
  
  if (!records || !Array.isArray(records) || records.length === 0) {
    container.innerHTML = '<div class="trip-preview-inline__empty">No elevation data available</div>';
    return;
  }
  
  // Create SVG elevation chart
  const W = 400;
  const H = 120;
  const padLeft = 40;
  const padRight = 15;
  const padTop = 15;
  const padBottom = 28;
  const innerWidth = W - padLeft - padRight;
  const innerHeight = H - padTop - padBottom;
  
  // Extract distances and elevations from records
  const points = records.map((r, i) => ({
    distance: r.cumulative_distance_m ?? r.distance ?? r.cumulative_distance ?? i * 100,
    elevation: r.altitude_m ?? r.elevation ?? r.altitude ?? 0,
  }));
  
  const minAlt = Math.min(...points.map(p => p.elevation));
  const maxAlt = Math.max(...points.map(p => p.elevation));
  const maxX = Math.max(...points.map(p => p.distance));
  
  // Scale functions
  const scaleX = (d) => padLeft + (d / (maxX || 1)) * innerWidth;
  const scaleY = (alt) => padTop + innerHeight - ((alt - minAlt) / ((maxAlt - minAlt) || 1)) * innerHeight;
  
  // Create path
  const pathD = points.map((p, i) => 
    `${i === 0 ? 'M' : 'L'}${scaleX(p.distance).toFixed(1)},${scaleY(p.elevation).toFixed(1)}`
  ).join(' ');
  
  // Create area fill path
  const areaD = pathD + ` L${scaleX(maxX).toFixed(1)},${H - padBottom} L${padLeft},${H - padBottom} Z`;
  
  // X-axis ticks
  const numXTicks = 4;
  const xTicks = [];
  for (let i = 0; i <= numXTicks; i++) xTicks.push((maxX / numXTicks) * i);
  
  // Y-axis ticks
  const numYTicks = 3;
  const yTicks = [];
  for (let i = 0; i <= numYTicks; i++) yTicks.push(minAlt + ((maxAlt - minAlt) / numYTicks) * i);
  
  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" class="elevation-chart-inline" preserveAspectRatio="xMidYMid meet">
      <!-- Grid lines -->
      ${yTicks.map(y => `
        <line x1="${padLeft}" y1="${scaleY(y)}" x2="${W - padRight}" y2="${scaleY(y)}" stroke="#e5e7eb" stroke-dasharray="2,2" />
      `).join('')}
      
      <!-- Axes -->
      <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${H - padBottom}" stroke="#d1d5db" />
      <line x1="${padLeft}" y1="${H - padBottom}" x2="${W - padRight}" y2="${H - padBottom}" stroke="#d1d5db" />
      
      <!-- Area fill -->
      <path d="${areaD}" fill="rgba(5, 150, 105, 0.1)" />
      
      <!-- Elevation line -->
      <path d="${pathD}" stroke="#059669" stroke-width="2" fill="none" />
      
      <!-- X-axis ticks and labels -->
      ${xTicks.map(x => `
        <line x1="${scaleX(x)}" y1="${H - padBottom}" x2="${scaleX(x)}" y2="${H - padBottom + 4}" stroke="#9ca3af" />
        <text x="${scaleX(x)}" y="${H - padBottom + 16}" text-anchor="middle" font-size="10" fill="#6b7280">${(x / 1000).toFixed(1)}</text>
      `).join('')}
      <text x="${W - padRight}" y="${H - 8}" text-anchor="end" font-size="10" fill="#9ca3af">km</text>
      
      <!-- Y-axis ticks and labels -->
      ${yTicks.map(y => `
        <line x1="${padLeft - 4}" y1="${scaleY(y)}" x2="${padLeft}" y2="${scaleY(y)}" stroke="#9ca3af" />
        <text x="${padLeft - 8}" y="${scaleY(y) + 3}" text-anchor="end" font-size="10" fill="#6b7280">${Math.round(y)}</text>
      `).join('')}
      <text x="12" y="${padTop + innerHeight / 2}" text-anchor="middle" font-size="10" fill="#9ca3af" transform="rotate(-90 12 ${padTop + innerHeight / 2})">m</text>
    </svg>
  `;
};

const loadLeaflet = () => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (typeof L !== "undefined") {
      resolve();
      return;
    }
    
    // Load CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    
    // Load JS
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

// Get the database UUID (id field) - this is what the API expects
const getTripDbId = (trip) => {
  if (typeof trip === "string") {
    return trip;
  }
  // The API uses the database UUID (id field), not the GTFS trip_id
  return trip?.id || trip?.trip?.id || trip?.pk || trip?.trip_pk || null;
};

const loadTripPreview = async (trip, routeId, previewRow) => {
  const mapContainer = previewRow.querySelector('[data-role="map"]');
  const elevationContainer = previewRow.querySelector('[data-role="elevation"]');
  
  const tripDbId = getTripDbId(trip);
  
  if (!tripDbId) {
    console.warn("[TripPreview] No trip database ID found", trip);
    mapContainer.innerHTML = '<div class="trip-preview-inline__empty">No trip ID available</div>';
    elevationContainer.innerHTML = '<div class="trip-preview-inline__empty">No trip ID available</div>';
    return;
  }
  
  console.log(`[TripPreview] Loading preview for trip DB ID: ${tripDbId}`);
  
  // Check cache
  if (previewCache.has(tripDbId)) {
    const cached = previewCache.get(tripDbId);
    await renderMap(mapContainer, cached.elevation, cached.stops);
    renderElevation(elevationContainer, cached.elevation);
    return;
  }
  
  // Show loading state
  mapContainer.innerHTML = '<div class="trip-preview-inline__loading">Loading map...</div>';
  elevationContainer.innerHTML = '<div class="trip-preview-inline__loading">Loading elevation...</div>';
  
  try {
    let stops = [];
    let elevation = null;
    
    // Fetch stops
    try {
      console.log(`[TripPreview] Fetching stops for trip: ${tripDbId}`);
      stops = await fetchStopsByTripId(tripDbId);
      console.log(`[TripPreview] Loaded ${stops?.length || 0} stops`);
    } catch (e) {
      console.warn(`[TripPreview] Failed to load stops:`, e.message);
    }
    
    // Fetch elevation profile (this also contains the route coordinates for the map)
    try {
      console.log(`[TripPreview] Fetching elevation for trip: ${tripDbId}`);
      elevation = await fetchElevationByTripId(tripDbId);
      const recordCount = elevation?.records?.length || (Array.isArray(elevation) ? elevation.length : 0);
      console.log(`[TripPreview] Loaded elevation with ${recordCount} points`);
    } catch (e) {
      console.warn(`[TripPreview] Failed to load elevation:`, e.message);
    }
    
    // Cache the results
    previewCache.set(tripDbId, { stops, elevation });
    
    // Only render if this trip is still the current one
    if (currentTripId === tripDbId && currentPreviewRow) {
      // Map uses elevation profile coordinates (more detailed than stops)
      await renderMap(mapContainer, elevation, stops);
      renderElevation(elevationContainer, elevation);
    }
  } catch (error) {
    console.error("[TripPreview] Failed to load trip preview:", error);
    if (currentTripId === tripDbId && currentPreviewRow) {
      mapContainer.innerHTML = '<div class="trip-preview-inline__empty">Failed to load map</div>';
      elevationContainer.innerHTML = '<div class="trip-preview-inline__empty">Failed to load elevation</div>';
    }
  }
};

const removePreviewRow = () => {
  if (currentPreviewRow) {
    // Clean up map instance before removing
    if (mapInstance) {
      try {
        mapInstance.remove();
      } catch (e) {
        // Ignore errors when removing
      }
      mapInstance = null;
    }
    
    currentPreviewRow.remove();
    currentPreviewRow = null;
  }
  currentTripId = null;
};

const scheduleHide = () => {
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(() => {
    if (!isHoveringPreview) {
      removePreviewRow();
    }
  }, 300);
};

export const showTripPreview = (trip, routeId, anchorElement) => {
  if (!trip || !anchorElement) {
    console.warn("[TripPreview] showTripPreview called without trip or anchorElement");
    return;
  }
  
  const tripDbId = getTripDbId(trip);
  
  // If same trip is already shown, don't recreate
  if (currentTripId === tripDbId && currentPreviewRow) {
    clearTimeout(hideTimeout);
    return;
  }
  
  // Remove any existing preview row
  removePreviewRow();
  
  clearTimeout(hideTimeout);
  currentTripId = tripDbId;
  
  // Create new preview row
  const previewRow = document.createElement("tr");
  previewRow.className = "trip-preview-row";
  previewRow.appendChild(createPreviewContent());
  
  // Insert after the anchor row
  anchorElement.insertAdjacentElement("afterend", previewRow);
  currentPreviewRow = previewRow;
  
  // Add hover handlers to the preview row
  previewRow.addEventListener("mouseenter", () => {
    isHoveringPreview = true;
    clearTimeout(hideTimeout);
  });
  
  previewRow.addEventListener("mouseleave", () => {
    isHoveringPreview = false;
    scheduleHide();
  });
  
  // Load the preview data
  loadTripPreview(trip, routeId, previewRow);
  
  // Debug logging
  console.log("[TripPreview] Trip object:", {
    id: trip.id,
    trip_id: trip.trip_id,
    pk: trip.pk,
    tripId: trip.tripId,
    trip_pk: trip.trip_pk,
  });
  console.log(`[TripPreview] Using trip DB ID for API calls: ${tripDbId}`);
};

export const hideTripPreview = () => {
  isHoveringPreview = false;
  scheduleHide();
};

export const clearPreviewCache = () => {
  previewCache.clear();
};
