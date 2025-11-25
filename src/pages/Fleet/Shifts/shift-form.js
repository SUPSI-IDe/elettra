import './shifts.css';
import {
    createShift,
    fetchBuses,
    fetchBusById,
    fetchDepots,
    fetchRoutes,
    fetchShiftById,
    fetchStopsByTripId,
    fetchTripsByRoute,
    updateShift,
} from '../../../api';
import { resolveUserId } from '../../../auth';
import { triggerPartialLoad } from '../../../events';
import { getOwnedBuses, setOwnedBuses } from '../../../store';
import { textContent, toggleFormDisabled, updateFeedback } from '../../../ui-helpers';

const text = (value) =>
    value === null || value === undefined ? '' : String(value);

const firstAvailable = (...values) => {
    for (const value of values) {
        const result = text(value).trim();
        if (result) {
            return result;
        }
    }
    return '';
};

const normalizeTime = (value) => {
    const raw = firstAvailable(value);
    if (!raw) {
        return '';
    }

    if (raw.includes('T')) {
        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) {
            const hours = String(parsed.getHours()).padStart(2, '0');
            const minutes = String(parsed.getMinutes()).padStart(2, '0');
            return `${hours}:${minutes}`;
        }
    }

    const timeMatch = raw.match(/^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (timeMatch) {
        const hours = String(Number.parseInt(timeMatch[1], 10)).padStart(2, '0');
        const minutes = timeMatch[2];
        return `${hours}:${minutes}`;
    }

    return raw;
};

const resolveStopNameFromTimes = (times = [], position = 'first') => {
    if (!Array.isArray(times) || times.length === 0) {
        return '';
    }

    const index = position === 'last' ? times.length - 1 : 0;
    const entry = times[index] ?? {};

    return firstAvailable(
        entry?.stop_name,
        entry?.stopName,
        entry?.name,
        entry?.stop?.name,
        entry?.stop?.stop_name,
        entry?.stop?.label,
    );
};

const resolveRouteLabel = (trip = {}, fallbackLabel = '') =>
    firstAvailable(
        trip?.route_label,
        trip?.routeLabel,
        trip?.route_short_name,
        trip?.routeShortName,
        trip?.route_long_name,
        trip?.routeLongName,
        trip?.route?.label,
        trip?.route?.name,
        trip?.route?.route_short_name,
        trip?.route?.route_long_name,
        trip?.route?.short_name,
        trip?.route?.long_name,
        trip?.trip_headsign,
        fallbackLabel,
    );

const resolveRouteId = (trip = {}) =>
    firstAvailable(
        trip?.route_id,
        trip?.routeId,
        trip?.route?.id,
        trip?.route?.route_id,
        trip?.trip?.route_id,
        trip?.trip?.routeId,
        trip?.trip?.route?.id,
        trip?.trip?.route?.route_id,
    );

const resolveTripId = (trip = {}) =>
    firstAvailable(trip?.trip_id, trip?.tripId, trip?.id);

