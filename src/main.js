import "./style.css";
import { installAuthRedirectHandler } from "./api/client";
import { initializeSession, handleUnauthorizedSession } from "./api/session";
import { initializeNavigation } from "./navigation";
import { initializeI18n } from "./i18n";

const LEGACY_ACTIVE_YEARLY_ANALYSIS_KEY = "cache.activeYearlyAnalysis";
const loginButton = document.querySelector(".login");
const root = document;

try {
  localStorage.removeItem(LEGACY_ACTIVE_YEARLY_ANALYSIS_KEY);
} catch {
  // non-fatal
}

installAuthRedirectHandler(handleUnauthorizedSession);
await initializeSession(loginButton);
initializeNavigation(root);
initializeI18n();
