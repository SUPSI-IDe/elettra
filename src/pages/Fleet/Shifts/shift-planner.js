import "./shift-planner.css";
import { mountTripPreview } from "./trip-preview.js";
import {
  fetchAllBuses, fetchAllBusModels, fetchAllDepots, fetchAllRoutes, fetchGtfsDatasets,
  fetchRoutesByAgency, fetchTripById,
} from "../../../api";
import { fetchPlannerCatalog, fetchPlannerProgramme, fetchPlannerRoute, newPlannerRequestId, savePlannerProgramme } from "../../../api/shift-planner.js";
import { resolveAgencyId, resolveUserId } from "../../../api/session";
import { triggerPartialLoad } from "../../../events";
import { I18N_CHANGE_EVENT, t } from "../../../i18n";
import { textContent as html } from "../../../ui-helpers";
import { datasetKey, datasetLabel, datasetSummaryHtml, sortDatasets } from "../../../utils/gtfs-datasets.js";
import { invalidateShiftDistanceCache } from "../../../utils/shift-distance.js";
import { renderBusOptions, renderDepotOptions } from "./shift-renderers.js";
import { DAYS_OF_WEEK } from "./shift-utils.js";
import {
  canonicalPlannerStep, evaluatePlannerProgramme, evaluatePlannerStep, getPlannerStart,
  plannerDisplayTime, plannerInputTime, plannerTime, plannerTimeSeconds, selectPlannerTrips,
} from "./shift-planner-programme.js";
import {
  activityTitle, label, renderPlannerCandidates, renderPlannerDraft, renderPlannerSteps, stepNotice,
} from "./shift-planner-view.js";

const items = (data) => Array.isArray(data) ? data : data?.items ?? data?.results ?? [];
const canStartAtDepot = (depot) => !depot?.features?.type || depot.features.type === "depot";
const pairKey = (pair) => pair ? JSON.stringify([pair.from, pair.to]) : "";

function formatClockEntry(input) {
  const raw = input.value;
  let formatted = raw;
  if (/^\d{4}$/.test(raw)) formatted = raw.slice(0, 2) + ":" + raw.slice(2);
  else if (/^\d:\d{2}$/.test(raw)) formatted = "0" + raw;
  if (formatted === raw) return;
  const caret = input.selectionStart;
  input.value = formatted;
  const offset = raw.includes(":") || caret > 2 ? 1 : 0;
  input.setSelectionRange(caret + offset, caret + offset);
}

const replaceOptions = (select, placeholder, options) => {
  const selected = select.value;
  select.replaceChildren(
    new Option(placeholder, ""),
    ...options.map(([value, name]) => new Option(name, value)),
  );
  select.value = selected || "";
  if (select.selectedIndex < 0) select.selectedIndex = 0;
};

const withApiError = (key, error) => [t(key), error?.message].filter(Boolean).join(" ");

function trackCatalogPreview(row, preview) {
  const scroll = row.closest(".planner-catalog-scroll");
  const heading = row.closest("table").tHead;
  const property = "--planner-catalog-preview-top";
  const update = () => {
    const viewportTop = scroll.getBoundingClientRect().top + scroll.clientTop;
    const headingBottom = heading.getBoundingClientRect().bottom;
    const rowHeight = row.getBoundingClientRect().height;
    // Chrome constrains a sticky table row to the whole table, even across row groups.
    const lastRowTop = preview.getBoundingClientRect().bottom - rowHeight;
    row.style.setProperty(property, `${Math.min(headingBottom, lastRowTop) - viewportTop}px`);
    scroll.style.setProperty("--planner-stops-heading-top", `${headingBottom + rowHeight - viewportTop}px`);
  };
  const resize = new ResizeObserver(update);
  for (const element of [scroll, heading, row, preview]) resize.observe(element);
  scroll.addEventListener("scroll", update, { passive: true });
  update();
  return () => {
    scroll.removeEventListener("scroll", update);
    resize.disconnect();
    row.style.removeProperty(property);
    scroll.style.removeProperty("--planner-stops-heading-top");
  };
}

