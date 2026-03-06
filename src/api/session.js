import { fetchCurrentUser, changePassword, fetchAgencyById } from "./user";
import { getCurrentUserId, setCurrentUserId, getCurrentAgencyId, setCurrentAgencyId, clearDataCache } from "../store";
import { triggerPartialLoad } from "../events";
import { readAccessToken } from "./client";

let sessionElementsRef = null;
let unauthorizedRedirectPending = false;

const getUserInfo = () => ({
  email: localStorage.getItem("user_email") || "",
  name: localStorage.getItem("user_name") || "",
  company: localStorage.getItem("user_company") || "",
  agencyId: localStorage.getItem("user_agency_id") || "",
  gtfsAgencyId: localStorage.getItem("user_gtfs_agency_id") || "",
  agencyName: localStorage.getItem("user_agency_name") || "",
});

const persistUserInfo = ({
  email = "",
  name = "",
  company = "",
  agencyId = "",
  gtfsAgencyId = "",
  agencyName = "",
} = {}) => {
  if (email) localStorage.setItem("user_email", email);
  if (name) localStorage.setItem("user_name", name);
  if (company) localStorage.setItem("user_company", company);
  if (agencyId) localStorage.setItem("user_agency_id", agencyId);
  if (gtfsAgencyId) localStorage.setItem("user_gtfs_agency_id", gtfsAgencyId);
  if (agencyName) localStorage.setItem("user_agency_name", agencyName);
};

const clearUserData = () => {
  localStorage.removeItem("access_token");
  localStorage.removeItem("token_type");
  localStorage.removeItem("cache.currentUser.id");
  localStorage.removeItem("cache.currentUser.agencyId");
  localStorage.removeItem("user_email");
  localStorage.removeItem("user_name");
  localStorage.removeItem("user_company");
  localStorage.removeItem("user_agency_id");
  localStorage.removeItem("user_gtfs_agency_id");
  localStorage.removeItem("user_agency_name");
  localStorage.removeItem("remember_email");
};

const isUnauthorizedError = (error) =>
  error?.status === 401 ||
  error?.status === 403 ||
  error?.message === "Could not validate credentials";

export const isAuthenticated = () => {
  const token = readAccessToken();
  return Boolean(token && token.length > 0);
};

export const clearSessionState = () => {
  clearDataCache();
  setCurrentUserId("");
  setCurrentAgencyId("");
  clearUserData();
};

export const markSessionActive = () => {
  unauthorizedRedirectPending = false;
};

export const resolveUserId = async () => {
  const cached = getCurrentUserId();
  if (cached) {
    return cached;
  }

  const user = await fetchCurrentUser();
  const id = user?.id ?? "";

  if (!id) {
    throw new Error("Unable to resolve current user.");
  }

  setCurrentUserId(id);
  return id;
};

export const resolveAgencyId = async () => {
  const cached = getCurrentAgencyId();
  if (cached) {
    return cached;
  }

  const user = await fetchCurrentUser();
  const agencyId = user?.company_id ?? user?.agency_id ?? "";

  if (!agencyId) {
    // User may not have an agency assigned - this is not an error
    return "";
  }

  setCurrentAgencyId(agencyId);
  return agencyId;
};

// UI State Management
const updateUIState = (elements, loggedIn, userInfo = {}) => {
  const { loginButton, userMenu, userNameSpan, userCompanySpan, userSeparator, userEmailSpan, dropdownEmailSpan } = elements;

  if (loginButton) {
    loginButton.hidden = loggedIn;
  }

  if (userMenu) {
    userMenu.hidden = !loggedIn;
  }

  if (userNameSpan) {
    userNameSpan.textContent = userInfo.name || userInfo.email || "";
  }

  // Show separator only if both name and company exist
  const hasCompany = Boolean(userInfo.company);
  
  if (userSeparator) {
    userSeparator.hidden = !hasCompany;
  }

  if (userCompanySpan) {
    userCompanySpan.textContent = userInfo.company || "";
    userCompanySpan.hidden = !hasCompany;
  }

  if (userEmailSpan) {
    userEmailSpan.textContent = userInfo.email || "";
  }

  if (dropdownEmailSpan) {
    dropdownEmailSpan.textContent = userInfo.email || "";
  }
};

