import { t, I18N_CHANGE_EVENT } from '../../../i18n';

// Presentation only: eligibility, GTFS editions and persistence stay in shift-form.
export const initializeShiftComposer = ({ form, isEditMode, readState, validateTrips, updateFeedback, isTimetableReady = () => true, prepareReview = async () => true, onOpenStays = () => {}, onLeaveStays = () => {} }) => {
  const find = (selector) => form.querySelector(selector);
  const setup = find('.shift-config');
  const grid = find('.shift-form-grid');
  const available = find('.add-stops');
  const programme = find('.shift-stops');
  const review = find('[data-composer-panel="review"]');
  const timeline = find('.shift-timeline-section');
  const next = find('[data-action="composer-next"]');
  const back = find('[data-action="composer-back"]');
  const save = find('[type="submit"]');
  const steps = ['setup', 'compose', 'review'];
  let step = 'setup';
  let invalidSetup = null;
  let navigationRevision = 0;
  const requiredFields = new Map([
    ['shift-name', 'shifts.validation_name_required'],
    ['shift-bus', 'shifts.validation_bus_required'],
    ['shift-start-depot', 'shifts.validation_start_depot_required'],
    ['shift-start-time', 'shifts.validation_start_time_required'],
    ['shift-end-depot', 'shifts.validation_end_depot_required'],
    ['shift-end-time', 'shifts.validation_end_time_required'],
  ]);
  const dayOffset = document.createElement('small');
  dayOffset.setAttribute('aria-live', 'polite');
  dayOffset.dataset.role = 'composer-day-offset';
  find('#shift-end-time').after(dayOffset);

  // Put decisions where they are needed: depot limits in setup, GTFS filters
  // beside available trips, and the full timeline in the final review.
  const filters = document.createElement('div');
  filters.className = 'composer-filters';
  for (const id of ['scheduled-trips-line', 'scheduled-trips-day']) {
    filters.append(find(`#${id}`).closest('.form-group'));
  }
  available.querySelector('header').after(filters);
  for (const controls of programme.querySelectorAll('.shift-stops__controls')) {
    setup.append(controls);
  }
  grid.before(setup);
  grid.replaceChildren(available, programme);
  review.append(timeline);
  form.classList.add('shift-composer');

  const label = (id) => {
    const input = find(`#${id}`);
    return input?.selectedOptions?.[0]?.textContent || input?.value || '—';
  };
  const clearInvalidSetup = () => {
    if (!invalidSetup) return;
    invalidSetup.input.setCustomValidity('');
    invalidSetup.input.removeAttribute('aria-invalid');
    invalidSetup.input.removeAttribute('aria-errormessage');
    invalidSetup = null;
  };
  const setupErrorKey = (input, requiredKey) => {
    input.setCustomValidity('');
    if (input.validity.badInput) return 'shifts.validation_time_invalid';
    if (!input.value.trim()) return requiredKey;
    if (!input.validity.valid) return input.type === 'time' ? 'shifts.validation_time_invalid' : 'shifts.validation_value_invalid';
    return '';
  };
  const renderInvalidSetup = () => {
    if (!invalidSetup) return;
    const { input, key } = invalidSetup;
    input.setCustomValidity(t(key));
    input.setAttribute('aria-invalid', 'true');
    input.setAttribute('aria-errormessage', 'shift-form-feedback');
    updateFeedback(find('[data-role="feedback"]'), () => t(key), 'error');
  };
  const validateSetup = () => {
    clearInvalidSetup();
    for (const [id, requiredKey] of requiredFields) {
      const input = find(`#${id}`);
      const key = setupErrorKey(input, requiredKey);
      if (key) {
        invalidSetup = { input, key };
        show('setup');
        renderInvalidSetup();
        input.focus();
        input.reportValidity();
        return false;
      }
    }
    return true;
  };

  const update = () => {
    const { trips, activeTrips = trips, stays = [], depots = [], activePeriod = 0, activeBounds, adjusting = false } = readState();
    const count = t(trips.length === 1 ? 'shifts.composer_count_one' : 'shifts.composer_count', { count: trips.length });
    find('[data-role="composer-count"]').textContent = count;
    find('[data-role="composer-status"]').textContent = count;
    const last = activeTrips.at(-1);
    find('[data-role="composer-next"]').textContent = isEditMode ? t('shifts.editor_whole_day') : stays.length
      ? t('shifts.stay_period_candidates', { number: activePeriod + 1, start: activeBounds?.startTime || '—', end: activeBounds?.endTime || '—' })
      : last
      ? t('shifts.composer_next_from', { stop: last.end_stop_name || '—', time: last.arrival_time || '—' })
      : t('shifts.composer_first_trip');
    const summary = find('[data-role="composer-summary"]');
    const overnight = Boolean(find('#shift-start-time').value && find('#shift-end-time').value
      && find('#shift-end-time').value < find('#shift-start-time').value);
    dayOffset.textContent = overnight ? t('shifts.composer_next_day') : '';
    const values = [
      [t('shifts.field_shift_name'), find('#shift-name').value || '—'],
      [t('shifts.field_bus_model'), label('shift-bus')],
      [t('gtfs.label'), Array.from(find('[data-role="gtfs-dataset-summary"]').querySelectorAll('.gtfs-metadata > *'), node => node.textContent).join(' · ')],
      [t('shifts.stop_start_location_label'), `${label('shift-start-depot')} · ${find('#shift-start-time').value || '—'}`],
      [t('shifts.stop_return_location_label'), `${label('shift-end-depot')} · ${find('#shift-end-time').value || '—'}${overnight ? ` · ${t('shifts.composer_next_day')}` : ''}`],
    ];
    summary.replaceChildren();
    for (const [name, value] of values) {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = name;
      dd.textContent = value;
      summary.append(dt, dd);
    }
    let list = review.querySelector('.composer-itinerary');
    if (!list) {
      list = document.createElement('ol');
      list.className = 'composer-itinerary';
      summary.after(list);
    }
    list.replaceChildren(...trips.flatMap((trip) => {
      const li = document.createElement('li');
      li.textContent = `${trip.departure_time || '—'} – ${trip.arrival_time || '—'}   ${trip.start_stop_name || '—'} → ${trip.end_stop_name || '—'}`;
      const stay = stays.find(item => item.afterTripId === trip.id);
      if (!stay) return [li];
      const pause = document.createElement('li');
      pause.className = 'composer-itinerary__stay';
      pause.textContent = `${stay.arrivalTime || '—'} – ${stay.departureTime || '—'}   ${t('shifts.stay_review', { depot: depots.find(item => item.id === stay.depotId)?.name || '—' })}`;
      return [li, pause];
    }));
    const stayStep = find('[data-composer-step="stays"]');
    if (stayStep) {
      stayStep.hidden = !stays.length && step !== 'stays';
      find('[data-composer-step="review"] > span').textContent = stayStep.hidden ? '3' : '4';
    }
    next.disabled = step === 'compose' && trips.length === 0;
    next.setAttribute('aria-busy', String(adjusting));
    next.dataset.i18n = step === 'compose' ? 'shifts.composer_review' : 'shifts.composer_continue';
    next.textContent = t(next.dataset.i18n);
  };

  const show = (target, focus = true) => {
    const previous = step;
    if (previous === 'stays' && target !== 'stays') onLeaveStays();
    step = target;
    if (step === 'stays' && previous !== 'stays') onOpenStays();
    const stayPanel = find('[data-composer-panel="stays"]');
    if (stayPanel) stayPanel.hidden = step !== 'stays';
    find('.form-actions').hidden = step === 'stays';
    form.dataset.composerStep = step;
    setup.hidden = step !== 'setup';
    grid.hidden = step !== 'compose';
    review.hidden = step !== 'review';
    back.hidden = step === 'setup';
    next.hidden = step === 'review';
    save.hidden = step !== 'review';
    next.textContent = t(step === 'compose' ? 'shifts.composer_review' : 'shifts.composer_continue');
    for (const button of form.querySelectorAll('[data-composer-step]')) {
      if (button.dataset.composerStep === step) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
    update();
    if (focus) (step === 'setup' ? setup : step === 'compose' ? available : step === 'stays' ? stayPanel : review).querySelector('h2').focus();
    // The timeline needs its visible width, so ask the form to redraw it.
    form.dispatchEvent(new CustomEvent('composer:layout'));
  };
  const navigate = async (target) => {
    const revision = ++navigationRevision;
    if (target !== 'setup' && !validateSetup()) return;
    if (target !== 'setup' && !isTimetableReady()) {
      show('setup');
      return;
    }
    if (target === 'review' && !readState().trips.length) {
      show('compose');
      return;
    }
    if (target === 'review') {
      if (!await prepareReview() || revision !== navigationRevision) return;
      if (!checkTrips()) return;
    }
    updateFeedback(find('[data-role="feedback"]'), '');
    show(target);
  };
  const checkTrips = () => {
    const error = validateTrips();
    if (!error) return true;
    show('compose');
    updateFeedback(find('[data-role="feedback"]'), () => validateTrips(), 'error');
    return false;
  };
  const onClick = (event) => {
    const button = event.target.closest('button');
    if (button?.dataset.action === 'edit-stays') navigate('stays');
    if (button?.dataset.composerStep) navigate(button.dataset.composerStep);
    if (button === next) navigate(steps[steps.indexOf(step) + 1]);
    if (button === back) { navigationRevision++; show(steps[steps.indexOf(step) - 1]); }
  };
  form.addEventListener('click', onClick);
  form.addEventListener('change', update);
  const onValidationInput = event => {
    if (event.target !== invalidSetup?.input) return;
    const key = setupErrorKey(event.target, requiredFields.get(event.target.id));
    if (key) {
      invalidSetup.key = key;
      renderInvalidSetup();
    } else {
      clearInvalidSetup();
      updateFeedback(find('[data-role="feedback"]'), '');
    }
  };
  const onLanguageChange = () => {
    update();
    renderInvalidSetup();
  };
  form.addEventListener('input', onValidationInput);
  form.addEventListener('change', onValidationInput);
  document.addEventListener(I18N_CHANGE_EVENT, onLanguageChange);
  show('setup', false);
  return {
    update,
    showProgramme: () => { navigationRevision++; show('compose'); },
    ready: () => isEditMode ? show('compose', false) : update(),
    canSubmit: () => {
      if (step !== 'review') {
        navigate(step === 'setup' ? 'compose' : 'review');
        return false;
      }
      return validateSetup() && checkTrips();
    },
    cleanup: () => {
      navigationRevision++;
      form.removeEventListener('click', onClick);
      form.removeEventListener('change', update);
      form.removeEventListener('input', onValidationInput);
      form.removeEventListener('change', onValidationInput);
      document.removeEventListener(I18N_CHANGE_EVENT, onLanguageChange);
      clearInvalidSetup();
    },
  };
};