export const initializeShiftPlanner = (root, { shiftId } = {}) => {
  const section = root.querySelector("section.shift-planner");
  if (!section) return null;

  const form = section.querySelector("form");
  const lifetime = new AbortController();
  const { signal } = lifetime;
  const field = (name) => form.querySelector(`[data-field="${name}"]`);
  const role = (name) => section.querySelector(`[data-role="${name}"]`);
  const action = (name) => section.querySelector(`[data-action="${name}"]`);
  const setup = { startTime: "", depotId: "" };
  const depots = new Map();
  const trips = new Map();
  const estimates = new Map();
  const estimateQueue = [];
  const candidateResults = new Map();
  const previewCache = new Map();
  let preview = null;
  const catalogs = new Map();
  const history = [];
  let datasets = [];
  let routes = [];
  let steps = [];
  let catalog = [];
  let catalogKey = "";
  let catalogStatus = "";
  let terminusFilterContext = "";
  let activeEstimates = 0;
  let catalogRequest = null;
  let routesGeneration = 0;
  let cursor = null;
  let draft = null;
  let catalogScrollTop = 0;
  let autoArrival = false;
  let ready = false;
  let saving = false;
  let feedback = null;
  let revision;
  let requestId;

  const dataset = () => datasets.find((entry) => datasetKey(entry) === field("dataset").value);
  const start = () => {
    const depotId = canStartAtDepot(depots.get(setup.depotId)) ? setup.depotId : "";
    const shown = field("start-time").value;
    // Keep the precise departure of a saved programme until the operator edits it.
    const startTime = shown === plannerInputTime(setup.startTime) ? setup.startTime : shown;
    return getPlannerStart(depotId, startTime, depots);
  };
  const context = () => ({ trips, depots, depotId: setup.depotId });
  const results = () => evaluatePlannerProgramme(steps, start(), context());
  const insertion = () => cursor ?? { index: steps.length, replace: false };
  const selectedCatalogKey = () => `${field("weekday").value}/${field("line").value}`;
  const previous = () => {
    const index = insertion().index;
    return index ? results()[index - 1].next : start();
  };
  const closed = () => steps.at(-1)?.kind === "return";
  const hasService = () => steps.some((step) => step.kind === "service");
  const canPlan = () => ready && field("weekday").value && dataset() &&
    start().stopId && start().time !== null && previous().stopId && previous().time !== null &&
    (!closed() || cursor);
  const estimateFor = (pair) => estimates.get(pairKey(pair));

  const closePreview = () => {
    if (!preview) return;
    preview.detachLayout?.();
    preview.dispose();
    preview.host.remove();
    preview.button.setAttribute("aria-expanded", "false");
    preview.button.removeAttribute("aria-controls");
    preview = null;
  };

  // Reattach the same map when a catalogue or its programme is redrawn.
  const attachPreview = (button) => {
    preview.button = button;
    button.setAttribute("aria-controls", preview.host.id);
    button.setAttribute("aria-expanded", "true");
    if (preview.scope === "catalog") {
      const row = button.closest("tr");
      if (row.nextElementSibling === preview.host) return;
      preview.detachLayout?.();
      row.after(preview.host);
      preview.detachLayout = trackCatalogPreview(row, preview.host);
    } else {
      button.closest("[data-step-index]").append(preview.host);
    }
  };

  const syncPreview = (scope) => {
    if (preview?.scope !== scope) return;
    const row = scope === "catalog"
      ? role(scope).querySelector(`tr[data-trip-id="${CSS.escape(preview.tripId)}"]`)
      : role(scope).querySelector(`[data-step-index="${steps.findIndex(step => step.trip_id === preview.tripId)}"]`);
    const button = row?.querySelector('[data-action="preview-trip"]');
    if (button) attachPreview(button);
    else closePreview();
  };

  const togglePreview = (button) => {
    const candidate = button.closest("tr[data-trip-id]");
    const tripId = candidate?.dataset.tripId ?? steps[Number(button.closest("[data-step-index]")?.dataset.stepIndex)]?.trip_id;
    const scope = candidate ? "catalog" : "programme";
    const alreadyOpen = preview?.scope === scope && preview.tripId === tripId;
    closePreview();
    if (alreadyOpen || !tripId) return;
    const host = document.createElement(candidate ? "tr" : "div");
    host.id = "planner-trip-profile";
    let content = host;
    if (candidate) {
      host.className = "trip-preview-row";
      content = host.insertCell();
      content.colSpan = candidate.cells.length;
      content.className = "trip-preview-cell";
    } else {
      host.tabIndex = 0;
      host.setAttribute("role", "region");
      host.setAttribute("aria-label", label("trip_profile"));
    }
    preview = { scope, tripId, host, button };
    attachPreview(button);
    preview.dispose = mountTripPreview(content, tripId, previewCache, { scrollStops: false });
  };

  const renderFeedback = () => {
    const element = role("feedback");
    element.hidden = !feedback;
    element.textContent = feedback ? withApiError(feedback.key, feedback.error) : "";
  };

  const renderCatalogueWarnings = (key) => {
    role("catalog").querySelectorAll("[data-trip-id]").forEach((row) => {
      const result = candidateResults.get(row.dataset.tripId);
      if (result && (!key || pairKey(result.route) === key)) {
        row.querySelector('[data-role="candidate-notice"]').innerHTML = stepNotice(result, estimateFor(result.route));
      }
    });
  };

  const renderCatalog = () => {
    if (draft) return;
    const element = role("catalog");
    const planned = canPlan();
    const current = previous();
    const hasLine = Boolean(field("line").value);
    const fromTerminus = planned && hasLine && current.kind === "terminus";
    const includeOtherTermini = field("include-other-termini");
    const { index, replace } = insertion();
    const filterContext = fromTerminus
      ? JSON.stringify([selectedCatalogKey(), index, replace, current.stopId, current.parent, current.time]) : "";
    if (filterContext !== terminusFilterContext) {
      includeOtherTermini.checked = false;
      terminusFilterContext = filterContext;
    }
    role("terminus-filter").hidden = !fromTerminus;
    candidateResults.clear();
    if (preview?.scope === "catalog" && (!planned || !hasLine || catalogStatus || catalogKey !== selectedCatalogKey())) closePreview();
    if (!planned) {
      element.replaceChildren();
      return;
    }
    if (!hasLine || catalogStatus === "loading" || catalogKey !== selectedCatalogKey()) {
      element.innerHTML = `<p>${html(hasLine ? t("common.loading") : label("choose_line_prompt"))}</p>`;
      return;
    }
    if (catalogStatus === "error") {
      element.innerHTML = `<p>${html(label("catalog_error"))}
        <button type="button" class="list-secondary-action" data-action="retry-catalog">${html(label("retry"))}</button></p>`;
      return;
    }
    const used = new Set(steps.filter((_, i) => !cursor?.replace || cursor.index !== i).map((step) => step.trip_id));
    const candidates = selectPlannerTrips(catalog, current, used, { includeOtherTermini: includeOtherTermini.checked })
      .map(({ trip, direct }) => {
        const result = evaluatePlannerStep({ kind: "service", trip_id: trip.id }, current, context(), insertion().index === 0);
        candidateResults.set(trip.id, result);
        if (!result.errors.length) requestEstimate(result.route);
        return { trip, direct, result };
      });
    const emptyMessage = fromTerminus && !includeOtherTermini.checked ? "no_terminus_candidates" : "no_candidates";
    element.innerHTML = candidates.length ? renderPlannerCandidates(candidates)
      : `<p>${html(label(emptyMessage, { place: current.name || "—", time: plannerDisplayTime(current.time) }))}</p>`;
    syncPreview("catalog");
    renderCatalogueWarnings();
  };

  const saveProblem = (checked = results()) => {
    if (draft) return "save_draft";
    if (!dataset()) return "save_edition";
    if (!hasService()) return "save_missing_service";
    if (checked.some((result) => result.errors.length)) return "save_conflicts";
    if (!closed()) return "save_missing_return";
    return "";
  };

  const renderProgramme = () => {
    const checked = results();
    role("programme").innerHTML = renderPlannerSteps(checked, cursor, estimateFor);
    syncPreview("programme");
    const problem = saveProblem(checked);
    role("save-status").textContent = saving ? t(shiftId ? "shifts.saving_shift" : "shifts.creating_shift")
      : problem ? label(problem) : "";
    action("save").disabled = saving || Boolean(problem);
    action("undo").disabled = !history.length;
  };

  const draftResult = () => evaluatePlannerStep(draft, previous(), context(), insertion().index === 0);

  const renderDraftNotice = () => {
    if (!draft || role("draft").hidden) return;
    const result = draftResult();
    role("draft-notice").innerHTML = stepNotice(result, estimateFor(result.route), { draft: true });
    action("confirm-step").disabled = Boolean(result.errors.length);
  };

  const renderDraft = () => {
    const element = role("draft");
    element.hidden = !draft;
    element.innerHTML = draft ? renderPlannerDraft(draft, draftResult(), depots, insertion()) : "";
    renderDraftNotice();
  };

  const render = ({ includeDraft = false } = {}) => {
    const current = previous();
    const planned = canPlan();
    const atEnd = closed() && !cursor;
    const currentParams = { place: current.name || "—", time: plannerDisplayTime(current.time) };
    const hasState = field("weekday").value && current.stopId && current.time !== null;
    role("current-state").textContent = hasState
      ? [label(atEnd ? "closed_at" : "ready", currentParams), atEnd ? label("closed_prompt") : ""].filter(Boolean).join(" ")
      : label("setup_prompt");
    role("position").hidden = !cursor;
    if (cursor) {
      role("position-text").textContent = label(cursor.replace ? "edit_place" : "insertion_place", {
        activity: activityTitle(results()[cursor.index]),
      });
    }
    role("next-activity").hidden = !planned;
    const editing = Boolean(draft);
    section.classList.toggle("planner-editing-activity", editing);
    role("activity-choices").hidden = editing;
    role("review").hidden = editing;
    action("back-to-end").hidden = editing;
    action("undo").hidden = editing;
    action("close").disabled = editing;
    field("weekday").disabled = editing || Boolean(steps.length);
    field("dataset").disabled = editing || Boolean(steps.length) || !datasets.length;
    field("depot").disabled = editing || !field("weekday").value;
    field("start-time").disabled = editing || !field("weekday").value;
    field("line").disabled = !planned || !routes.length;
    action("choose-return").disabled = !hasService() ||
      (cursor && !(cursor.replace && cursor.index === steps.length - 1));
    if (includeDraft) renderDraft();
    renderCatalogueAndProgramme();
    renderFeedback();
  };

  const renderCatalogueAndProgramme = () => {
    renderCatalog();
    renderProgramme();
  };

  const updateAutoArrival = () => {
    if (!draft || !autoArrival || draft.kind === "service") return;
    const result = draftResult();
    const estimate = estimateFor(result.route);
    const departure = plannerTimeSeconds(draft.transfer_departure);
    let arrival = null;
    if (departure !== null) {
      if (!result.route) arrival = departure;
      else if (estimate?.status === "ready") arrival = Math.ceil(departure / 60) * 60 + estimate.seconds;
    }
    draft.arrival = plannerTime(arrival);
    const input = field("transfer-arrival");
    const shown = plannerInputTime(arrival);
    if (input && input.value !== shown) input.value = shown;
  };

  const startQueuedEstimates = () => {
    while (!signal.aborted && activeEstimates < 4 && estimateQueue.length) {
      const pair = estimateQueue.shift();
      const key = pairKey(pair);
      estimates.set(key, { status: "loading" });
      activeEstimates += 1;
      const handle = (outcome) => {
        activeEstimates -= 1;
        if (signal.aborted) return;
        estimates.set(key, outcome);
        if (draft && pairKey(draftResult().route) === key) {
          // Keep the selection and caret intact if the estimate arrives during an edit.
          if (document.activeElement !== field("transfer-arrival")) updateAutoArrival();
          renderDraftNotice();
        }
        renderCatalogueWarnings(key);
        if (results().some((result) => pairKey(result.route) === key)) renderProgramme();
        startQueuedEstimates();
      };
      void fetchPlannerRoute(pair.from, pair.to, { signal }).then(
        (data) => {
          const seconds = data?.duration_seconds;
          handle(Number.isFinite(seconds) && seconds >= 0
            ? { status: "ready", seconds: Math.max(pair.from === pair.to ? 0 : 1, Math.round(seconds / 60)) * 60 }
            : { status: "unavailable" });
        },
        () => handle({ status: "unavailable" }),
      );
    }
  };

  const requestEstimate = (pair, { retry = false, priority = false } = {}) => {
    if (!pair) return;
    const key = pairKey(pair);
    const pending = estimates.get(key);
    if (priority && pending?.status === "queued") {
      const index = estimateQueue.findIndex((entry) => pairKey(entry) === key);
      estimateQueue.splice(index, 1);
    } else if (pending && !retry) {
      return;
    }
    estimates.set(key, { status: "queued" });
    if (priority) estimateQueue.unshift(pair);
    else estimateQueue.push(pair);
    startQueuedEstimates();
  };

  const requestProgrammeEstimates = () => {
    results().forEach((result) => {
      if (!result.errors.length) requestEstimate(result.route);
    });
  };

  const loadCatalog = async () => {
    catalogRequest?.abort();
    const routeId = field("line").value;
    const weekday = field("weekday").value;
    catalog = [];
    catalogStatus = "";
    if (!routeId || !weekday || !canPlan()) {
      renderCatalog();
      return;
    }
    const key = catalogKey = selectedCatalogKey();
    if (catalogs.has(key)) {
      catalog = catalogs.get(key);
      renderCatalog();
      return;
    }
    const controller = new AbortController();
    catalogRequest = controller;
    catalogStatus = "loading";
    renderCatalog();
    try {
      const data = await fetchPlannerCatalog(routeId, weekday, { signal: controller.signal });
      if (signal.aborted || controller.signal.aborted) return;
      catalog = items(data);
      catalogs.set(key, catalog);
      catalog.forEach((trip) => trips.set(trip.id, trip));
      catalogStatus = "";
    } catch {
      if (signal.aborted || controller.signal.aborted) return;
      catalogStatus = "error";
    }
    renderCatalog();
  };

  const renderRoutes = () => {
    const collator = new Intl.Collator(undefined, { numeric: true });
    const options = routes.map((route) => [
      route.id,
      [...new Set([route.route_short_name, route.route_long_name].filter(Boolean))].join(" · ") || route.id,
    ]);
    options.sort((left, right) => collator.compare(left[1], right[1]));
    replaceOptions(field("line"), label("choose_line"), options);
  };

  const renderDatasets = () => {
    replaceOptions(field("dataset"), t("gtfs.label"), datasets.map((entry) => [datasetKey(entry), datasetLabel(entry, t)]));
    role("dataset-summary").innerHTML = dataset() ? datasetSummaryHtml([dataset()], t) : "";
  };

  const loadRoutes = async () => {
    const generation = ++routesGeneration;
    const activeDataset = dataset();
    catalogRequest?.abort();
    routes = [];
    catalog = [];
    catalogKey = "";
    catalogStatus = "";
    renderRoutes();
    render();
    if (!activeDataset) return;
    try {
      const agencyId = await resolveAgencyId();
      if (signal.aborted || generation !== routesGeneration) return;
      const data = await (agencyId ? fetchRoutesByAgency(agencyId, activeDataset) : fetchAllRoutes(activeDataset));
      if (signal.aborted || generation !== routesGeneration) return;
      routes = items(data).filter((route) => route?.id);
      if (feedback?.key === "shifts.unable_to_load_routes") feedback = null;
    } catch (error) {
      if (signal.aborted || generation !== routesGeneration) return;
      feedback = { key: "shifts.unable_to_load_routes", error };
    }
    renderRoutes();
    render();
  };

  const closeDraft = () => {
    draft = null;
    autoArrival = false;
  };

  const editDraft = (next, { keepTimes = false } = {}) => {
    catalogScrollTop = role("catalog").querySelector(".planner-catalog-scroll")?.scrollTop ?? 0;
    closePreview();
    const current = previous();
    autoArrival = !keepTimes && next.kind !== "service";
    const departure = !keepTimes && next.kind !== "service" && insertion().index > 0
      ? plannerTime(Math.ceil(current.time / 60) * 60) : plannerTime(current.time);
    if (keepTimes) {
      draft = { ...next };
      if (insertion().index === 0) draft.transfer_departure = departure;
      else draft.transfer_departure ||= departure;
    } else {
      draft = { ...next, transfer_departure: departure };
      if (next.kind !== "service") draft.arrival = departure;
    }
    const { route, transferArrival } = draftResult();
    if (draft.kind === "service") draft.transfer_arrival ??= plannerTime(transferArrival);
    requestEstimate(route, { priority: true });
    updateAutoArrival();
    render({ includeDraft: true });
    section.querySelector("#planner-draft-heading")?.focus();
  };

  const recordChange = () => history.push({ steps, ...setup });

  const finishChange = () => {
    closeDraft();
    cursor = null;
    feedback = null;
    render({ includeDraft: true });
    void loadCatalog();
    requestProgrammeEstimates();
    section.querySelector("#planner-next-heading")?.focus();
  };

  const commitStep = (step, result) => {
    const { index, replace } = insertion();
    recordChange();
    steps = steps.toSpliced(index, Number(replace), canonicalPlannerStep(step, result));
    finishChange();
  };

  const handleActivityAction = (name, index) => {
    if (name === "edit-step" && steps[index].kind === "service" && results()[index].direct) return;
    if (name === "remove-step") {
      recordChange();
      steps = steps.filter((_, position) => position !== index);
      finishChange();
      return;
    }
    closeDraft();
    cursor = { index, replace: name === "edit-step" };
    const step = steps[index];
    const line = trips.get(step.trip_id)?.route_id;
    if ((cursor.replace || !field("line").value) && line && routes.some(route => route.id === line)) {
      field("line").value = line;
    }
    if (cursor.replace) {
      editDraft(step, { keepTimes: true });
    } else {
      render({ includeDraft: true });
      section.querySelector("#planner-next-heading")?.focus();
    }
    void loadCatalog();
  };

  const handleClick = (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button || button.disabled) return;
    const { action: name } = button.dataset;
    if (draft && !["confirm-step", "cancel-step", "retry-estimate"].includes(name)) return;
    if (name === "close" || name === "cancel") {
      if (!saving) triggerPartialLoad("shifts");
      return;
    }
    if (!ready || saving) return;
    if (name === "preview-trip") {
      togglePreview(button);
      return;
    }
    const row = button.closest("[data-step-index]");
    if (row) {
      handleActivityAction(name, Number(row.dataset.stepIndex));
      return;
    }
    switch (name) {
      case "select-trip": {
        const tripId = button.closest("[data-trip-id]").dataset.tripId;
        if (candidateResults.get(tripId)?.direct === false) editDraft({ kind: "service", trip_id: tripId });
        break;
      }
      case "add-direct-trip": {
        const result = candidateResults.get(button.closest("[data-trip-id]").dataset.tripId);
        if (result?.direct && !result.errors.length) commitStep(result.step, result);
        break;
      }
      case "choose-stay": {
        const sameDepot = [...depots.values()].find((depot) => depot.stop_id === previous().stopId);
        editDraft({ kind: "stay", depot_id: sameDepot?.id ?? setup.depotId });
        break;
      }
      case "choose-return":
        editDraft({ kind: "return" });
        break;
      case "confirm-step": {
        if (!draft) break;
        const result = draftResult();
        if (result.errors.length) break;
        commitStep(draft, result);
        break;
      }
      case "undo": {
        const snapshot = history.pop();
        if (!snapshot) break;
        ({ steps, depotId: setup.depotId, startTime: setup.startTime } = snapshot);
        field("depot").value = setup.depotId;
        field("start-time").value = plannerInputTime(setup.startTime) || setup.startTime;
        field("start-time").setCustomValidity("");
        finishChange();
        break;
      }
      case "back-to-end":
        finishChange();
        break;
      case "cancel-step": {
        const { kind, trip_id: tripId } = draft;
        const editedIndex = cursor?.replace ? cursor.index : null;
        closeDraft();
        if (cursor?.replace) cursor = null;
        render({ includeDraft: true });
        const scroll = role("catalog").querySelector(".planner-catalog-scroll");
        if (scroll) scroll.scrollTop = catalogScrollTop;
        const opener = editedIndex !== null
          ? role("programme").querySelector(`[data-step-index="${editedIndex}"] [data-action="edit-step"]`)
          : kind === "service"
            ? role("catalog").querySelector(`[data-trip-id="${CSS.escape(tripId)}"] [data-action="select-trip"]`)
            : action(kind === "stay" ? "choose-stay" : "choose-return");
        (opener ?? section.querySelector("#planner-next-heading")).focus();
        break;
      }
      case "retry-catalog":
        void loadCatalog();
        break;
      case "retry-estimate":
        if (draft) {
          requestEstimate(draftResult().route, { retry: true, priority: true });
          renderDraftNotice();
        }
        break;
    }
  };

  const handleChange = (event) => {
    const { field: name } = event.target.dataset;
    const { value } = event.target;
    if (name === "depot" || name === "start-time") {
      if (steps.length) recordChange();
      if (name === "depot") setup.depotId = value;
      else {
        setup.startTime = plannerInputTime(value) || value;
        field(name).value = setup.startTime;
        event.target.setCustomValidity(value && plannerTimeSeconds(value) === null ? label("time_format") : "");
        if (value && plannerTimeSeconds(value) === null) event.target.reportValidity();
        // Input already refreshed the list. Replacing its buttons during blur can swallow the pending click.
        if (!draft) {
          action("undo").disabled = !history.length;
          requestProgrammeEstimates();
          return;
        }
      }
      if (draft) {
        if (insertion().index === 0) draft.transfer_departure = plannerTime(start().time);
        requestEstimate(draftResult().route, { priority: true });
        updateAutoArrival();
      }
      render({ includeDraft: true });
      requestProgrammeEstimates();
      void loadCatalog();
    } else if (name === "weekday") {
      render();
      void loadCatalog();
    } else if (name === "dataset") {
      renderDatasets();
      void loadRoutes();
    } else if (name === "line") {
      void loadCatalog();
    } else if (name === "include-other-termini") {
      renderCatalog();
    } else if (draft && name === "stay-depot") {
      draft.depot_id = value;
      requestEstimate(draftResult().route, { priority: true });
      updateAutoArrival();
      section.querySelector("#planner-draft-heading").textContent = activityTitle(draftResult());
      renderDraftNotice();
    }
  };

  const handleInput = (event) => {
    const { field: name } = event.target.dataset;
    if (event.target.hasAttribute("data-planner-clock") && !event.isComposing) formatClockEntry(event.target);
    const { value } = event.target;
    if (name === "start-time" && !draft) {
      render();
      return;
    }
    if (!draft) return;
    if (name === "transfer-departure") {
      draft.transfer_departure = value;
      updateAutoArrival();
    } else if (name === "transfer-arrival") {
      if (draft.kind === "service") draft.transfer_arrival = value;
      else draft.arrival = value;
      autoArrival = false;
    } else if (name === "stay-departure") {
      draft.departure = value;
    } else {
      return;
    }
    renderDraftNotice();
  };

  const save = async (event) => {
    event.preventDefault();
    const checked = results();
    if (!ready || saving || saveProblem(checked)) return;
    const name = field("name").value.trim();
    field("name").value = name;
    if (!field("name").reportValidity() || !field("bus").reportValidity()) return;
    const { gtfs_year, gtfs_file_date } = dataset();
    const body = {
      name, bus_id: field("bus").value,
      gtfs_dataset: { gtfs_year, gtfs_file_date },
      programme: {
        version: 1, weekday: field("weekday").value, depot_id: setup.depotId,
        start_time: plannerTime(start().time), steps: checked.map((entry) => canonicalPlannerStep(entry.step, entry)),
      },
      ...(shiftId ? { revision } : { request_id: requestId ??= newPlannerRequestId() }),
    };
    saving = true;
    feedback = null;
    role("editor").disabled = true;
    action("close").disabled = true;
    render();
    try {
      await savePlannerProgramme(body, { shiftId, signal });
      if (signal.aborted) return;
      if (shiftId) invalidateShiftDistanceCache(shiftId);
      triggerPartialLoad("shifts", { flashMessageKey: shiftId ? "shifts.shift_updated" : "shifts.shift_created" });
    } catch (error) {
      if (signal.aborted) return;
      feedback = { key: shiftId ? "shifts.unable_to_update" : "shifts.unable_to_save", error };
      saving = false;
      role("editor").disabled = false;
      action("close").disabled = false;
      render();
      role("feedback").scrollIntoView({ block: "nearest" });
    }
  };

  const populateWeekdays = () => replaceOptions(field("weekday"), label("choose_day"),
    DAYS_OF_WEEK.map(({ value }) => [value, t(`simulation.day_${value}`)]));

  const changeLanguage = () => {
    populateWeekdays();
    renderRoutes();
    renderDatasets();
    render({ includeDraft: true });
  };

  const loadMissingTrips = async (weekDay) => {
    const missing = steps.filter((step) => step.kind === "service" && !trips.has(step.trip_id));
    if (!missing.length) return;
    const meta = await Promise.all(missing.map((step) => fetchTripById(step.trip_id).catch(() => null)));
    const routeIds = new Set(meta.map((trip) => trip?.route_id).filter(Boolean));
    await Promise.all([...routeIds].map(async (routeId) => {
      const data = await fetchPlannerCatalog(routeId, weekDay, { signal }).catch(() => []);
      if (signal.aborted) return;
      items(data).forEach((trip) => {
        trips.set(trip.id, trip);
        for (const alias of trip.equivalent_trip_ids ?? []) {
          if (!trips.has(alias)) trips.set(alias, { ...trip, id: alias });
        }
      });
    }));
  };

  const initialize = async () => {
    populateWeekdays();
    const titleKey = shiftId ? "shifts.edit_shift" : "shifts.add_shift";
    role("title").dataset.i18n = titleKey;
    role("title").textContent = t(titleKey);
    if (shiftId) {
      action("save").dataset.i18n = "shifts.update_shift";
      action("save").textContent = t("shifts.update_shift");
    }
    feedback = { key: "common.loading" };
    renderFeedback();
    try {
      const [userId, depotData, busData, datasetData, existing] = await Promise.all([
        resolveUserId(), fetchAllDepots(), fetchAllBuses(), fetchGtfsDatasets(),
        shiftId ? fetchPlannerProgramme(shiftId, { signal }) : null,
      ]);
      const models = await fetchAllBusModels({ userId });
      if (signal.aborted) return;
      const owned = (entity) => entity.user_id === userId;
      items(depotData).filter(owned).filter((depot) => depot.stop_id).forEach((depot) => depots.set(depot.id, depot));
      renderDepotOptions(field("depot"), [...depots.values()].filter(canStartAtDepot));
      const ownedBuses = items(busData).filter(owned);
      // The selector exposes one vehicle per model. Keep the saved vehicle as
      // that representative when reopening a block with several equivalent buses.
      const savedBus = existing && ownedBuses.find((bus) => bus.id === existing.bus_id);
      const selectorBuses = savedBus ? [savedBus, ...ownedBuses.filter((bus) => bus.id !== savedBus.id)] : ownedBuses;
      const modelIds = new Set(ownedBuses.map((bus) => bus.bus_model_id));
      const modelOptions = items(models).filter((model) => owned(model) && modelIds.has(model.id));
      renderBusOptions(field("bus"), selectorBuses, Object.fromEntries(modelOptions.map((model) => [model.id, model])));
      datasets = sortDatasets(datasetData);
      if (existing?.gtfs_dataset && !datasets.some((entry) => datasetKey(entry) === datasetKey(existing.gtfs_dataset))) {
        datasets = [existing.gtfs_dataset, ...datasets];
      }
      renderDatasets();
      field("dataset").value = datasetKey(existing?.gtfs_dataset ?? datasets[0]);
      if (existing) {
        const programme = existing.programme;
        setup.depotId = programme.depot_id;
        setup.startTime = programme.start_time;
        field("name").value = existing.name;
        if (!Array.from(field("bus").options).some((option) => option.value === existing.bus_id)) {
          field("bus").add(new Option(existing.bus_id, existing.bus_id));
        }
        field("bus").value = existing.bus_id;
        field("weekday").value = programme.weekday;
        field("depot").value = setup.depotId;
        field("start-time").value = plannerInputTime(setup.startTime);
        steps = programme.steps;
        revision = existing.revision;
        items(existing.trips).forEach((trip) => trips.set(trip.id, trip));
        await loadMissingTrips(programme.weekday);
        if (signal.aborted) return;
      }
      renderDatasets();
      ready = true;
      feedback = null;
      role("editor").disabled = false;
      await loadRoutes();
      if (!signal.aborted) requestProgrammeEstimates();
    } catch (error) {
      if (signal.aborted) return;
      feedback = { key: "shifts.unable_to_load", error };
      renderFeedback();
    }
  };

  const options = { signal };
  section.addEventListener("click", handleClick, options);
  form.addEventListener("input", handleInput, options);
  form.addEventListener("focusout", (event) => {
    if (event.target.dataset.field === "transfer-arrival" && autoArrival) {
      updateAutoArrival();
      renderDraftNotice();
    }
  }, options);
  form.addEventListener("change", handleChange, options);
  form.addEventListener("submit", save, options);
  document.addEventListener(I18N_CHANGE_EVENT, changeLanguage, options);
  void initialize();

  return () => {
    closePreview();
    lifetime.abort();
    catalogRequest?.abort();
  };
};
