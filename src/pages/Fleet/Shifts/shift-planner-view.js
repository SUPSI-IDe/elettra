import { getCurrentLang, t } from "../../../i18n";
import { textContent as html } from "../../../ui-helpers.js";
import { isDirectConnection, plannerDisplayTime } from "./shift-planner-programme.js";

export const label = (key, params) => t(`shift_planner.${key}`, params);

const duration = (seconds) => new Intl.NumberFormat(getCurrentLang(), {
  style: "unit", unit: "minute", unitDisplay: "short", maximumFractionDigits: 1,
}).format(seconds / 60);

export const activityTitle = ({ step, trip, target }) => {
  if (step.kind === "service" && trip) {
    return [trip.line, [trip.from_name, trip.to_name].filter(Boolean).join(" → ")].filter(Boolean).join(" · ");
  }
  if (step.kind === "service") return label("trip");
  return [label(step.kind), target?.name].filter(Boolean).join(" · ");
};

export const tripTime = (trip) => [trip.departure_time, trip.arrival_time].map(plannerDisplayTime).join("–");

export const stepNotice = (result, estimate, { draft = false } = {}) => {
  if (result.errors.length) {
    return `<p data-role="step-conflict">${result.errors.map((key) => html(label(key))).join(" ")}</p>`;
  }
  if (!result.route) return "";
  if (!estimate || estimate.status === "loading" || estimate.status === "queued") {
    return draft ? `<p>${html(t("common.loading"))}</p>` : "";
  }
  if (estimate.status === "unavailable") {
    return `<p data-role="step-warning">${html(label("route_unavailable"))}${draft ? `
      <button type="button" data-action="retry-estimate">${html(label("retry"))}</button>` : ""}</p>`;
  }
  const estimated = duration(estimate.seconds);
  if (result.availableSeconds !== null && result.availableSeconds < estimate.seconds) {
    return `<p data-role="step-warning">${html(label("route_warning", {
      available: duration(result.availableSeconds), estimated,
    }))}</p>`;
  }
  return draft ? `<p>${html(label("estimated", { time: estimated }))}</p>` : "";
};

export const renderPlannerSteps = (results, cursor, estimateFor) => {
  if (!results.length) return `<p>${html(t("shifts.no_trips_added"))}</p>`;
  return `<ol class="planner-list">${results.map((result, index) => {
    const { step, trip, direct, next, transferDeparture, transferArrival, errors } = result;
    const publicTime = step.kind === "service" && trip ? tripTime(trip)
      : step.kind === "stay" ? `${plannerDisplayTime(transferArrival)}–${plannerDisplayTime(next.time)}`
      : plannerDisplayTime(transferArrival);
    const connection = !direct && transferDeparture !== null && transferArrival !== null
      ? label("transfer", { departure: plannerDisplayTime(transferDeparture), arrival: plannerDisplayTime(transferArrival) })
      : step.kind === "service" && transferArrival !== null
        ? label("direct_window", { arrival: plannerDisplayTime(transferArrival) }) : "";
    return `<li class="planner-step" data-step-index="${index}" data-kind="${step.kind}" data-conflict="${Boolean(errors.length)}"${cursor?.index === index ? ' aria-current="true"' : ""}>
      <p><strong>${html(activityTitle(result))}</strong></p>
      <p><span class="planner-time">${html(publicTime)}</span>${connection ? ` · ${html(connection)}` : ""}</p>
      ${stepNotice(result, estimateFor(result.route))}
      <div class="planner-row-actions">
        <button type="button" data-action="edit-step">${html(t("common.edit"))}</button>
        <button type="button" data-action="insert-before">${html(label("insert_before"))}</button>
        <button type="button" data-action="remove-step">${html(label("remove"))}</button>
      </div>
    </li>`;
  }).join("")}</ol>`;
};

export const renderPlannerCandidates = (candidates, activeTripId) => `
  <ul class="planner-list planner-list--catalog">${candidates.map(({ trip, direct, result }) => `
    <li class="planner-candidate" data-trip-id="${html(trip.id)}">
      <div>
        <p><strong class="planner-time">${html(tripTime(trip))}</strong> · ${html([trip.from_name, trip.to_name].filter(Boolean).join(" → "))}</p>
        <small>${html(label(direct ? "direct_connection" : "transfer_needed"))}</small>
        <div data-role="candidate-notice"></div>
      </div>
      <div class="planner-row-actions">
        ${direct && !result.errors.length ? `<button type="button" data-action="add-direct-trip" class="action-positive">${html(label("add_direct"))}</button>` : ""}
        <button type="button" data-action="select-trip" aria-pressed="${trip.id === activeTripId}">${html(label("choose_trip"))}</button>
      </div>
    </li>`).join("")}</ul>`;

const localTimeField = (field, key, value, readonly = false) => `
  <label for="planner-${field}">
    <span>${html(label(key))}</span>
    <input id="planner-${field}" type="text" required autocomplete="off" placeholder="HH:MM" data-field="${field}" value="${html(value)}"${readonly ? " readonly" : ""} />
  </label>`;

export const renderPlannerDraft = (draft, result, previous, depots, cursor) => {
  const { kind } = draft;
  const stayOptions = Array.from(depots.values(), (depot) => `<option value="${html(depot.id)}"${depot.id === draft.depot_id ? " selected" : ""}>${html(depot.name ?? depot.label ?? depot.id)}</option>`).join("");
  return `<h3 id="planner-draft-heading" tabindex="-1">${html(activityTitle(result))}</h3>
    ${result.trip ? `<p class="planner-time">${html(tripTime(result.trip))}</p>` : ""}
    <div class="planner-field-grid">
      ${kind === "stay" ? `
        <label for="planner-stay-depot"><span>${html(label("stay_depot"))}</span>
          <select id="planner-stay-depot" data-field="stay-depot">${stayOptions}</select>
        </label>` : ""}
      ${localTimeField("transfer-departure", "depart_previous", draft.transfer_departure, cursor.index === 0)}
      ${localTimeField("transfer-arrival", kind === "service" ? "arrive_terminus" : "arrive_depot", kind === "service" ? draft.transfer_arrival : draft.arrival)}
      ${kind === "stay" ? localTimeField("stay-departure", "leave_depot", draft.departure) : ""}
    </div>
    ${kind === "service" && previous.stopId !== result.target.stopId && isDirectConnection(previous, result.target) ? `
      <label class="planner-force-transfer">
        <input type="checkbox" data-field="force-transfer"${draft.force_transfer ? " checked" : ""} />
        <span>${html(label("force_transfer"))}</span>
      </label>` : ""}
    <div data-role="draft-notice" aria-live="polite"></div>
    <div class="planner-row-actions">
      <button type="button" class="action-positive" data-action="confirm-step">${html(label(cursor.replace ? "update_activity" : "add_activity"))}</button>
      <button type="button" data-action="cancel-step">${html(t("common.cancel"))}</button>
    </div>`;
};
