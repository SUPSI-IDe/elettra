# Badge / pill unification

Status: ready-for-human
Type: task

A shared `.badge`/`.status-badge` component exists (style.css:1142–1191, with success/warn/danger/neutral tones) and five page-local badge families reimplement it with near-identical-but-different values — sometimes both shapes on the same page (env badge = pill, overview badge = rect, both in simulation-results).

## Shape — decision needed

- **Pill** (9999px/999px): shared `.badge` (style.css:1149), `.ya-badge` (ya-results:293), env-kpi-card__badge (sim-results:2036), chips (:1206), results-shift-tab (:66)
- **4px rect**: efficiency-badge (sim-results:1611 + simulation-comparison:267), overview-badge (:1090), ya-overview-badge (ya-results:551)

Pill wins by usage; either convert the rects or declare "table badges are rects" — currently mixed within one page. Also: pill radius is written three ways (`9999px`, `999px`) — add `--radius-full` and use it everywhere.

## Padding — five near-identical variants

Shared `.badge` = `xs × 0.65rem` (itself carrying a non-token 0.65rem). Local: `0.2rem × 0.6rem` (ya-badge), `0.15rem × 0.6rem` (efficiency-badge ×2), `0.12rem × sm` (overview badges ×2), `0.15rem × sm` (env badge), `0.18rem × sm` (chip). No variant clearly wins — pick one when extending the shared class.

## Typography

- Size: `xs` majority (matches shared). Fold `2xs` deviants: efficiency-badge, env-kpi-card__badge, emissions-kpi-reduction (sim-results:2358).
- Weight: 600 majority; fold ya-badge (700), env badge (700).
- Case: page badges are 5:0 **uppercase** but the shared `.badge` is **capitalize** — decision: the shared class wins by usage across list pages; pick one.

## Colors

- badge-ok bg `rgba(171,232,40,0.18)` (sim-results:1101, 1622) — near-duplicate of `--color-sim-b-bg` (same hue, 0.14)
- badge-err bg `rgba(192,57,43,0.12)` (sim-results:1106, 1627) ≈ `--color-negative-muted`
- notice text `#7a1a10` (sim-results:1649) ≈ existing `--badge-danger-text #721c24`

## Recommendation

Extend the shared `.badge` with the missing tones/sizes, delete the local reimplementations (`.ya-badge`, `.efficiency-badge` ×2, `.overview-badge`, `.ya-overview-badge`, `.env-kpi-card__badge`), and route colors through `--badge-*` tokens.

Decision applied: badges are pills with normal-case labels. Dense result and overview badges use the shared compact size; feasibility and delta outcomes use the shared positive/negative tones.

## Comments

- 2026-07-29: Added the shared full-radius token, compact size, and positive/negative badge tones. Replaced all five local badge families in yearly analysis, simulation results, simulation comparison, and analysis comparison. Ready for visual review.
