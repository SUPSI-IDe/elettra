const WINDOW_ROUTE_STATE_PREFIX = "elettra:route:";

export const normalizeRouteOptions = (detail = {}) =>
    Object.fromEntries(
        Object.entries(detail).filter(([, value]) =>
            value != null && typeof value !== "function",
        ),
    );

export const triggerPartialLoad = (slug, detail = {}) =>
    document.dispatchEvent(
        new CustomEvent('partial:request', {
            detail: { slug, ...normalizeRouteOptions(detail) },
        }),
    );

export const openPartialInNewTab = (slug, detail = {}) => {
    if (!slug || typeof window === "undefined") {
        return null;
    }

    const popup = window.open("about:blank", "_blank");
    if (!popup) {
        return null;
    }

    popup.name = `${WINDOW_ROUTE_STATE_PREFIX}${JSON.stringify({
        slug,
        options: normalizeRouteOptions(detail),
    })}`;

    const targetUrl = new URL(window.location.href);
    targetUrl.hash = slug;
    popup.location.replace(targetUrl.toString());
    return popup;
};

export const consumeWindowRouteState = (slug = "") => {
    if (typeof window === "undefined" || typeof window.name !== "string") {
        return null;
    }
    if (!window.name.startsWith(WINDOW_ROUTE_STATE_PREFIX)) {
        return null;
    }

    try {
        const payload = JSON.parse(window.name.slice(WINDOW_ROUTE_STATE_PREFIX.length));
        if (payload?.slug && slug && payload.slug !== slug) {
            return null;
        }
        window.name = "";
        return normalizeRouteOptions(payload?.options ?? {});
    } catch {
        window.name = "";
        return null;
    }
};
