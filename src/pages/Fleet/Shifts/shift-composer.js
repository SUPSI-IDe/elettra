import { t, I18N_CHANGE_EVENT } from '../../../i18n';
import { updateFeedback } from '../../../ui-helpers';

// Presentation only: eligibility, GTFS editions and persistence stay in shift-form.
export const initializeShiftComposer = ({ form, isEditMode, readState, validateTrips, isTimetableReady = () => true }) => {
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
  const validateSetup = () => {
    for (const id of ['shift-name', 'shift-bus', 'shift-start-depot', 'shift-start-time', 'shift-end-depot', 'shift-end-time']) {
      const input = find(`#${id}`);
      if (!input.value.trim() || !input.checkValidity()) {
        show('setup');
        if (!input.value.trim() && input.value) {
          updateFeedback(find('[data-role="feedback"]'), t('shifts.name_bus_required'), 'error');
        }
        input.focus();
        input.reportValidity();
        return false;
      }
    }
    return true;
  };

  const update = () => {
    const { trips } = readState();
    const count = t(trips.length === 1 ? 'shifts.composer_count_one' : 'shifts.composer_count', { count: trips.length });
    find('[data-role="composer-count"]').textContent = count;
    find('[data-role="composer-status"]').textContent = count;
    const last = trips.at(-1);
    find('[data-role="composer-next"]').textContent = last
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
    list.replaceChildren(...trips.map((trip) => {
      const li = document.createElement('li');
      li.textContent = `${trip.departure_time || '—'} – ${trip.arrival_time || '—'}   ${trip.start_stop_name || '—'} → ${trip.end_stop_name || '—'}`;
      return li;
    }));
    next.disabled = step === 'compose' && trips.length === 0;
    next.dataset.i18n = step === 'compose' ? 'shifts.composer_review' : 'shifts.composer_continue';
    next.textContent = t(next.dataset.i18n);
  };

  const show = (target, focus = true) => {
    step = target;
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
    if (focus) (step === 'setup' ? setup : step === 'compose' ? available : review).querySelector('h2').focus();
    // The timeline needs its visible width, so ask the form to redraw it.
    form.dispatchEvent(new CustomEvent('composer:layout'));
  };
  const navigate = (target) => {
    if (target !== 'setup' && !validateSetup()) return;
    if (target !== 'setup' && !isTimetableReady()) {
      show('setup');
      return;
    }
    if (target === 'review' && !readState().trips.length) {
      show('compose');
      return;
    }
    if (target === 'review' && !checkTrips()) return;
    updateFeedback(find('[data-role="feedback"]'), '');
    show(target);
  };
  const checkTrips = () => {
    const error = validateTrips();
    if (!error) return true;
    show('compose');
    updateFeedback(find('[data-role="feedback"]'), error, 'error');
    return false;
  };
  const onClick = (event) => {
    const button = event.target.closest('button');
    if (button?.dataset.composerStep) navigate(button.dataset.composerStep);
    if (button === next) navigate(steps[steps.indexOf(step) + 1]);
    if (button === back) show(steps[steps.indexOf(step) - 1]);
  };
  form.addEventListener('click', onClick);
  form.addEventListener('change', update);
  document.addEventListener(I18N_CHANGE_EVENT, update);
  show('setup', false);
  return {
    update,
    ready: () => isEditMode ? show('compose', false) : update(),
    canSubmit: () => {
      if (step !== 'review') {
        navigate(step === 'setup' ? 'compose' : 'review');
        return false;
      }
      return validateSetup() && checkTrips();
    },
    cleanup: () => {
      form.removeEventListener('click', onClick);
      form.removeEventListener('change', update);
      document.removeEventListener(I18N_CHANGE_EVENT, update);
    },
  };
};
