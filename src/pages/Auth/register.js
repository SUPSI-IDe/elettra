import { registerUser } from "../../api/auth";
import { fetchAgencies } from "../../api/gtfs";
import { triggerPartialLoad } from "../../events";

// Cache for agencies
let agenciesCache = null;

// Load agencies from API
const loadAgencies = async () => {
  if (agenciesCache) {
    return agenciesCache;
  }

  try {
    const data = await fetchAgencies();
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
    li.textContent = "No agencies found";
    list.appendChild(li);
    return;
  }

  agencies.forEach((agency) => {
    const li = document.createElement("li");
    li.className = "autocomplete-item";
    // Use 'id' (UUID) for company_id, and agency_name for display
    li.dataset.agencyId = agency.id || ""; // UUID for registration
    li.dataset.agencyName = agency.agency_name || "";
    li.textContent = agency.agency_name || "Unknown Agency";
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
    showFeedback(feedback, "Please enter your first and last name.", "error");
    return;
  }

  if (!email || !password) {
    showFeedback(feedback, "Please enter your email and password.", "error");
    return;
  }

  if (!companyId) {
    showFeedback(feedback, "Please select a company/agency from the list.", "error");
    return;
  }

  if (password !== confirmPassword) {
    showFeedback(feedback, "Passwords do not match.", "error");
    return;
  }

  if (password.length < 8) {
    showFeedback(feedback, "Password must be at least 8 characters.", "error");
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
      "Account created successfully! Redirecting to login...",
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
      error.message || "Registration failed. Please try again.",
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

  if (!input || !dropdown || !list || !hiddenInput) {
    console.warn("Agency autocomplete elements not found");
    return;
  }

  // Load agencies
  const agencies = await loadAgencies();

  let selectedIndex = -1;

  const showDropdown = () => {
    dropdown.hidden = false;
  };

  const hideDropdown = () => {
    dropdown.hidden = true;
    selectedIndex = -1;
  };

  const selectAgency = (agency) => {
    // Use agency_name for display, and id (UUID) for registration
    input.value = agency.agency_name || "";
    hiddenInput.value = agency.id || ""; // UUID for company_id
    input.dataset.agencyId = agency.id || "";
    hideDropdown();
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
  setupAgencyAutocomplete(container);

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
    form.removeEventListener("submit", handleSubmit);
    if (backBtn) {
      backBtn.removeEventListener("click", handleBack);
    }
    if (loginLink) {
      loginLink.removeEventListener("click", handleLoginClick);
    }
  };
};
