import { test as base, expect } from '@playwright/test';
import { translations } from '../src/i18n/translations.js';

const records = ['first', 'second'].map((id, index) => ({
  id, name: index ? 'Beta duty' : 'Alpha duty', bus_id: `bus-${index + 1}`,
  trip_count: 3, start_time: '07:00', end_time: '12:00', daily_distance_km: 12,
  gtfs_datasets: [{ gtfs_year: 2026 - index, gtfs_file_date: index ? '2024-09-27' : '2025-09-27' }],
  structure: [
    { trip_id: `${id}-return`, sequence_number: 3 },
    { trip_id: `${id}-out`, sequence_number: 1 },
    { trip_id: `${id}-service`, sequence_number: 2 },
  ],
}));
const blocked = { status: 409, json: { detail: { message: 'Still used', blockers: [{ type: 'optimization_run', id: 'evaluation', name: 'Protected evaluation' }] } } };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const row = (page, id) => page.locator(`section.shifts tr[data-id="${id}"]`);
const topDelete = page => page.locator('[data-action="delete-selected-shifts"]');

const test = base.extend({
  shiftList: async ({ page }, use) => {
    const errors = [], unexpected = [];
    page.on('pageerror', error => errors.push(error.message));
    await use(async (options = {}) => {
      const state = { rows: structuredClone(records), writes: [], deletes: [], reads: [] };
      await page.addInitScript(() => {
        localStorage.setItem('access_token', 'row-action-test');
        localStorage.setItem('elettra_lang', 'en');
        localStorage.setItem('elettra.usageNotice.dismissed.v1', 'true');
      });
      await page.route('**/auth/me', route => route.fulfill({ json: { id: 'user', email: 'shift-actions@example.invalid' } }));
      await page.route('**/api/v1/**', async route => {
        const request = route.request(), path = new URL(request.url()).pathname, method = request.method();
        if (method === 'GET') state.reads.push(path);
        else state.writes.push({ path, method, body: request.postData() ? request.postDataJSON() : null });
        if (method === 'DELETE') state.deletes.push(path.split('/').at(-1));
        const override = await options.respond?.({ path, method, state });
        if (override) return route.fulfill(override);
        if (method === 'DELETE' && path.includes('/shifts/')) {
          state.rows = state.rows.filter(item => !path.endsWith(`/${item.id}`));
          return route.fulfill({ status: 204 });
        }
        let json;
        if (path.endsWith('/version')) json = { version: 'test' };
        else if (path.endsWith('/bus-models/')) json = [{ id: 'model', user_id: 'user', name: 'City bus' }];
        else if (/\/buses\/bus-[12]$/.test(path)) json = { id: path.split('/').at(-1), user_id: 'user', bus_model_id: 'model' };
        else if (path.endsWith('/shifts/') && method === 'GET') json = state.rows;
        else if (path.endsWith('/shifts/') && method === 'POST') {
          const body = request.postDataJSON();
          const original = state.rows.find(item => body.trip_ids.every(id => item.structure.some(leg => leg.trip_id === id)));
          json = { ...original, id: 'copy', name: body.name, bus_id: body.bus_id };
          state.rows.push(json);
        } else if (path.includes('/shifts/') && method === 'GET') json = state.rows.find(item => path.endsWith(`/${item.id}`));
        else {
          unexpected.push(`${method} ${path}`);
          return route.fulfill({ status: 500, json: { detail: `Missing mock: ${method} ${path}` } });
        }
        return route.fulfill({ json });
      });
      await page.goto('./#shifts');
      await expect(row(page, 'second')).toBeVisible();
      return state;
    });
    expect(errors, 'No uncaught browser errors').toEqual([]);
    expect(unexpected, 'Every API request has an explicit mock').toEqual([]);
  },
});

