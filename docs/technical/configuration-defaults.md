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

Physical lengths of 9–13 m and 17–19 m are supported. The form derives the Mobitool category from the length and uses its operating defaults.

| Field | Midi (up to 10 m) | Standard (over 10 to 13 m) | Articulated (17–19 m) |
|-------|-----|------|------|
| Max passengers | 34 | 64 | 150 |
| Empty mass excluding passengers and batteries (kg) | 9,875 | 12,750 | 16,325 |
| Battery packs min–max | 5–8 | 7–11 | 12–16 |
| Max charging power (kW) | 300 | 450 | 450 |

The economic defaults API supplies the net body cost anchors (CHF 360,000 at 9 m, 460,000 at 10 m, 490,000 at 12 m and 570,000 at 18 m). Interpolation is linear, with the last slope extended through 19 m. These are estimates from the 2025–2026 procurement calibration. The 9 m anchor has limited Swiss evidence and the 18 m estimate depends on assumed battery capacity.

For the diesel comparator, the frontend interpolates its existing 9, 12, 13 and 18 m prices and extends the final slope to 19 m.

For a new bus the nominal pack size starts at 40 kWh. LFP is preselected (6.85 kg/kWh, CHF 330/kWh). NMC uses 195 Wh/kg and CHF 450/kWh. An entered price or mass overrides its own estimate. Bus and battery lives default to 12 and 8 years. Replacement uses the pack price entered for the initial purchase. [INFRAS/VöV, figure 19, p. 25](https://www.infras.ch/media/filer_public/79/e5/79e599d9-0dae-491e-ac2b-19f07385834a/4166a_technologiestudie_elektrobusse_vov_schlussbericht.pdf#page=25)

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
