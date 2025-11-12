export const textContent = (value) =>
    value === null || value === undefined ? '' : String(value);

export const resolveModelFields = (item = {}) => {
    const model =
        item.model ??
        item.name ??
        item.model_name ??
        item.title ??
        '';
    const manufacturer =
        item.manufacturer ??
        item.manufacturer_name ??
        item.brand ??
        '';
    const description =
        item.description ??
        item.notes ??
        item.note ??
        '';
    return {
        model: textContent(model),
        manufacturer: textContent(manufacturer),
        description: textContent(description),
    };
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


