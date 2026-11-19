import { test, expect } from '@playwright/test';

export function defineFleetAddLabelTests() {
  test('fleet list Add buttons share a label and update when language changes', async ({ page }) => {
    const errors = [], unexpected = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('access_token', 'fleet-add-labels-test');
      localStorage.setItem('elettra_lang', 'en');
      localStorage.setItem('elettra.usageNotice.dismissed.v1', 'true');
    });
    await page.route('**/auth/me', route => route.fulfill({
      json: { id: 'user', company_id: 'company', role: 'analyst' },
    }));
    await page.route('**/api/v1/**', route => {
      const { pathname } = new URL(route.request().url());
      if (route.request().method() === 'GET') {
        if (pathname === '/api/v1/version') return route.fulfill({ json: { version: 'test' } });
        if (pathname === '/api/v1/agency/agencies/company') {
          return route.fulfill({ json: { id: 'company', gtfs_agency_id: 'agency' } });
        }
        if (/^\/api\/v1\/user\/(bus-models|depots|shifts)\/$/.test(pathname)) {
          return route.fulfill({ json: [] });
        }
      }
      unexpected.push(`${route.request().method()} ${pathname}`);
      return route.fulfill({ status: 500, json: { detail: 'Missing test mock' } });
    });

    for (const [section, action] of [
      ['buses', 'add-bus-model'],
      ['custom-stops', 'add-custom-stop'],
      ['shifts', 'add-shift'],
    ]) {
      await page.goto(`./#${section}`);
      const button = page.locator(`[data-action="${action}"]`);
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();
      await expect(button).toHaveAttribute('data-i18n', 'common.add');
      for (const [lang, label] of [['it', 'Aggiungi'], ['de', 'Hinzufügen'], ['fr', 'Ajouter'], ['en', 'Add']]) {
        await page.locator('.language-select').selectOption(lang);
        await expect(button).toHaveText(label);
        await expect(button).toHaveAccessibleName(label);
        const size = await button.evaluate(element => ({ client: element.clientWidth, scroll: element.scrollWidth }));
        expect(size.scroll, `${section}: ${lang} label fits`).toBeLessThanOrEqual(size.client + 1);
      }
    }
    expect(unexpected, 'Every API request has an explicit mock').toEqual([]);
    expect(errors, 'No uncaught browser errors').toEqual([]);
  });
}
