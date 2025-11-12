export const triggerPartialLoad = (slug, detail = {}) =>
    document.dispatchEvent(
        new CustomEvent('partial:request', { detail: { slug, ...detail } }),
    );


