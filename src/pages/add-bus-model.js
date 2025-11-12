import { createBusModel } from '../api';
import { resolveUserId } from '../auth';
import { triggerPartialLoad } from '../events';
import { writeFlash } from '../store';
import { toggleFormDisabled, updateFeedback } from '../ui-helpers';

const toBusModelPayload = (formData) => {
    const name = formData.get('name')?.toString().trim();
    const manufacturer = formData.get('manufacturer')?.toString().trim();
    const description =
        formData.get('description')?.toString().trim() ?? '';

    return { name, manufacturer, description };
};

export const initializeAddBusModel = (root = document) => {
    const section = root.querySelector('section.add-bus-model');
    if (!section) {
        return;
    }

    const form = section.querySelector('form[data-form="add-bus-model"]');
    if (!form) {
        return;
    }

    const feedback = form.querySelector('[data-role="feedback"]');
    const cancelButton = form.querySelector('[data-action="cancel"]');

    cancelButton?.addEventListener('click', () => {
        triggerPartialLoad('buses');
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = new FormData(form);
        const { name, manufacturer, description } = toBusModelPayload(formData);

        if (!name || !manufacturer) {
            updateFeedback(
                feedback,
                'Model name and manufacturer are required.',
                'error',
            );
            return;
        }

        toggleFormDisabled(form, true);
        updateFeedback(feedback, 'Saving…', 'info');

        try {
            const userId = await resolveUserId();

            await createBusModel({
                name,
                manufacturer,
                description,
                specs: {},
                userId,
            });
            writeFlash('Bus model added.');
            triggerPartialLoad('buses');
        } catch (error) {
            console.error('Failed to create bus model', error);
            updateFeedback(
                feedback,
                error?.message ?? 'Unable to save bus model.',
                'error',
            );
        } finally {
            toggleFormDisabled(form, false);
        }
    });
};


