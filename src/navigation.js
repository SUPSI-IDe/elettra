import { initializeAddBusModel } from "./pages/Fleet/Buses/add-bus-model";
import { initializeShiftForm } from "./pages/Fleet/Shifts/shift-form";
import { initializeAddCustomStop } from "./pages/Fleet/Custom Stops/add-custom-stop";
import { initializeBuses } from "./pages/Fleet/Buses/buses";
import { initializeCustomStops } from "./pages/Fleet/Custom Stops/custom-stops";
import { initializeShifts } from "./pages/Fleet/Shifts/shifts";
import { initializeVisualizeShift } from "./pages/Fleet/Shifts/visualize-shift";
import { initializeSimulationRuns } from "./pages/Simulation/Runs/simulation-runs";
import { initializeAddSimulation } from "./pages/Simulation/Runs/add-simulation";
import { initializeSimulationDetail } from "./pages/Simulation/Runs/simulation-detail";
import { initializeSimulationResults } from "./pages/Simulation/Runs/simulation-results";
import { initializeSimulationComparison } from "./pages/Simulation/Runs/simulation-comparison";
import { initializeLogin } from "./pages/Auth/login";
import { initializeLanding } from "./pages/Auth/landing";
import { initializeRegister } from "./pages/Auth/register";
import { applyTranslations, getCurrentLang } from "./i18n";
import { isAuthenticated } from "./api/session";

const partials = import.meta.glob("./pages/**/*.html", {
  query: "?raw",
  import: "default",
});

const slugFrom = (node) => node?.dataset.partial?.trim() || "";

const getLoader = (slug) => {
  const key = Object.keys(partials).find((k) => k.endsWith(`/${slug}.html`));
  return partials[key];
};

const renderInto =
  (container) =>
  (html = "") => {
    container.innerHTML = html;
  };

const createPartialLoader = (render, onBeforeLoad) => {
  let state = { current: "", pending: "" };

  const transition = (next) => {
    state = { ...state, ...next };
    return state;
  };

  return async (slug) => {
    if (!slug || slug === state.current || slug === state.pending) {
      return state;
    }

    // Call cleanup before loading new partial
    onBeforeLoad?.();

    transition({ pending: slug });
    const loader = getLoader(slug);

    if (!loader) {
      transition({ pending: "", current: "" });
      render("");
      console.warn(`Missing partial for slug "${slug}".`);
      return state;
    }

    const html = await loader();

    if (state.pending !== slug) {
      return state;
    }

    transition({ current: slug, pending: "" });
    render(html);
    applyTranslations(getCurrentLang());

    return state;
  };
};

export const initializeNavigation = (root = document) => {
  const container = root.querySelector(".layout-article");
  const nav = root.querySelector("nav");

  if (!container || !nav) {
    return;
  }

  let currentCleanup = null;

  const runCleanup = () => {
    if (typeof currentCleanup === "function") {
      try {
        currentCleanup();
      } catch (error) {
        console.error("Cleanup error:", error);
      }
    }
    currentCleanup = null;
  };

  const loadPartial = createPartialLoader(renderInto(container), runCleanup);

  const initializePartial = async (slug, target, options = {}) => {
    if (!slug || !target) {
      return;
    }

    let cleanup = null;

    switch (slug) {
      case "landing":
        cleanup = initializeLanding(target, options);
        break;
      case "login":
        cleanup = initializeLogin(target, options);
        break;
      case "register":
        cleanup = initializeRegister(target, options);
        break;
      case "buses":
        cleanup = await initializeBuses(target, options);
        break;
      case "add-bus-model":
        cleanup = initializeAddBusModel(target, options);
        break;
      case "shifts":
        cleanup = await initializeShifts(target, options);
        break;
      case "shift-form":
        cleanup = await initializeShiftForm(target, options);
        break;
      case "add-custom-stop":
        cleanup = initializeAddCustomStop(target, options);
        break;
      case "custom-stops":
        cleanup = await initializeCustomStops(target, options);
        break;
      case "visualize-shift":
        cleanup = await initializeVisualizeShift(target, options);
        break;
      case "simulation-runs":
        cleanup = await initializeSimulationRuns(target, options);
        break;
      case "add-simulation":
        cleanup = await initializeAddSimulation(target, options);
        break;
      case "simulation-detail":
        cleanup = await initializeSimulationDetail(target, options);
        break;
      case "simulation-results":
        cleanup = initializeSimulationResults(target, options);
        break;
      case "simulation-comparison":
        cleanup = initializeSimulationComparison(target, options);
        break;
      default:
        break;
    }

    currentCleanup = cleanup;
  };

  const loadAndInitialize = (slug, options = {}) =>
    loadPartial(slug).then(() => initializePartial(slug, container, options));

  // Update nav visibility based on authentication
  const updateNavVisibility = () => {
    const authenticated = isAuthenticated();
    nav.hidden = !authenticated;
  };

  nav.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-partial]");
    if (!link) {
      return;
    }

    event.preventDefault();
    const slug = slugFrom(link);
    loadAndInitialize(slug);
  });

  // Determine initial page based on authentication
  const authenticated = isAuthenticated();
  updateNavVisibility();

  if (authenticated) {
    const initialSlug = slugFrom(nav.querySelector("a[data-partial]"));
    loadAndInitialize(initialSlug);
  } else {
    loadAndInitialize("landing");
  }

  document.addEventListener("partial:request", (event) => {
    const detail = event.detail ?? {};
    const { slug, ...options } = detail;
    if (!slug) {
      return;
    }

    // Update nav visibility when navigating (in case auth status changed)
    updateNavVisibility();

    loadAndInitialize(slug, options);
  });
};
