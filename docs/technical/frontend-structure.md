# Frontend Structure

> Last updated: 2026-06-01

Code organization, routing model, and page lifecycle patterns for the ELETTRA frontend.

---

## Directory layout

```
src/
├── api/                 # API client modules (one per domain)
│   ├── client.js        # Base client: auth headers, API_ROOT, fetch interceptor
│   ├── pagination.js    # Pagination helpers
│   ├── session.js       # Session initialization and management
│   ├── auth.js          # Login, register
│   ├── buses.js         # Bus CRUD
│   ├── bus-models.js    # Bus model CRUD
│   ├── depots.js        # Depot CRUD
│   ├── shifts.js        # Shift CRUD
│   ├── gtfs.js          # GTFS routes, trips, stops
│   ├── simulation.js    # Prediction runs, optimization runs, yearly analysis
│   ├── environmental.js # LCA endpoints
│   └── index.js         # Barrel re-export
├── config/              # Domain defaults and constants
│   ├── simulation-defaults.js
│   ├── economic-defaults.js
│   ├── bus-model-defaults.js
│   ├── auxiliary-consumption-defaults.js
│   └── company-locations.js
├── dom/                 # DOM utility functions
│   ├── tables.js        # Table rendering helpers
│   └── pagination.js    # Pagination UI component
├── i18n/                # Internationalization
│   ├── index.js         # i18n engine (applyTranslations, getCurrentLang)
│   └── translations.js  # All translation strings (en/de/fr/it)
├── pages/               # Page components (HTML + JS + CSS per page)
│   ├── Auth/            # Login, Register, Landing
│   ├── Account/         # Settings
│   ├── Fleet/
│   │   ├── Buses/       # Bus model management
│   │   ├── Custom Stops/ # Custom stop management
│   │   └── Shifts/      # Shift management and visualization
│   ├── Simulation/
│   │   ├── Runs/        # Feasibility evaluation (add, list, detail, results, comparison)
│   │   └── YearlyAnalysis/ # Yearly analysis (create, list, results)
│   └── About/
├── utils/               # Utility functions
│   ├── shift-distance.js
│   └── optimization-run.js
├── adapters/            # Data transformation adapters
│   └── yearly-analysis.js
├── config.js            # Runtime config (API_ROOT resolution)
├── events.js            # Custom events and route state helpers
├── main.js              # Application entry point
├── navigation.js        # SPA router
├── store.js             # Simple state store
├── style.css            # Global styles
└── ui-helpers.js        # Shared UI utility functions
```

---

## SPA routing

ELETTRA uses hash-based routing with partial HTML loading.

### How it works

1. Each page is an HTML partial (e.g., `src/pages/Fleet/Buses/buses.html`)
2. Partials are imported via Vite's `import.meta.glob` as raw strings
3. Navigation loads a partial's HTML into `.layout-article` and calls its initializer
4. The URL hash reflects the current page (e.g., `#buses`, `#simulation-runs`)

### Route → slug mapping

Routes are identified by slugs. The `SHELL_SECTION_BY_SLUG` map groups related slugs under nav sections:

| Slug | Nav section |
|------|-------------|
| `buses`, `add-bus-model` | buses |
| `custom-stops`, `add-custom-stop` | custom-stops |
| `shifts`, `shift-form`, `visualize-shift` | shifts |
| `simulation-runs`, `add-simulation`, `simulation-detail`, `simulation-results`, `simulation-comparison` | simulation-runs |
| `yearly-analysis-runs`, `create-yearly-analysis`, `yearly-analysis-results` | yearly-analysis-runs |

### Navigation events

- `partial:request` — Custom event to trigger navigation programmatically
- `popstate` — Browser back/forward button handling
- `I18N_CHANGE_EVENT` — Forces page reload when language changes

Source: `src/navigation.js`

---

## Page lifecycle

Each page follows this pattern:

1. **HTML partial** loaded into the DOM
2. **Initializer function** called with `(root, options)`
3. Initializer sets up event listeners, fetches data, renders content
4. Returns a **cleanup function** (or null)
5. On navigation away, cleanup is called before loading the next page

Example:

```javascript
export const initializeBuses = async (root, options = {}) => {
  // Setup: DOM queries, data fetching, event binding
  const cleanup = [];
  // ... logic ...
  return () => cleanup.forEach(fn => fn()); // cleanup function
};
```

---

## State management

- **`src/store.js`** — Simple module-level state (current user ID, etc.)
- **`localStorage`** — Session token, language preference
- **No global state library** — Each page manages its own state

---

## Events system

`src/events.js` provides:
- `triggerPartialLoad(slug, options)` — Navigate to a page programmatically
- `openPartialInNewTab(slug, options)` — Open a page in a new browser tab
- `consumeWindowRouteState(slug)` — Read and consume route state passed between pages
- `normalizeRouteOptions(options)` — Sanitize route parameters

---

## DOM utilities

- `src/dom/tables.js` — Table rendering and sorting helpers
- `src/dom/pagination.js` — Pagination UI (page size selector, prev/next buttons)
- `src/ui-helpers.js` — Shared functions (text content sanitization, model field resolution)

---

## Testing

*To verify*: No test framework or test scripts are present in `package.json`. Testing strategy is currently undocumented.

---

## Related documentation

- [Architecture](architecture.md) — System overview
- [API Integration](api-integration.md) — How the frontend calls the backend
- [Internationalization](i18n.md) — Translation system
