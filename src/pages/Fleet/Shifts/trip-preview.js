import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { fetchElevationByTripId, fetchStopsByTripId } from "../../../api";
import {
  buildCartoVoyagerTileUrl,
  getCartoApiKey,
} from "../../../config/carto.js";
import { t } from "../../../i18n";
import { escapeHtml as html } from "../../../utils/html.js";
import { plannerInputTime } from "./shift-planner-programme.js";

const previewMessage = (key, type = "empty") =>
  `<div class="trip-preview-inline__${type}">${t(key)}</div>`;

const previewMarkup = () => `
  <div class="trip-preview-inline">
    <div class="trip-preview-inline__content">
      <div class="trip-preview-inline__map" data-role="map">
        ${previewMessage("trip_preview.loading_map", "loading")}
      </div>
      <div class="trip-preview-inline__elevation" data-role="elevation" aria-live="polite">
        ${previewMessage("trip_preview.loading_elevation", "loading")}
      </div>
    </div>
    <div class="trip-preview-inline__stops" data-role="stops" aria-live="polite">
      ${previewMessage("trip_preview.loading_stops", "loading")}
    </div>
  </div>`;

const numeric = (value) => value != null && value !== "" && Number.isFinite(Number(value));

function observePreviewSize(element, paint, signal) {
  let frame;
  const observer = new ResizeObserver(([entry]) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      if (!signal.aborted) paint(entry.contentRect.width);
    });
  });
  observer.observe(element);
  signal.addEventListener("abort", () => {
    observer.disconnect();
    cancelAnimationFrame(frame);
  }, { once: true });
}

const stopPosition = ({ stop_lat: lat, stop_lon: lon }) =>
  numeric(lat) && numeric(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180
    ? [Number(lat), Number(lon)] : null;

const formatStop = (stop) => ({
  name: stop.stop_name?.trim() || "—",
  arrival: plannerInputTime(stop.arrival_time) || "—",
  departure: plannerInputTime(stop.departure_time) || "—",
  position: stopPosition(stop),
});

const renderStops = (container, stops, { canLocate, scrollStops }) => {
  if (!stops.length) {
    container.innerHTML = previewMessage("trip_preview.no_stops");
    return;
  }
  const title = html(t("trip_preview.stops"));
  container.innerHTML = `
    <div class="trip-preview-stops-scroll"${scrollStops ? ` role="region" aria-label="${title}" tabindex="0"` : ""}>
      <table class="trip-preview-stops-table">
        <caption>${title}</caption>
        <thead><tr>
          <th scope="col">${html(t("trip_preview.stop"))}</th>
          <th scope="col">${html(t("trip_preview.arrival"))}</th>
          <th scope="col">${html(t("trip_preview.departure"))}</th>
        </tr></thead>
        <tbody>${stops.map((stop, index) => `
          <tr>
            <th scope="row">${canLocate && stop.position
              ? `<button type="button" class="trip-preview-stop-location" data-stop-index="${index}" title="${html(t("trip_preview.show_stop_on_map"))}">${html(stop.name)}</button>`
              : html(stop.name)}</th>
            <td>${html(stop.arrival)}</td>
            <td>${html(stop.departure)}</td>
          </tr>`).join("")}</tbody>
      </table>
    </div>`;
};

const stopPopup = (stops) => `<div class="trip-preview-stop-popup">${stops.map((stop) => `
  <div><strong>${html(stop.name)}</strong>
    <span>${html(t("trip_preview.arrival"))} ${html(stop.arrival)} · ${html(t("trip_preview.departure"))} ${html(stop.departure)}</span>
  </div>`).join("")}</div>`;

const createPreviewMap = (container, signal) => {

  container.innerHTML = '<div class="trip-preview-map-container"></div>';
  const map = L.map(container.firstElementChild, {
    zoomControl: false,
    scrollWheelZoom: false,
    dragging: !window.matchMedia("(pointer: coarse)").matches,
  });
  signal.addEventListener("abort", () => map.remove(), { once: true });
  const layers = L.featureGroup().addTo(map);
  const markers = new Map();
  const fit = () => {
    if (signal.aborted) return;
    map.invalidateSize();
    const bounds = layers.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [18, 18], maxZoom: 17, animate: false });
  };
  observePreviewSize(container, fit, signal);

  const addRoute = (coordinates) => {
    L.polyline(coordinates, { color: "#2563eb", weight: 3, opacity: 0.9 }).addTo(layers);
    const endpoint = (position, fillColor, color) =>
      L.circleMarker(position, { radius: 7, fillColor, color, weight: 2, fillOpacity: 1, interactive: false }).addTo(layers);
    endpoint(coordinates[0], "#10b981", "#065f46");
    endpoint(coordinates.at(-1), "#dc2626", "#7f1d1d");
    fit();
  };

  const addStops = (stops) => {
    const groups = new Map();
    for (const stop of stops) {
      if (!stop.position) continue;
      const key = stop.position.join(",");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(stop);
    }
    const icon = L.divIcon({
      className: "trip-preview-stop-marker", iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -8],
    });
    for (const group of groups.values()) {
      const marker = L.marker(group[0].position, { icon });
      marker.on("add", () => {
        const element = marker.getElement();
        element.setAttribute("aria-label", group.map((stop) => stop.name).join(", "));
        element.classList.toggle("is-origin", group.includes(stops[0]));
        element.classList.toggle("is-destination", group.includes(stops.at(-1)));
      });
      marker.bindPopup(() => stopPopup(group), { maxHeight: 85 });
      marker.addTo(layers);
      group.forEach((stop) => markers.set(stop, marker));
    }
    fit();
  };

  getCartoApiKey().then((key) => {
    if (signal.aborted) return;
    if (!key) {
      map.attributionControl.addAttribution(html(t("trip_preview.no_basemap")));
      return;
    }
    L.tileLayer(buildCartoVoyagerTileUrl(key), {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);
  });
  return {
    addRoute,
    addStops,
    openStop(stop) {
      const marker = markers.get(stop);
      if (!marker) return;
      container.scrollIntoView({ block: "nearest", inline: "nearest" });
      marker.getElement()?.focus({ preventScroll: true });
      marker.openPopup();
    },
  };
};

