const GUEST_ROUTES = new Set(["landing", "login", "register"]);
const PUBLIC_ROUTES = new Set([...GUEST_ROUTES, "about"]);

// Use the same destination for startup, in-app navigation and browser history.
export const resolveRouteSlug = (slug, authenticated) => {
  if (!slug) return authenticated ? "home" : "landing";
  if (authenticated && GUEST_ROUTES.has(slug)) return "home";
  if (!authenticated && !PUBLIC_ROUTES.has(slug)) return "login";
  return slug;
};