// Fetch and update user info from API
const loadUserInfo = async (elements, email) => {
  try {
    const user = await fetchCurrentUser();
    
    // Extract basic user info
    let userInfo = {
      email: user?.email || email,
      name: user?.full_name || user?.name || user?.username || email?.split("@")[0] || "",
      company: "",
      agencyId: "",
      gtfsAgencyId: "",
      agencyName: "",
    };

    // If user has a company_id, fetch the company details
    const companyId = user?.company_id || user?.agency_id;
    if (companyId) {
      // Store the agency ID for filtering routes
      setCurrentAgencyId(companyId);
      userInfo.agencyId = String(companyId);
      
      try {
        const agency = await fetchAgencyById(companyId);
        if (agency) {
          const agencyName = agency?.agency_name || agency?.name || "";
          userInfo.company = agency?.name || agencyName || "";
          userInfo.agencyName = agencyName || userInfo.company || "";
          userInfo.gtfsAgencyId = String(agency?.gtfs_agency_id || "").trim();
          userInfo.agencyId = String(agency?.id || companyId || "").trim();
        }
      } catch (agencyError) {
        console.warn("Could not fetch agency details:", agencyError);
      }
    }

    persistUserInfo(userInfo);
    updateUIState(elements, true, userInfo);
    unauthorizedRedirectPending = false;
    
    if (user?.id) {
      setCurrentUserId(user.id);
    }

    return true;
  } catch (error) {
    console.warn("Could not fetch user details:", error);

    if (isUnauthorizedError(error)) {
      handleUnauthorizedSession();
      return false;
    }

    const userInfo = { email, name: email?.split("@")[0] || "", company: "" };
    persistUserInfo(userInfo);
    updateUIState(elements, true, userInfo);
    return true;
  }
};

// Navigate to Login Page
const navigateToLogin = () => {
  triggerPartialLoad("login");
};

export const handleUnauthorizedSession = () => {
  if (unauthorizedRedirectPending) {
    return;
  }

  unauthorizedRedirectPending = true;
  clearSessionState();

  if (sessionElementsRef) {
    updateUIState(sessionElementsRef, false, {});
  }

  const nav = document.querySelector("nav");
  if (nav) {
    nav.hidden = true;
  }

  triggerPartialLoad("login");
};

// Logout Handler
const handleLogout = (elements) => {
  clearSessionState();
  unauthorizedRedirectPending = false;
  updateUIState(elements, false, {});
  console.log("Logged out successfully.");
  
  // Close user menu if open
  const dropdown = elements.userMenu?.querySelector(".user-menu-dropdown");
  const toggle = elements.userMenu?.querySelector(".user-menu-toggle");
  if (dropdown) {
    dropdown.hidden = true;
  }
  if (toggle) {
    toggle.setAttribute("aria-expanded", "false");
  }
  
  // Redirect to login page
  triggerPartialLoad("login");
};

// Password Change Handler
const handlePasswordChange = async (modal, feedback) => {
  const form = modal.querySelector("form");
  const currentPassword = form.querySelector("#current-password").value;
  const newPassword = form.querySelector("#new-password").value;
  const confirmPassword = form.querySelector("#confirm-password").value;

  // Validate passwords match
  if (newPassword !== confirmPassword) {
    showFeedback(feedback, "New passwords do not match.", "error");
    return false;
  }

  // Validate password length
  if (newPassword.length < 8) {
    showFeedback(feedback, "Password must be at least 8 characters.", "error");
    return false;
  }

  try {
    showFeedback(feedback, "Updating password...", "info");
    await changePassword(currentPassword, newPassword);
    showFeedback(feedback, "Password updated successfully!", "success");
    
    // Close modal after short delay
    setTimeout(() => {
      modal.close();
      form.reset();
      feedback.hidden = true;
    }, 1500);
    
    return true;
  } catch (error) {
    console.error("Password change failed", error);
    showFeedback(feedback, error.message || "Failed to change password.", "error");
    return false;
  }
};