export const defineShiftRowActionTests = () => {
  test('shift rows have four compact translated icons and the toolbar has Add and batch Delete', async ({ page, shiftList }, testInfo) => {
    const state = await shiftList();
    await expect(page.locator('.shifts-toolbar-actions button')).toHaveCount(2);
    const searchBox = await page.locator('#shifts-filter').boundingBox();
    expect(searchBox.height).toBeLessThanOrEqual(64);
    await expect(topDelete(page)).toBeDisabled();
    await expect(page.locator('[data-action="edit-selected-shifts"], [data-action="duplicate-selected-shifts"]')).toHaveCount(0);
    for (const lang of ['it', 'de', 'fr', 'en']) {
      await page.locator('.language-select').selectOption(lang);
      const dict = translations[lang];
      for (const [action, key] of [['details', 'shifts.visualize'], ['edit', 'common.edit'], ['duplicate', 'common.duplicate'], ['delete', 'common.delete']]) {
        const button = row(page, 'second').locator(`[data-row-action="${action}"]`);
        await expect(button).toHaveAttribute('aria-label', dict[key]);
        await expect(button).toHaveAttribute('title', dict[key]);
        await expect(button.locator('[aria-hidden="true"]')).toHaveCount(1);
        await expect(button).toBeEnabled();
      }
      expect(await row(page, 'second').locator('[data-row-action]').evaluateAll(buttons => buttons.map(button => button.dataset.rowAction))).toEqual(['details', 'edit', 'duplicate', 'delete']);
      for (const button of await page.locator('.shifts-toolbar-actions button').all()) {
        expect(await button.evaluate(node => node.scrollWidth <= node.clientWidth + 1)).toBe(true);
      }
    }
    const cell = row(page, 'second').locator('td.actions');
    await cell.scrollIntoViewIfNeeded();
    const bounds = await cell.boundingBox();
    for (const button of await cell.locator('button').all()) {
      const box = await button.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(32);
      expect(box.width).toBeLessThanOrEqual(40);
      expect(box.height).toBeGreaterThanOrEqual(32);
      expect(box.height).toBeLessThanOrEqual(48);
      expect(box.x).toBeGreaterThanOrEqual(bounds.x);
      expect(box.x + box.width).toBeLessThanOrEqual(bounds.x + bounds.width + 1);
    }
    await cell.locator('[data-row-action="edit"]').focus();
    await expect(cell.locator('[data-row-action="edit"]')).toBeFocused();
    await page.screenshot({ path: testInfo.outputPath('shift-row-actions.png'), fullPage: true });
    expect(state.writes).toEqual([]);
  });

  test('View and Edit target their row independently from selected checkboxes', async ({ page, shiftList }) => {
    const state = await shiftList();
    await row(page, 'first').locator('input[type="checkbox"]').check();
    await page.evaluate(() => {
      window.rowActionRoutes = [];
      document.addEventListener('partial:request', event => {
        window.rowActionRoutes.push(event.detail);
        event.stopImmediatePropagation();
      }, { capture: true });
    });
    await row(page, 'second').locator('[data-row-action="details"]').click();
    await row(page, 'second').locator('[data-row-action="edit"]').focus();
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.rowActionRoutes)).toEqual([
      { slug: 'visualize-shift', shiftId: 'second' },
      { slug: 'shift-form', mode: 'edit', shiftId: 'second' },
    ]);
    await expect(row(page, 'first').locator('input')).toBeChecked();
    await expect(row(page, 'second').locator('input')).not.toBeChecked();
    expect(state.writes).toEqual([]);
  });

  test('row Duplicate preserves the targeted programme and edition and ignores a repeated click', async ({ page, shiftList }) => {
    const gate = deferred();
    const state = await shiftList({ respond: async ({ path, method }) => {
      if (method === 'POST' && path.endsWith('/shifts/')) await gate.promise;
    } });
    await row(page, 'first').locator('input').check();
    await page.locator('th[data-sort-key="name"] button').click();
    const duplicate = row(page, 'second').locator('[data-row-action="duplicate"]');
    await duplicate.click();
    try {
      await expect.poll(() => state.writes.length).toBe(1);
      await expect(duplicate).toBeDisabled();
      await duplicate.evaluate(button => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      expect(state.writes).toHaveLength(1);
    } finally { gate.resolve(); }
    await expect(row(page, 'copy')).toBeVisible();
    expect(state.writes[0].body).toMatchObject({ bus_id: 'bus-2', trip_ids: ['second-out', 'second-service', 'second-return'] });
    expect(state.writes[0].body.name).toBe(`Beta duty ${translations.en['shifts.copy_suffix']}`);
    await expect(row(page, 'copy').locator('[data-role="gtfs-metadata"]')).toContainText('2025');
    await expect(row(page, 'first').locator('input')).toBeChecked();
  });

  for (const failure of ['detail', 'create']) {
    test(`row Duplicate recovers from ${failure} failure without changing another row`, async ({ page, shiftList }) => {
      const state = await shiftList({ respond: ({ path, method }) =>
        failure === 'detail' && path.endsWith('/shifts/second') && method === 'GET'
        || failure === 'create' && path.endsWith('/shifts/') && method === 'POST'
          ? { status: 503, json: { detail: 'Copy unavailable' } } : undefined });
      await page.locator('.language-select').selectOption('it');
      await row(page, 'second').locator('[data-row-action="duplicate"]').click();
      await expect(page.locator('section.shifts [data-role="flash"]')).toContainText('Copy unavailable');
      await expect(page.locator('section.shifts [data-role="flash"]')).toContainText(translations.it['shifts.unable_to_duplicate']);
      await expect(row(page, 'second').locator('[data-row-action="duplicate"]')).toBeEnabled();
      expect(state.rows).toHaveLength(2);
      expect(state.writes).toHaveLength(failure === 'detail' ? 0 : 1);
    });
  }

  test('cancelling row Delete sends no request and restores the action', async ({ page, shiftList }) => {
    const state = await shiftList();
    page.once('dialog', dialog => dialog.dismiss());
    await row(page, 'second').locator('[data-row-action="delete"]').click();
    await expect(row(page, 'second').locator('[data-row-action="delete"]')).toBeEnabled();
    await expect(topDelete(page)).toBeDisabled();
    expect(state.deletes).toEqual([]);
  });

  test('row Delete removes only its row while another row is selected', async ({ page, shiftList }) => {
    const state = await shiftList();
    await row(page, 'first').locator('input').check();
    page.once('dialog', dialog => dialog.accept());
    await row(page, 'second').locator('[data-row-action="delete"]').click();
    await expect(row(page, 'second')).toHaveCount(0);
    expect(state.deletes).toEqual(['second']);
    await expect(row(page, 'first').locator('input')).toBeChecked();
    await expect(topDelete(page)).toBeEnabled();
  });

  test('the top Delete removes all checked rows and becomes disabled when none remain', async ({ page, shiftList }) => {
    const state = await shiftList();
    await page.locator('section.shifts thead input[type="checkbox"]').check();
    await expect(topDelete(page)).toBeEnabled();
    page.once('dialog', dialog => dialog.accept());
    await topDelete(page).click();
    await expect(page.locator('section.shifts tbody tr[data-id]')).toHaveCount(0);
    expect(state.deletes.sort()).toEqual(['first', 'second']);
    await expect(topDelete(page)).toBeDisabled();
    await expect(page.locator('[data-action="add-shift"]')).toBeEnabled();
  });

  test('a protected row survives Delete and shows its dependency', async ({ page, shiftList }) => {
    const state = await shiftList({ respond: ({ method }) => method === 'DELETE' ? blocked : undefined });
    page.once('dialog', dialog => dialog.accept());
    await row(page, 'second').locator('[data-row-action="delete"]').click();
    await expect(page.locator('section.shifts [data-role="flash"]')).toContainText('Protected evaluation');
    await expect(row(page, 'second').locator('[data-row-action="delete"]')).toBeEnabled();
    expect(state.rows).toHaveLength(2);
  });

  test('partial batch deletion preserves the protected checked row for retry', async ({ page, shiftList }) => {
    const state = await shiftList({ respond: ({ path, method }) => method === 'DELETE' && path.endsWith('/second') ? blocked : undefined });
    await page.locator('section.shifts thead input').check();
    page.once('dialog', dialog => dialog.accept());
    await topDelete(page).click();
    await expect(row(page, 'first')).toHaveCount(0);
    await expect(row(page, 'second').locator('input')).toBeChecked();
    await expect(topDelete(page)).toBeEnabled();
    await expect(page.locator('section.shifts [data-role="flash"]')).toContainText('Protected evaluation');
    expect(state.deletes.sort()).toEqual(['first', 'second']);
  });
};
