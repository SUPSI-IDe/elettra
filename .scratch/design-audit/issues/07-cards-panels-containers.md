# Card / panel / table-container treatment

Status: ready-for-agent
Type: task

## Card treatment — majority: 1px border + `--panel-radius`/`--radius-xl` + `--shadow-sm`

Variants to fold in:
- **Hardcoded 8px, no shadow**: efficiency-section/-more-information/-sensitivity-card (simulation-results.css:1277, 1296, 1133), simulation-detail.css:62, predictions-trip-section (sim-results:1789), emissions-kpi-card (:2324), ya-uncertainty/ya-critical items (ya-results:378, 416)
- **Hardcoded 10px, no shadow**: ya-env-chart-section (ya-results:1258) — its sibling ya-eff-chart-section on the same page is fully tokenized *with* shadow
- **`--radius-2xl` (14px), no shadow**: shift-form-card (shifts.css:47), shift-summary__card (shifts.css:408) — the only 14px cards in the app (visually confirmed on the shift pages). **Decision: align Shifts to the standard or bless 14px.**

## Card padding — majority `--panel-padding` (lg); `md` is a legitimate dense tier

Fold the drift: env-kpi/chart cards `md × 1.1rem` (sim-results:1971; ya-results:1017, 1264), efficiency-sensitivity-card `0.85rem × md` (:1135), bus-model-intro `md × lg` (buses.css:41), about-card `2md × lg` (about.css:101), slider panels `2sm` (sim-results:275, ya-results:738). Also: ya-results overrides shared `.ya-res-section` padding to `md` at ≤768 (ya-results:1311) while simulation-results leaves `.chart-section` untouched — the two results pages disagree responsively.

## Table containers — majority: 1px border + `--radius-lg` + `--shadow-sm` on the scroll wrapper

- shifts.css:112 shift-form `.table-wrapper` — no shadow
- add-simulation.css:96, 211 — **5px radius**, no shadow
- In-panel tables bare (simulation-results.css:1489; ya-results:941, 1107) — acceptable, but state the rule.

## Left-accent bars — two widths for one idiom

`4px` (env KPI cards sim-results:1986–1994, ya-results:1028–1030; infeasibility notices sim-results:1641, simulation-comparison.css:295) vs `3px` (env tone rows sim-results:2269–2293; selected-row inset style.css:982, 519). Pick one (3px matches the selected-row standard).

## 2px borders

Heading underlines (buses.css:92, sim-results:833, 1908) and dense-table thead borders (sim-results:1510, 1831, 2174; ya-results:957, 1123; create-yearly-analysis.css:39) vs the shared table's 1px (style.css:894). Decide: is 2px the dense-table signature (then apply uniformly) or drift? Also shifts.css:710 `border-bottom: 2px … !important` — remove the `!important`.

## Radius mechanical inventory (hardcoded → token)

simulation-detail.css:64 (8px→lg), :109 (6px→md); add-simulation.css:170, 188 (6px→md), :251 (4px→sm), :331 (8px→lg), :87, 96, 211 (5px→sm or md), :283 (12px→xl or 2xl); simulation-results.css:321 (8px→lg), :747 (6px→md), :776 (10px→xl), :1094 (4px→sm), :1133, 1277, 1296 (8px→lg), :1577 (6px→md), :1614 (4px→sm), :1643 (0 6px 6px 0→md), :1724, 1792, 1867, 1939, 2137, 2329 (8px→lg); simulation-comparison.css:269 (4px→sm); yearly-analysis-results.css:135 (10px→xl), :209 (5px), :242/247 (6px/4px), :378, 416, 1163, 1237 (8px→lg), :554 (4px→sm), :680, 722 (6px→md), :1263 (10px→xl); create-yearly-analysis.css:24 (5px); style.css:2170 (6px→md).

Fallback anti-pattern: `var(--radius-sm, 6px)` at simulation-results.css:1446 — fallback contradicts the token (4px); also `var(--radius-md, 6px)` noise at sim-results:38, ya-results:87.

## Comments

- 2026-07-29: Resolved through a grilling session. Standard cards/panels use a 1px border, `--panel-radius`, and `--shadow-sm`; `md` padding is limited to intentional dense analytical panels, including mobile result panels. Standalone table wrappers use a 1px border, `--radius-lg`, and `--shadow-sm`; in-panel tables remain bare. Remove left-accent bars. Borders are uniformly 1px. Add `--shadow-modal` (`0 8px 32px rgba(0, 0, 0, 0.18)`) and standardize slider thumbs on the focus-ring treatment.
- 2026-07-29: Restored semantic emphasis on environmental KPI cards without a side rail: variants use a solid 1px, brighter and less-saturated HSL border with a 10% tint over white.

## Shadows

- Modal shadow `0 8px 32px rgba(0,0,0,0.18)` ×4 (add-simulation.css:289, shifts.css:249, simulation-results.css:782, ya-results:137) → add `--shadow-modal`; outlier add-simulation.css:332 (`0 12px 34px`).
- `0 4px 12px rgba(0,0,0,0.1)` (style.css:540, 1973) and ya tooltip `0.12` (ya-results:680, 722) ≈ `--shadow-md` (the sim-results twins already use the token).
- ya-results:261 unit-button active `0 1px 2px rgba(15,60,60,0.14)` ≈ `--shadow-sm`; shifts.css:724 `0 2px 8px rgba(0,0,0,0.06)` off-token.
- Slider thumbs disagree: sim-results:371, 380 ring-style vs ya-results:802, 812 drop-shadow — same component, pick one (see also ticket 09/12 slider colors).
