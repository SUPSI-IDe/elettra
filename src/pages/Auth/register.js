import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { registerUser } from "../../api/auth";
import {
  fetchAgencyNetworkPreview,
  fetchAllAgencies,
} from "../../api/gtfs";
import { triggerPartialLoad } from "../../events";
import {
  buildCartoVoyagerTileUrl,
  getCartoApiKey,
} from "../../config/carto.js";
import { I18N_CHANGE_EVENT, t } from "../../i18n";
import { normalizeAgencyNetworkLines } from "../../utils/agency-network-preview";
import { meetsPasswordMinimumLength } from "../../utils/password-policy";

// Cache for agencies
let agenciesCache = null;
const networkPreviewCache = new Map();
const NETWORK_PREVIEW_COLORS = [
  "#007f86",
  "#1d4e89",
  "#c35a21",
  "#6c4da8",
  "#2e7d4f",
  "#b33a5b",
];

const routeColor = (value, index) => {
  const normalized = String(value ?? "")
    .trim()
    .replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(normalized) && normalized.toLowerCase() !== "ffffff") {
    return `#${normalized}`;
  }
  return NETWORK_PREVIEW_COLORS[index % NETWORK_PREVIEW_COLORS.length];
};

const setNetworkPreviewState = (preview, state) => {
  if (!preview) return;
  preview.dataset.state = state;
  preview.setAttribute("aria-busy", state === "loading" ? "true" : "false");
  preview.querySelectorAll("[data-preview-state]").forEach((element) => {
    element.hidden = element.dataset.previewState !== state;
  });
};

const createNetworkPreviewMap = (preview) => {
  const canvas = preview?.querySelector(
    '[data-role="agency-network-preview-map"]'
  );
  let map = null;
  let routesLayer = null;

  const ensureMap = () => {
    if (map || !canvas) return map;
    map = L.map(canvas, {
      attributionControl: false,
      boxZoom: false,
      doubleClickZoom: false,
      dragging: false,
      keyboard: false,
      scrollWheelZoom: false,
      touchZoom: false,
      zoomControl: false,
    });
    routesLayer = L.layerGroup().addTo(map);

    const createdMap = map;
    getCartoApiKey()
      .then((apiKey) => {
        if (apiKey && map === createdMap) {
          L.tileLayer(buildCartoVoyagerTileUrl(apiKey), {
            maxZoom: 19,
          }).addTo(createdMap);
        }
      })
      .catch((error) => {
        console.warn("Unable to load the agency preview basemap", error);
      });
    return map;
  };

  return {
    clear() {
      routesLayer?.clearLayers();
    },
    destroy() {
      map?.remove();
      map = null;
      routesLayer = null;
    },
    render(lines) {
      const currentMap = ensureMap();
      if (!currentMap || !routesLayer) return;
      routesLayer.clearLayers();
      const bounds = [];
      lines.forEach((line, index) => {
        const coordinates = line.points.map(({ lat, lon }) => [lat, lon]);
        bounds.push(...coordinates);
        const polyline = L.polyline(coordinates, {
          color: routeColor(line.color, index),
          opacity: 0.88,
          weight: 4,
        }).addTo(routesLayer);
        if (line.label) {
          polyline.bindTooltip(line.label, { sticky: true });
        }
      });
      currentMap.invalidateSize();
      currentMap.fitBounds(bounds, { padding: [16, 16], maxZoom: 13 });
    },
  };
};

const clearNetworkPreview = (preview, networkMap) => {
  networkMap?.clear();
  setNetworkPreviewState(preview, "idle");
};