const normalizeTrip = (trip = {}) => {
    const stopTimes =
        Array.isArray(trip?.stop_times) && trip.stop_times.length > 0
            ? trip.stop_times
            : Array.isArray(trip?.trip?.stop_times) && trip.trip.stop_times.length > 0
            ? trip.trip.stop_times
            : [];

    const stops =
        Array.isArray(trip?.stops) && trip.stops.length > 0
            ? trip.stops
            : Array.isArray(trip?.trip?.stops) && trip.trip.stops.length > 0
            ? trip.trip.stops
            : [];

    const startStop =
        trip?.start_stop ??
        trip?.startStop ??
        trip?.origin_stop ??
        trip?.originStop ??
        trip?.origin ??
        trip?.trip?.start_stop ??
        trip?.trip?.startStop ??
        {};

    const endStop =
        trip?.end_stop ??
        trip?.endStop ??
        trip?.destination_stop ??
        trip?.destinationStop ??
        trip?.destination ??
        trip?.trip?.end_stop ??
        trip?.trip?.endStop ??
        {};

    const id = resolveTripId(trip);
    const routeId = resolveRouteId(trip);

    const startName = firstAvailable(
        trip?.start_stop_name,
        trip?.startStopName,
        startStop?.name,
        startStop?.label,
        startStop?.stop_name,
        startStop?.stop?.name,
        resolveStopNameFromTimes(stopTimes, 'first'),
        resolveStopNameFromTimes(stops, 'first'),
    );

    const endName = firstAvailable(
        trip?.end_stop_name,
        trip?.endStopName,
        endStop?.name,
        endStop?.label,
        endStop?.stop_name,
        endStop?.stop?.name,
        resolveStopNameFromTimes(stopTimes, 'last'),
        resolveStopNameFromTimes(stops, 'last'),
    );

    const departureTime = normalizeTime(
        firstAvailable(
            trip?.departure_time,
            trip?.departureTime,
            trip?.start_time,
            trip?.startTime,
            trip?.time,
            trip?.trip?.departure_time,
            trip?.trip?.departureTime,
            trip?.trip?.start_time,
            trip?.trip?.startTime,
            stopTimes[0]?.departure_time,
            stopTimes[0]?.departureTime,
        ),
    );

    const arrivalTime = normalizeTime(
        firstAvailable(
            trip?.arrival_time,
            trip?.arrivalTime,
            trip?.end_time,
            trip?.endTime,
            trip?.trip?.arrival_time,
            trip?.trip?.arrivalTime,
            trip?.trip?.end_time,
            trip?.trip?.endTime,
            stopTimes[stopTimes.length - 1]?.arrival_time,
            stopTimes[stopTimes.length - 1]?.arrivalTime,
        ),
    );

    const routeLabel = resolveRouteLabel(trip);

    return {
        ...trip,
        id,
        trip_id: id,
        route_id: routeId,
        route_label: routeLabel,
        start_stop_name: startName,
        end_stop_name: endName,
        departure_time: departureTime,
        arrival_time: arrivalTime,
    };
};


const DAYS_OF_WEEK = [
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' },
];

const clearNode = (node) => {
    if (!node) {
        return;
    }
    node.innerHTML = '';
};

const updateEmptyState = (element, hasItems, message) => {
    if (!element) {
        return;
    }

    if (hasItems) {
        element.hidden = true;
        return;
    }

    if (typeof message === 'string' && message.length > 0) {
        element.textContent = message;
    }
    element.hidden = false;
};

const renderTripsLoading = (tbody) => {
    if (!tbody) {
        return;
    }

    tbody.innerHTML = `
        <tr>
            <td class="time" colspan="4">Loading…</td>
        </tr>
    `;
};

const renderShiftTrips = (tbody, trips = []) => {
    if (!tbody) {
        return;
    }

    if (!Array.isArray(trips) || trips.length === 0) {
        clearNode(tbody);
        return;
    }

    const rows = trips
        .map((trip = {}) => {
            const time = text(trip?.departure_time ?? trip?.departureTime ?? '');
            const start = text(trip?.start_stop_name ?? trip?.startStopName ?? '');
            const end = text(trip?.end_stop_name ?? trip?.endStopName ?? '');

            return `
                <tr data-trip-id="${text(trip?.id ?? trip?.trip_id ?? '')}">
                    <td class="time">${textContent(time || '—')}</td>
                    <td class="route">${textContent(
                        start && end ? `${start} – ${end}` : start || end || '—',
                    )}</td>
                    <td class="actions">
                        <button type="button" data-action="remove-trip">Remove</button>
                    </td>
                </tr>
            `;
        })
        .join('');

    tbody.innerHTML = rows;
};

const renderScheduledTrips = ({
    tbody,
    trips = [],
    routeLabel = '',
    selectedTripIds = new Set(),
}) => {
    if (!tbody) {
        return;
    }

    if (!Array.isArray(trips) || trips.length === 0) {
        clearNode(tbody);
        return;
    }

    const rows = trips
        .map((trip = {}) => {
            const normalized = normalizeTrip(trip);
            const id = resolveTripId(normalized);
            const time = text(
                normalized?.departure_time ?? normalized?.departureTime ?? '',
            );
            const start = text(
                normalized?.start_stop_name ?? normalized?.startStopName ?? '',
            );
            const end = text(
                normalized?.end_stop_name ?? normalized?.endStopName ?? '',
            );
            const disabled = selectedTripIds.has(id) ? 'disabled' : '';
            const currentRouteLabel =
                routeLabel || resolveRouteLabel(normalized) || '—';

            return `
                <tr data-trip-id="${id}">
                    <td class="time">${textContent(time || '—')}</td>
                    <td class="line">${textContent(currentRouteLabel)}</td>
                    <td class="route">${textContent(
                        start && end ? `${start} – ${end}` : start || end || '—',
                    )}</td>
                    <td class="actions">
                        <button type="button" data-action="add-trip" ${disabled}>Add</button>
                    </td>
                </tr>
            `;
        })
        .join('');

    tbody.innerHTML = rows;
};

