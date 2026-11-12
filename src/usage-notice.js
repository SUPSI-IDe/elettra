import "./usage-notice.css";
import { SESSION_AUTHENTICATED_EVENT } from "./events";

export const USAGE_NOTICE_DISMISSED_KEY = "elettra.usageNotice.dismissed.v1";

const isDismissed = () => {
  try {
    return localStorage.getItem(USAGE_NOTICE_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
};

const rememberDismissal = () => {
  try {
    localStorage.setItem(USAGE_NOTICE_DISMISSED_KEY, "true");
  } catch {
    // Storage can be unavailable; showing the notice again is a safe fallback.
  }
};

export const initializeUsageNotice = (
  root = document,
  { showOnInitialize = false } = {},
) => {
  const dialog = root.querySelector('[data-role="usage-notice"]');
  const dismissCheckbox = dialog?.querySelector('[data-role="usage-notice-dismiss"]');
  const confirmButton = dialog?.querySelector('[data-action="confirm-usage-notice"]');

  if (!dialog || !dismissCheckbox || !confirmButton) {
    return null;
  }

  const show = () => {
    if (isDismissed() || dialog.open) return;
    dismissCheckbox.checked = false;
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  };

  const rememberPreference = () => {
    if (dismissCheckbox.checked) rememberDismissal();
  };

  const close = () => {
    rememberPreference();
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  };

  confirmButton.addEventListener("click", close);
  dialog.addEventListener("close", rememberPreference);
  document.addEventListener(SESSION_AUTHENTICATED_EVENT, show);

  if (showOnInitialize) show();

  return () => {
    confirmButton.removeEventListener("click", close);
    dialog.removeEventListener("close", rememberPreference);
    document.removeEventListener(SESSION_AUTHENTICATED_EVENT, show);
    if (dialog.open) dialog.close();
  };
};
