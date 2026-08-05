# Form control consistency

Status: done
Type: task

## Labels — majority `lg/600` (global .form-label, style.css:1317, 1483)

Three pages shrink labels independently to *different* sizes:
- add-bus-model `md/600` (buses.css:138)
- add-simulation `sm/600` (add-simulation.css:29)
- create-yearly-analysis `sm/600` (create-yearly-analysis.css:5)
- simulation-detail custom-variables `lg/500` (simulation-detail.css:51) — weight drift

**Decision: is there a compact-form tier?** If yes, pick ONE size (md vs sm both exist today); if no, all go `lg/600`. Visually confirmed: add-simulation and create-yearly-analysis render with visibly smaller labels than settings/auth forms, and the two "New X" forms also differ from *each other* (create-YA uses bordered fieldsets with legends; add-simulation uses plain labels + one tinted fieldset).

## Inputs — majority `lg` size, `--radius-md`, `--border-medium`, teal 3px focus ring

- Size deviants: add-simulation select `md` (:36), shift-search `sm` (:88), create-YA input `md` (create-yearly-analysis.css:7), stops-table number inputs `2xs` (add-simulation.css:252)
- Radius deviants: table-controls input/select `--radius-sm` (style.css:736 — compact context, acceptable), add-bus-model `--radius-lg` (buses.css:148), shift-search `5px` (add-simulation.css:87), stops-table `4px` (:251), ac-select `--radius-sm` (analysis-comparison.css:43), pagination select `--radius-sm` (style.css:2230)
- Border deviants: ac-select `--color-border`, pagination select `--color-border-dim`, everything else `--border-medium` — three strengths for one control
- Input padding (compact tier disagreement): add-simulation `2xs × sm` (:35) vs create-YA `0.4rem × 0.55rem` (create-yearly-analysis.css:7) — same role, should match (majority: the tokenized pair)

## Label-to-input gap — majority `--space-2xs` (shared style.css:1479)

Fold: add-simulation.css:40 + simulation-runs.css:159 (`xs`), create-yearly-analysis.css:8 (`0.2rem`). Delete dead re-declaration buses.css:134 (restates shared value).

## Form field-to-field gap

Majority `lg` (shared style.css:1471); compact pair add-simulation/create-YA use `md` consistently — recognize as the compact tier or fold.

## Form/dialog action rows

Shared `.form-actions` margin-top `md` (style.css:1518); settings.css:54 and shifts.css:182–183 push to `lg` — decision (2 pages vs shared default). Results close-action rows `xl` are a consistent trio — keep. Action gap: `2sm` shared vs `sm` (analysis-comparison.css:191, ya-results:95) — majority `2sm`.

## Sliders (cost variables)

Focus outlines removed (ticket 01). Thumb halo: sim-results teal `rgba(11,126,119,0.12)` vs ya-results plain drop-shadow; value pill: teal `rgba(11,126,119,0.08)` vs accent-blue `rgba(111,190,236,0.12)` — 1 page each, **decision needed**; `#0b7e77` matches no token. The whole `*-cost-variables__*` panel is duplicated byte-identical (spacing) between the two pages — extract to style.css before it drifts further.

## Resolution

- No compact form tier: labels and ordinary form controls use the shared `lg/600` and `lg` contract.
- Form actions use the shared `md` top margin.
- Cost-variable sliders use the shared teal treatment and are defined in `src/style.css`; result pages retain only their grid and layout variants.
