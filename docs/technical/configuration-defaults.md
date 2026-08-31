# Configuration Defaults

> Last updated: 2026-08-31

The frontend embeds domain-specific configuration and default values used for simulation setup, economic comparison, and bus model creation. These are **not** user-editable at runtime — they are compiled into the application.

---

## Source files

All configuration lives in `src/config/`:

| File | Domain |
|------|--------|
| `simulation-defaults.js` | Prediction model parameters |
| `economic-defaults.js` | Economic comparison parameters |
| `bus-model-defaults.js` | Default bus specs by length |
| `auxiliary-consumption-defaults.js` | Temperature-dependent auxiliary power |
| `company-locations.js` | *To verify*: Company/depot geolocation presets |

Plus the runtime config:
| `config.js` | `API_ROOT` resolution from `VITE_API_ROOT` |

---

## Simulation defaults (`simulation-defaults.js`)

| Constant | Value | Purpose |
|----------|-------|---------|
| `DEFAULT_PREDICTION_QUANTILES` | `[0.05, 0.5, 0.95]` | Quantile levels for uncertainty bands |
| `DEFAULT_PASSENGER_WEIGHT_KG` | `80` | Average passenger weight for weight calculation |
| `GREYBOX_PARAMS` | Object with physics coefficients | Parameters for the greybox consumption model |

The frontend does not select a prediction model by default. It omits
`model_name` from prediction requests so the backend can resolve the deployed
release from `CONSUMPTION_MODEL_RELEASE` and persist that resolved value on the
prediction run. An explicit `model_name` remains supported for future model
selection interfaces.

### Greybox parameters

| Parameter | Value | Physical meaning |
|-----------|-------|-----------------|
| `k1` | 1014.0 | Rolling resistance coefficient |
| `k2` | 2525.0 | Aerodynamic drag coefficient |
| `alpha_up` | 2.88e-6 | Uphill gradient factor |
| `alpha_aero` | 2.53e-16 | Aerodynamic loss factor |
| `alpha_down` | -2.14e-6 | Downhill regeneration factor |
| `alpha_roll` | 5.13e-8 | Rolling loss factor |
| `battery_pack_density` | 6.85 | Energy density constant |

---

## Economic defaults (`economic-defaults.js`)

### Maintenance costs (linear model: intercept + slope × length)

| Type | Intercept (CHF/km) | Slope (CHF/km per m) |
|------|--------------------|--------------------|
| Electric maintenance | 0.12 | 0.0147 |
| Diesel maintenance | 0.14 | 0.02 |
| Diesel consumption (L/km) | 0.1918 | 0.02 |

### Per-length defaults

| Length | Diesel L/km | Diesel maint CHF/km | Electric maint CHF/km |
|--------|-------------|--------------------|-----------------------|
| 9m | 0.34 | 0.30 | 0.30 |
| 12m | 0.42 | 0.37 | 0.35 |
| 18m | 0.55 | 0.45 | 0.40 |

### Equivalent diesel bus CAPEX

| Length | CAPEX (CHF) |
|--------|-------------|
| 9m | 280,000 |
| 12m | 350,000 |
| 18m | 500,000 |

### Lifetime defaults

| Parameter | Value |
|-----------|-------|
| `DEFAULT_OPEX_ANNUALIZATION_RATE` | 3% |
| `DEFAULT_BUS_LIFETIME_YEARS` | 12 |
| `DEFAULT_DIESEL_BUS_LIFETIME_YEARS` | 10 |
| `DEFAULT_BATTERY_LIFETIME_YEARS` | 8 |

---

## Bus model defaults (`bus-model-defaults.js`)

Pre-filled values when creating a new bus model, based on selected length:

| Field | 9m | 12m | 18m |
|-------|-----|------|------|
| Cost (CHF) | 450,000 | 600,000 | 800,000 |
| Max passengers | 55 | 85 | 120 |
| Empty weight (kg) | 12,000 | 14,000 | 18,000 |
| Battery packs max | 8 | 11 | 16 |
| Battery packs min | 5 | 7 | 12 |
| Pack size (kWh) | 40 | 40 | 40 |
| Pack cost (CHF) | 6,000 | 6,000 | 6,000 |
| Max charging power (kW) | 300 | 450 | 450 |
| Pack weight (kg) | 275 | 275 | 275 |
| Battery lifetime (years) | 8 | 8 | 8 |
| Bus lifetime (years) | 12 | 12 | 12 |

---

## Auxiliary consumption defaults (`auxiliary-consumption-defaults.js`)

Temperature-dependent auxiliary power consumption (not user-editable):

### Default profile (heat pump)

| Temperature (°C) | Consumption (kW) |
|-------------------|-----------------|
| -5 | 24 |
| 0 | 16 |
| 5 | 12 |
| 10 | 8 |
| 15 | 9 |
| 20 | 10 |
| 25 | 16 |

### Diesel heater profile

| Parameter | Value |
|-----------|-------|
| Reference temperature | 10°C |
| Base power | 8 kW |
| Diesel heater efficiency | 0.83 |
| COP at -10°C | 2.0 |
| COP at 10°C | 3.0 |

---

## Modifying defaults

These values are compiled into the frontend bundle. To change them:

1. Edit the relevant file in `src/config/`
2. Rebuild the application (`npm run build`)
3. Redeploy

Changes do not require backend modifications.

---

## Related documentation

- [Feasibility Evaluation](../user-guide/feasibility-evaluation.md) — How these defaults affect simulations
- [Glossary](../glossary.md) — Domain term definitions
