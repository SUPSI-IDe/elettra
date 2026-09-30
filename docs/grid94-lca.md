# Charging boundary and annual lifecycle assessment

Charging inputs are DC power delivered to the bus. Their derived AC connection estimate divides by 0.94 and is not an optimizer-verified grid limit. This conversion does not alter charging duration or battery SOC calculations. Actual charged energy and annual replenishment of consumed energy are distinct quantities.

Electricity cost uses purchased energy, `DC kWh / 0.94`. Energy predictions remain DC/battery-side. The efficiency is fixed, shared by depot and pantograph scenarios, with no parked preconditioning.

Annual environmental views and analysis comparison call `/yearly-analysis/{id}/lca`. They require `mobitool-parameterized-grid94-v1` and a complete response. There is no fallback to the legacy `/emissions` method. The API supplies independent electricity, heater and other-lifecycle components, phase totals, diesel reference and provenance. Inventory assumptions are visible and exported. Representative vehicle inventories do not describe a specific manufacturer or engineered depot.

The annual-distance control triggers a debounced, abortable backend request. It does not multiply all environmental phases locally: annual manufacture and battery replacement depend on the new lifetime distance. Cost and environmental distance choices are linked. A failed LCA request preserves energy and economic functionality but hides the environmental total.

The initial battery is included in the inventory; replacement counts exclude a replacement at the exact end of vehicle life. Installed capacity is distinguished from the usable SOC window. Snapshot physical inputs, per-vehicle identities and source attribution are handled by the backend. New results carry explicit methodology identifiers; stored historical results are not rewritten.

Tests: `tests/grid94-lca.test.mjs`, `tests/e2e/grid94-lca.spec.js`, complete `npm test`, Playwright desktop/mobile suite and Vite production build. Mocked browser tests never use production credentials or mutate operational cases.
