import { test, expect } from '../../test-support/shift-composer-fixture.js';

// Build with npm run build:local: local nginx owns /auth and /api, even when
// .env.production names a remote API. Wildcard API mocks must not hide this.
test('the local production shift table uses the frontend origin for API requests', async ({ page, composer, baseURL }) => {
  const apiRequests = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/auth') || url.pathname.startsWith('/api/')) apiRequests.push(url);
  });
  const state = await composer({ application: true, entry: 'shifts' });
  await expect(page.locator('[data-action="add-shift"]')).toBeVisible();
  expect(state.reads.some(value => new URL(value).pathname.endsWith('/user/shifts/'))).toBe(true);
  expect(apiRequests.length).toBeGreaterThan(0);
  expect([...new Set(apiRequests.map(url => url.origin))]).toEqual([new URL(baseURL).origin]);
});
