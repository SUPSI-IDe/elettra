import { initializeAddBusModel } from "./pages/Fleet/Buses/add-bus-model";
import { initializeAddBus } from "./pages/Fleet/Buses/add-bus";
import { initializeShiftForm } from "./pages/Fleet/Shifts/shift-form";
import { initializeAddCustomStop } from "./pages/Fleet/Custom Stops/add-custom-stop";
import { initializeBuses } from "./pages/Fleet/Buses/buses";
import { initializeCustomStops } from "./pages/Fleet/Custom Stops/custom-stops";
import { initializeShifts } from "./pages/Fleet/Shifts/shifts";
import { initializeVisualizeShift } from "./pages/Fleet/Shifts/visualize-shift";
import { applyTranslations, getCurrentLang } from "./i18n";

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
      case "add-bus":
        cleanup = await initializeAddBus(target, options);
        break;
      case "custom-stops":
        cleanup = await initializeCustomStops(target, options);
        break;
      case "visualize-shift":
        cleanup = await initializeVisualizeShift(target, options);
        break;
      default:
        break;
    }

    currentCleanup = cleanup;
  };

  const loadAndInitialize = (slug, options = {}) =>
    loadPartial(slug).then(() => initializePartial(slug, container, options));

  nav.addEventListener("click", (event) => {
    const link = event.target.closest("a[data-partial]");
    if (!link) {
      return;
    }

    event.preventDefault();
    const slug = slugFrom(link);
    loadAndInitialize(slug);
  });

  const initialSlug = slugFrom(nav.querySelector("a[data-partial]"));
  loadAndInitialize(initialSlug);

  document.addEventListener("partial:request", (event) => {
    const detail = event.detail ?? {};
    const { slug, ...options } = detail;
    if (!slug) {
      return;
    }

    loadAndInitialize(slug, options);
  });
};
