import { inferVehicleCategoryFromSpecs } from "./config/vehicle-categories";

export const textContent = (value) =>
    value === null || value === undefined ? '' : String(value);

const parseSpecs = (specs) => {
    if (!specs) return {};
    if (typeof specs === 'string') {
        try {
            const parsed = JSON.parse(specs);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }
    return typeof specs === 'object' ? specs : {};
};

export const resolveModelFields = (item = {}) => {
    const model =
        item.model ??
        item.name ??
        item.model_name ??
        item.title ??
        '';
    const description =
        item.description ??
        item.notes ??
        item.note ??
        '';
    return {
        model: textContent(model),
        description: textContent(description),
    };
};

export const resolveBusModelDisplayName = (item = {}) => {
    if (!item) return '';
    const specs = parseSpecs(item.specs);
    const category = inferVehicleCategoryFromSpecs(specs);
    const value =
        category?.label ??
        specs.model_type ??
        item.model ??
        item.model_name ??
        item.name ??
        item.title ??
        '';
    return textContent(value);
};

export const toggleFormDisabled = (form, disabled) => {
    if (!form) {
        return;
    }

    Array.from(form.elements ?? []).forEach((element) => {
        if (element instanceof HTMLElement && 'disabled' in element) {
            element.disabled = disabled;
        }
    });
};

export const updateFeedback = (node, message = '', tone = 'info') => {
    if (!node) {
        return;
    }

    if (!message) {
        node.textContent = '';
        node.hidden = true;
        node.removeAttribute('data-tone');
        return;
    }

    node.textContent = message;
    node.hidden = false;
    node.dataset.tone = tone;
};
