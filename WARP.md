# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Architecture & Structure

This project is a **Vanilla JavaScript** single-page application (SPA) powered by **Vite**. It does not use a UI framework like React or Vue.

### Key Components

*   **Entry Point**: `src/main.js` initializes the application, login logic, and navigation.
*   **Navigation / Routing**: `src/navigation.js` implements a custom client-side router.
    *   It dynamically loads HTML partials from `src/pages/**/*.html` using Vite's `import.meta.glob`.
    *   It maps "slugs" (from `data-partial` attributes on links) to specific initializer functions (e.g., `initializeBuses`).
    *   It renders content into the `main article` element.
*   **Pages**: Located in `src/pages/`.
    *   Each page typically consists of an HTML file (the partial) and a companion JS file that handles the logic (event listeners, data fetching).
    *   **Convention**: To add a new page, you must create the HTML partial, write the initializer function, and register it in the `switch` statement in `src/navigation.js`.
*   **State Management**: `src/store.js` serves as a centralized store.
    *   It persists data (like user ID, buses, models) to `localStorage`.
    *   It provides getters and setters for global state.
*   **API Layer**: `src/api/` contains modules for interacting with the backend.
    *   `src/api/client.js` is the HTTP client wrapper.
    *   Domain-specific files (e.g., `buses.js`, `auth.js`) handle specific endpoints.

### Project Structure

*   `src/api/`: Backend integration modules.
*   `src/pages/`: Feature-specific logic and HTML templates.
*   `src/partials/`: Reusable HTML snippets (aliased as `@partials` in Vite).
*   `src/store.js`: Global state and caching logic.
*   `src/navigation.js`: Router and page loader.

## Development

### Common Commands

*   `npm run dev`: Starts the local development server.
*   `npm run build`: Builds the application for production.
*   `npm run preview`: Previews the production build locally.

### Adding a New Feature

1.  **Create the View**: Add a new `.html` partial in `src/pages/`.
2.  **Create the Logic**: Add a corresponding `.js` file with an `initializeX` function.
3.  **Register Route**: Import the initializer in `src/navigation.js` and add a case to the `initializePartial` switch statement.
4.  **Add Navigation**: Add a link with `data-partial="your-slug"` in the `index.html` navigation or trigger it programmatically via `document.dispatchEvent(new CustomEvent("partial:request", { detail: { slug: "your-slug" } }))`.
