import './buses.css';
import {
    createBus,
    deleteBus,
    deleteBusModel,
    fetchBusModels,
    fetchBuses,
    updateBus,
    updateBusModel,
} from '../../../api';
import { resolveUserId } from '../../../auth';
import {
    addOwnedBus,
    cacheCollections,
    getBusesById,
    getCurrentUserId,
    getModelsById,
    nextBusName,
    readFlash,
    setOwnedBuses,
    writeFlash,
} from '../../../store';
import {
    bindSelectAll,
    renderBusesErrorRow,
    renderBusesList,
    renderBusesLoadingRow,
    renderErrorRow,
    renderLoadingRow,
    renderModels,
} from '../../../dom/tables';
import { triggerPartialLoad } from '../../../events';
import { resolveModelFields, textContent } from '../../../ui-helpers';

const renderModelFilter = (select, models = []) => {
    if (!select) {
        return;
    }

    const options = [
        '<option value="">All bus models</option>',
        ...models
            .filter((model) => model?.id)
            .map((model) => {
                const { model: label, manufacturer } = resolveModelFields(model);
                const name = label || 'Untitled model';
                const suffix = manufacturer ? ` — ${manufacturer}` : '';
                return `<option value="${String(model.id)}">${textContent(
                    `${name}${suffix}`,
                )}</option>`;
            }),
    ].join('');

    select.innerHTML = options;
};

const getSelectedIdsFrom = (container) =>
    Array.from(
        container?.querySelectorAll('input[type="checkbox"]:checked') ?? [],
    )
        .map((input) => input.closest('tr')?.dataset?.id)
        .filter(Boolean);

const bindBusModelActions = (tbody) => {
    if (!tbody || tbody.dataset.busActionsBound === 'true') {
        return;
    }

    const handleBusModelsClick = async (event) => {
        const button = event.target.closest('button[data-action="add-bus"]');
        if (!button || button.disabled) {
            return;
        }

        const busModelId = button.dataset.busModelId?.trim();
        if (!busModelId) {
            alert('Missing bus model reference.');
            return;
        }

        const name = nextBusName();

        const previousLabel = button.textContent;
        button.disabled = true;
        button.textContent = 'Adding…';

        try {
            const userId = await resolveUserId();
            await createBus({
                name,
                busModelId,
                userId,
                specs: {},
            });
            addOwnedBus({ name, bus_model_id: busModelId, user_id: userId });
            writeFlash('Bus added.');
            triggerPartialLoad('buses');
        } catch (error) {
            console.error('Failed to create bus', error);
            alert(error?.message ?? 'Unable to create bus.');
            button.disabled = false;
            button.textContent = previousLabel;
        }
    };

    tbody.addEventListener('click', handleBusModelsClick);
    tbody.dataset.busActionsBound = 'true';
};

const setFlashMessage = (section, message) => {
    const flashElement = section.querySelector('[data-role="flash"]');
    if (!flashElement) {
        return;
    }

    if (message) {
        flashElement.textContent = message;
        flashElement.hidden = false;
    } else {
        flashElement.textContent = '';
        flashElement.hidden = true;
    }
};

const initializeModelControls = (section) => {
    const controls = section.querySelector('.bus-models .table-controls .actions');
    if (!controls || controls.dataset.bound === 'true') {
        return;
    }

    controls.dataset.bound = 'true';
    controls.addEventListener('click', async (event) => {
        const actionButton = event.target.closest('button[data-action]');
        if (!actionButton) {
            return;
        }
        const action = actionButton.dataset.action;
        const selectedIds = getSelectedIdsFrom(
            section.querySelector('.bus-models table'),
        );
        if (!selectedIds.length) {
            alert('Select at least one bus model.');
            return;
        }

        if (action === 'delete-selected-models') {
            const confirmDelete = confirm(
                `Delete ${selectedIds.length} bus model${
                    selectedIds.length > 1 ? 's' : ''
                }?`,
            );
            if (!confirmDelete) {
                return;
            }
            try {
                await Promise.all(selectedIds.map((id) => deleteBusModel(id)));
                writeFlash('Bus model(s) deleted.');
                triggerPartialLoad('buses');
            } catch (error) {
                console.error('Failed to delete bus model(s)', error);
                alert(error?.message ?? 'Unable to delete bus model(s).');
            }
            return;
        }

        if (action === 'edit-selected-model') {
            if (selectedIds.length !== 1) {
                alert('Select a single bus model to edit.');
                return;
            }
            const id = selectedIds[0];
            const current = getModelsById()[id] ?? null;
            const currentName = current?.name ?? current?.model ?? '';
            const currentManufacturer = current?.manufacturer ?? '';
            const currentDescription = current?.description ?? '';

            const name = prompt('Model name', currentName)?.trim();
            if (!name) {
                return;
            }
            const manufacturer = prompt('Manufacturer', currentManufacturer)?.trim();
            if (!manufacturer) {
                return;
            }
            const description =
                prompt('Description', currentDescription)?.trim() ?? '';

            try {
                const userId = await resolveUserId();
                await updateBusModel(id, {
                    name,
                    manufacturer,
                    description,
                    specs: current?.specs ?? {},
                    userId,
                });
                writeFlash('Bus model updated.');
                triggerPartialLoad('buses');
            } catch (error) {
                console.error('Failed to update bus model', error);
                alert(error?.message ?? 'Unable to update bus model.');
            }
        }
    });
};

