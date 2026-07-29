# Button normalization

Status: done
Type: task

## Radius — majority `--radius-md`

Fold `--radius-lg` deviants: section-header button (style.css:1379), landing-btn (:1692), login-submit/register-submit (:2078).

## Padding — majority `sm × md`

Fold: sim-data-btn (sim-results:91) + ya-toolbar-btn (ya-results:100) `sm × 0.875rem`; ac-export-btn (analysis-comparison:198) `sm × 2md`; compare-btn (simulation-runs:204) `sm × 1.4rem`. Close-button trio: simulation-comparison.css:223 and ya-results:63 use `control-padding-block × xl`; simulation-results.css:746 drifted to `0.6rem × xl` — align to its siblings. Form-actions `control-padding-block × lg` (style.css:1522) is its own tier — keep or fold (minor).

## Font-weight — decision needed

style.css splits the same role: `.table-controls button` + `.section-header button` = md/**500** (style.css:769, 1383) vs `.list-*-action` = md/**600** (:794). Overall majority 500 but the newest classes use 600. Also close-button: `lg/500` (sim-results:748) vs same class `md/600` (simulation-comparison:225) vs ya-btn-close `md/600` — majority md/600.

## Transitions — decision needed on canonical duration

`0.2s ease` hardcoded (majority in style.css) vs `var(--transition-fast)` =150ms (6+ page buttons, pagination, tabs) vs `0.15s` literal (sim-results:751, style.css:559, 1994) vs none at all (add-simulation.css:356, ya-results:245, sim-results:801, :412). Mechanical part: replace every literal with `--transition-fast/base`; decision: which duration is canonical.

## Disabled treatment — conflicting rules stack

Keep the token gray-swap block (style.css:845–859). Delete/fix the conflicting opacity rules that stack on the same selectors:
- style.css:1310 `.btn-disabled/.btn-primary:disabled/.btn-secondary:disabled { opacity: .6 }` — applies *on top of* the gray swap
- simulation-runs.css:218 compare-btn:disabled `opacity: .5` — same stacking
- Normalize stragglers: form-actions (style.css:1556) & login-submit (:2094) `opacity .6`; pagination `opacity .5` (style.css:2265); shifts.css:139 `.55`; buses.css:156 `.4`; sliders `.6`.

Visually confirmed: the disabled Delete button renders differently on Buses vs Custom Stops toolbars.

## Hover

Color-shift hover is the system (primary bg→teal-dark, secondary bg→bg-hover). The `translateY(-2px)+shadow` lift exists only on about/landing feature cards (style.css:1665, about.css:116) — marketing idiom, fine to keep, but `.about-privacy-link` invert-to-teal sits on an app page; decide keep/align.

## Implementation

- Standard buttons now use `500`; result-overlay close buttons retain their compact `md/600` tier.
- Radius and ordinary padding are `--radius-md` and `sm × md`, including form-ending actions, auth submits, and page-specific toolbar buttons.
- Button-like controls use `--transition-fast`; app controls retain semantic colour/border hovers, while marketing cards retain their lift treatment.
- Disabled buttons use the shared token gray-swap at full opacity. The result sliders and disabled bus-model input now use the same disabled palette.
- Validation: `npm test` (26 passing) and `npm run build` (successful; retains the pre-existing ticket-14 malformed-CSS warning).
