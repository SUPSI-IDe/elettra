import { t, I18N_CHANGE_EVENT } from '../../../i18n';
import { textContent as esc } from '../../../ui-helpers';
import { serviceMinutes, serviceTime } from './shift-stay-adjustment.js';
import { toClockTime } from './shift-time-window.js';

// Draft controls never mutate the working programme. Only Apply publishes a
// complete proposal; async results never replace native time input elements.
export const initializeShiftStayEditor = ({ form, readState, propose, apply, close }) => {
  const entry = document.createElement('section');
  entry.className = 'stay-editor-entry';
  entry.dataset.role = 'stay-editor-entry';
  form.querySelector('.shift-details').before(entry);
  const nav = document.createElement('button');
  nav.type = 'button';
  nav.dataset.composerStep = 'stays';
  nav.hidden = true;
  nav.innerHTML = '<span>3</span><span data-i18n="shifts.editor_stays"></span>';
  form.querySelector('[data-composer-step="review"]').before(nav);
  const panel = document.createElement('section');
  panel.className = 'shift-form-card stay-editor';
  panel.dataset.composerPanel = 'stays';
  panel.hidden = true;
  panel.innerHTML = `<header class="section-header shift-form-card__header"><h2 tabindex="-1" data-i18n="shifts.editor_stays"></h2></header>
    <p class="composer-help" data-i18n="shifts.editor_help"></p>
    <p class="composer-help" data-role="stay-editor-scope"></p>
    <div data-role="stay-editor-fields"></div>
    <button type="button" class="list-secondary-action" data-action="editor-add-stay" data-i18n="shifts.stay_add"></button>
    <section class="stay-editor-preview" aria-live="polite" aria-busy="false">
      <h3 data-i18n="shifts.editor_preview"></h3>
      <p data-role="stay-editor-status" role="status"></p>
      <button type="button" class="list-secondary-action" data-action="editor-retry" data-i18n="shifts.stay_retry" hidden></button>
    <div class="stay-editor-actions"><button type="button" class="list-secondary-action" data-action="editor-cancel" data-i18n="common.cancel"></button>
    <button type="button" class="list-primary-action" data-action="editor-apply" data-i18n="shifts.editor_apply" disabled></button></div>
      <div data-role="stay-editor-changes"></div>
      <ol class="stay-editor-itinerary" data-role="stay-editor-itinerary"></ol>
    </section>
`;
  form.querySelector('[data-composer-panel="review"]').before(panel);
  const fields = panel.querySelector('[data-role="stay-editor-fields"]');
  const status = panel.querySelector('[data-role="stay-editor-status"]');
  const changes = panel.querySelector('[data-role="stay-editor-changes"]');
  const itinerary = panel.querySelector('[data-role="stay-editor-itinerary"]');
  const applyButton = panel.querySelector('[data-action="editor-apply"]');
  const retry = panel.querySelector('[data-action="editor-retry"]');
  let draft = [], result = null, revision = 0, timer, opened = false, disposed = false;
  const tripText = trip => `${trip.departure_time} – ${trip.arrival_time} · ${trip.start_stop_name} → ${trip.end_stop_name}`;
  const translate = () => {
    for (const node of panel.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n, { day: node.value || 1 });
    nav.lastElementChild.textContent = t('shifts.editor_stays');
    fields.querySelectorAll('fieldset').forEach((fieldset, index) => {
      fieldset.querySelector('legend').textContent = t('shifts.stay_title', { number: index + 1 });
      const remove = fieldset.querySelector('[data-action="editor-remove-stay"]');
      remove.textContent = t('shifts.stay_remove');
      for (const field of ['arrivalTime', 'departureTime']) {
        fieldset.querySelector(`[data-day="${field}"]`).setAttribute('aria-label', `${t(field === 'arrivalTime' ? 'shifts.stay_arrival' : 'shifts.stay_departure')} · ${t('shifts.stay_day')}`);
      }
      fieldset.querySelector('select[data-field="depotId"] option').textContent = t('shifts.select_depot');
    });
  };
  const render = () => {
    const { stays, depots, disabled, scope } = readState();
    entry.innerHTML = `<p>${esc(stays.length ? stays.map(stay => `${stay.arrivalTime} – ${stay.departureTime} · ${depots.find(stop => stop.id === stay.depotId)?.name || '—'}`).join(' / ') : t('shifts.editor_no_stays'))}</p>
      <button type="button" class="list-secondary-action" data-action="edit-stays" ${disabled ? 'disabled' : ''}>${esc(t(stays.length ? 'shifts.editor_manage' : 'shifts.stay_add'))}</button>`;
    panel.querySelector('[data-role="stay-editor-scope"]').textContent = scope || '';
    translate();
    if (opened) renderResult();
  };
  const timeField = (stay, index, field, key) => {
    const id = `editor-stay-${index}-${field}`;
    const day = Math.floor(serviceMinutes(stay[field]) / 1440) || 0;
    return `<div class="depot-stay-time"><label for="${id}" data-i18n="${key}">${esc(t(key))}</label>
      <input id="${id}" type="time" step="60" data-index="${index}" data-field="${field}" value="${esc(toClockTime(stay[field] || ''))}" aria-required="true">
      <select data-index="${index}" data-day="${field}" ${readState().overnight ? '' : 'hidden'} aria-label="${esc(t(key))} · ${esc(t('shifts.stay_day'))}">
        ${[0, 1].map(dayOffset => `<option value="${dayOffset}" ${day === dayOffset ? 'selected' : ''} data-i18n="${dayOffset ? 'shifts.stay_day_offset' : 'shifts.stay_same_day'}">${esc(t(dayOffset ? 'shifts.stay_day_offset' : 'shifts.stay_same_day', { day: dayOffset }))}</option>`).join('')}
      </select></div>`;
  };
  const renderFields = () => {
    const { depots } = readState();
    fields.innerHTML = draft.map((stay, index) => `<fieldset class="depot-stay"><legend>${esc(t('shifts.stay_title', { number: index + 1 }))}</legend>
      <div class="depot-stay-fields"><div><label for="editor-stay-${index}-depot" data-i18n="shifts.stay_depot">${esc(t('shifts.stay_depot'))}</label>
      <select id="editor-stay-${index}-depot" data-index="${index}" data-field="depotId" aria-required="true"><option value="">${esc(t('shifts.select_depot'))}</option>
      ${depots.map(stop => `<option value="${esc(stop.id)}" ${stop.id === stay.depotId ? 'selected' : ''}>${esc(stop.name)}</option>`).join('')}</select></div>
      ${timeField(stay, index, 'arrivalTime', 'shifts.stay_arrival')}${timeField(stay, index, 'departureTime', 'shifts.stay_departure')}</div>
      <button type="button" data-action="editor-remove-stay" data-index="${index}">${esc(t('shifts.stay_remove'))}</button></fieldset>`).join('');
  };
  const renderResult = () => {
    panel.querySelector('.stay-editor-preview').setAttribute('aria-busy', String(result?.status === 'loading'));
    applyButton.disabled = result?.status !== 'ready';
    retry.hidden = result?.status !== 'error';
    status.textContent = result?.status === 'ready'
      ? t('shifts.editor_changes', { added: result.addedTrips.length, removed: result.removedTrips.length })
      : t(result?.key || (result?.status === 'loading' ? 'shifts.stay_adjusting' : 'shifts.editor_complete_fields'), result || {});
    changes.replaceChildren();
    itinerary.replaceChildren();
    if (result?.status !== 'ready') return;
    const changeList = (trips, key, role) => trips.length ? `<details open data-role="${role}"><summary>${esc(t(key))}</summary><ul>${trips.map(trip => `<li>${esc(tripText(trip))}</li>`).join('')}</ul></details>` : '';
    changes.innerHTML = changeList(result.addedTrips, 'shifts.editor_added', 'stay-editor-added') + changeList(result.removedTrips, 'shifts.stay_removed_trips', 'stay-editor-removed');
    const added = new Set(result.addedTrips.map(trip => trip.id));
    for (const trip of result.trips) {
      const li = document.createElement('li');
      li.textContent = `${added.has(trip.id) ? `${t('shifts.editor_added')} · ` : ''}${tripText(trip)}`;
      if (added.has(trip.id)) li.className = 'stay-editor-added';
      itinerary.append(li);
      const stay = result.stays.find(item => item.afterTripId === trip.id);
      if (stay) {
        const pause = document.createElement('li');
        pause.className = 'stay-editor-pause';
        pause.textContent = `${stay.arrivalTime} – ${stay.departureTime} · ${depotsName(stay.depotId)}`;
        itinerary.append(pause);
      }
    }
  };
  const depotsName = id => readState().depots.find(stop => stop.id === id)?.name || '—';
  const calculate = async token => {
    if (disposed || !opened || token !== revision) return;
    let proposal;
    try { proposal = await propose(structuredClone(draft)); }
    catch { proposal = { status: 'error', key: 'shifts.stay_routing_error' }; }
    if (disposed || !opened || token !== revision) return;
    result = proposal;
    renderResult();
  };
  const schedule = () => {
    clearTimeout(timer);
    const token = ++revision;
    if (draft.some(stay => !stay.depotId || !Number.isFinite(serviceMinutes(stay.arrivalTime)) || !Number.isFinite(serviceMinutes(stay.departureTime)))) {
      result = { status: 'incomplete' };
      renderResult();
      return;
    }
    result = { status: 'loading' };
    renderResult();
    timer = setTimeout(() => void calculate(token), 200);
  };
  const input = event => {
    const node = event.target;
    if (!node.matches('[data-field], [data-day]')) return;
    if (event.type === 'change' && node.type === 'time') return;
    const index = Number(node.dataset.index), field = node.dataset.field || node.dataset.day;
    if (field === 'depotId') draft[index][field] = node.value;
    else {
      const clock = fields.querySelector(`[data-index="${index}"][data-field="${field}"]`).value;
      const day = Number(fields.querySelector(`[data-index="${index}"][data-day="${field}"]`).value);
      draft[index][field] = clock ? serviceTime(serviceMinutes(clock) + 1440 * day) : '';
    }
    schedule();
  };
  const click = event => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;
    switch (button.dataset.action) {
      case 'editor-add-stay': draft.push({ depotId: '', arrivalTime: '', departureTime: '' }); renderFields(); schedule(); break;
      case 'editor-remove-stay': draft.splice(Number(button.dataset.index), 1); renderFields(); schedule(); break;
      case 'editor-retry': schedule(); break;
      case 'editor-cancel': close(); break;
      case 'editor-apply': if (result?.status === 'ready') { apply(result); close(); } break;
    }
  };
  const keydown = event => {
    if (event.key === 'Enter' && event.target.matches('input, select')) event.preventDefault();
  };
  panel.addEventListener('input', input);
  panel.addEventListener('change', input);
  panel.addEventListener('click', click);
  panel.addEventListener('keydown', keydown);
  document.addEventListener(I18N_CHANGE_EVENT, render);
  return {
    render,
    open: () => {
      opened = true;
      const state = readState();
      draft = structuredClone(state.stays);
      result = { status: 'ready', trips: state.trips, stays: state.stays, addedTrips: [], removedTrips: [] };
      renderFields();
      render();
      if (!draft.length) { draft.push({ depotId: '', arrivalTime: '', departureTime: '' }); renderFields(); schedule(); }
    },
    leave: () => { opened = false; revision++; clearTimeout(timer); result = null; },
    cleanup: () => {
      disposed = true; revision++; clearTimeout(timer);
      panel.removeEventListener('input', input); panel.removeEventListener('change', input); panel.removeEventListener('click', click); panel.removeEventListener('keydown', keydown);
      document.removeEventListener(I18N_CHANGE_EVENT, render);
      entry.remove(); panel.remove(); nav.remove();
    },
  };
};
