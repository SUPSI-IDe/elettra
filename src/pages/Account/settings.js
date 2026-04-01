import "./settings.css";
import {
  changePassword,
  fetchAgencyById,
  fetchCurrentUser,
  updateCurrentUser,
} from "../../api/user";
import {
  handleUnauthorizedSession,
  refreshSessionUserInfo,
} from "../../api/session";
import { t } from "../../i18n";
import { toggleFormDisabled, updateFeedback } from "../../ui-helpers";

const isUnauthorizedError = (error) =>
  error?.status === 401 ||
  error?.status === 403 ||
  error?.message === "Could not validate credentials";

const resolveDisplayName = (user) =>
  user?.full_name ||
  user?.name ||
  user?.username ||
  "";

const resolveAgencyName = async (user) => {
  const cachedAgencyName =
    localStorage.getItem("user_company") ||
    localStorage.getItem("user_agency_name") ||
    "";

  if (cachedAgencyName) {
    return cachedAgencyName;
  }

  const companyId = user?.company_id || user?.agency_id;
  if (!companyId) {
    return "";
  }

  try {
    const agency = await fetchAgencyById(companyId);
    return agency?.agency_name || agency?.name || "";
  } catch {
    return "";
  }
};

const fillForms = async (section, user) => {
  const profileForm = section.querySelector('[data-form="profile-settings"]');
  const agencyInput = profileForm?.querySelector("#settings-agency");

  if (profileForm) {
    const nameInput = profileForm.querySelector("#settings-name");
    const emailInput = profileForm.querySelector("#settings-email");

    if (nameInput) {
      nameInput.value = resolveDisplayName(user);
    }

    if (emailInput) {
      emailInput.value = user?.email || "";
    }
  }

  if (agencyInput) {
    agencyInput.value = await resolveAgencyName(user);
  }
};

export const initializeSettings = async (root = document) => {
  const section = root.querySelector("section.settings-page");
  if (!section) {
    return null;
  }

  const profileForm = section.querySelector('[data-form="profile-settings"]');
  const passwordForm = section.querySelector('[data-form="password-settings"]');
  const profileFeedback = section.querySelector('[data-role="profile-feedback"]');
  const passwordFeedback = section.querySelector('[data-role="password-feedback"]');

  if (!profileForm || !passwordForm) {
    return null;
  }

  let currentUser = null;

  try {
    currentUser = await fetchCurrentUser();
    await fillForms(section, currentUser);
  } catch (error) {
    if (isUnauthorizedError(error)) {
      handleUnauthorizedSession();
      return null;
    }

    updateFeedback(
      profileFeedback,
      error?.message || t("settings.load_error"),
      "error"
    );
  }

  const handleProfileSubmit = async (event) => {
    event.preventDefault();

    const formData = new FormData(profileForm);
    const fullName = formData.get("full_name")?.toString().trim() || "";
    const email = formData.get("email")?.toString().trim() || "";

    if (!fullName) {
      updateFeedback(profileFeedback, t("settings.name_required"), "error");
      return;
    }

    if (!email) {
      updateFeedback(profileFeedback, t("settings.email_required"), "error");
      return;
    }

    updateFeedback(profileFeedback, t("settings.profile_saving"), "info");
    toggleFormDisabled(profileForm, true);

    try {
      await updateCurrentUser({
        full_name: fullName,
        email,
      });
      currentUser = await refreshSessionUserInfo();
      await fillForms(section, currentUser);
      updateFeedback(profileFeedback, t("settings.profile_success"), "success");
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleUnauthorizedSession();
        return;
      }

      updateFeedback(
        profileFeedback,
        error?.message || t("settings.profile_error"),
        "error"
      );
    } finally {
      toggleFormDisabled(profileForm, false);
    }
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();

    const formData = new FormData(passwordForm);
    const currentPassword =
      formData.get("current_password")?.toString() || "";
    const newPassword =
      formData.get("new_password")?.toString() || "";
    const confirmPassword =
      formData.get("confirm_password")?.toString() || "";

    if (newPassword !== confirmPassword) {
      updateFeedback(passwordFeedback, t("password.mismatch"), "error");
      return;
    }

    if (newPassword.length < 8) {
      updateFeedback(passwordFeedback, t("password.too_short"), "error");
      return;
    }

    updateFeedback(passwordFeedback, t("settings.password_saving"), "info");
    toggleFormDisabled(passwordForm, true);

    try {
      await changePassword(currentPassword, newPassword);
      passwordForm.reset();
      updateFeedback(passwordFeedback, t("password.success"), "success");
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleUnauthorizedSession();
        return;
      }

      updateFeedback(
        passwordFeedback,
        error?.message || t("settings.password_error"),
        "error"
      );
    } finally {
      toggleFormDisabled(passwordForm, false);
    }
  };

  profileForm.addEventListener("submit", handleProfileSubmit);
  passwordForm.addEventListener("submit", handlePasswordSubmit);

  return () => {
    profileForm.removeEventListener("submit", handleProfileSubmit);
    passwordForm.removeEventListener("submit", handlePasswordSubmit);
  };
};
