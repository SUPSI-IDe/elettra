import L from "leaflet";
import "leaflet/dist/leaflet.css";

import {
  fetchElevationByTripId,
  fetchStopsByTripId,
} from "../../../api";
import {
  buildCartoVoyagerTileUrl,
  getCartoApiKey,
} from "../../../config/carto.js";
import { t } from "../../../i18n";
import { firstAvailable, normalizeTime } from "./shift-utils";

const coordinateValue = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const tripStops = (trip = {}) => {
  const candidates = [
    trip?.stop_times,
    trip?.stops,
    trip?.trip?.stop_times,
    trip?.trip?.stops,
  ];
  return candidates.find((entries) => Array.isArray(entries) && entries.length) ?? [];
};

export const normalizeMapStop = (entry = {}, index = 0) => {
  const stop = entry?.stop ?? {};
  const latitude = coordinateValue(
    entry?.stop_lat ??
      entry?.latitude ??
      entry?.lat ??
      stop?.stop_lat ??
      stop?.latitude ??
      stop?.lat
  );
  const longitude = coordinateValue(
    entry?.stop_lon ??
      entry?.stop_lng ??
      entry?.longitude ??
      entry?.lng ??
      entry?.lon ??
      stop?.stop_lon ??
      stop?.stop_lng ??
      stop?.longitude ??
      stop?.lng ??
      stop?.lon
  );

  return {
    name: firstAvailable(
      entry?.stop_name,
      entry?.stopName,
      entry?.name,
      stop?.stop_name,
      stop?.name,
      stop?.label,
      t("shifts.map_unnamed_stop", { number: index + 1 })
    ),
    time: normalizeTime(
      firstAvailable(
        entry?.departure_time,
        entry?.departureTime,
        entry?.arrival_time,
        entry?.arrivalTime
      )
    ),
    latitude,
    longitude,
  };
};

export const extractRouteCoordinates = (elevationData) => {
  const records = elevationData?.records ?? elevationData;
  if (!Array.isArray(records)) {
    return [];
  }

  return records
    .map((record = {}) => [
      coordinateValue(record?.latitude ?? record?.lat),
      coordinateValue(
        record?.longitude ?? record?.lng ?? record?.lon
      ),
    ])
    .filter(([latitude, longitude]) => latitude !== null && longitude !== null);
};

const resolveTripDatabaseId = (trip = {}) =>
  firstAvailable(
    trip?.id,
    trip?.pk,
    trip?.trip_pk,
    trip?.tripPk,
    trip?.trip?.id,
    trip?.trip?.pk
  );

const stopMarkerClass = (index, count) => {
  if (index === 0) return "shift-trip-map__marker--start";
  if (index === count - 1) return "shift-trip-map__marker--end";
  return "shift-trip-map__marker--middle";
};

