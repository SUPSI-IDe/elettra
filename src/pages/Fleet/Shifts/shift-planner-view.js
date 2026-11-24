import { getCurrentLang, t } from "../../../i18n";
import { textContent as html } from "../../../ui-helpers.js";
import { plannerDisplayTime, plannerInputTime } from "./shift-planner-programme.js";

export const label = (key, params) => t(`shift_planner.${key}`, params);

const duration = (seconds) => new Intl.NumberFormat(getCurrentLang(), {
  style: "unit", unit: "minute", unitDisplay: "short", maximumFractionDigits: 0,
}).format(seconds / 60);

export const activityTitle = ({ step, trip, target }) => {
  if (step.kind === "service" && trip) {
    return [trip.line, [trip.from_name, trip.to_name].filter(Boolean).join(" → ")].filter(Boolean).join(" · ");
  }
  if (step.kind === "service") return label("trip");
  return [label(step.kind), target?.name].filter(Boolean).join(" · ");
};

export const tripTime = (trip) => [trip.departure_time, trip.arrival_time].map(plannerDisplayTime).join("–");

const previewToggle = (title, buttonClass = "") => `
  <button type="button" class="planner-preview-toggle ${buttonClass}" data-action="preview-trip" title="${html(label("trip_profile"))}" aria-expanded="false">
    <span>${html(title)}</span>
  </button>`;

export const stepNotice = (result, estimate, { draft = false } = {}) => {
  const errors = result.errors.filter(key => !draft || key !== "time_required");
  if (errors.length) {
    return `<p data-role="step-conflict">${[...new Set(errors)].map((key) => html(label(key))).join(" ")}</p>`;
  }
  if (!result.route) return "";
  if (!estimate || estimate.status === "loading" || estimate.status === "queued") {
    return draft ? `<p>${html(t("common.loading"))}</p>` : "";
  }
  if (estimate.status === "unavailable") {
    return `<p data-role="step-warning">${html(label("route_unavailable"))}${draft ? `
      <button type="button" class="list-secondary-action" data-action="retry-estimate">${html(label("retry"))}</button>` : ""}</p>`;
  }
  const estimated = duration(estimate.seconds);
  if (result.availableSeconds !== null && result.availableSeconds < estimate.seconds) {
    return `<p data-role="step-warning">${html(label("route_warning", {
      available: duration(60 * Math.floor(result.availableSeconds / 60)), estimated,
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
        ${step.kind === "service" && trip ? previewToggle(label("trip_profile"), "list-secondary-action") : ""}
        ${step.kind !== "service" || !direct ? `<button type="button" class="list-secondary-action" data-action="edit-step">${html(t("common.edit"))}</button>` : ""}
        <button type="button" class="list-secondary-action" data-action="insert-before">${html(label("insert_before"))}</button>
        <button type="button" class="list-danger-action" data-action="remove-step">${html(label("remove"))}</button>
      </div>
    </li>`;
  }).join("")}</ol>`;
};

const describeCandidateVariants = (rows) => {
  const groups = new Map();
  for (const row of rows) {
    const key = JSON.stringify([row.route, row.departure, row.arrival]);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const counts = new Map();
    const descriptions = group.map(({ trip }) => {
      const number = String(trip.trip_short_name ?? "").trim();
      const stops = trip.stop_count;
      const count = Number.isInteger(stops) && stops >= 0
        ? label(stops === 1 ? "trip_stop_count_one" : "trip_stop_count_other", { count: stops }) : "";
      const description = [number && `${label("trip_number")} ${number}`, count].filter(Boolean).join(" · ");
      counts.set(description, (counts.get(description) ?? 0) + 1);
      return { number, count, description };
    });

    group.forEach((row, index) => {
      const { number, count, description } = descriptions[index];
      const variant = label("trip_variant", { number: index + 1 });
      row.detail = !number ? [variant, count].filter(Boolean).join(" · ")
        : counts.get(description) > 1 ? `${description} · ${variant}` : description;
    });
  }
};

export const renderPlannerCandidates = (candidates) => {
  const rows = candidates.map(({ trip, direct, result }) => ({
    trip, direct, result,
    route: [trip.from_name, trip.to_name].filter(Boolean).join(" – ") || label("trip"),
    departure: plannerDisplayTime(trip.departure_time),
    arrival: plannerDisplayTime(trip.arrival_time),
  }));
  describeCandidateVariants(rows);

  return `
  <div class="table-scroll-wrap planner-catalog-scroll" role="region" aria-label="${html(t("shifts.scheduled_trips_caption"))}" tabindex="0">
    <table class="table-standard planner-catalog-table">
      <caption class="sr-only">${html(t("shifts.scheduled_trips_caption"))}</caption>
      <thead>
        <tr>
          <th scope="col" class="planner-time">${html(t("shifts.col_start"))}</th>
          <th scope="col" class="planner-time">${html(t("shifts.col_end"))}</th>
          <th scope="col">${html(t("shifts.col_from_to"))}</th>
          <th scope="col" class="actions"><span class="sr-only">${html(t("common.actions"))}</span></th>
        </tr>
      </thead>
      <tbody>${rows.map(({ trip, direct, result, route, departure, arrival, detail }) => `
        <tr class="planner-candidate" data-trip-id="${html(trip.id)}">
          <td class="planner-time">${html(departure)}</td>
          <td class="planner-time">${html(arrival)}</td>
          <td>
            ${previewToggle(route)}${detail ? `<small data-role="candidate-variant">${html(detail)}</small>` : ""}
            <small>${html(label(direct ? "direct_connection" : "transfer_needed"))}</small>
            <div data-role="candidate-notice"></div>
          </td>
          <td class="actions">
            <button type="button" data-action="${direct ? "add-direct-trip" : "select-trip"}"${direct && result.errors.length ? " disabled" : ""}>${html(t("shifts.add_trip"))}</button>
          </td>
        </tr>`).join("")}</tbody>
    </table>
  </div>`;
};

const localTimeField = (field, key, value, readonly = false) => `
  <label for="planner-${field}">
    <span>${html(label(key))}</span>
    <input id="planner-${field}" type="text" data-planner-clock inputmode="numeric" maxlength="5" pattern="[0-9]{2}:[0-5][0-9]" required autocomplete="off" placeholder="HH:MM" data-field="${field}" value="${html(plannerInputTime(value) || value)}"${readonly ? " readonly" : ""} />
  </label>`;

export const renderPlannerDraft = (draft, result, depots, cursor) => {
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
    <div data-role="draft-notice" aria-live="polite"></div>
    <div class="planner-row-actions">
      <button type="button" class="list-primary-action" data-action="confirm-step">${html(label(cursor.replace ? "update_activity" : "add_activity"))}</button>
      <button type="button" class="list-secondary-action" data-action="cancel-step">${html(t("common.cancel"))}</button>
    </div>`;
};
