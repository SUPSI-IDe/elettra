import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { fetchElevationByTripId } from "../../../api";
import {
  buildCartoVoyagerTileUrl,
  getCartoApiKey,
} from "../../../config/carto.js";
import { t } from "../../../i18n";

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

const renderMap = (container, records, signal) => {
  const coordinates = records.filter((r) => numeric(r.latitude) && numeric(r.longitude))
    .map((r) => [Number(r.latitude), Number(r.longitude)]);
  if (!coordinates.length) {
    container.innerHTML = previewMessage("trip_preview.no_route_data");
    return;
  }

  container.innerHTML = '<div class="trip-preview-map-container"></div>';
  const map = L.map(container.firstElementChild, { zoomControl: false, scrollWheelZoom: false });
  const line = L.polyline(coordinates, { color: "#2563eb", weight: 3, opacity: 0.9 }).addTo(map);
  const marker = (position, fillColor, color) =>
    L.circleMarker(position, { radius: 7, fillColor, color, weight: 2, fillOpacity: 1 }).addTo(map);
  marker(coordinates[0], "#10b981", "#065f46");
  marker(coordinates.at(-1), "#dc2626", "#7f1d1d");
  const fit = () => {
    if (signal.aborted) return;
    map.invalidateSize();
    map.fitBounds(line.getBounds(), { padding: [18, 18], maxZoom: 17, animate: false });
  };
  fit();
  observePreviewSize(container, fit, signal);
  signal.addEventListener("abort", () => map.remove(), { once: true });

  getCartoApiKey().then((key) => {
    if (signal.aborted) return;
    const osm = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
    const url = key ? buildCartoVoyagerTileUrl(key) : "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
    const attribution = key ? osm + ' &copy; <a href="https://carto.com/attributions">CARTO</a>' : osm;
    L.tileLayer(url, { maxZoom: 19, attribution }).addTo(map);
  });
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

// The catalogue and saved programme share the same elevation records and map renderer.
export function mountTripPreview(container, tripId, cache, { cacheEmpty = false } = {}) {
  const controller = new AbortController();
  const { signal } = controller;
  container.innerHTML = previewMarkup();
  const chart = container.querySelector('[data-role="elevation"]');
  const map = container.querySelector('[data-role="map"]');

  async function load() {
    try {
      let records = cache.get(tripId);
      if (!records) {
        const payload = await fetchElevationByTripId(tripId, { signal });
        if (signal.aborted) return;
        records = payload?.records ?? payload;
        if (!Array.isArray(records)) throw new Error("Invalid elevation records");
        if (records.length || cacheEmpty) {
          if (cache.size >= 12) cache.delete(cache.keys().next().value);
          cache.set(tripId, records);
        }
      }
      renderElevation(chart, records, signal);
      try {
        renderMap(map, records, signal);
      } catch {
        map.innerHTML = previewMessage("trip_preview.failed_render_map");
      }
    } catch {
      if (signal.aborted) return;
      chart.innerHTML = previewMessage("trip_preview.failed_elevation");
      map.innerHTML = previewMessage("trip_preview.failed_map");
    }
  }
  void load();
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
};