const createStopIcon = (index, count) =>
  L.divIcon({
    className: "shift-trip-map__marker-shell",
    html: `<span class="shift-trip-map__marker ${stopMarkerClass(index, count)}">${index + 1}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });

export const createShiftTripMap = ({ container, trips = [] } = {}) => {
  if (!container) {
    return null;
  }

  const canvas = container.querySelector('[data-role="shift-trip-map-canvas"]');
  const routeLabel = container.querySelector('[data-role="trip-map-route"]');
  const timeLabel = container.querySelector('[data-role="trip-map-time"]');
  const counter = container.querySelector('[data-role="trip-map-counter"]');
  const stopsList = container.querySelector('[data-role="trip-map-stops"]');
  const firstButton = container.querySelector('[data-action="first-trip"]');
  const previousButton = container.querySelector('[data-action="previous-trip"]');
  const nextButton = container.querySelector('[data-action="next-trip"]');
  const lastButton = container.querySelector('[data-action="last-trip"]');
  const status = container.querySelector('[data-role="trip-map-status"]');

  let currentTrips = Array.isArray(trips) ? trips : [];
  let currentIndex = 0;
  let map = null;
  let routeLayer = null;
  let stopsLayer = null;
  let renderVersion = 0;
  let destroyed = false;
  const tripCache = new Map();

  const setStatus = (message = "") => {
    if (!status) return;
    status.textContent = message;
    status.hidden = !message;
  };

  const ensureMap = () => {
    if (map || !canvas || destroyed) return map;

    map = L.map(canvas, {
      zoomControl: true,
      attributionControl: false,
    });

    const createdMap = map;
    getCartoApiKey()
      .then((apiKey) => {
        if (apiKey && map === createdMap) {
          L.tileLayer(buildCartoVoyagerTileUrl(apiKey), { maxZoom: 19 }).addTo(
            createdMap
          );
        }
      })
      .catch((error) => {
        console.warn("Unable to load the shift map basemap", error);
      });

    return map;
  };

  const renderStopsList = (stops = []) => {
    if (!stopsList) return;
    stopsList.innerHTML = "";

    if (!stops.length) {
      const item = document.createElement("li");
      item.className = "shift-trip-map__empty-stop";
      item.textContent = t("shifts.map_no_stops");
      stopsList.append(item);
      return;
    }

    const fragment = document.createDocumentFragment();
    stops.forEach((stop, index) => {
      const item = document.createElement("li");
      item.className = "shift-trip-map__stop";

      const indexNode = document.createElement("span");
      indexNode.className = `shift-trip-map__stop-index ${stopMarkerClass(index, stops.length)}`;
      indexNode.textContent = String(index + 1);

      const copy = document.createElement("span");
      copy.className = "shift-trip-map__stop-copy";
      const name = document.createElement("strong");
      name.textContent = stop.name;
      const time = document.createElement("span");
      time.textContent = stop.time || "—";
      copy.append(name, time);
      item.append(indexNode, copy);
      fragment.append(item);
    });
    stopsList.append(fragment);
  };

  const updateTripHeader = (trip = {}) => {
    const start = firstAvailable(trip?.start_stop_name, trip?.startStopName, "—");
    const end = firstAvailable(trip?.end_stop_name, trip?.endStopName, "—");
    const departure = normalizeTime(trip?.departure_time);
    const arrival = normalizeTime(trip?.arrival_time);

    if (routeLabel) routeLabel.textContent = `${start} → ${end}`;
    if (timeLabel) {
      timeLabel.textContent = [departure, arrival].filter(Boolean).join(" – ") || "—";
    }
    if (counter) {
      counter.textContent = t("shifts.map_trip_counter", {
        current: currentTrips.length ? currentIndex + 1 : 0,
        total: currentTrips.length,
      });
    }
    const isFirst = currentIndex <= 0;
    const isLast = currentIndex >= currentTrips.length - 1;
    if (firstButton) firstButton.disabled = isFirst;
    if (previousButton) previousButton.disabled = isFirst;
    if (nextButton) nextButton.disabled = isLast;
    if (lastButton) lastButton.disabled = isLast;
  };

  const loadTripData = async (trip) => {
    const tripId = resolveTripDatabaseId(trip);
    const embeddedStops = tripStops(trip);
    const cacheKey = tripId || `index:${currentIndex}`;

    if (tripCache.has(cacheKey)) {
      return tripCache.get(cacheKey);
    }

    const request = (async () => {
      let stops = embeddedStops;
      let elevation = null;

      if (tripId) {
        const [stopsResult, elevationResult] = await Promise.allSettled([
          stops.length ? Promise.resolve(stops) : fetchStopsByTripId(tripId),
          fetchElevationByTripId(tripId),
        ]);
        if (stopsResult.status === "fulfilled" && Array.isArray(stopsResult.value)) {
          stops = stopsResult.value;
        }
        if (elevationResult.status === "fulfilled") {
          elevation = elevationResult.value;
        }
      }

      return {
        stops: stops.map((stop, index) => normalizeMapStop(stop, index)),
        coordinates: extractRouteCoordinates(elevation),
      };
    })();

    tripCache.set(cacheKey, request);
    return request;
  };

  const renderMapLayers = async ({ coordinates = [], stops = [] } = {}) => {
    const currentMap = ensureMap();
    if (!currentMap || destroyed) return;

    routeLayer?.remove();
    stopsLayer?.remove();

    const locatedStops = stops.filter(
      (stop) => stop.latitude !== null && stop.longitude !== null
    );
    const fallbackCoordinates = locatedStops.map((stop) => [
      stop.latitude,
      stop.longitude,
    ]);
    const routeCoordinates = coordinates.length ? coordinates : fallbackCoordinates;

    if (routeCoordinates.length >= 2) {
      routeLayer = L.polyline(routeCoordinates, {
        color: "#2563eb",
        weight: 5,
        opacity: 0.85,
      }).addTo(currentMap);
    } else {
      routeLayer = null;
    }

    stopsLayer = L.layerGroup().addTo(currentMap);
    locatedStops.forEach((stop, index) => {
      const marker = L.marker([stop.latitude, stop.longitude], {
        icon: createStopIcon(index, locatedStops.length),
        keyboard: true,
        title: `${stop.time ? `${stop.time} · ` : ""}${stop.name}`,
      }).addTo(stopsLayer);
      const tooltip = document.createElement("span");
      const tooltipTime = document.createElement("strong");
      tooltipTime.textContent = stop.time || "—";
      tooltip.append(tooltipTime, document.createElement("br"), stop.name);
      marker.bindTooltip(tooltip, { direction: "top", offset: [0, -12] });
    });

    const bounds = L.latLngBounds([]);
    if (routeLayer) {
      bounds.extend(routeLayer.getBounds());
    }
    locatedStops.forEach((stop) => {
      bounds.extend([stop.latitude, stop.longitude]);
    });
    currentMap.invalidateSize();
    if (bounds.isValid()) {
      currentMap.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 });
    } else {
      currentMap.setView([46.0, 8.95], 10);
    }

    setStatus(
      routeCoordinates.length || locatedStops.length ? "" : t("shifts.map_no_route")
    );
  };

  const renderCurrentTrip = async () => {
    const version = ++renderVersion;
    const trip = currentTrips[currentIndex];
    updateTripHeader(trip);

    if (!trip) {
      renderStopsList([]);
      setStatus(t("shifts.map_no_trips"));
      return;
    }

    const initialStops = tripStops(trip).map((stop, index) =>
      normalizeMapStop(stop, index)
    );
    renderStopsList(initialStops);
    setStatus(t("shifts.map_loading"));

    try {
      const data = await loadTripData(trip);
      if (destroyed || version !== renderVersion) return;
      renderStopsList(data.stops);
      await renderMapLayers(data);
    } catch (error) {
      if (destroyed || version !== renderVersion) return;
      console.error("Unable to render shift trip map", error);
      setStatus(t("shifts.map_failed"));
    }
  };

  const goTo = (index) => {
    if (!currentTrips.length) return;
    const nextIndex = Math.min(Math.max(index, 0), currentTrips.length - 1);
    if (nextIndex === currentIndex && map) {
      map.invalidateSize();
      return;
    }
    currentIndex = nextIndex;
    renderCurrentTrip();
  };

  const show = () => {
    renderCurrentTrip();
    requestAnimationFrame(() => map?.invalidateSize());
  };

  const setTrips = (nextTrips = []) => {
    currentTrips = Array.isArray(nextTrips) ? nextTrips : [];
    currentIndex = Math.min(currentIndex, Math.max(currentTrips.length - 1, 0));
    tripCache.clear();
    updateTripHeader(currentTrips[currentIndex]);
    renderStopsList(
      tripStops(currentTrips[currentIndex]).map((stop, index) =>
        normalizeMapStop(stop, index)
      )
    );
  };

  const handleFirst = () => goTo(0);
  const handlePrevious = () => goTo(currentIndex - 1);
  const handleNext = () => goTo(currentIndex + 1);
  const handleLast = () => goTo(currentTrips.length - 1);
  firstButton?.addEventListener("click", handleFirst);
  previousButton?.addEventListener("click", handlePrevious);
  nextButton?.addEventListener("click", handleNext);
  lastButton?.addEventListener("click", handleLast);

  updateTripHeader(currentTrips[currentIndex]);
  renderStopsList(tripStops(currentTrips[currentIndex]).map(normalizeMapStop));

  return {
    show,
    setTrips,
    goTo,
    destroy() {
      destroyed = true;
      renderVersion += 1;
      firstButton?.removeEventListener("click", handleFirst);
      previousButton?.removeEventListener("click", handlePrevious);
      nextButton?.removeEventListener("click", handleNext);
      lastButton?.removeEventListener("click", handleLast);
      map?.remove();
      map = null;
    },
  };
};
