/**
 * Escape a value for safe insertion into HTML **content** (between tags).
 * Converts &, <, >, ", ' to their HTML-entity equivalents.
 */
export const escapeHtml = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

/**
 * Escape a value for safe insertion into an HTML **attribute** (inside quotes).
 * Same as escapeHtml — the entity set covers both contexts.
 */
export const escapeAttr = escapeHtml;

/**
 * Legacy alias – now escapes HTML so it is safe inside innerHTML templates.
 */
export const textContent = escapeHtml;

/**
 * Coerce a value to a plain string (no escaping).
 * Use for logic/comparisons — NOT for insertion into innerHTML.
 */
export const text = (value) =>
    value === null || value === undefined ? '' : String(value);

/**
 * Normalise an API response into a flat array.
 * Handles bare arrays, `{ items: [] }`, and `{ results: [] }` envelopes.
 */
export const normalizeApiList = (payload) =>
    Array.isArray(payload)
        ? payload
        : (payload?.items ?? payload?.results ?? []);

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


