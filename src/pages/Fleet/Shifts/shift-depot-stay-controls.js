import { t } from '../../../i18n';
import { textContent } from '../../../ui-helpers';
import { splitServicePeriods } from './shift-depot-stays.js';
import { toClockTime } from './shift-time-window.js';

export const initializeDepotStayControls = ({ form, readState, onAction }) => {
  const container = document.createElement('section');
  container.className = 'depot-stay-controls';
  container.dataset.role = 'depot-stay-controls';
  form.querySelector('.shift-details').before(container);
  const esc = textContent;
  const dirtyInputs = new WeakSet();
  const confirmedInputs = new WeakSet();
  let deferredRender = false;
  let disposed = false;
  let pointerInteraction = false;
  const timeField = (stay, index, field, key) => {
    const value = stay[field] || '';
    const day = Math.floor(Number(value.split(':')[0] || 0) / 24);
    const id = `stay-${index}-${field}`;
    return `<div class="depot-stay-time"><label for="${id}">${esc(t(key))}</label>
      <input type="time" id="${id}" data-stay-index="${index}" data-stay-field="${field}" value="${esc(toClockTime(value))}" step="60" aria-required="true">
      <select id="${id}-day" aria-label="${esc(t(key))} · ${esc(t('shifts.stay_day'))}" data-stay-index="${index}" data-stay-day="${field}">
        ${[0, 1].map(offset => `<option value="${offset}" ${day === offset ? 'selected' : ''}>${esc(t(offset ? 'shifts.stay_day_offset' : 'shifts.stay_same_day', { day: offset }))}</option>`).join('')}
      </select></div>`;
  };
  const render = () => {
    if (disposed || !container.isConnected) return;
    if (pointerInteraction) {
      deferredRender = true;
      return;
    }
    // Keep the native hour/minute editor, including an incomplete segment,
    // intact while it has focus. Restoring focus on a new node is not enough.
    if (container.contains(document.activeElement) && document.activeElement.matches('input[type="time"], button') && !confirmedInputs.has(document.activeElement)) {
      deferredRender = true;
      const { trips, stays, activePeriod } = readState();
      const periods = splitServicePeriods(trips, stays);
      container.querySelectorAll('[data-action="select-period"]').forEach((button, index) => {
        button.textContent = `${t('shifts.stay_period', { number: index + 1 })} · ${periods[index]?.trips.length || 0}`;
        button.setAttribute('aria-pressed', String(index === activePeriod));
      });
      const help = container.querySelector('[data-role="active-period-help"]');
      if (help) help.textContent = t('shifts.stay_active_help', { number: activePeriod + 1 });
      return;
    }
    deferredRender = false;
    const { trips, stays, depots, activePeriod, adjustmentPending, adjustmentError, adjustmentIndex, adjustmentSummary } = readState();
    const periods = splitServicePeriods(trips, stays);
    const candidates = periods[activePeriod].trips.filter(trip => !stays.some(stay => stay.afterTripId === trip.id));
    const active = document.activeElement;
    const focus = container.contains(active) ? active.id : '';
    container.innerHTML = `
      ${stays.length ? `<div class="service-periods" role="group" aria-label="${esc(t('shifts.stay_periods'))}">${periods.map((period, index) =>
        `<button type="button" data-action="select-period" data-period="${index}" aria-pressed="${index === activePeriod}">${esc(t('shifts.stay_period', { number: index + 1 }))} · ${period.trips.length}</button>`).join('')}</div>
        <p class="composer-help" data-role="active-period-help">${esc(t('shifts.stay_active_help', { number: activePeriod + 1 }))}</p>` : ''}
      ${stays.map((stay, index) => {
        const previous = trips.find(trip => trip.id === stay.afterTripId);
        return `<fieldset class="depot-stay" data-role="depot-stay" data-stay-index="${index}">
          <legend>${esc(t('shifts.stay_title', { number: index + 1 }))}</legend>
          <p>${esc(previous ? `${previous.arrival_time} · ${previous.end_stop_name}` : '')}</p>
          <div class="depot-stay-fields"><div><label for="stay-${index}-depot">${esc(t('shifts.stay_depot'))}</label>
          <select id="stay-${index}-depot" data-stay-index="${index}" data-stay-field="depotId" aria-required="true">
            <option value="">${esc(t('shifts.select_depot'))}</option>
            ${depots.map(depot => `<option value="${esc(depot.id)}" ${depot.id === stay.depotId ? 'selected' : ''}>${esc(depot.name)}</option>`).join('')}
          </select></div>
          ${timeField(stay, index, 'arrivalTime', 'shifts.stay_arrival')}
          ${timeField(stay, index, 'departureTime', 'shifts.stay_departure')}</div>
          <p class="composer-help" data-role="stay-time-help">${esc(t('shifts.stay_commit_hint'))}</p>
          ${adjustmentPending && adjustmentIndex === index ? `<p role="status">${esc(t('shifts.stay_adjusting'))}</p>` : ''}
          ${adjustmentError && adjustmentIndex === index ? `<p role="status">${esc(t(adjustmentError))}</p><button type="button" data-action="retry-stay-adjustment" data-stay-index="${index}">${esc(t('shifts.stay_retry'))}</button>` : ''}
          ${adjustmentSummary?.index === index && (adjustmentSummary.removedTrips.length || adjustmentSummary.adjustedTimes.length) ? `
            <div class="stay-adjustment-summary" data-role="stay-adjustment-summary" aria-live="polite">
              <p>${esc(t(adjustmentSummary.kind === 'trip-insertion' ? 'shifts.trip_replaced' : 'shifts.stay_adjusted', { count: adjustmentSummary.removedTrips.length }))}</p>
              ${adjustmentSummary.adjustedTimes.map(change => `<p>${esc(t('shifts.stay_time_limited', { field: t(change.field === 'arrivalTime' ? 'shifts.stay_arrival' : 'shifts.stay_departure'), requested: change.requested, applied: change.applied }))}</p>`).join('')}
              ${adjustmentSummary.removedTrips.length ? `<details><summary>${esc(t('shifts.stay_removed_trips'))}</summary><ul>${adjustmentSummary.removedTrips.map(trip => `<li>${esc(`${trip.departure_time} – ${trip.arrival_time} · ${trip.start_stop_name} → ${trip.end_stop_name}`)}</li>`).join('')}</ul></details>` : ''}
            </div>` : ''}
          <button type="button" data-action="remove-stay" data-stay-index="${index}">${esc(t('shifts.stay_remove'))}</button>
        </fieldset>`;
      }).join('')}
      <div class="depot-stay-add"><label for="stay-after-trip">${esc(t('shifts.stay_after'))}</label>
        <select id="stay-after-trip" ${!candidates.length ? 'disabled' : ''}>${candidates.map(trip =>
          `<option value="${esc(trip.id)}" ${trip === periods[activePeriod]?.trips.at(-1) ? 'selected' : ''}>${esc(`${trip.arrival_time} · ${trip.start_stop_name} → ${trip.end_stop_name}`)}</option>`).join('')}</select>
        <button type="button" data-action="add-stay" ${!candidates.length ? 'disabled' : ''}>${esc(t('shifts.stay_add'))}</button>
      </div>`;
    if (focus) container.querySelector(`#${CSS.escape(focus)}`)?.focus();
  };
  const click = event => {
    pointerInteraction = false;
    const button = event.target.closest('button[data-action]');
    if (!button) {
      if (deferredRender) queueMicrotask(render);
      return;
    }
    // A queued blur render must not replace a button before its click runs.
    confirmedInputs.add(button);
    onAction({ action: button.dataset.action, index: Number(button.dataset.stayIndex),
      period: Number(button.dataset.period), afterTripId: container.querySelector('#stay-after-trip').value });
  };
  const change = event => {
    const input = event.target;
    if (!input.matches('[data-stay-field], [data-stay-day]')) return;
    // A native change may arrive after focusout. Reopening the draft here
    // would invalidate the calculation that focusout has just committed.
    if (input.matches('input[type="time"]') && event.type === 'change') return;
    const field = input.dataset.stayField || input.dataset.stayDay;
    let value = input.value;
    if (field !== 'depotId') {
      const index = Number(input.dataset.stayIndex);
      const clock = container.querySelector(`[data-stay-index="${index}"][data-stay-field="${field}"]`).value;
      const day = Number(container.querySelector(`[data-stay-index="${index}"][data-stay-day="${field}"]`).value);
      value = clock ? `${String(Number(clock.split(':')[0]) + 24 * day).padStart(2, '0')}:${clock.split(':')[1]}` : '';
    }
    const timeInput = input.matches('input[type="time"]');
    if (timeInput && event.type !== 'focusout') {
      dirtyInputs.add(input);
      confirmedInputs.delete(input);
    }
    // Browsers can emit change for each completed hour/minute segment while
    // focus is still inside the time input. Only leaving the field commits it.
    onAction({ action: event.type === 'input' || (timeInput && event.type !== 'focusout') ? 'draft-stay' : 'change-stay', index: Number(input.dataset.stayIndex), field, value, explicitDay: Boolean(input.dataset.stayDay) });
  };
  const focusout = event => {
    const input = event.target;
    if (!input.matches('input[type="time"][data-stay-field]')) return;
    if (dirtyInputs.has(input)) {
      dirtyInputs.delete(input);
      change(event);
    }
    if (deferredRender) queueMicrotask(() => {
      if (!disposed && document.hasFocus()) render();
    });
  };
  const keydown = event => {
    if (event.key !== 'Enter' || !event.target.matches('input[type="time"][data-stay-field]')) return;
    event.preventDefault();
    const input = event.target;
    confirmedInputs.add(input);
    input.blur();
    // Mobile time controls can retain focus after blur(). Enter is still an
    // explicit confirmation and must not depend on a native focusout event.
    if (dirtyInputs.has(input)) {
      dirtyInputs.delete(input);
      change({ type: 'focusout', target: input });
    }
  };
  const pointerdown = () => { pointerInteraction = true; };
  const releasePointer = event => {
    if (event.type === 'pointercancel' || !container.contains(event.target)) {
      pointerInteraction = false;
      if (deferredRender) queueMicrotask(render);
    }
  };
  container.addEventListener('click', click);
  container.addEventListener('change', change);
  container.addEventListener('input', change);
  container.addEventListener('focusout', focusout);
  container.addEventListener('keydown', keydown, true);
  container.addEventListener('pointerdown', pointerdown);
  document.addEventListener('pointerup', releasePointer);
  document.addEventListener('pointercancel', releasePointer);
  return {
    render,
    acceptDraft: () => container.querySelectorAll('input[type="time"]').forEach(input => {
      if (!dirtyInputs.has(input)) return;
      dirtyInputs.delete(input);
      confirmedInputs.add(input);
    }),
    cleanup: () => { disposed = true; container.removeEventListener('click', click); container.removeEventListener('change', change); container.removeEventListener('input', change); container.removeEventListener('focusout', focusout); container.removeEventListener('keydown', keydown, true); container.removeEventListener('pointerdown', pointerdown); document.removeEventListener('pointerup', releasePointer); document.removeEventListener('pointercancel', releasePointer); container.remove(); },
  };
};
