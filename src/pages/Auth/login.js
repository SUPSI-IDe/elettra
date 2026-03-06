import { authenticate } from "../../api/auth";
import { triggerPartialLoad } from "../../events";
import { setCurrentUserId, setCurrentAgencyId, clearDataCache } from "../../store";
import { fetchCurrentUser, fetchAgencyById } from "../../api/user";
import { markSessionActive } from "../../api/session";

// Token persistence
const persistTokens = ({ access_token = "", token_type = "" } = {}) => {
  if (access_token) {
    localStorage.setItem("access_token", access_token);
  }
  if (token_type) {
    localStorage.setItem("token_type", token_type);
  }
  return { access_token, token_type };
};

// User info persistence
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
  const spinner = submitBtn?.querySelector('.spinner');
  const inputs = form.querySelectorAll('input');
  
  if (submitBtn) {
    submitBtn.disabled = isLoading;
  }
  
  if (spinner) {
    spinner.hidden = !isLoading;
  }
  
  inputs.forEach(input => {
    input.disabled = isLoading;
  });
};

// Fetch user details after login
const loadUserDetails = async (email) => {
  try {
    const user = await fetchCurrentUser();
    
    let userInfo = {
      email: user?.email || email,
      name: user?.full_name || user?.name || user?.username || email?.split("@")[0] || "",
      company: "",
      agencyId: "",
      gtfsAgencyId: "",
      agencyName: "",
    };

    // Store user ID
    if (user?.id) {
      setCurrentUserId(user.id);
    }

    // Fetch company details if available
    const companyId = user?.company_id || user?.agency_id;
    if (companyId) {
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
    return userInfo;
  } catch (error) {
    console.warn("Could not fetch user details:", error);
    const userInfo = { email, name: email?.split("@")[0] || "", company: "" };
    persistUserInfo(userInfo);
    return userInfo;
  }
};

// Handle login form submission
const handleLogin = async (form, feedback) => {
  const formData = new FormData(form);
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();
  const remember = formData.get("remember") === "on";

  if (!email || !password) {
    showFeedback(feedback, "Please enter your email and password.", "error");
    return;
  }

  hideFeedback(feedback);
  setLoading(form, true);

  try {
    // Authenticate with the API
    const tokens = await authenticate(email, password);
    persistTokens(tokens);
    
    // Store remember preference
    if (remember) {
      localStorage.setItem("remember_email", email);
    } else {
      localStorage.removeItem("remember_email");
    }

    // Clear any cached data from previous user to prevent data leakage
    clearDataCache();

    showFeedback(feedback, "Login successful! Redirecting...", "success");

    // Load user details
    await loadUserDetails(email);
    markSessionActive();

    // Redirect to main page after short delay
    setTimeout(() => {
      // Update header UI
      updateHeaderUI();
      
      // Navigate to buses page
      triggerPartialLoad("buses");
    }, 500);

  } catch (error) {
    console.error("Login failed:", error);
    showFeedback(feedback, error.message || "Login failed. Please check your credentials.", "error");
  } finally {
    setLoading(form, false);
  }
};

// Update header UI after login
const updateHeaderUI = () => {
  const loginButton = document.querySelector('[data-action="login"]');
  const userMenu = document.querySelector('.user-menu');
  const userNameSpan = userMenu?.querySelector('[data-role="user-name"]');
  const userCompanySpan = userMenu?.querySelector('[data-role="user-company"]');
  const userSeparator = userMenu?.querySelector('.user-separator');
  const dropdownEmailSpan = userMenu?.querySelector('.dropdown-email');
  const nav = document.querySelector('nav');

  const userInfo = {
    email: localStorage.getItem("user_email") || "",
    name: localStorage.getItem("user_name") || "",
    company: localStorage.getItem("user_company") || "",
  };

  if (loginButton) {
    loginButton.hidden = true;
  }

  if (userMenu) {
    userMenu.hidden = false;
  }

  // Show nav after login
  if (nav) {
    nav.hidden = false;
  }

  if (userNameSpan) {
    userNameSpan.textContent = userInfo.name || userInfo.email || "";
  }

  const hasCompany = Boolean(userInfo.company);
  
  if (userSeparator) {
    userSeparator.hidden = !hasCompany;
  }

  if (userCompanySpan) {
    userCompanySpan.textContent = userInfo.company || "";
    userCompanySpan.hidden = !hasCompany;
  }

  if (dropdownEmailSpan) {
    dropdownEmailSpan.textContent = userInfo.email || "";
  }
};

// Toggle password visibility
const setupPasswordToggle = (form) => {
  const toggleBtn = form.querySelector('.toggle-password');
  const passwordInput = form.querySelector('#login-password');
  
  if (!toggleBtn || !passwordInput) return;

  const eyeOpen = toggleBtn.querySelector('.eye-open');
  const eyeClosed = toggleBtn.querySelector('.eye-closed');

  toggleBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    
    if (eyeOpen) eyeOpen.hidden = !isPassword;
    if (eyeClosed) eyeClosed.hidden = isPassword;
  });
};

// Pre-fill remembered email
const prefillRememberedEmail = (form) => {
  const rememberedEmail = localStorage.getItem("remember_email");
  if (rememberedEmail) {
    const emailInput = form.querySelector('#login-email');
    const rememberCheckbox = form.querySelector('[name="remember"]');
    
    if (emailInput) {
      emailInput.value = rememberedEmail;
    }
    if (rememberCheckbox) {
      rememberCheckbox.checked = true;
    }
  }
};

// Initialize login page
export const initializeLogin = (container, options = {}) => {
  const form = container.querySelector('[data-form="login"]');
  const feedback = container.querySelector('[data-role="login-feedback"]');
  const backBtn = container.querySelector('[data-action="back-to-landing"]');
  const registerLink = container.querySelector('[data-action="go-to-register"]');

  if (!form) {
    console.warn("Login form not found");
    return;
  }

  // Setup password visibility toggle
  setupPasswordToggle(form);
  
  // Pre-fill remembered email
  prefillRememberedEmail(form);

  // Handle form submission
  const handleSubmit = async (event) => {
    event.preventDefault();
    await handleLogin(form, feedback);
  };

  // Navigate back to landing
  const handleBack = (event) => {
    event.preventDefault();
    triggerPartialLoad("landing");
  };

  // Navigate to register
  const handleRegisterClick = (event) => {
    event.preventDefault();
    triggerPartialLoad("register");
  };

  form.addEventListener("submit", handleSubmit);

  if (backBtn) {
    backBtn.addEventListener("click", handleBack);
  }

  if (registerLink) {
    registerLink.addEventListener("click", handleRegisterClick);
  }

  // Focus email input on load
  const emailInput = form.querySelector('#login-email');
  if (emailInput && !emailInput.value) {
    emailInput.focus();
  } else {
    // If email is pre-filled, focus password
    const passwordInput = form.querySelector('#login-password');
    passwordInput?.focus();
  }

  // Cleanup function
  return () => {
    form.removeEventListener("submit", handleSubmit);
    if (backBtn) {
      backBtn.removeEventListener("click", handleBack);
    }
    if (registerLink) {
      registerLink.removeEventListener("click", handleRegisterClick);
    }
  };
};