const readTripId = (node) => node?.dataset?.tripId?.trim() ?? '';

const buildShiftPayload = ({ form, selectedTrips }) => {
    const formData = new FormData(form);
    const name = formData.get('name')?.toString().trim();
    const busId = formData.get('busId')?.toString().trim();
    const tripIds = selectedTrips.map((trip) => resolveTripId(trip) ?? '');

    return { name, busId, tripIds };
};

const renderRouteOptions = (select, routes = []) => {
    if (!select) {
        return {};
    }

    const map = {};
    const seenLabels = new Set();
    const options = [
        '<option value="">All lines</option>',
        ...routes
            .filter((route) => route && route.id)
            .map((route) => {
                const id = String(route.id);
                const shortName = text(route?.route_short_name ?? '');
                const longName = text(route?.route_long_name ?? '');
                const label = shortName || longName || `Route ${id}`;
                if (seenLabels.has(label)) {
                    return null;
                }
                seenLabels.add(label);
                map[id] = label;
                return `<option value="${id}">${textContent(label)}</option>`;
            })
            .filter(Boolean),
    ].join('');

    select.innerHTML = options;
    return map;
};

const renderBusOptions = (select, buses = []) => {
    if (!select) {
        return;
    }

    const options = [
        '<option value="">Select a bus</option>',
        ...buses
            .filter((bus) => bus && bus.id)
            .map(
                (bus) =>
                    `<option value="${text(bus.id)}">${textContent(
                        bus?.name ?? bus?.label ?? `Bus ${bus.id}`,
                    )}</option>`,
            ),
    ].join('');

    select.innerHTML = options;
};

const renderDepotOptions = (select, depots = []) => {
    if (!select) {
        return;
    }

    const options = [
        '<option value="">Select a depot</option>',
        ...depots
            .filter((depot) => depot && depot.id)
            .map(
                (depot) =>
                    `<option value="${text(depot.id)}">${textContent(
                        depot?.name ?? depot?.label ?? `Depot ${depot.id}`,
                    )}</option>`,
            ),
    ].join('');

    select.innerHTML = options;
};

const populateDayOptions = (select) => {
    if (!select) {
        return;
    }

    const options = [
        '<option value="">All days</option>',
        ...DAYS_OF_WEEK.map(
            (day) =>
                `<option value="${day.value}">${textContent(day.label)}</option>`,
        ),
    ].join('');

    select.innerHTML = options;
};

const toTripFromStructure = (item = {}) => {
    const trip = item?.trip ?? {};
    const combined = { ...item, ...trip, trip };
    const normalized = normalizeTrip(combined);
    return normalized?.trip_id ? normalized : null;
};

const readShiftTripsFromStructure = (shift = {}) => {
    const structure = Array.isArray(shift?.structure) ? shift.structure : [];
    if (structure.length === 0) {
        return [];
    }
    return structure.map(toTripFromStructure).filter(Boolean);
};

const hydrateShift = async (shift) => {
    if (!shift || !Array.isArray(shift.structure) || shift.structure.length === 0) {
        return shift;
    }

    const structure = await Promise.all(
        shift.structure.map(async (item) => {
            if (!item.trip_id) {
                return item;
            }
            try {
                const stopTimes = await fetchStopsByTripId(item.trip_id);
                return {
                    ...item,
                    stop_times: stopTimes,
                    trip: {
                        ...(item.trip || {}),
                        stop_times: stopTimes,
                    },
                };
            } catch (error) {
                console.error(`Failed to load stops for trip ${item.trip_id}`, error);
                return item;
            }
        }),
    );

    return { ...shift, structure };
};

