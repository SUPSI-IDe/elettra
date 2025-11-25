const API_ROOT = (import.meta.env.VITE_API_ROOT ?? '').replace(/\/$/, '');

export const authenticate = async (email, password) => {
    const response = await fetch(`${API_ROOT}/auth/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to authenticate.';

        throw new Error(message);
    }

    return payload;
};

const BUS_MODELS_PATH = '/api/v1/user/bus-models/';
const BUSES_PATH = '/api/v1/user/buses/';
const DEPOTS_PATH = '/api/v1/user/depots/';
const CURRENT_USER_PATH = '/auth/me';
const SHIFTS_PATH = '/api/v1/user/shifts/';
const GTFS_ROUTES_PATH = '/api/v1/gtfs/gtfs-routes/';
const GTFS_TRIPS_BY_ROUTE_PATH = '/api/v1/gtfs/gtfs-trips/by-route/';
const GTFS_STOPS_BY_TRIP_PATH = '/api/v1/gtfs/gtfs-stops/by-trip/';

const readAccessToken = () =>
    localStorage.getItem('access_token') ||
    (import.meta.env.VITE_TEST_PASSWORD ?? '');

const authHeaders = () => {
    const token = readAccessToken();
    const headers = { accept: 'application/json' };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

export const fetchBusModels = async ({ skip = 0, limit = 100 } = {}) => {
    const headers = authHeaders();

    const url = `${BUS_MODELS_PATH}?skip=${encodeURIComponent(
        String(skip),
    )}&limit=${encodeURIComponent(String(limit))}`;

    const response = await fetch(url, { method: 'GET', headers });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to load bus models.';
        throw new Error(message);
    }

    return payload;
};

export const fetchDepots = async ({ skip = 0, limit = 100 } = {}) => {
    const headers = authHeaders();
    const url = `${DEPOTS_PATH}?skip=${encodeURIComponent(
        String(skip),
    )}&limit=${encodeURIComponent(String(limit))}`;

    const response = await fetch(url, { method: 'GET', headers });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to load custom stops.';
        throw new Error(message);
    }

    return payload;
};

export const fetchBusModelById = async (modelId) => {
    if (!modelId) {
        throw new Error('Missing modelId');
    }
    const headers = authHeaders();
    const response = await fetch(`${BUS_MODELS_PATH}${encodeURIComponent(modelId)}`, {
        method: 'GET',
        headers,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to load bus model.';
        throw new Error(message);
    }
    return payload;
};

export const createBusModel = async ({
    name,
    manufacturer,
    description = '',
    specs = {},
    userId,
} = {}) => {
    if (!name) {
        throw new Error('Missing name');
    }
    if (!manufacturer) {
        throw new Error('Missing manufacturer');
    }

    const headers = {
        ...authHeaders(),
        'Content-Type': 'application/json',
    };

    const body = {
        name,
        manufacturer,
        description,
        specs: typeof specs === 'object' && specs !== null ? specs : {},
    };

    if (userId) {
        body.user_id = userId;
    }

    const response = await fetch(BUS_MODELS_PATH, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to create bus model.';
        throw new Error(message);
    }
    return payload;
};

export const createDepot = async ({
    name,
    address,
    userId,
    latitude = 0,
    longitude = 0,
    features = {},
} = {}) => {
    if (!name) {
        throw new Error('Missing name');
    }
    if (!address) {
        throw new Error('Missing address');
    }

    const headers = {
        ...authHeaders(),
        'Content-Type': 'application/json',
    };

    const body = {
        name,
        address,
        latitude,
        longitude,
        features: typeof features === 'object' && features !== null ? features : {},
    };

    if (userId) {
        body.user_id = userId;
    }

    const response = await fetch(DEPOTS_PATH, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to create custom stop.';
        throw new Error(message);
    }
    return payload;
};

export const createBus = async ({
    name,
    busModelId,
    userId,
    description = '',
    specs = {},
} = {}) => {
    if (!name) {
        throw new Error('Missing name');
    }
    if (!busModelId) {
        throw new Error('Missing busModelId');
    }

    const headers = {
        ...authHeaders(),
        'Content-Type': 'application/json',
    };

    const body = {
        name,
        bus_model_id: busModelId,
        description,
        specs: typeof specs === 'object' && specs !== null ? specs : {},
    };

    if (userId) {
        body.user_id = userId;
    }

    const response = await fetch(BUSES_PATH, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to create bus.';
        throw new Error(message);
    }
    return payload;
};

export const fetchCurrentUser = async () => {
    const headers = authHeaders();

    if (!headers.Authorization) {
        throw new Error('Missing access token.');
    }

    const response = await fetch(CURRENT_USER_PATH, {
        method: 'GET',
        headers,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to load current user.';
        throw new Error(message);
    }

    return payload;
};

export const fetchBuses = async ({ skip = 0, limit = 100 } = {}) => {
    const headers = authHeaders();
    const url = `${BUSES_PATH}?skip=${encodeURIComponent(
        String(skip),
    )}&limit=${encodeURIComponent(String(limit))}`;
    const response = await fetch(url, { method: 'GET', headers });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to load buses.';
        throw new Error(message);
    }
    return payload;
};

export const fetchBusById = async (busId) => {
    if (!busId) {
        throw new Error('Missing busId');
    }
    const headers = authHeaders();
    const response = await fetch(`${BUSES_PATH}${encodeURIComponent(busId)}`, {
        method: 'GET',
        headers,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to load bus.';
        throw new Error(message);
    }
    return payload;
};

export const updateBusModel = async (modelId, {
    name,
    manufacturer,
    description = '',
    specs = {},
    userId,
} = {}) => {
    if (!modelId) {
        throw new Error('Missing modelId');
    }
    if (!name) {
        throw new Error('Missing name');
    }
    if (!manufacturer) {
        throw new Error('Missing manufacturer');
    }

    const headers = {
        ...authHeaders(),
        'Content-Type': 'application/json',
    };

    const body = {
        name,
        manufacturer,
        description,
        specs: typeof specs === 'object' && specs !== null ? specs : {},
    };

    if (userId) {
        body.user_id = userId;
    }

    const response = await fetch(`${BUS_MODELS_PATH}${encodeURIComponent(modelId)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to update bus model.';
        throw new Error(message);
    }
    return payload;
};

export const updateDepot = async (
    depotId,
    {
        name,
        address,
        latitude = 0,
        longitude = 0,
        features = {},
    } = {},
) => {
    if (!depotId) {
        throw new Error('Missing depotId');
    }
    if (!name) {
        throw new Error('Missing name');
    }
    if (!address) {
        throw new Error('Missing address');
    }

    const headers = {
        ...authHeaders(),
        'Content-Type': 'application/json',
    };

    const body = {
        name,
        address,
        latitude,
        longitude,
        features: typeof features === 'object' && features !== null ? features : {},
    };

    const response = await fetch(`${DEPOTS_PATH}${encodeURIComponent(depotId)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to update custom stop.';
        throw new Error(message);
    }
    return payload;
};

export const deleteBusModel = async (modelId) => {
    if (!modelId) {
        throw new Error('Missing modelId');
    }
    const headers = authHeaders();
    const response = await fetch(`${BUS_MODELS_PATH}${encodeURIComponent(modelId)}`, {
        method: 'DELETE',
        headers,
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to delete bus model.';
        throw new Error(message);
    }
    return true;
};

export const updateBus = async (busId, {
    name,
    busModelId,
    userId,
    specs = {},
} = {}) => {
    if (!busId) {
        throw new Error('Missing busId');
    }
    if (!name) {
        throw new Error('Missing name');
    }
    if (!busModelId) {
        throw new Error('Missing busModelId');
    }
    const headers = {
        ...authHeaders(),
        'Content-Type': 'application/json',
    };
    const body = {
        name,
        bus_model_id: busModelId,
        specs: typeof specs === 'object' && specs !== null ? specs : {},
    };
    if (userId) {
        body.user_id = userId;
    }
    const response = await fetch(`${BUSES_PATH}${encodeURIComponent(busId)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to update bus.';
        throw new Error(message);
    }
    return payload;
};

export const deleteBus = async (busId) => {
    if (!busId) {
        throw new Error('Missing busId');
    }
    const headers = authHeaders();
    const response = await fetch(`${BUSES_PATH}${encodeURIComponent(busId)}`, {
        method: 'DELETE',
        headers,
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to delete bus.';
        throw new Error(message);
    }
    return true;
};

export const deleteDepot = async (depotId) => {
    if (!depotId) {
        throw new Error('Missing depotId');
    }
    const headers = authHeaders();
    const response = await fetch(`${DEPOTS_PATH}${encodeURIComponent(depotId)}`, {
        method: 'DELETE',
        headers,
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to delete custom stop.';
        throw new Error(message);
    }
    return true;
};

export const fetchShifts = async ({
    skip = 0,
    limit = 100,
    busId = '',
    userId = '',
} = {}) => {
    const headers = authHeaders();
    const params = new URLSearchParams();
    params.set('skip', String(skip));
    params.set('limit', String(limit));
    if (busId) {
        params.set('bus_id', busId);
    }
    if (userId) {
        params.set('user_id', userId);
    }
    const query = params.toString();
    const url = query ? `${SHIFTS_PATH}?${query}` : SHIFTS_PATH;

    const response = await fetch(url, { method: 'GET', headers });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to load shifts.';
        throw new Error(message);
    }
    return payload;
};

export const fetchShiftById = async (shiftId) => {
    if (!shiftId) {
        throw new Error('Missing shiftId');
    }
    const headers = authHeaders();
    const response = await fetch(`${SHIFTS_PATH}${encodeURIComponent(shiftId)}`, {
        method: 'GET',
        headers,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to load shift.';
        throw new Error(message);
    }
    return payload;
};

const toTripIds = (tripIds) =>
    Array.isArray(tripIds) ? tripIds.filter(Boolean).map(String) : [];

export const createShift = async ({ name, busId, tripIds } = {}) => {
    if (!name) {
        throw new Error('Missing name');
    }
    if (!busId) {
        throw new Error('Missing busId');
    }
    const trips = toTripIds(tripIds);
    if (!trips.length) {
        throw new Error('At least one trip is required.');
    }

    const headers = {
        ...authHeaders(),
        'Content-Type': 'application/json',
    };

    const body = {
        name,
        bus_id: busId,
        trip_ids: trips,
    };

    const response = await fetch(SHIFTS_PATH, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to create shift.';
        throw new Error(message);
    }
    return payload;
};

export const updateShift = async (shiftId, { name, busId, tripIds } = {}) => {
    if (!shiftId) {
        throw new Error('Missing shiftId');
    }
    if (!name) {
        throw new Error('Missing name');
    }
    if (!busId) {
        throw new Error('Missing busId');
    }
    const trips = toTripIds(tripIds);
    if (!trips.length) {
        throw new Error('At least one trip is required.');
    }

    const headers = {
        ...authHeaders(),
        'Content-Type': 'application/json',
    };

    const body = {
        name,
        bus_id: busId,
        trip_ids: trips,
    };

    const response = await fetch(`${SHIFTS_PATH}${encodeURIComponent(shiftId)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to update shift.';
        throw new Error(message);
    }
    return payload;
};

export const deleteShift = async (shiftId) => {
    if (!shiftId) {
        throw new Error('Missing shiftId');
    }
    const headers = authHeaders();
    const response = await fetch(`${SHIFTS_PATH}${encodeURIComponent(shiftId)}`, {
        method: 'DELETE',
        headers,
    });
    if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to delete shift.';
        throw new Error(message);
    }
    return true;
};

export const fetchRoutes = async ({
    skip = 0,
    limit = 100,
    gtfs_year,
    gtfs_file_date,
} = {}) => {
    const headers = authHeaders();
    const params = new URLSearchParams();
    params.set('skip', String(skip));
    params.set('limit', String(limit));
    if (gtfs_year !== undefined && gtfs_year !== null) {
        params.set('gtfs_year', String(gtfs_year));
    }
    if (gtfs_file_date) {
        params.set('gtfs_file_date', gtfs_file_date);
    }
    const query = params.toString();
    const url = query ? `${GTFS_ROUTES_PATH}?${query}` : GTFS_ROUTES_PATH;

    const response = await fetch(url, { method: 'GET', headers });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to load routes.';
        throw new Error(message);
    }
    return payload;
};

export const fetchTripsByRoute = async ({
    routeId,
    dayOfWeek,
    status = 'gtfs',
} = {}) => {
    if (!routeId) {
        throw new Error('Missing routeId');
    }
    if (!dayOfWeek) {
        throw new Error('Missing dayOfWeek');
    }
    const headers = authHeaders();
    const params = new URLSearchParams();
    params.set('day_of_week', dayOfWeek);
    if (status) {
        params.set('status', status);
    }
    const query = params.toString();
    const url = `${GTFS_TRIPS_BY_ROUTE_PATH}${encodeURIComponent(routeId)}${
        query ? `?${query}` : ''
    }`;

    const response = await fetch(url, { method: 'GET', headers });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to load trips.';
        throw new Error(message);
    }
    return payload;
};

export const fetchStopsByTripId = async (tripId) => {
    if (!tripId) {
        throw new Error('Missing tripId');
    }
    const headers = authHeaders();
    const response = await fetch(`${GTFS_STOPS_BY_TRIP_PATH}${encodeURIComponent(tripId)}`, {
        method: 'GET',
        headers,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to load stops for trip.';
        throw new Error(message);
    }
    return payload;
};

export const fetchDepotById = async (depotId) => {
    if (!depotId) {
        throw new Error('Missing depotId');
    }
    const headers = authHeaders();
    const response = await fetch(`${DEPOTS_PATH}${encodeURIComponent(depotId)}`, {
        method: 'GET',
        headers,
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message =
            payload?.detail?.[0]?.msg ??
            payload?.detail ??
            'Unable to load depot.';
        throw new Error(message);
    }
    return payload;
};