// Feedback Helper
const showFeedback = (element, message, tone) => {
  if (!element) return;
  element.textContent = message;
  element.dataset.tone = tone;
  element.hidden = false;
};

// Initialize User Menu
const initializeUserMenu = (elements) => {
  const { userMenu } = elements;
  if (!userMenu) return;

  const toggle = userMenu.querySelector(".user-menu-toggle");
  const dropdown = userMenu.querySelector(".user-menu-dropdown");

  if (!toggle || !dropdown) return;

  // Toggle dropdown on click
  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const isExpanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", !isExpanded);
    dropdown.hidden = isExpanded;
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!userMenu.contains(e.target)) {
      toggle.setAttribute("aria-expanded", "false");
      dropdown.hidden = true;
    }
  });

  // Handle dropdown actions
  dropdown.addEventListener("click", (e) => {
    const button = e.target.closest("button[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    
    if (action === "logout") {
      handleLogout(elements);
    } else if (action === "change-password") {
      const modal = document.querySelector('[data-modal="change-password"]');
      if (modal) {
        modal.showModal();
      }
      dropdown.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    }
  });
};

// Initialize Password Modal
const initializePasswordModal = () => {
  const modal = document.querySelector('[data-modal="change-password"]');
  if (!modal) return;

  const form = modal.querySelector("form");
  const feedback = modal.querySelector('[data-role="password-feedback"]');
  const cancelBtn = modal.querySelector('[data-action="cancel-password"]');

  // Handle form submit
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    await handlePasswordChange(modal, feedback);
  });

  // Handle cancel
  cancelBtn?.addEventListener("click", () => {
    modal.close();
    form.reset();
    if (feedback) {
      feedback.hidden = true;
    }
  });

  // Reset form when modal closes
  modal.addEventListener("close", () => {
    form.reset();
    if (feedback) {
      feedback.hidden = true;
    }
  });

  // Close on backdrop click
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.close();
    }
  });
};

// Main Initialization - renamed to avoid conflict with login page
export const initializeSession = async (loginButton) => {
  const userSection = document.querySelector(".user-section");
  const userMenu = userSection?.querySelector(".user-menu");
  const userNameSpan = userMenu?.querySelector('[data-role="user-name"]');
  const userSeparator = userMenu?.querySelector('.user-separator');
  const userCompanySpan = userMenu?.querySelector('[data-role="user-company"]');
  const userEmailSpan = userMenu?.querySelector('[data-role="user-email"]');
  const dropdownEmailSpan = userMenu?.querySelector('.dropdown-email');

  const elements = {
    loginButton,
    userMenu,
    userNameSpan,
    userSeparator,
    userCompanySpan,
    userEmailSpan,
    dropdownEmailSpan,
  };
  sessionElementsRef = elements;

  // Set initial UI state
  const authenticated = isAuthenticated();
  const userInfo = getUserInfo();
  updateUIState(elements, authenticated, userInfo);

  // Login button click handler - navigate to login page
  loginButton?.addEventListener("click", () => {
    navigateToLogin();
  });

  // Initialize user menu
  initializeUserMenu(elements);

  // Initialize password modal
  initializePasswordModal();

  // Validate the persisted session before allowing access to protected pages.
  if (authenticated) {
    const sessionIsValid = await loadUserInfo(elements, userInfo.email);
    if (!sessionIsValid) {
      return false;
    }
  }

  return authenticated;
};
