const CURRENT_USER_KEY = 'cache.currentUser.id';
const OWNED_BUSES_KEY = 'cache.buses.owned';
const BUSES_LIST_KEY = 'cache.buses.list';
const BUSES_BY_ID_KEY = 'cache.buses.byId';
const BUS_MODELS_LIST_KEY = 'cache.busModels.list';
const BUS_MODELS_BY_ID_KEY = 'cache.busModels.byId';
const BUSES_BY_MODEL_ID_KEY = 'cache.buses.byModelId';
const FLASH_KEY = 'flash.busModels';

const safeParse = (value, fallback) => {
    if (!value) {
        return fallback;
    }
    try {
        const parsed = JSON.parse(value);
        return parsed ?? fallback;
    } catch {
        return fallback;
    }
};

const safeSetItem = (key, value) => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // non-fatal
    }
};

const safeRemoveItem = (storage, key) => {
    try {
        storage.removeItem(key);
    } catch {
        // non-fatal
    }
};

let currentUserId = '';
let currentUserResolved = false;

export const setCurrentUserId = (id = '') => {
    currentUserId = typeof id === 'string' ? id : String(id ?? '');
    currentUserResolved = true;
    safeSetItem(CURRENT_USER_KEY, currentUserId);
    return currentUserId;
};

export const getCurrentUserId = () => {
    if (currentUserResolved) {
        return currentUserId;
    }

    const stored = localStorage.getItem(CURRENT_USER_KEY) ?? '';
    currentUserId = typeof stored === 'string' ? stored : '';
    currentUserResolved = true;
    return currentUserId;
};

let ownedBuses = [];
let ownedBusesResolved = false;

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

const readStoredOwnedBuses = () =>
    normalizeArray(safeParse(localStorage.getItem(OWNED_BUSES_KEY), []));

export const setOwnedBuses = (buses = []) => {
    ownedBuses = normalizeArray(buses);
    ownedBusesResolved = true;
    safeSetItem(OWNED_BUSES_KEY, JSON.stringify(ownedBuses));
    return ownedBuses;
};

export const addOwnedBus = (bus) => {
    const current = getOwnedBuses();
    return setOwnedBuses([...current, bus]);
};

export const getOwnedBuses = () => {
    if (ownedBusesResolved) {
        return ownedBuses;
    }

    const storedOwned = readStoredOwnedBuses();
    if (storedOwned.length) {
        ownedBuses = storedOwned;
        ownedBusesResolved = true;
        return ownedBuses;
    }

    const storedList = normalizeArray(
        safeParse(localStorage.getItem(BUSES_LIST_KEY), []),
    );
    const userId = getCurrentUserId();

    const filtered =
        userId && userId.length
            ? storedList.filter((item) => item?.user_id === userId)
            : storedList;

    ownedBuses = filtered;
    ownedBusesResolved = true;
    return ownedBuses;
};

let modelsById = null;
let busesById = null;
let busesByModelId = null;

const toObject = (value) =>
    value && typeof value === 'object' ? value : {};

const computeModelsById = (models = []) =>
    Object.fromEntries(
        normalizeArray(models)
            .filter((model) => model && model.id)
            .map((model) => [model.id, model]),
    );

const computeBusesById = (buses = []) =>
    Object.fromEntries(
        normalizeArray(buses)
            .filter((bus) => bus && bus.id)
            .map((bus) => [bus.id, bus]),
    );

const computeBusesByModelId = (buses = []) =>
    normalizeArray(buses).reduce((acc, bus) => {
        const key = bus?.bus_model_id;
        if (!key) {
            return acc;
        }
        (acc[key] = acc[key] ?? []).push(bus);
        return acc;
    }, {});

export const cacheCollections = ({
    models = [],
    buses = [],
    owned = null,
} = {}) => {
    const normalizedModels = normalizeArray(models);
    const normalizedBuses = normalizeArray(buses);

    modelsById = computeModelsById(normalizedModels);
    busesById = computeBusesById(normalizedBuses);
    busesByModelId = computeBusesByModelId(normalizedBuses);

    safeSetItem(BUS_MODELS_LIST_KEY, JSON.stringify(normalizedModels));
    safeSetItem(BUS_MODELS_BY_ID_KEY, JSON.stringify(modelsById));
    safeSetItem(BUSES_LIST_KEY, JSON.stringify(normalizedBuses));
    safeSetItem(BUSES_BY_ID_KEY, JSON.stringify(busesById));
    safeSetItem(BUSES_BY_MODEL_ID_KEY, JSON.stringify(busesByModelId));

    if (owned !== null) {
        setOwnedBuses(owned);
    }
};

export const getModelsById = () => {
    if (modelsById !== null) {
        return modelsById;
    }
    modelsById = toObject(
        safeParse(localStorage.getItem(BUS_MODELS_BY_ID_KEY), {}),
    );
    return modelsById;
};

export const getBusesById = () => {
    if (busesById !== null) {
        return busesById;
    }
    busesById = toObject(safeParse(localStorage.getItem(BUSES_BY_ID_KEY), {}));
    return busesById;
};

export const getBusesByModelId = () => {
    if (busesByModelId !== null) {
        return busesByModelId;
    }
    busesByModelId = toObject(
        safeParse(localStorage.getItem(BUSES_BY_MODEL_ID_KEY), {}),
    );
    return busesByModelId;
};

export const writeFlash = (message = '') => {
    if (!message) {
        safeRemoveItem(sessionStorage, FLASH_KEY);
        return;
    }

    try {
        sessionStorage.setItem(FLASH_KEY, message);
    } catch {
        // non-fatal
    }
};

export const readFlash = () => {
    try {
        const stored = sessionStorage.getItem(FLASH_KEY);
        if (!stored) {
            return null;
        }
        sessionStorage.removeItem(FLASH_KEY);
        return stored;
    } catch {
        return null;
    }
};

export const nextBusName = () => {
    const owned = getOwnedBuses();
    const existingNames = owned
        .map((bus) => bus?.name)
        .filter((name) => typeof name === 'string' && name.length > 0);

    const numbers = existingNames
        .map((name) => {
            const match = /^Bus_(\d+)$/.exec(name);
            return match ? Number.parseInt(match[1], 10) : null;
        })
        .filter((value) => Number.isInteger(value) && value > 0);

    let next = numbers.length
        ? Math.max(...numbers) + 1
        : existingNames.length + 1;
    let candidate = `Bus_${next}`;

    const nameSet = new Set(existingNames);
    while (nameSet.has(candidate)) {
        next += 1;
        candidate = `Bus_${next}`;
    }

    return candidate;
};