const initializeBusControls = (section) => {
    const controls = section.querySelector('.buses-list .table-controls .actions');
    if (!controls || controls.dataset.bound === 'true') {
        return;
    }

    controls.dataset.bound = 'true';
    controls.addEventListener('click', async (event) => {
        const actionButton = event.target.closest('button[data-action]');
        if (!actionButton) {
            return;
        }
        const action = actionButton.dataset.action;
        const selectedIds = getSelectedIdsFrom(
            section.querySelector('.buses-list table'),
        );
        if (!selectedIds.length) {
            alert('Select at least one bus.');
            return;
        }

        if (action === 'delete-selected-buses') {
            const confirmDelete = confirm(
                `Delete ${selectedIds.length} bus${
                    selectedIds.length > 1 ? 'es' : ''
                }?`,
            );
            if (!confirmDelete) {
                return;
            }
            try {
                await Promise.all(selectedIds.map((id) => deleteBus(id)));
                writeFlash('Bus(es) deleted.');
                triggerPartialLoad('buses');
            } catch (error) {
                console.error('Failed to delete bus(es)', error);
                alert(error?.message ?? 'Unable to delete bus(es).');
            }
            return;
        }

        if (action === 'edit-selected-bus') {
            if (selectedIds.length !== 1) {
                alert('Select a single bus to edit.');
                return;
            }
            const id = selectedIds[0];
            const current = getBusesById()[id] ?? null;
            const currentName = current?.name ?? '';
            const name = prompt('Bus name', currentName)?.trim();
            if (!name) {
                return;
            }
            try {
                const userId = await resolveUserId();
                await updateBus(id, {
                    name,
                    busModelId: current?.bus_model_id ?? '',
                    specs: current?.specs ?? {},
                    userId,
                });
                writeFlash('Bus updated.');
                triggerPartialLoad('buses');
            } catch (error) {
                console.error('Failed to update bus', error);
                alert(error?.message ?? 'Unable to update bus.');
            }
        }
    });
};

export const initializeBuses = async (root = document, options = {}) => {
    const section = root.querySelector('section.buses');
    if (!section) {
        return;
    }

    const modelsTable = section.querySelector('.bus-models table');
    const busesTable = section.querySelector('.buses-list table');
    const modelsTbody = modelsTable?.querySelector('tbody');
    const busesTbody = busesTable?.querySelector('tbody');
    const modelFilter = section.querySelector('#model-filter');

    bindBusModelActions(modelsTbody);

    const modelsHeaderCheckbox = modelsTable?.querySelector(
        'thead .checkbox input[type="checkbox"]',
    );
    const busesHeaderCheckbox = busesTable?.querySelector(
        'thead .checkbox input[type="checkbox"]',
    );

    const message = options.flashMessage ?? readFlash();
    setFlashMessage(section, message);

    const addModelButton = section.querySelector('[data-action="add-bus-model"]');
    addModelButton?.addEventListener('click', () => {
        triggerPartialLoad('add-bus-model');
    });

    renderLoadingRow(modelsTbody);
    renderBusesLoadingRow(busesTbody);

    try {
        const [modelsPayload, busesPayload, userId] = await Promise.all([
            fetchBusModels({ skip: 0, limit: 100 }),
            fetchBuses({ skip: 0, limit: 100 }),
            resolveUserId().catch(() => null),
        ]);

        const models = Array.isArray(modelsPayload)
            ? modelsPayload
            : modelsPayload?.items ?? modelsPayload?.results ?? [];
        const buses = Array.isArray(busesPayload)
            ? busesPayload
            : busesPayload?.items ?? busesPayload?.results ?? [];

        const currentUserId = userId ?? getCurrentUserId() ?? '';
        const userBuses =
            currentUserId && Array.isArray(buses)
                ? buses.filter((bus) => bus?.user_id === currentUserId)
                : buses ?? [];

        setOwnedBuses(userBuses);
        cacheCollections({ models, buses, owned: userBuses });

        renderModels(modelsTbody, models);
        if (modelFilter) {
            renderModelFilter(modelFilter, models);
        }

        const modelsById = getModelsById();

        const applyBusFilter = (modelId = '') => {
            const filtered =
                modelId && Array.isArray(userBuses)
                    ? userBuses.filter((bus) => bus?.bus_model_id === modelId)
                    : userBuses;
            renderBusesList(busesTbody, filtered, modelsById);
        };

        bindSelectAll(modelsHeaderCheckbox, modelsTable);
        bindSelectAll(busesHeaderCheckbox, busesTable);

        initializeModelControls(section);
        initializeBusControls(section);

        if (modelFilter) {
            modelFilter.value = '';
            modelFilter.onchange = (event) => {
                applyBusFilter(event.target.value ?? '');
            };
        }

        applyBusFilter('');
    } catch (error) {
        console.error('Failed to load bus models', error);
        renderErrorRow(modelsTbody, error?.message ?? 'Unable to load bus models.');
        renderBusesErrorRow(
            busesTbody,
            error?.message ?? 'Unable to load buses.',
        );
    }
};


