import "./style.css";
import { installAuthRedirectHandler } from "./api/client";
import { initializeSession, handleUnauthorizedSession } from "./api/session";
import { initializeNavigation } from "./navigation";
import { initializeI18n } from "./i18n";
import { loadDeploymentVersions } from "./deployment-versions";
import { initializeUsageNotice } from "./usage-notice";

const LEGACY_ACTIVE_YEARLY_ANALYSIS_KEY = "cache.activeYearlyAnalysis";
const loginButton = document.querySelector(".login");
const root = document;

try {
  localStorage.removeItem(LEGACY_ACTIVE_YEARLY_ANALYSIS_KEY);
} catch {
  // non-fatal
}

installAuthRedirectHandler(handleUnauthorizedSession);
loadDeploymentVersions();
const sessionIsAuthenticated = await initializeSession(loginButton);
initializeNavigation(root);
initializeI18n();
initializeUsageNotice(root, { showOnInitialize: sessionIsAuthenticated });