const renderElevation = (container, records, signal) => {
  const points = records.map((record) => ({
    distance: record.cumulative_distance_m ?? record.distance ?? record.cumulative_distance,
    elevation: record.altitude_m ?? record.elevation ?? record.altitude,
  })).filter(({ distance, elevation }) => numeric(distance) && numeric(elevation))
    .map(({ distance, elevation }) => ({ distance: Number(distance), elevation: Number(elevation) }));

  if (!points.length) {
    container.innerHTML = previewMessage("trip_preview.no_elevation_data");
    return;
  }

  // Create SVG elevation chart
  const H = 136;
  const padRight = 15;
  const padTop = 15;
  const padBottom = 44;
  const innerHeight = H - padTop - padBottom;

  let minAlt = points[0].elevation;
  let maxAlt = minAlt;
  let maxX = 0;
  for (const point of points) {
    minAlt = Math.min(minAlt, point.elevation);
    maxAlt = Math.max(maxAlt, point.elevation);
    maxX = Math.max(maxX, point.distance);
  }
  const digits = Math.max(String(Math.round(minAlt)).length, String(Math.round(maxAlt)).length);
  const padLeft = 25 + 7 * digits;

  // Size the coordinate system to the actual column, so the axis labels keep
  // their font size in both the wide table and the compact programme panel.
  let paintedWidth = 0;
  const draw = (width) => {
    const W = Math.min(400, Math.floor(width));
    if (signal.aborted || W <= padLeft + padRight || W === paintedWidth) return;
    paintedWidth = W;
    const innerWidth = W - padLeft - padRight;
    // Scale functions
    const scaleX = (d) => padLeft + (d / (maxX || 1)) * innerWidth;
    const scaleY = (alt) => maxAlt === minAlt ? padTop + innerHeight / 2
      : padTop + innerHeight - (alt - minAlt) / (maxAlt - minAlt) * innerHeight;

    // Create path
    const pathD = points.map((p, i) =>
      `${i === 0 ? 'M' : 'L'}${scaleX(p.distance).toFixed(1)},${scaleY(p.elevation).toFixed(1)}`
    ).join(' ');

    // Create area fill path
    const areaD = pathD + ` L${scaleX(maxX).toFixed(1)},${H - padBottom} L${padLeft},${H - padBottom} Z`;

    // X-axis ticks
    const numXTicks = W < 250 ? 3 : 4;
    const xTicks = [];
    for (let i = 0; i <= (maxX ? numXTicks : 0); i++) xTicks.push((maxX / numXTicks) * i);

    // Y-axis ticks
    const numYTicks = 3;
    const yTicks = [];
    for (let i = 0; i <= (maxAlt === minAlt ? 0 : numYTicks); i++) yTicks.push(minAlt + ((maxAlt - minAlt) / numYTicks) * i);

    container.innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${t("trip_preview.elevation_profile")}" class="elevation-chart-inline" preserveAspectRatio="xMidYMid meet">
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
          <text x="${scaleX(x)}" y="${H - padBottom + 16}" text-anchor="middle" font-size="12" fill="#6b7280">${(x / 1000).toFixed(1)}</text>
        `).join('')}
        <text x="${W - padRight}" y="${H - 8}" text-anchor="end" font-size="12" fill="#9ca3af">km</text>

        <!-- Y-axis ticks and labels -->
        ${yTicks.map(y => `
          <line x1="${padLeft - 4}" y1="${scaleY(y)}" x2="${padLeft}" y2="${scaleY(y)}" stroke="#9ca3af" />
          <text x="${padLeft - 8}" y="${scaleY(y) + 3}" text-anchor="end" font-size="12" fill="#6b7280">${Math.round(y)}</text>
        `).join('')}
        <text x="12" y="${padTop + innerHeight / 2}" text-anchor="middle" font-size="12" fill="#9ca3af" transform="rotate(-90 12 ${padTop + innerHeight / 2})">m</text>
      </svg>
    `;
  };
  observePreviewSize(container, draw, signal);
};

const stopsCaches = new WeakMap();

