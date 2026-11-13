import "./custom-stops.css";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { createDepot, updateDepot } from "../../../api";
import { resolveUserId } from "../../../api/session";
import { triggerPartialLoad } from "../../../events";
import { toggleFormDisabled, updateFeedback } from "../../../ui-helpers";
import { getUserAgencyCentroidSync, getUserAgencyCentroid, DEFAULT_LOCATION } from "../../../config/company-locations";
import { t } from "../../../i18n";

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

const objectFeatures = (features) =>
  features && typeof features === "object" && !Array.isArray(features) ?
    { ...features }
  : {};

const toDepotPayload = (formData, existingFeatures) => {
  const name = formData.get("name")?.toString().trim() ?? "";
  const address = formData.get("address")?.toString().trim() ?? "";
  const type = formData.get("type")?.toString().trim() ?? "";
  const city = formData.get("city")?.toString().trim() ?? "";
  const notes = formData.get("notes")?.toString().trim() ?? "";
  const latitude = parseCoordinate(formData.get("latitude"));
  const longitude = parseCoordinate(formData.get("longitude"));

  const features = objectFeatures(existingFeatures);
  if (type) {
    features.type = type;
  } else {
    delete features.type;
  }
  if (city) {
    features.city = city;
  } else {
    delete features.city;
  }
  if (notes) {
    features.notes = notes;
  } else {
    delete features.notes;
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

  const currentDepot = options.depot || {};
  const isDuplicateMode = options.duplicate === true && !!currentDepot?.id;
  const isEditMode = !isDuplicateMode && !!currentDepot?.id;

  if (isEditMode || isDuplicateMode) {
    const header = section.querySelector("header h1");
    if (header && isEditMode) {
      header.textContent = t("custom_stops.edit_title");
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
  const addressSearchButton = form.querySelector('[data-action="search-address"]');
  const addressSearchFeedback = form.querySelector(
    '[data-role="address-search-feedback"]'
  );

  // Initial center: use existing depot coords in edit mode, else use cached centroid or default
  const initialLocation = getUserAgencyCentroidSync();
  const defaultLat = currentDepot.latitude ?? initialLocation.lat;
  const defaultLon = currentDepot.longitude ?? initialLocation.lon;

  const map = L.map(mapContainer, {
    center: [defaultLat, defaultLon],
    zoom: 13,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map);

  let reverseGeocodeController = null;
  let addressSearchController = null;
  let skipReverseAt = null;

  const geocodingLanguage = () =>
    document.documentElement.lang?.trim() || "it";

  // Reverse geocode using Nominatim
  const reverseGeocode = async (lat, lon) => {
    reverseGeocodeController?.abort();
    const controller = new AbortController();
    reverseGeocodeController = controller;

    try {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.search = new URLSearchParams({
        lat: String(lat),
        lon: String(lon),
        format: "jsonv2",
        addressdetails: "1",
      });
      const response = await fetch(url, {
        headers: { "Accept-Language": geocodingLanguage() },
        signal: controller.signal,
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    } finally {
      if (reverseGeocodeController === controller) {
        reverseGeocodeController = null;
      }
    }
  };

  const forwardGeocode = async (query, signal) => {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.search = new URLSearchParams({
      q: query,
      format: "jsonv2",
      addressdetails: "1",
      limit: "1",
    });
    const response = await fetch(url, {
      headers: { "Accept-Language": geocodingLanguage() },
      signal,
    });
    if (!response.ok) {
      throw new Error(`Address search failed with status ${response.status}`);
    }
    const results = await response.json();
    return Array.isArray(results) ? results : [];
  };

  const cityFromGeocode = (geo) => {
    const addr = geo?.address || {};
    return (
      addr.city ||
      addr.town ||
      addr.village ||
      addr.municipality ||
      addr.hamlet ||
      addr.suburb ||
      ""
    );
  };

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

  const setAddressSearchFeedback = (message = "", tone = "info") => {
    if (!addressSearchFeedback) return;
    addressSearchFeedback.textContent = message;
    addressSearchFeedback.dataset.tone = tone;
    addressSearchFeedback.hidden = !message;
  };

  const setAddressSearchBusy = (busy) => {
    if (addressSearchButton) addressSearchButton.disabled = busy;
    addressInput?.setAttribute("aria-busy", String(busy));
  };

  const searchAddressOnMap = async () => {
    const address = addressInput?.value.trim() || "";
    const city = cityInput?.value.trim() || "";
    if (!address) {
      addressInput?.setAttribute("aria-invalid", "true");
      addressInput?.focus();
      setAddressSearchFeedback(
        t("custom_stops.required_field_missing", {
          field: t("custom_stops.field_address"),
        }),
        "error"
      );
      return;
    }

    addressInput.removeAttribute("aria-invalid");
    addressSearchController?.abort();
    reverseGeocodeController?.abort();
    const controller = new AbortController();
    addressSearchController = controller;
    setAddressSearchBusy(true);
    setAddressSearchFeedback(t("custom_stops.address_searching"), "info");

    try {
      const query = [address, city].filter(Boolean).join(", ");
      const [result] = await forwardGeocode(query, controller.signal);
      if (!result) {
        setAddressSearchFeedback(
          t("custom_stops.address_search_no_results"),
          "error"
        );
        return;
      }

      const latitude = Number.parseFloat(result.lat);
      const longitude = Number.parseFloat(result.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("Address search returned invalid coordinates");
      }

      const resultAddress = result.address || {};
      const addressLine = buildAddressLine(resultAddress, result.display_name);
      const resultCity = cityFromGeocode(result);
      if (addressLine) addressInput.value = addressLine;
      if (resultCity) cityInput.value = resultCity;
      latInput.value = latitude.toFixed(6);
      lonInput.value = longitude.toFixed(6);

      userInteracted = true;
      skipReverseAt = { lat: latitude, lon: longitude };
      map.setView([latitude, longitude], Math.max(map.getZoom(), 16));
      setAddressSearchFeedback(
        t("custom_stops.address_search_success"),
        "success"
      );
    } catch (error) {
      if (error?.name !== "AbortError") {
        console.warn("Could not search custom stop address", error);
        setAddressSearchFeedback(
          t("custom_stops.address_search_failed"),
          "error"
        );
      }
    } finally {
      if (addressSearchController === controller) {
        addressSearchController = null;
        setAddressSearchBusy(false);
      }
    }
  };

  // Update form fields from map center
  const updateFromMapCenter = async () => {
    const center = map.getCenter();
    const lat = center.lat.toFixed(6);
    const lon = center.lng.toFixed(6);

    latInput.value = lat;
    lonInput.value = lon;

    const geo = await reverseGeocode(center.lat, center.lng);
    if (geo) {
      const addr = geo.address || {};
      const addressLine = buildAddressLine(addr, geo.display_name);
      if (addressLine) addressInput.value = addressLine;
      const city = cityFromGeocode(geo);
      if (city) cityInput.value = city;
    }
  };

  let debounceTimer;
  const debounce = (fn, delay) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, delay);
  };

  // Track if user interacted with map - don't override their position
  let userInteracted = false;
  map.on("dragstart", () => {
    userInteracted = true;
  });
  cleanupHandlers.push(() => {
    map.off("dragstart");
  });

  const handleMoveEnd = () => {
    const center = map.getCenter();
    if (
      skipReverseAt &&
      Math.abs(center.lat - skipReverseAt.lat) < 0.000001 &&
      Math.abs(center.lng - skipReverseAt.lon) < 0.000001
    ) {
      skipReverseAt = null;
      clearTimeout(debounceTimer);
      return;
    }
    skipReverseAt = null;
    debounce(updateFromMapCenter, 500);
  };
  map.on("moveend", handleMoveEnd);
  cleanupHandlers.push(() => {
    clearTimeout(debounceTimer);
    map.off("moveend", handleMoveEnd);
  });

  const handleAddressSearchClick = () => {
    void searchAddressOnMap();
  };
  const handleAddressKeydown = (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void searchAddressOnMap();
  };
  const handleAddressInput = () => {
    addressInput.removeAttribute("aria-invalid");
    addressSearchController?.abort();
    setAddressSearchFeedback();
  };
  addressSearchButton?.addEventListener("click", handleAddressSearchClick);
  addressInput?.addEventListener("keydown", handleAddressKeydown);
  addressInput?.addEventListener("input", handleAddressInput);
  cleanupHandlers.push(() => {
    addressSearchButton?.removeEventListener("click", handleAddressSearchClick);
    addressInput?.removeEventListener("keydown", handleAddressKeydown);
    addressInput?.removeEventListener("input", handleAddressInput);
    addressSearchController?.abort();
    reverseGeocodeController?.abort();
  });

  // Initial update if adding new stop
  if (!isEditMode && !isDuplicateMode) {
    updateFromMapCenter();
  }

  // Recover the missing city from stored coordinates for legacy stops.
  if ((isEditMode || isDuplicateMode) && !cityInput.value.trim()) {
    const latitude = Number.parseFloat(latInput.value);
    const longitude = Number.parseFloat(lonInput.value);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      reverseGeocode(latitude, longitude).then((geo) => {
        const city = cityFromGeocode(geo);
        if (city && !cityInput.value.trim()) {
          cityInput.value = city;
        }
      });
    }
  }

  // For new stops: asynchronously calculate centroid from GTFS data and recenter
  // Only if we don't have depot coordinates and user hasn't interacted
  if (
    !isEditMode &&
    !isDuplicateMode &&
    currentDepot.latitude == null &&
    currentDepot.longitude == null
  ) {
    getUserAgencyCentroid()
      .then((centroid) => {
        if (!centroid || userInteracted) return;
        
        // Check if centroid is different from current position (not default)
        const current = map.getCenter();
        const isSame =
          Math.abs(current.lat - centroid.lat) < 0.001 &&
          Math.abs(current.lng - centroid.lon) < 0.001;
        
        if (!isSame) {
          map.setView([centroid.lat, centroid.lon], 13);
          updateFromMapCenter();
        }
      })
      .catch((err) => {
        console.warn("Could not calculate agency centroid:", err);
      });
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const { name, address, latitude, longitude, features } =
      toDepotPayload(formData, currentDepot.features);

    // Everything but notes is mandatory. Coordinates come from the address
    // search or map; address and city remain editable if geocoding is unavailable.
    const requiredFields = [
      { name: "name", value: name, label: t("custom_stops.field_name") },
      { name: "type", value: features.type, label: t("custom_stops.field_type") },
      { name: "address", value: address, label: t("custom_stops.field_address") },
      { name: "city", value: features.city, label: t("custom_stops.field_city") },
      {
        name: "latitude",
        value: latitude,
        label: t("custom_stops.field_latitude"),
      },
      {
        name: "longitude",
        value: longitude,
        label: t("custom_stops.field_longitude"),
      },
    ];
    const missingField = requiredFields.find(
      ({ value }) => value === undefined || value === ""
    );

    form.querySelectorAll('[aria-invalid="true"]').forEach((field) => {
      field.removeAttribute("aria-invalid");
    });

    if (missingField) {
      const field = form.elements.namedItem(missingField.name);
      field?.setAttribute("aria-invalid", "true");
      field?.focus();
      updateFeedback(
        feedback,
        t("custom_stops.required_field_missing", { field: missingField.label }),
        "error"
      );
      return;
    }

    updateFeedback(feedback, isEditMode ? t("custom_stops.updating") : t("custom_stops.saving"), "info");
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
        updateFeedback(feedback, t("custom_stops.updated"), "success");
      } else {
        await createDepot({
          name,
          address,
          latitude,
          longitude,
          features,
          userId,
        });
        updateFeedback(feedback, t("custom_stops.added"), "success");
      }

      triggerPartialLoad("custom-stops", {
        flashMessage:
          isEditMode ? t("custom_stops.updated") : t("custom_stops.added"),
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
            t("custom_stops.unable_to_update")
          : t("custom_stops.unable_to_create")),
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
