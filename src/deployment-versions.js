import { API_ROOT } from "./config";
import { t, I18N_CHANGE_EVENT } from "./i18n";

// This version identifies the bundle actually loaded by this browser, even if
// a newer bundle has since been deployed on the server.
export const FRONTEND_VERSION = __APP_VERSION__;

export function initializeDeploymentVersions(root = document) {
  const element = root.querySelector('[data-role="deployment-versions"]');
  if (!element) return;
  let backendVersion = null;
  let finished = false;
  const render = () => {
    const backend = backendVersion || (finished ? t("footer.version_unavailable") : "…");
    element.textContent = `Frontend v${FRONTEND_VERSION} · Backend ${backendVersion ? "v" : ""}${backend}`;
    element.title = t("footer.version_help");
  };
  render();
  document.addEventListener(I18N_CHANGE_EVENT, render);
  // A failed version lookup must neither hide the app nor invent a version.
  void fetch(`${API_ROOT}/api/v1/version`, { cache: "no-store", signal: AbortSignal.timeout(5000) })
    .then(async (response) => {
      if (!response.ok) throw new Error("Version unavailable");
      const metadata = await response.json();
      if (typeof metadata.version === "string" && metadata.version.trim()) {
        backendVersion = metadata.version.replace(/^v/, "");
      }
    })
    .catch(() => {})
    .finally(() => { finished = true; render(); });
}