const loadPreviewRecords = async (cache, tripId, fetchRecords, { signal, cacheEmpty }) => {
  if (cache.has(tripId)) return cache.get(tripId);
  const records = await fetchRecords(tripId, { signal });
  if (!Array.isArray(records)) throw new Error("Invalid trip preview records");
  if (!signal.aborted && (records.length || cacheEmpty)) {
    if (cache.size >= 12) cache.delete(cache.keys().next().value);
    cache.set(tripId, records);
  }
  return records;
};

export function mountTripPreview(container, tripId, cache, { cacheEmpty = false, scrollStops = true } = {}) {
  const controller = new AbortController();
  const { signal } = controller;
  container.innerHTML = previewMarkup();
  const chart = container.querySelector('[data-role="elevation"]');
  const mapContainer = container.querySelector('[data-role="map"]');
  const timetable = container.querySelector('[data-role="stops"]');
  if (!stopsCaches.has(cache)) stopsCaches.set(cache, new Map());
  const stopsCache = stopsCaches.get(cache);
  const requestOptions = { signal, cacheEmpty };
  let map;
  let mapFailed = false;
  let elevationFailed = false;
  let elevationDone = false;
  let stopsDone = false;
  let stops = [];
  timetable.addEventListener("click", (event) => {
    const button = event.target.closest("[data-stop-index]");
    if (button) map?.openStop(stops[Number(button.dataset.stopIndex)]);
  }, { signal });

  const updateMap = ({ coordinates = [], newStops = [] } = {}) => {
    if (mapFailed) return;
    try {
      const hasStopPositions = newStops.some((stop) => stop.position);
      if (coordinates.length || hasStopPositions) {
        map ??= createPreviewMap(mapContainer, signal);
        if (coordinates.length) map.addRoute(coordinates);
        if (hasStopPositions) map.addStops(newStops);
      } else if (!map && elevationDone && stopsDone) {
        mapContainer.innerHTML = previewMessage(elevationFailed ? "trip_preview.failed_map" : "trip_preview.no_route_data");
      }
    } catch {
      mapFailed = true;
      map = null;
      mapContainer.innerHTML = previewMessage("trip_preview.failed_render_map");
    }
  };

  async function loadElevation() {
    let coordinates = [];
    try {
      const records = await loadPreviewRecords(cache, tripId, async (id, options) => {
        const payload = await fetchElevationByTripId(id, options);
        return payload?.records ?? payload;
      }, requestOptions);
      if (signal.aborted) return;
      coordinates = records.filter((r) => numeric(r.latitude) && numeric(r.longitude))
        .map((r) => [Number(r.latitude), Number(r.longitude)]);
      renderElevation(chart, records, signal);
    } catch {
      if (signal.aborted) return;
      elevationFailed = true;
      chart.innerHTML = previewMessage("trip_preview.failed_elevation");
    }
    elevationDone = true;
    updateMap({ coordinates });
  }

  async function loadStops() {
    try {
      const records = await loadPreviewRecords(stopsCache, tripId, fetchStopsByTripId, requestOptions);
      if (signal.aborted) return;
      // The by-trip endpoint already returns stop-time rows in stop_sequence order.
      stops = records.map(formatStop);
      stopsDone = true;
      updateMap({ newStops: stops });
      renderStops(timetable, stops, { canLocate: Boolean(map), scrollStops });
    } catch {
      if (signal.aborted) return;
      stopsDone = true;
      timetable.innerHTML = previewMessage("trip_preview.failed_stops");
      updateMap();
    }
  }

  void loadElevation();
  void loadStops();
  return () => controller.abort();
}

const previewCache = new Map();
let currentRow;
let closePreview;
let hideTimeout;

function removePreviewRow() {
  clearTimeout(hideTimeout);
  closePreview?.();
  closePreview = null;
  currentRow?.remove();
  currentRow = null;
}

export const showTripPreview = (trip, _routeId, anchor) => {
  const id = typeof trip === "string" ? trip : trip?.id ?? trip?.trip?.id ?? trip?.pk ?? trip?.trip_pk;
  if (!id || !anchor) return;
  clearTimeout(hideTimeout);
  if (currentRow?.previousElementSibling === anchor && currentRow.dataset.previewId === id) return;
  removePreviewRow();
  const row = document.createElement("tr");
  row.className = "trip-preview-row";
  row.dataset.previewId = id;
  const cell = row.insertCell();
  cell.colSpan = anchor.cells.length;
  cell.className = "trip-preview-cell";
  anchor.after(row);
  currentRow = row;
  // Hover can fire again when a translated table is redrawn without a pointer action.
  closePreview = mountTripPreview(cell, id, previewCache, { cacheEmpty: true });
  row.addEventListener("mouseenter", () => clearTimeout(hideTimeout));
  row.addEventListener("mouseleave", hideTripPreview);
};

export const hideTripPreview = () => {
  clearTimeout(hideTimeout);
  hideTimeout = setTimeout(removePreviewRow, 300);
};

export const clearPreviewCache = () => {
  removePreviewRow();
  previewCache.clear();
  stopsCaches.delete(previewCache);
};
