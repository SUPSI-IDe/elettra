# Glossary

> Last updated: 2026-06-01

Domain-specific terms used throughout the ELETTRA documentation and application.

---

| Term | Definition |
|------|-----------|
| **Battery pack** | A modular battery unit (typically 40 kWh) that can be added to a bus. Bus models define minimum and maximum pack counts. |
| **CAPEX** | Capital expenditure — one-time costs such as bus body, battery packs, and charging infrastructure. |
| **Charging station (OPP)** | Opportunity charging point where a bus can recharge during scheduled dwell times at stops or depots. |
| **COP** | Coefficient of Performance — ratio of heating output to electrical input for heat pumps. Higher COP means more efficient heating. |
| **Deadhead trip** | A non-revenue trip (e.g., bus traveling from depot to start of route) that still consumes energy. Also called auxiliary trip. |
| **Depot** | A bus depot or garage where buses start/end their shifts and may charge overnight. |
| **Feasibility evaluation** | An optimization run that determines whether a given shift can be operated electrically with the specified battery and charging configuration. The main simulation workflow in ELETTRA. |
| **Greybox model** | A physics-informed machine learning model combining physical equations (rolling resistance, aerodynamics, gradient) with data-driven parameters. Used for energy consumption prediction. |
| **GTFS** | General Transit Feed Specification — a standard format for public transit schedules and geographic data (routes, trips, stops, calendar). |
| **Heat pump** | The default (more efficient) heating method for electric buses. Compared to diesel/resistive heating, it consumes less electrical energy. |
| **Diesel heating (ebus-dh)** | An auxiliary diesel heater used on electric buses. Less efficient than a heat pump but more reliable in extreme cold. |
| **LCA** | Lifecycle Assessment — methodology to evaluate the environmental impact of a product across its full life (manufacturing, operation, disposal). |
| **OPEX** | Operational expenditure — recurring costs including energy, maintenance, and driver costs. |
| **Optimization run** | A backend computation that solves for the optimal battery pack count and/or charging station allocation for a given shift configuration. |
| **Prediction run** | A backend computation that predicts energy consumption for a specific shift, bus model, and parameter set. Multiple prediction runs (one per battery pack count) feed into an optimization run. |
| **PVGIS TMY** | Photovoltaic Geographical Information System — Typical Meteorological Year. A standardized dataset of hourly weather data for a location, used to derive representative temperature scenarios. |
| **Q05 / Q50 / Q95** | Prediction quantiles. Q50 is the median estimate, Q05 is a low-demand (optimistic) estimate, Q95 is a high-demand (pessimistic) estimate. The Q05–Q95 range represents prediction uncertainty. |
| **Recurrence** | How often a shift operates (e.g., daily, weekday-only). Used to compute yearly distance and costs from daily values. |
| **Shift** | A complete daily work assignment for a bus, comprising one or more trips between stops, including deadhead trips to/from the depot. |
| **SOC** | State of Charge — the current battery level as a percentage (0–100%). |
| **Usable SOC** | The SOC window actually used during operation (e.g., 10%–90% = 80% usable). A wider window means more energy available but may reduce battery lifetime. |
| **Variant** | A specific routing variant for a GTFS route (different stop patterns or paths for the same line). |
| **Yearly analysis** | A multi-scenario analysis that weights single-day feasibility results across representative temperature clusters to produce annualized cost and emissions estimates. |
