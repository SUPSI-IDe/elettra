# Guide deep links move out of view after screenshots load

Status: ready-for-agent
Priority: P2
Affected release: frontend 1.2.0-rc.3 (69b07ac), main 9869d43
Environment: elettra-user-staging, frontend :55558, backend 1.7.0 :9005

## Reproduction

Run `npm exec playwright test -- --config playwright.staging-extended.config.js rc3-guide.spec.js --project staging-desktop`.

The regression starts a cold visit to `/elettra/guide/#yearly`, holds PNG responses until the target heading is in view, then releases the images. It performs no DOM changes or artificial scrolling. It runs in English, Italian, German and French against the deployed bundle.

## Expected

The heading selected by the URL hash remains visible when guide screenshots finish loading.

## Observed

All four desktop language variants fail; the four mobile variants pass. Three additional English desktop repetitions failed identically. In all three repetitions the heading top moved from 132.08 px to 776.86 px in a 720 px viewport, after six delayed images were delivered.

The initial hash position is correct. The screenshots are lazy-loaded without intrinsic width/height attributes in `guide/guide.js:renderFigures`, allowing preceding content to change height. Reserving image space is a likely fix to investigate; the test must not be weakened with a corrective scroll.

## Evidence and acceptance

- Permanent regression: `tests/staging-extended/rc3-guide.spec.js`.
- Repetition JSON and traces: `/ssd2/elettra-releases/frontend-rc3-tests-20261120-5qix4z/guide-repeat.json` and `/ssd2/elettra-releases/frontend-rc3-tests-20261120-5qix4z/guide-repeat-results/`.
- Preserve the regression in all four languages and desktop/mobile.
- Verify cold links, regular guide navigation, language changes and return-to-app navigation.
- Application code and deployment were not changed during this test session.
