import "./custom-stops.css";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { createDepot, updateDepot } from "../../../api";
import { resolveUserId } from "../../../api/session";
import { triggerPartialLoad } from "../../../events";
import { toggleFormDisabled, updateFeedback } from "../../../ui-helpers";

const parseCoordinate = (value) => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed.length) {
    return undefined;
  }
  const numeric = Number.parseFloat(trimmed);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const toDepotPayload = (formData) => {
  const name = formData.get("name")?.toString().trim() ?? "";
  const address = formData.get("address")?.toString().trim() ?? "";
  const type = formData.get("type")?.toString().trim() ?? "";
  const city = formData.get("city")?.toString().trim() ?? "";
  const notes = formData.get("notes")?.toString().trim() ?? "";
  const latitude = parseCoordinate(formData.get("latitude"));
  const longitude = parseCoordinate(formData.get("longitude"));

  const features = {};
  if (type) {
    features.type = type;
  }
  if (city) {
    features.city = city;
  }
  if (notes) {
    features.notes = notes;
  }

  return {
    name,
    address,
    latitude,
    longitude,
    features,
  };
};

export const initializeAddCustomStop = (root = document, options = {}) => {
  const section = root.querySelector("section.add-custom-stop");
  if (!section) {
    return null;
  }

  const cleanupHandlers = [];

  const form = section.querySelector('form[data-form="add-custom-stop"]');
  if (!form) {
    return null;
  }

  const isEditMode = !!options.depot;
  const currentDepot = options.depot || {};

  if (isEditMode) {
    const header = section.querySelector("header h1");
    if (header) {
      header.textContent = "Edit Custom Stop";
    }

    // Pre-fill form
    const nameInput = form.querySelector("#custom-stop-name");
    const typeSelect = form.querySelector("#custom-stop-type");
    const addressInput = form.querySelector("#custom-stop-address");
    const cityInput = form.querySelector("#custom-stop-city");
    const latInput = form.querySelector("#custom-stop-latitude");
    const lonInput = form.querySelector("#custom-stop-longitude");
    const notesInput = form.querySelector("#custom-stop-notes");

    if (nameInput) nameInput.value = currentDepot.name || "";
    if (addressInput) addressInput.value = currentDepot.address || "";
    if (latInput) latInput.value = currentDepot.latitude ?? "";
    if (lonInput) lonInput.value = currentDepot.longitude ?? "";

    if (typeSelect && currentDepot.features?.type) {
      typeSelect.value = currentDepot.features.type;
    }
    if (cityInput && currentDepot.features?.city) {
      cityInput.value = currentDepot.features.city;
    }
    if (notesInput && currentDepot.features?.notes) {
      notesInput.value = currentDepot.features.notes;
    }
  }

  const feedback = form.querySelector('[data-role="feedback"]');
  const cancelButton = form.querySelector('[data-action="cancel"]');
  const closeButton = section.querySelector('[data-action="close"]');

  const handleCloseClick = () => {
    triggerPartialLoad("custom-stops");
  };
  if (closeButton) {
    closeButton.addEventListener("click", handleCloseClick);
    cleanupHandlers.push(() => {
      closeButton.removeEventListener("click", handleCloseClick);
    });
  }

  const handleCancelClick = () => {
    triggerPartialLoad("custom-stops");
  };
  if (cancelButton) {
    cancelButton.addEventListener("click", handleCancelClick);
    cleanupHandlers.push(() => {
      cancelButton.removeEventListener("click", handleCancelClick);
    });
  }

  // Initialize map
  const mapContainer = form.querySelector('[data-role="map"]');
  const latInput = form.querySelector("#custom-stop-latitude");
  const lonInput = form.querySelector("#custom-stop-longitude");
  const addressInput = form.querySelector("#custom-stop-address");
  const cityInput = form.querySelector("#custom-stop-city");

  // Default center (Bern) or use existing coordinates in edit mode
  const defaultLat = currentDepot.latitude ?? 46.9480;
  const defaultLon = currentDepot.longitude ?? 7.4474;

  const map = L.map(mapContainer, {
    center: [defaultLat, defaultLon],
    zoom: 13,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  // Reverse geocode using Nominatim
  const reverseGeocode = async (lat, lon) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`,
        { headers: { "Accept-Language": "it" } }
      );
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  };

  // Track manual edits so we don't overwrite user input
  const handleAddressInput = () => {
    addressInput.dataset.userEdited = "true";
  };
  addressInput.addEventListener("input", handleAddressInput);
  cleanupHandlers.push(() => {
    addressInput.removeEventListener("input", handleAddressInput);
  });

  const handleCityInput = () => {
    cityInput.dataset.userEdited = "true";
  };
  cityInput.addEventListener("input", handleCityInput);
  cleanupHandlers.push(() => {
    cityInput.removeEventListener("input", handleCityInput);
  });

  // Build a robust single-line address from Nominatim data
  const buildAddressLine = (addr, displayName) => {
    const street = [
      addr.road,
      addr.pedestrian,
      addr.footway,
      addr.path,
      addr.cycleway,
      addr.residential,
      addr.square,
      addr.place,
    ].find(Boolean);
    const number = addr.house_number;

    if (street && number) return `${street} ${number}`;
    if (street) return street;
    if (number) {
      const primary = (displayName || "").split(",")[0]?.trim();
      return primary ? `${number}, ${primary}` : `${number}`;
    }
    const primary = (displayName || "").split(",")[0]?.trim();
    return primary || "";
  };

  // Update form fields from map center
  const updateFromMapCenter = async () => {
    const center = map.getCenter();
    const lat = center.lat.toFixed(6);
    const lon = center.lng.toFixed(6);

    latInput.value = lat;
    lonInput.value = lon;

    // Reverse geocode for address
    const geo = await reverseGeocode(center.lat, center.lng);
    if (geo) {
      const addr = geo.address || {};

      const addressLine = buildAddressLine(addr, geo.display_name);
      if (!addressInput.dataset.userEdited && addressLine) {
        addressInput.value = addressLine;
      }

      const city = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || addr.suburb;
      if (!cityInput.dataset.userEdited && city) {
        cityInput.value = city;
      }
    }
  };

  // Debounce helper
  let debounceTimer;
  const debounce = (fn, delay) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, delay);
  };

  const handleMoveEnd = () => {
    debounce(updateFromMapCenter, 500);
  };
  map.on("moveend", handleMoveEnd);
  cleanupHandlers.push(() => {
    clearTimeout(debounceTimer);
    map.off("moveend", handleMoveEnd);
  });

  // Initial update if adding new stop
  if (!isEditMode) {
    updateFromMapCenter();
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const { name, address, latitude, longitude, features } =
      toDepotPayload(formData);

    if (!name || !address) {
      updateFeedback(feedback, "Name and address are required.", "error");
      return;
    }

    updateFeedback(feedback, isEditMode ? "Updating…" : "Saving…", "info");
    toggleFormDisabled(form, true);

    try {
      const userId = await resolveUserId();

      if (isEditMode) {
        await updateDepot(currentDepot.id, {
          name,
          address,
          latitude,
          longitude,
          features,
          userId,
        });
        updateFeedback(feedback, "Custom stop updated.", "success");
      } else {
        await createDepot({
          name,
          address,
          latitude,
          longitude,
          features,
          userId,
        });
        updateFeedback(feedback, "Custom stop added.", "success");
      }

      triggerPartialLoad("custom-stops", {
        flashMessage:
          isEditMode ? "Custom stop updated." : "Custom stop added.",
      });
    } catch (error) {
      console.error(
        isEditMode ?
          "Failed to update custom stop"
        : "Failed to create custom stop",
        error
      );
      updateFeedback(
        feedback,
        error?.message ??
          (isEditMode ?
            "Unable to update custom stop."
          : "Unable to create custom stop."),
        "error"
      );
    } finally {
      toggleFormDisabled(form, false);
    }
  };

  form.addEventListener("submit", handleSubmit);
  cleanupHandlers.push(() => {
    form.removeEventListener("submit", handleSubmit);
  });

  // Clean up map on navigation
  cleanupHandlers.push(() => {
    map.remove();
  });

  return () => {
    cleanupHandlers.forEach((handler) => handler());
  };
};