const renderNetworkPreview = (
  preview,
  payload,
  fallbackAgencyName = "",
  networkMap
) => {
  const mapCanvas = preview?.querySelector(
    '[data-role="agency-network-preview-map"]'
  );
  const summary = preview?.querySelector(
    '[data-role="agency-network-preview-summary"]'
  );
  const routeList = preview?.querySelector(
    '[data-role="agency-network-preview-routes"]'
  );
  if (!preview || !mapCanvas || !summary || !routeList) return false;

  const lines = normalizeAgencyNetworkLines(payload?.lines).sort((left, right) =>
    String(left.label ?? "").localeCompare(String(right.label ?? ""), undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
  if (!lines.length) {
    networkMap?.clear();
    setNetworkPreviewState(preview, "empty");
    return false;
  }

  routeList.replaceChildren();
  lines.forEach((line, index) => {
    const badge = document.createElement("span");
    badge.className = "agency-network-preview__route";
    badge.style.setProperty("--route-color", routeColor(line.color, index));
    badge.textContent = line.label || "–";
    routeList.append(badge);
  });

  const agencyName = payload?.agency_name || fallbackAgencyName;
  summary.textContent = agencyName;
  mapCanvas.setAttribute(
    "aria-label",
    t("register.network_preview_map_label", { company: agencyName })
  );
  preview._networkPreviewPayload = payload;
  preview._networkPreviewAgencyName = fallbackAgencyName;
  setNetworkPreviewState(preview, "ready");
  networkMap?.render(lines);
  return true;
};

// Load agencies from API
const loadAgencies = async () => {
  if (agenciesCache) {
    return agenciesCache;
  }

  try {
    const data = await fetchAllAgencies();
    // Handle both array response and paginated response
    agenciesCache = Array.isArray(data) ? data : data?.items || data?.results || [];
    return agenciesCache;
  } catch (error) {
    console.error("Failed to load agencies:", error);
    return [];
  }
};

// Filter agencies based on search term
const filterAgencies = (agencies, searchTerm) => {
  if (!searchTerm || searchTerm.length < 1) {
    return agencies.slice(0, 10); // Show first 10 when empty or short query
  }

  const term = searchTerm.toLowerCase();
  return agencies
    .filter((agency) => {
      const name = (agency.agency_name || "").toLowerCase();
      const gtfsId = (agency.gtfs_agency_id || "").toLowerCase();
      return name.includes(term) || gtfsId.includes(term);
    })
    .slice(0, 10); // Limit to 10 results
};

// Render autocomplete dropdown
const renderAgencyDropdown = (list, agencies, onSelect) => {
  list.innerHTML = "";

  if (agencies.length === 0) {
    const li = document.createElement("li");
    li.className = "autocomplete-item autocomplete-empty";
    li.textContent = t("register.no_agencies");
    list.appendChild(li);
    return;
  }

  agencies.forEach((agency) => {
    const li = document.createElement("li");
    li.className = "autocomplete-item";
    // Use 'id' (UUID) for company_id, and agency_name for display
    li.dataset.agencyId = agency.id || ""; // UUID for registration
    li.dataset.agencyName = agency.agency_name || "";
    li.textContent = agency.agency_name || t("register.unknown_agency");
    li.addEventListener("click", () => onSelect(agency));
    list.appendChild(li);
  });
};

// Show feedback message
const showFeedback = (element, message, tone) => {
  if (!element) return;
  element.textContent = message;
  element.dataset.tone = tone;
  element.hidden = false;
};

// Hide feedback message
const hideFeedback = (element) => {
  if (!element) return;
  element.hidden = true;
};

// Set loading state
const setLoading = (form, isLoading) => {
  const submitBtn = form.querySelector('[type="submit"]');
  const spinner = submitBtn?.querySelector(".spinner");
  const inputs = form.querySelectorAll("input");

  if (submitBtn) {
    submitBtn.disabled = isLoading;
  }

  if (spinner) {
    spinner.hidden = !isLoading;
  }

  inputs.forEach((input) => {
    input.disabled = isLoading;
  });
};

// Handle registration form submission
const handleRegister = async (form, feedback) => {
  const formData = new FormData(form);
  const firstName = formData.get("first_name")?.toString().trim();
  const lastName = formData.get("last_name")?.toString().trim();
  const email = formData.get("email")?.toString().trim();
  const companyId = formData.get("agency_id")?.toString().trim(); // This is the UUID
  const password = formData.get("password")?.toString();
  const confirmPassword = formData.get("confirm_password")?.toString();

  // Validation
  if (!firstName || !lastName) {
    showFeedback(feedback, t("register.name_required"), "error");
    return;
  }

  if (!email || !password) {
    showFeedback(feedback, t("register.email_password_required"), "error");
    return;
  }

  if (!companyId) {
    showFeedback(feedback, t("register.company_required"), "error");
    return;
  }

  if (password !== confirmPassword) {
    showFeedback(feedback, t("register.passwords_mismatch"), "error");
    return;
  }

  if (!meetsPasswordMinimumLength(password)) {
    showFeedback(feedback, t("register.password_too_short"), "error");
    return;
  }

  hideFeedback(feedback);
  setLoading(form, true);

  // Combine first and last name into full_name as expected by the API
  const fullName = `${firstName} ${lastName}`;

  try {
    await registerUser({
      full_name: fullName,
      email,
      password,
      company_id: companyId,
    });

    showFeedback(
      feedback,
      t("register.success"),
      "success"
    );

    // Redirect to login page after short delay
    setTimeout(() => {
      triggerPartialLoad("login");
    }, 1500);
  } catch (error) {
    console.error("Registration failed:", error);
    showFeedback(
      feedback,
      error.message || t("register.error"),
      "error"
    );
  } finally {
    setLoading(form, false);
  }
};

// Toggle password visibility
const setupPasswordToggles = (form) => {
  const toggleBtns = form.querySelectorAll(".toggle-password");

  toggleBtns.forEach((toggleBtn) => {
    const targetId = toggleBtn.dataset.target;
    const passwordInput = form.querySelector(`#${targetId}`);

    if (!passwordInput) return;

    const eyeOpen = toggleBtn.querySelector(".eye-open");
    const eyeClosed = toggleBtn.querySelector(".eye-closed");

    toggleBtn.addEventListener("click", () => {
      const isPassword = passwordInput.type === "password";
      passwordInput.type = isPassword ? "text" : "password";

      if (eyeOpen) eyeOpen.hidden = !isPassword;
      if (eyeClosed) eyeClosed.hidden = isPassword;
    });
  });
};

// Setup agency autocomplete
const setupAgencyAutocomplete = async (container) => {
  const input = container.querySelector("#register-agency");
  const hiddenInput = container.querySelector("#register-agency-id");
  const dropdown = container.querySelector('[data-role="agency-dropdown"]');
  const list = container.querySelector('[data-role="agency-list"]');
  const preview = container.querySelector(
    '[data-role="agency-network-preview"]'
  );
  const networkMap = createNetworkPreviewMap(preview);

  if (!input || !dropdown || !list || !hiddenInput) {
    console.warn("Agency autocomplete elements not found");
    return;
  }

  // Avoid accepting text before the selectable agency list is ready.
  input.disabled = true;
  const agencies = await loadAgencies();
  input.disabled = false;

  let selectedIndex = -1;
  let selectedAgencyId = "";
  let previewController = null;

  const showDropdown = () => {
    dropdown.hidden = false;
  };

  const hideDropdown = () => {
    dropdown.hidden = true;
    selectedIndex = -1;
  };

  const loadNetworkPreview = async (agency) => {
    const agencyId = String(agency?.id ?? "");
    selectedAgencyId = agencyId;
    previewController?.abort();
    previewController = new AbortController();
    setNetworkPreviewState(preview, "loading");

    try {
      let payload = networkPreviewCache.get(agencyId);
      if (!payload) {
        payload = await fetchAgencyNetworkPreview(agencyId, {
          signal: previewController.signal,
        });
        networkPreviewCache.set(agencyId, payload);
      }
      if (selectedAgencyId !== agencyId) return;
      renderNetworkPreview(preview, payload, agency?.agency_name, networkMap);
    } catch (error) {
      if (error?.name === "AbortError" || selectedAgencyId !== agencyId) return;
      console.warn("Failed to load agency network preview", error);
      setNetworkPreviewState(preview, "error");
    }
  };

  const selectAgency = (agency) => {
    // Use agency_name for display, and id (UUID) for registration
    input.value = agency.agency_name || "";
    hiddenInput.value = agency.id || ""; // UUID for company_id
    input.dataset.agencyId = agency.id || "";
    hideDropdown();
    void loadNetworkPreview(agency);
  };

  const updateDropdown = (searchTerm) => {
    const filtered = filterAgencies(agencies, searchTerm);
    renderAgencyDropdown(list, filtered, selectAgency);
    showDropdown();
  };

  const highlightItem = (index) => {
    const items = list.querySelectorAll(".autocomplete-item:not(.autocomplete-empty)");
    items.forEach((item, i) => {
      item.classList.toggle("highlighted", i === index);
    });
  };

  // Input event - filter as user types
  input.addEventListener("input", () => {
    // Clear the hidden input when user types (they need to select from list)
    hiddenInput.value = "";
    input.dataset.agencyId = "";
    selectedAgencyId = "";
    previewController?.abort();
    clearNetworkPreview(preview, networkMap);
    updateDropdown(input.value);
  });

  // Focus event - show dropdown
  input.addEventListener("focus", () => {
    updateDropdown(input.value);
  });

  // Blur event - hide dropdown (with delay to allow click)
  input.addEventListener("blur", () => {
    setTimeout(() => {
      hideDropdown();
      // If no agency selected, clear the input
      if (!hiddenInput.value) {
        input.value = "";
      }
    }, 200);
  });

  // Keyboard navigation
  input.addEventListener("keydown", (event) => {
    const items = list.querySelectorAll(".autocomplete-item:not(.autocomplete-empty)");

    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
      highlightItem(selectedIndex);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      highlightItem(selectedIndex);
    } else if (event.key === "Enter" && selectedIndex >= 0) {
      event.preventDefault();
      const selectedItem = items[selectedIndex];
      if (selectedItem) {
        const agency = {
          id: selectedItem.dataset.agencyId, // UUID
          agency_name: selectedItem.dataset.agencyName,
        };
        selectAgency(agency);
      }
    } else if (event.key === "Escape") {
      hideDropdown();
    }
  });

  const handleLanguageChange = () => {
    if (preview?.dataset.state === "ready" && preview._networkPreviewPayload) {
      renderNetworkPreview(
        preview,
        preview._networkPreviewPayload,
        preview._networkPreviewAgencyName,
        networkMap
      );
    }
  };
  document.addEventListener(I18N_CHANGE_EVENT, handleLanguageChange);

  return () => {
    selectedAgencyId = "";
    previewController?.abort();
    networkMap.destroy();
    document.removeEventListener(I18N_CHANGE_EVENT, handleLanguageChange);
  };
};

// Initialize registration page
export const initializeRegister = (container, options = {}) => {
  const form = container.querySelector('[data-form="register"]');
  const feedback = container.querySelector('[data-role="register-feedback"]');
  const backBtn = container.querySelector('[data-action="back-to-landing"]');
  const loginLink = container.querySelector('[data-action="go-to-login"]');

  if (!form) {
    console.warn("Register form not found");
    return;
  }

  // Setup password visibility toggles
  setupPasswordToggles(form);

  // Setup agency autocomplete
  const agencyAutocompleteCleanup = setupAgencyAutocomplete(container);

  // Handle form submission
  const handleSubmit = async (event) => {
    event.preventDefault();
    await handleRegister(form, feedback);
  };

  // Navigate back to landing
  const handleBack = (event) => {
    event.preventDefault();
    triggerPartialLoad("landing");
  };

  // Navigate to login
  const handleLoginClick = (event) => {
    event.preventDefault();
    triggerPartialLoad("login");
  };

  form.addEventListener("submit", handleSubmit);

  if (backBtn) {
    backBtn.addEventListener("click", handleBack);
  }

  if (loginLink) {
    loginLink.addEventListener("click", handleLoginClick);
  }

  // Focus first name input on load
  const firstNameInput = form.querySelector("#register-first-name");
  firstNameInput?.focus();

  // Cleanup function
  return () => {
    void agencyAutocompleteCleanup.then((cleanup) => cleanup?.());
    form.removeEventListener("submit", handleSubmit);
    if (backBtn) {
      backBtn.removeEventListener("click", handleBack);
    }
    if (loginLink) {
      loginLink.removeEventListener("click", handleLoginClick);
    }
  };
};
