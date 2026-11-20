# Changing language resets an individual vehicle-block result to General

Status: needs-triage
Priority: P2
Affected release: frontend 1.2.0-rc.3 (69b07ac), main 9869d43
Environment: elettra-user-staging, frontend :55558

## Reproduction

Run `npm exec playwright test -- --config playwright.staging-extended.config.js rc3-feasibility.spec.js --grep "changing language"`.

Open a saved infeasible result through the deployed application's normal navigation event. Select its individual vehicle-block tab, then change the shell language from English to Italian.

## Expected behavior to confirm

Keep the selected vehicle-block tab while translating the result, so the user can continue inspecting the same scope.

## Observed

On desktop and mobile the results page remounts and selects General. This is a loss of navigation context, not a change to saved feasibility data or a new calculation.

A separate matrix reselects the vehicle block after changing language to verify content independently: all 24 combinations of three modes, Mean/Q95, primary/diagnostic battery data and desktop/mobile pass. Battery limits remain 8 selected / 8 maximum / 10 required; missing Q95 consumption remains N/A with localized contextual help. No write requests occur while displaying these fixtures.

## Evidence and acceptance

- Permanent regression: `tests/staging-extended/rc3-feasibility.spec.js`.
- Production-bundle fixture: `test-support/deployed-infeasibility.js`.
- JSON/traces: `/ssd2/elettra-releases/frontend-rc3-tests-20261120-5qix4z/feasibility-final.json` and `/ssd2/elettra-releases/frontend-rc3-tests-20261120-5qix4z/feasibility-final-results/`.
- Confirm desired language-change behavior, then preserve the selected result scope across remounts if approved.
- Test General and individual tabs, all supported languages and both viewport classes.
- Application code and deployment were not changed during this test session.
