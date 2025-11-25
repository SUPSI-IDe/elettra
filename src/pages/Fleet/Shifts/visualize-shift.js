import './shifts.css';
import { fetchShiftById } from '../../../api';
import { triggerPartialLoad } from '../../../events';
import { textContent } from '../../../ui-helpers';

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
    if (!id) {
        return null;
    }

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
        ),
    );

    return {
        ...trip,
        id,
        trip_id: id,
        start_stop_name: startName,
        end_stop_name: endName,
        departure_time: departureTime,
        arrival_time: arrivalTime || departureTime,
    };
};

const readShiftTripsFromStructure = (shift = {}) => {
    const structure = Array.isArray(shift?.structure) ? shift.structure : [];
    if (structure.length === 0) {
        return [];
    }
    return structure
        .map((item = {}) => {
            const trip = item?.trip ?? {};
            const combined = { ...item, ...trip, trip };
            return normalizeTrip(combined);
        })
        .filter(Boolean);
};

const parseTimeToMinutes = (time) => {
    const match = /^\s*(\d{1,2}):(\d{2})/.exec(time ?? '');
    if (!match) {
        return null;
    }
    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
        return null;
    }
    return hours * 60 + minutes;
};

const formatMinutes = (value) => {
    if (!Number.isFinite(value)) {
        return '';
    }
    const hours = Math.max(0, Math.min(23, Math.floor(value / 60)));
    const minutes = Math.max(0, Math.min(59, Math.round(value % 60)));
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const ensureD3 = (() => {
    let loader = null;
    return () => {
        if (!loader) {
            loader = import('https://cdn.jsdelivr.net/npm/d3@7/+esm').catch((error) => {
                console.error('Unable to load d3', error);
                loader = null;
                throw error;
            });
        }
        return loader;
    };
})();

const ensurePlaceholder = (container, message) => {
    if (!container) {
        return;
    }
    container.innerHTML = '';
    const paragraph = document.createElement('p');
    paragraph.className = 'timeline__placeholder';
    paragraph.textContent = textContent(message ?? '');
    container.append(paragraph);
};

const renderTimeline = async (container, trips = [], options = {}) => {
    if (!container) {
        return;
    }

    if (!Array.isArray(trips) || trips.length === 0) {
        ensurePlaceholder(container, 'Add trips to visualize the shift timeline.');
        return;
    }

    const stopsSet = new Map();
    const addStop = (label) => {
        const normalized = text(label).trim();
        if (!normalized || stopsSet.has(normalized)) {
            return;
        }
        stopsSet.set(normalized, stopsSet.size);
    };

    addStop(options.startDepotName);
    trips.forEach((trip = {}) => {
        addStop(trip?.start_stop_name);
        addStop(trip?.end_stop_name);
    });
    addStop(options.endDepotName);

    const stops = Array.from(stopsSet.keys());

    if (!stops.length) {
        ensurePlaceholder(container, 'Insufficient stop information to render timeline.');
        return;
    }

    let d3;
    try {
        d3 = await ensureD3();
    } catch (error) {
        ensurePlaceholder(container, 'Unable to load visualization library.');
        return;
    }

    container.innerHTML = '';

    const width = Math.max(container.clientWidth || 0, 720);
    const rowHeight = 56;
    const margin = { top: 32, right: 32, bottom: 48, left: 168 };
    const innerHeight = Math.max((stops.length - 1) * rowHeight, rowHeight);
    const height = innerHeight + margin.top + margin.bottom;
    const innerWidth = width - margin.left - margin.right;

    const xScale = d3.scaleLinear().domain([0, 24 * 60]).range([0, innerWidth]);
    const yScale = d3
        .scalePoint()
        .domain(stops)
        .range([0, innerHeight])
        .padding(0.5);

    const svg = d3
        .create('svg')
        .attr('class', 'timeline__chart')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('role', 'presentation')
        .attr('aria-hidden', 'true')
        .attr('preserveAspectRatio', 'xMidYMid meet');

    const root = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const horizontal = root.append('g').attr('class', 'timeline__grid timeline__grid--horizontal');
    horizontal
        .selectAll('line')
        .data(stops)
        .join('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', (stop) => yScale(stop))
        .attr('y2', (stop) => yScale(stop));

    const tickMinutes = [0, 8 * 60, 16 * 60, 23 * 60];
    const vertical = root.append('g').attr('class', 'timeline__grid timeline__grid--vertical');
    vertical
        .selectAll('line')
        .data(tickMinutes)
        .join('line')
        .attr('x1', (minute) => xScale(minute))
        .attr('x2', (minute) => xScale(minute))
        .attr('y1', 0)
        .attr('y2', innerHeight);

    const xAxis = root.append('g').attr('class', 'timeline__axis timeline__axis--x');
    xAxis
        .selectAll('text')
        .data(tickMinutes)
        .join('text')
        .attr('x', (minute) => xScale(minute))
        .attr('y', innerHeight + 24)
        .attr('text-anchor', 'middle')
        .text((minute) => formatMinutes(minute));

    const yAxis = root.append('g').attr('class', 'timeline__axis timeline__axis--y');
    yAxis
        .selectAll('text')
        .data(stops)
        .join('text')
        .attr('x', -16)
        .attr('y', (stop) => yScale(stop))
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .text((stop) => textContent(stop));

    const serieGroup = root.append('g').attr('class', 'timeline__series');

    const line = d3
        .line()
        .x((point) => xScale(point.time))
        .y((point) => yScale(point.stop))
        .curve(d3.curveMonotoneX);

    serieGroup
        .selectAll('path')
        .data(trips)
        .join('path')
        .attr('class', 'timeline__trip-line')
        .attr('d', (trip) => {
            const departure = parseTimeToMinutes(trip?.departure_time) ?? 0;
            const arrival =
                parseTimeToMinutes(trip?.arrival_time) ??
                Math.min(departure + 10, 24 * 60);
            return line([
                { time: departure, stop: trip?.start_stop_name ?? '' },
                { time: arrival, stop: trip?.end_stop_name ?? '' },
            ]);
        });

    const points = root.append('g').attr('class', 'timeline__points');
    points
        .selectAll('g')
        .data(trips)
        .join('g')
        .each(function drawPoints(trip) {
            const group = d3.select(this);
            const departure = parseTimeToMinutes(trip?.departure_time) ?? 0;
            const arrival =
                parseTimeToMinutes(trip?.arrival_time) ??
                Math.min(departure + 10, 24 * 60);
            const startStop = trip?.start_stop_name ?? '';
            const endStop = trip?.end_stop_name ?? '';

            group
                .append('circle')
                .attr('class', 'timeline__point timeline__point--start')
                .attr('cx', xScale(departure))
                .attr('cy', yScale(startStop))
                .attr('r', 4);

            group
                .append('circle')
                .attr('class', 'timeline__point timeline__point--end')
                .attr('cx', xScale(arrival))
                .attr('cy', yScale(endStop))
                .attr('r', 4);
        });

    container.append(svg.node());
};

const computeTimeBounds = (trips = []) => {
    const departures = trips
        .map((trip = {}) => parseTimeToMinutes(trip?.departure_time))
        .filter((value) => Number.isFinite(value));
    const arrivals = trips
        .map((trip = {}) => parseTimeToMinutes(trip?.arrival_time))
        .filter((value) => Number.isFinite(value));

    const earliest = departures.length ? Math.min(...departures) : null;
    const latest = arrivals.length ? Math.max(...arrivals) : null;

    return { earliest, latest };
};

export const initializeVisualizeShift = async (root = document, options = {}) => {
    const section = root.querySelector('section.visualize-shift');
    if (!section) {
        return;
    }

    const backButton = section.querySelector('[data-action="back"]');
    backButton?.addEventListener('click', () => {
        triggerPartialLoad('shifts');
    });

    const state = {
        name: text(options.name).trim(),
        busName: text(options.busName ?? options.busLabel ?? ''),
        startTime: normalizeTime(options.startTime),
        startDepotName: text(options.startDepotName ?? ''),
        endTime: normalizeTime(options.endTime),
        endDepotName: text(options.endDepotName ?? ''),
        trips: Array.isArray(options.trips)
            ? options.trips.map((trip) => normalizeTrip(trip)).filter(Boolean)
            : [],
    };

    const setFieldText = (field, value, fallback = '—') => {
        const node = section.querySelector(`[data-field="${field}"]`);
        if (!node) {
            return;
        }
        const resolved = text(value).trim() || fallback;
        node.textContent = textContent(resolved);
        if (field === 'bus-name') {
            node.hidden = !text(value).trim();
        }
    };

    const tripsBody = section.querySelector('tbody[data-role="trips-body"]');
    const tripsEmpty = section.querySelector('[data-role="trips-empty"]');
    const timelineContainer = section.querySelector('[data-role="timeline"]');

    const renderTripsTable = () => {
        if (!tripsBody) {
            return;
        }

        tripsBody.innerHTML = '';

        if (!state.trips.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 3;
            cell.className = 'empty';
            cell.textContent = 'No trips available.';
            row.append(cell);
            tripsBody.append(row);
            if (tripsEmpty) {
                tripsEmpty.hidden = false;
            }
            return;
        }

        if (tripsEmpty) {
            tripsEmpty.hidden = true;
        }

        const fragment = document.createDocumentFragment();
        state.trips.forEach((trip = {}) => {
            const row = document.createElement('tr');
            const tripId = resolveTripId(trip);
            if (tripId) {
                row.dataset.tripId = tripId;
            }

            const timeCell = document.createElement('td');
            timeCell.className = 'time';
            const range = [trip?.departure_time, trip?.arrival_time]
                .map((part) => normalizeTime(part))
                .filter((part) => part && part.length > 0);
            timeCell.textContent = range.length
                ? range.join(' – ')
                : normalizeTime(trip?.departure_time) || '—';

            const routeCell = document.createElement('td');
            routeCell.className = 'route';
            const startName = text(trip?.start_stop_name ?? '');
            const endName = text(trip?.end_stop_name ?? '');
            routeCell.textContent =
                startName && endName
                    ? `${textContent(startName)} – ${textContent(endName)}`
                    : startName || endName || '—';

            const actionsCell = document.createElement('td');
            actionsCell.className = 'actions';
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.action = 'remove-trip';
            button.textContent = 'Remove';
            actionsCell.append(button);

            row.append(timeCell, routeCell, actionsCell);
            fragment.append(row);
        });
        tripsBody.append(fragment);
    };

    const renderSummary = () => {
        const { earliest, latest } = computeTimeBounds(state.trips);
        const startTime = state.startTime || (earliest !== null ? formatMinutes(earliest) : '');
        const endTime = state.endTime || (latest !== null ? formatMinutes(latest) : '');

        setFieldText('name', state.name || 'Untitled shift');
        setFieldText('bus-name', state.busName);
        setFieldText('start-time', startTime);
        setFieldText('start-depot', state.startDepotName || '—');
        setFieldText('end-time', endTime);
        setFieldText('end-depot', state.endDepotName || '—');
    };

    const renderAll = async () => {
        renderSummary();
        renderTripsTable();
        await renderTimeline(timelineContainer, state.trips, {
            startDepotName: state.startDepotName,
            endDepotName: state.endDepotName,
        });
    };

    const handleTripsTableClick = (event) => {
        const button = event.target?.closest?.('button[data-action="remove-trip"]');
        if (!button) {
            return;
        }
        const row = button.closest('tr');
        const tripId = row?.dataset?.tripId;
        if (!tripId) {
            return;
        }
        state.trips = state.trips.filter(
            (trip = {}) => resolveTripId(trip) && resolveTripId(trip) !== tripId,
        );
        renderAll();
    };

    tripsBody?.addEventListener('click', handleTripsTableClick);

    if (!state.trips.length && options.shiftId) {
        ensurePlaceholder(
            timelineContainer,
            'Loading shift timeline…',
        );
        try {
            const shift = await fetchShiftById(options.shiftId);
            state.name = state.name || text(shift?.name ?? '');
            state.busName =
                state.busName ||
                text(
                    shift?.bus?.name ??
                        shift?.bus_name ??
                        shift?.busName ??
                        shift?.bus_id ??
                        '',
                );
            state.startTime =
                state.startTime ||
                normalizeTime(
                    firstAvailable(
                        shift?.start_time,
                        shift?.startTime,
                        shift?.start?.time,
                        shift?.start?.scheduled_time,
                        shift?.start?.planned_time,
                    ),
                );
            state.startDepotName =
                state.startDepotName ||
                text(
                    shift?.start_depot?.name ??
                        shift?.startDepotName ??
                        shift?.start_depot ??
                        shift?.startDepot ??
                        '',
                );
            state.endTime =
                state.endTime ||
                normalizeTime(
                    firstAvailable(
                        shift?.end_time,
                        shift?.endTime,
                        shift?.end?.time,
                        shift?.end?.scheduled_time,
                        shift?.end?.planned_time,
                    ),
                );
            state.endDepotName =
                state.endDepotName ||
                text(
                    shift?.end_depot?.name ??
                        shift?.endDepotName ??
                        shift?.end_depot ??
                        shift?.endDepot ??
                        '',
                );
            state.trips = readShiftTripsFromStructure(shift);
        } catch (error) {
            console.error('Unable to load shift for visualization', error);
            ensurePlaceholder(
                timelineContainer,
                error?.message ?? 'Unable to load shift timeline.',
            );
        }
    }

    await renderAll();
};