export const initializeShiftForm = async (root = document, options = {}) => {
    const section = root.querySelector('section.shift-form');
    if (!section) {
        return;
    }

    const form = section.querySelector('form[data-form="shift-form"]');
    if (!form) {
        return;
    }

    const mode = options.mode === 'edit' ? 'edit' : 'create';
    const shiftId =
        mode === 'edit' ? text(options.shiftId ?? options.shift_id ?? '') : '';
    const isEditMode = mode === 'edit' && Boolean(shiftId);

    const feedback = form.querySelector('[data-role="feedback"]');
    const cancelButton = form.querySelector('[data-action="cancel"]');
    const visualizeButton = form.querySelector(
        '[data-action="visualize-shift"]',
    );

    const nameInput = form.querySelector('#shift-name');
    const busSelect = form.querySelector('#shift-bus');
    const startTimeInput = form.querySelector('#shift-start-time');
    const endTimeInput = form.querySelector('#shift-end-time');

    const lineSelect = form.querySelector('[data-filter="line"]');
    const daySelect = form.querySelector('[data-filter="day"]');
    const startDepotSelect = form.querySelector('[data-field="start-depot"]');
    const endDepotSelect = form.querySelector('[data-field="end-depot"]');
    const scheduledTripsBody = form.querySelector(
        'tbody[data-role="scheduled-trips-body"]',
    );
    const scheduledTripsEmpty = form.querySelector(
        '[data-role="scheduled-trips-empty"]',
    );

    const shiftTripsBody = form.querySelector(
        'tbody[data-role="shift-trips-body"]',
    );
    const shiftTripsEmpty = form.querySelector(
        '[data-role="shift-trips-empty"]',
    );

    populateDayOptions(daySelect);

    const title = section.querySelector('header h1');
    const submitButton = form.querySelector('button[type="submit"]');

    if (title) {
        title.textContent = isEditMode ? 'Edit Shift' : 'Add Shift';
    }

    if (submitButton) {
        submitButton.textContent = isEditMode ? 'Update shift' : 'Save shift';
    }

    section.dataset.mode = isEditMode ? 'edit' : 'create';
    form.dataset.mode = isEditMode ? 'edit' : 'create';
    if (shiftId) {
        form.dataset.shiftId = shiftId;
    } else {
        delete form.dataset.shiftId;
    }

    let routesById = {};
    let currentTrips = [];
    const selectedTripIds = new Set();
    let selectedTrips = [];

    const ensureTimesFromSelected = ({ force = false } = {}) => {
        const readTimes = (project) =>
            selectedTrips
                .map((trip = {}) => normalizeTime(project(trip)).trim())
                .filter((value) => value.length > 0);

        if (startTimeInput instanceof HTMLInputElement) {
            if (force || !startTimeInput.value) {
                const departureTimes = readTimes(
                    (trip) => trip?.departure_time ?? trip?.departureTime ?? '',
                );
                if (departureTimes.length > 0) {
                    const earliest = [...departureTimes].sort((a, b) =>
                        a.localeCompare(b),
                    )[0];
                    startTimeInput.value = earliest;
                }
            }
        }

        if (endTimeInput instanceof HTMLInputElement) {
            if (force || !endTimeInput.value) {
                const arrivalTimes = readTimes(
                    (trip) =>
                        trip?.arrival_time ??
                        trip?.arrivalTime ??
                        trip?.end_time ??
                        trip?.endTime ??
                        trip?.departure_time ??
                        trip?.departureTime ??
                        '',
                );
                if (arrivalTimes.length > 0) {
                    const latest = [...arrivalTimes].sort((a, b) =>
                        a.localeCompare(b),
                    ).pop();
                    endTimeInput.value = latest;
                }
            }
        }
    };

    const updateShiftTrips = () => {
        renderShiftTrips(shiftTripsBody, selectedTrips);
        updateEmptyState(shiftTripsEmpty, selectedTrips.length > 0);
    };

    const syncSelectedTripsWithCurrent = () => {
        if (!Array.isArray(selectedTrips) || selectedTrips.length === 0) {
            return;
        }

        let changed = false;

        selectedTrips = selectedTrips.map((trip = {}) => {
            const id = resolveTripId(trip);
            if (!id) {
                return trip;
            }
            const current = currentTrips.find(
                (candidate = {}) => resolveTripId(candidate) === id,
            );
            if (!current) {
                const normalized = normalizeTrip(trip);
                if (normalized !== trip) {
                    changed = true;
                }
                return normalized;
            }
            const merged = normalizeTrip({
                ...trip,
                ...current,
                trip: current.trip ?? trip.trip,
            });
            if (merged !== trip) {
                changed = true;
            }
            return merged;
        });

        if (changed) {
            updateShiftTrips();
            ensureTimesFromSelected({ force: false });
        }
    };

    const addTrip = (trip) => {
        const normalized = normalizeTrip(trip);
        const id = resolveTripId(normalized);
        if (!id || selectedTripIds.has(id)) {
            return;
        }
        selectedTripIds.add(id);
        selectedTrips = [...selectedTrips, normalized];
        updateShiftTrips();
        ensureTimesFromSelected();
        renderScheduledTrips({
            tbody: scheduledTripsBody,
            trips: currentTrips,
            routeLabel: routesById[lineSelect?.value ?? ''] ?? '',
            selectedTripIds,
        });
    };

    const removeTrip = (id) => {
        if (!selectedTripIds.has(id)) {
            return;
        }
        selectedTripIds.delete(id);
        selectedTrips = selectedTrips.filter((trip = {}) => {
            const tripId = resolveTripId(trip);
            return tripId && tripId !== id;
        });
        updateShiftTrips();
        ensureTimesFromSelected({ force: true });
        renderScheduledTrips({
            tbody: scheduledTripsBody,
            trips: currentTrips,
            routeLabel: routesById[lineSelect?.value ?? ''] ?? '',
            selectedTripIds,
        });
    };

    const prefillSelectValue = (select, value, fallbackLabel) => {
        if (!(select instanceof HTMLSelectElement)) {
            return;
        }
        const candidate = text(value);
        if (!candidate) {
            return;
        }
        select.value = candidate;
        if (select.value === candidate) {
            return;
        }
        const option = document.createElement('option');
        option.value = candidate;
        option.textContent = fallbackLabel
            ? textContent(fallbackLabel)
            : textContent(candidate);
        select.append(option);
        select.value = candidate;
    };

    const applyShiftPrefill = (shift = {}) => {
        const name = firstAvailable(shift?.name);
        if (nameInput instanceof HTMLInputElement && name) {
            nameInput.value = name;
        }

        const busId = firstAvailable(
            shift?.bus_id,
            shift?.busId,
            shift?.bus?.id,
            shift?.bus?.bus_id,
        );
        prefillSelectValue(
            busSelect,
            busId,
            shift?.bus?.name ?? shift?.bus_name ?? shift?.busName ?? '',
        );

        const startTime = normalizeTime(
            firstAvailable(
                shift?.start_time,
                shift?.startTime,
                shift?.start?.time,
                shift?.start?.scheduled_time,
                shift?.start?.scheduledTime,
                shift?.start?.planned_time,
                shift?.start?.plannedTime,
            ),
        );
        if (startTimeInput instanceof HTMLInputElement && startTime) {
            startTimeInput.value = startTime;
        }

        const endTime = normalizeTime(
            firstAvailable(
                shift?.end_time,
                shift?.endTime,
                shift?.end?.time,
                shift?.end?.scheduled_time,
                shift?.end?.scheduledTime,
                shift?.end?.planned_time,
                shift?.end?.plannedTime,
            ),
        );
        if (endTimeInput instanceof HTMLInputElement && endTime) {
            endTimeInput.value = endTime;
        }

        const startDepotId = firstAvailable(
            shift?.start_depot_id,
            shift?.startDepotId,
            shift?.start_depot?.id,
            shift?.start_depot,
            shift?.startDepot,
        );
        prefillSelectValue(
            startDepotSelect,
            startDepotId,
            shift?.start_depot?.name ?? shift?.startDepotName ?? '',
        );

        const endDepotId = firstAvailable(
            shift?.end_depot_id,
            shift?.endDepotId,
            shift?.end_depot?.id,
            shift?.end_depot,
            shift?.endDepot,
        );
        prefillSelectValue(
            endDepotSelect,
            endDepotId,
            shift?.end_depot?.name ?? shift?.endDepotName ?? '',
        );

        const trips = readShiftTripsFromStructure(shift);
        selectedTrips = trips;
        selectedTripIds.clear();
        trips.forEach((trip = {}) => {
            const id = resolveTripId(trip);
            if (id) {
                selectedTripIds.add(id);
            }
        });

        if (lineSelect instanceof HTMLSelectElement) {
            const firstTrip = trips[0] ?? {};
            const routeId = firstAvailable(
                shift?.route_id,
                shift?.routeId,
                shift?.route?.id,
                firstTrip?.route_id,
                firstTrip?.routeId,
                firstTrip?.route?.id,
                firstTrip?.trip?.route_id,
                firstTrip?.trip?.routeId,
            );
            if (routeId) {
                prefillSelectValue(
                    lineSelect,
                    routeId,
                    routesById[routeId] ??
                        shift?.route?.name ??
                        shift?.route_name ??
                        shift?.routeName ??
                        firstAvailable(
                            firstTrip?.route_name,
                            firstTrip?.routeName,
                            firstTrip?.route?.name,
                        ),
                );
            }
        }

        if (daySelect instanceof HTMLSelectElement) {
            const firstTrip = selectedTrips[0] ?? {};
            const rawDay = firstAvailable(
                shift?.day_of_week,
                shift?.dayOfWeek,
                shift?.service_day,
                shift?.serviceDay,
                shift?.day,
                firstTrip?.day_of_week,
                firstTrip?.dayOfWeek,
            );
            if (rawDay) {
                const normalized = rawDay.toLowerCase();
                const label =
                    rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase();
                prefillSelectValue(daySelect, normalized, label);
            }
        }

        updateShiftTrips();
        const shouldForceTimes =
            (startTimeInput instanceof HTMLInputElement &&
                !startTimeInput.value) ||
            (endTimeInput instanceof HTMLInputElement && !endTimeInput.value);
        ensureTimesFromSelected({ force: shouldForceTimes });
        renderScheduledTrips({
            tbody: scheduledTripsBody,
            trips: currentTrips,
            routeLabel: routesById[lineSelect?.value ?? ''] ?? '',
            selectedTripIds,
        });

        if (
            lineSelect instanceof HTMLSelectElement &&
            daySelect instanceof HTMLSelectElement &&
            lineSelect.value &&
            daySelect.value
        ) {
            loadTrips();
        }
    };

    const loadBuses = async () => {
        const cached = getOwnedBuses();
        if (Array.isArray(cached) && cached.length > 0) {
            renderBusOptions(busSelect, cached);
            return;
        }

        try {
            const [payload, userId] = await Promise.all([
                fetchBuses({ skip: 0, limit: 100 }),
                resolveUserId().catch(() => null),
            ]);

            const buses = Array.isArray(payload)
                ? payload
                : payload?.items ?? payload?.results ?? [];

            const filtered =
                userId && Array.isArray(buses)
                    ? buses.filter((bus) => bus?.user_id === userId)
                    : buses ?? [];

            setOwnedBuses(filtered);
            renderBusOptions(busSelect, filtered);
        } catch (error) {
            console.error('Failed to load buses', error);
            renderBusOptions(busSelect, []);
            updateFeedback(
                feedback,
                error?.message ?? 'Unable to load buses.',
                'error',
            );
        }
    };

    const loadDepots = async () => {
        if (!startDepotSelect && !endDepotSelect) {
            return;
        }

        try {
            const [payload, userId] = await Promise.all([
                fetchDepots({ skip: 0, limit: 100 }),
                resolveUserId().catch(() => null),
            ]);

            const depots = Array.isArray(payload)
                ? payload
                : payload?.items ?? payload?.results ?? [];

            const filtered =
                userId && Array.isArray(depots)
                    ? depots.filter((depot) => depot?.user_id === userId)
                    : depots ?? [];

            renderDepotOptions(startDepotSelect, filtered);
            renderDepotOptions(endDepotSelect, filtered);
        } catch (error) {
            console.error('Failed to load depots', error);
            renderDepotOptions(startDepotSelect, []);
            renderDepotOptions(endDepotSelect, []);
            updateFeedback(
                feedback,
                error?.message ?? 'Unable to load depots.',
                'error',
            );
        }
    };

    const loadRoutes = async () => {
        try {
            const payload = await fetchRoutes({ skip: 0, limit: 100 });
            const routes = Array.isArray(payload)
                ? payload
                : payload?.items ?? payload?.results ?? [];
            routesById = renderRouteOptions(lineSelect, routes);
        } catch (error) {
            console.error('Failed to load routes', error);
            routesById = renderRouteOptions(lineSelect, []);
            updateFeedback(
                feedback,
                error?.message ?? 'Unable to load routes.',
                'error',
            );
        }
    };

    const loadTrips = async () => {
        if (!lineSelect || !daySelect || !scheduledTripsBody) {
            return;
        }

        const routeId = lineSelect.value;
        const day = daySelect.value;

        if (!routeId || !day) {
            currentTrips = [];
            clearNode(scheduledTripsBody);
            updateEmptyState(
                scheduledTripsEmpty,
                false,
                'Select a line and day to view trips.',
            );
            return;
        }

        renderTripsLoading(scheduledTripsBody);
        updateEmptyState(scheduledTripsEmpty, true);

        try {
            const payload = await fetchTripsByRoute({
                routeId,
                dayOfWeek: day,
            });
            const trips = Array.isArray(payload)
                ? payload
                : payload?.items ?? payload?.results ?? [];
            currentTrips = Array.isArray(trips)
                ? trips
                      .map((trip) => normalizeTrip(trip))
                      .filter((trip) => resolveTripId(trip))
                : [];
            renderScheduledTrips({
                tbody: scheduledTripsBody,
                trips: currentTrips,
                routeLabel: routesById[routeId] ?? '',
                selectedTripIds,
            });
            syncSelectedTripsWithCurrent();
            updateEmptyState(
                scheduledTripsEmpty,
                currentTrips.length > 0,
                'No trips match the current filters.',
            );
        } catch (error) {
            console.error('Failed to load trips', error);
            currentTrips = [];
            clearNode(scheduledTripsBody);
            updateEmptyState(
                scheduledTripsEmpty,
                false,
                error?.message ?? 'Unable to load trips.',
            );
        }
    };

    const handleScheduledTripsClick = (event) => {
        const button = event.target?.closest?.('button[data-action="add-trip"]');
        if (!button || button.disabled) {
            return;
        }

        const row = button.closest('tr');
        const id = readTripId(row);
        if (!id) {
            return;
        }

        const trip = currentTrips.find((item = {}) => {
            const tripId = text(item?.id ?? item?.trip_id ?? '');
            return tripId === id;
        });

        if (trip) {
            addTrip(trip);
        }
    };

    const handleShiftTripsClick = (event) => {
        const button = event.target?.closest?.('button[data-action="remove-trip"]');
        if (!button) {
            return;
        }

        const row = button.closest('tr');
        const id = readTripId(row);
        if (!id) {
            return;
        }

        removeTrip(id);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        updateFeedback(feedback, '');

        const { name, busId, tripIds } = buildShiftPayload({
            form,
            selectedTrips,
        });

        if (!name || !busId) {
            updateFeedback(
                feedback,
                'Shift name and bus are required.',
                'error',
            );
            return;
        }

        if (!Array.isArray(tripIds) || tripIds.length === 0) {
            updateFeedback(
                feedback,
                'Add at least one trip to the shift.',
                'error',
            );
            return;
        }

        toggleFormDisabled(form, true);
        updateFeedback(
            feedback,
            isEditMode ? 'Updating…' : 'Saving…',
            'info',
        );

        try {
            if (isEditMode) {
                await updateShift(shiftId, { name, busId, tripIds });
                updateFeedback(feedback, 'Shift updated.', 'success');
                triggerPartialLoad('shifts', {
                    flashMessage: 'Shift updated.',
                });
                return;
            }

            await createShift({ name, busId, tripIds });
            updateFeedback(feedback, 'Shift created.', 'success');
            triggerPartialLoad('shifts', { flashMessage: 'Shift created.' });
        } catch (error) {
            console.error(
                isEditMode ? 'Failed to update shift' : 'Failed to create shift',
                error,
            );
            updateFeedback(
                feedback,
                error?.message ??
                    (isEditMode ? 'Unable to update shift.' : 'Unable to save shift.'),
                'error',
            );
        } finally {
            toggleFormDisabled(form, false);
        }
    };

    const handleVisualize = (event) => {
        event.preventDefault();

        const payload = {
            mode,
            shiftId,
            name: nameInput instanceof HTMLInputElement ? nameInput.value : '',
            busId: busSelect instanceof HTMLSelectElement ? busSelect.value : '',
            busName:
                busSelect instanceof HTMLSelectElement
                    ? busSelect.selectedOptions?.[0]?.text ?? ''
                    : '',
            startTime:
                startTimeInput instanceof HTMLInputElement ? startTimeInput.value : '',
            startDepotId:
                startDepotSelect instanceof HTMLSelectElement
                    ? startDepotSelect.value
                    : '',
            startDepotName:
                startDepotSelect instanceof HTMLSelectElement
                    ? startDepotSelect.selectedOptions?.[0]?.text ?? ''
                    : '',
            endTime:
                endTimeInput instanceof HTMLInputElement ? endTimeInput.value : '',
            endDepotId:
                endDepotSelect instanceof HTMLSelectElement ? endDepotSelect.value : '',
            endDepotName:
                endDepotSelect instanceof HTMLSelectElement
                    ? endDepotSelect.selectedOptions?.[0]?.text ?? ''
                    : '',
            trips: selectedTrips,
        };

        triggerPartialLoad('visualize-shift', payload);
    };

    scheduledTripsBody?.addEventListener('click', handleScheduledTripsClick);
    shiftTripsBody?.addEventListener('click', handleShiftTripsClick);

    lineSelect?.addEventListener('change', () => {
        loadTrips();
    });
    daySelect?.addEventListener('change', () => {
        loadTrips();
    });

    cancelButton?.addEventListener('click', () => {
        triggerPartialLoad('shifts');
    });

    visualizeButton?.addEventListener('click', handleVisualize);
    form.addEventListener('submit', handleSubmit);

    updateEmptyState(shiftTripsEmpty, false, 'No trips added to this shift yet.');
    updateEmptyState(
        scheduledTripsEmpty,
        false,
        'Select a line and day to view trips.',
    );

    if (!isEditMode && nameInput instanceof HTMLInputElement) {
        nameInput.focus();
    }

    if (isEditMode) {
        toggleFormDisabled(form, true);
    }

    const shiftPromise = isEditMode
        ? fetchShiftById(shiftId).catch((error) => {
              console.error('Failed to load shift', error);
              return null;
          })
        : Promise.resolve(null);

    const [, , , shift] = await Promise.all([
        loadBuses(),
        loadRoutes(),
        loadDepots(),
        shiftPromise,
    ]);

    if (isEditMode) {
        if (shift) {
            const busId = firstAvailable(
                shift?.bus_id,
                shift?.busId,
                shift?.bus?.id,
                shift?.bus?.bus_id,
            );

            // If the bus is not in the loaded list, try to fetch it to get the name
            if (busId && busSelect instanceof HTMLSelectElement) {
                const exists = Array.from(busSelect.options).some(
                    (opt) => opt.value === String(busId),
                );
                if (!exists) {
                    try {
                        const bus = await fetchBusById(busId);
                        if (bus) {
                            // Patch the shift object so prefill uses the correct name
                            shift.bus = { ...(shift.bus || {}), ...bus };
                        }
                    } catch (error) {
                        console.error('Failed to fetch missing bus details', error);
                    }
                }
            }

            const hydratedShift = await hydrateShift(shift);
            applyShiftPrefill(hydratedShift);
            updateFeedback(feedback, 'Shift ready to edit.', 'info');
            toggleFormDisabled(form, false);
            if (nameInput instanceof HTMLInputElement) {
                nameInput.focus();
                const length = nameInput.value.length;
                nameInput.setSelectionRange(length, length);
            }
        } else {
            updateFeedback(
                feedback,
                'Unable to load shift for editing.',
                'error',
            );
            toggleFormDisabled(form, false);
            if (submitButton) {
                submitButton.disabled = true;
            }
        }
    }
};

