import { API_ROOT } from "./config";
import { t, I18N_CHANGE_EVENT } from "./i18n";

// This version identifies the bundle actually loaded by this browser, even if
// a newer bundle has since been deployed on the server.
export const FRONTEND_VERSION = __APP_VERSION__;

let backendVersion = null;
let finished = false;
let lookupPromise = null;
const renderers = new Set();

const renderAll = () => renderers.forEach((render) => render());

export function loadDeploymentVersions() {
  if (lookupPromise) return lookupPromise;

  lookupPromise = fetch(`${API_ROOT}/api/v1/version`, {
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  })
    .then(async (response) => {
      if (!response.ok) throw new Error("Version unavailable");
      const metadata = await response.json();
      if (typeof metadata.version === "string" && metadata.version.trim()) {
        backendVersion = metadata.version.trim().replace(/^v/, "");
      }
    })
    .catch(() => {})
    .finally(() => {
      finished = true;
      renderAll();
    });

  return lookupPromise;
}

export function initializeDeploymentVersions(root = document) {
  const container = root.querySelector('[data-role="deployment-versions"]');
  const frontendElement = container?.querySelector('[data-role="frontend-version"]');
  const backendElement = container?.querySelector('[data-role="backend-version"]');
  if (!container || !frontendElement || !backendElement) return null;

  const render = () => {
    frontendElement.textContent = `v${FRONTEND_VERSION}`;
    backendElement.textContent = backendVersion
      ? `v${backendVersion}`
      : (finished ? t("about.version_unavailable") : "…");
  };

  render();
  renderers.add(render);
  document.addEventListener(I18N_CHANGE_EVENT, render);
  loadDeploymentVersions();

  return () => {
    renderers.delete(render);
    document.removeEventListener(I18N_CHANGE_EVENT, render);
  };
}
