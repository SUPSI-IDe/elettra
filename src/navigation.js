import { initializeAddBusModel } from "./pages/Fleet/Buses/add-bus-model";
import { initializeAddBus } from "./pages/Fleet/Buses/add-bus";
import { initializeShiftForm } from "./pages/Fleet/Shifts/shift-form";
import { initializeAddCustomStop } from "./pages/Fleet/Custom Stops/add-custom-stop";
import { initializeBuses } from "./pages/Fleet/Buses/buses";
import { initializeCustomStops } from "./pages/Fleet/Custom Stops/custom-stops";
import { initializeShifts } from "./pages/Fleet/Shifts/shifts";
import { initializeVisualizeShift } from "./pages/Fleet/Shifts/visualize-shift";

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

const createPartialLoader = (render) => {
  let state = { current: "", pending: "" };

  const transition = (next) => {
    state = { ...state, ...next };
    return state;
  };

  return async (slug) => {
    if (!slug || slug === state.current || slug === state.pending) {
      return state;
    }

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

    return state;
  };
};

export const initializeNavigation = (root = document) => {
  const container = root.querySelector("main article");
  const nav = root.querySelector("nav");

  if (!container || !nav) {
    return;
  }

  const loadPartial = createPartialLoader(renderInto(container));

  const initializePartial = (slug, target, options = {}) => {
    if (!slug || !target) {
      return;
    }

    switch (slug) {
      case "buses":
        initializeBuses(target, options);
        break;
      case "add-bus-model":
        initializeAddBusModel(target, options);
        break;
      case "shifts":
        initializeShifts(target, options);
        break;
      case "shift-form":
        initializeShiftForm(target, options);
        break;
      case "add-custom-stop":
        initializeAddCustomStop(target, options);
        break;
      case "add-bus":
        initializeAddBus(target, options);
        break;
      case "custom-stops":
        initializeCustomStops(target, options);
        break;
      case "visualize-shift":
        initializeVisualizeShift(target, options);
        break;
      default:
        break;
    }
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
