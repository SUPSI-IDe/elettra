import { openSavedInfeasibility } from './deployed-infeasibility.js';

export function registerResultScopeLanguageTests(test, expect) {
  const tab = (page, key) => page.locator('[data-action="select-result-scope"][data-scope-key="' + key + '"]');
  const changeLanguage = async (page, state, language) => {
    const previous = state.runReads;
    await page.locator('.language-select').focus();
    await page.locator('.language-select').selectOption(language);
    await expect.poll(() => state.runReads).toBeGreaterThan(previous);
  };
  for (const scope of ['general', 'shift:critical']) {
    test(`language changes preserve the ${scope} result scope across all supported languages`, async ({ page, baseURL }) => {
      const state = await openSavedInfeasibility(page, { applicationURL: baseURL });
      await expect(tab(page, 'general')).toHaveAttribute('aria-selected', 'true');
      if (scope !== 'general') await tab(page, scope).click();
      for (const language of ['it', 'de', 'fr', 'en']) {
        await changeLanguage(page, state, language);
        await expect(tab(page, scope)).toHaveAttribute('aria-selected', 'true');
        await expect(tab(page, scope)).toHaveAttribute('tabindex', '0');
        await expect(page.locator('.language-select')).toBeFocused();
        if (scope !== 'general')
          await expect(page.locator('[data-role="aggregate-energy"] .result-kpis strong').first()).toHaveText('10 / 8');
      }
      expect(state.writes).toEqual([]);
      expect(state.errors).toEqual([]);
      expect(JSON.stringify(state.saved)).toBe(state.before);
    });
  }

  test('a removed selected vehicle block falls back to General on language refresh', async ({ page, baseURL }) => {
    const state = await openSavedInfeasibility(page, { applicationURL: baseURL });
    await tab(page, 'shift:critical').click();
    await expect(tab(page, 'shift:critical')).toHaveAttribute('aria-selected', 'true');
    const battery = state.saved.results.infeasibility_diagnostics.battery_results.critical;
    state.saved.input_params.shift_ids = ['replacement'];
    state.saved.results.infeasibility_diagnostics.battery_results = { replacement: { ...battery } };
    await changeLanguage(page, state, 'it');
    await expect(tab(page, 'general')).toHaveAttribute('aria-selected', 'true');
    await expect(tab(page, 'shift:critical')).toHaveCount(0);
    await expect(tab(page, 'shift:replacement')).toHaveCount(1);
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
  });

  test('opening another result view does not inherit the previous view scope', async ({ page, baseURL }) => {
    const state = await openSavedInfeasibility(page, { applicationURL: baseURL });
    await tab(page, 'shift:critical').click();
    await expect(tab(page, 'shift:critical')).toHaveAttribute('aria-selected', 'true');
    const previous = state.runReads;
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('partial:request', {
      detail: { slug: 'simulation-results', runId: 'rc3-saved' },
    })));
    await expect.poll(() => state.runReads).toBeGreaterThan(previous);
    await expect(tab(page, 'general')).toHaveAttribute('aria-selected', 'true');
    expect(state.writes).toEqual([]);
    expect(state.errors).toEqual([]);
  });

  for (const key of ['shift:critical', 'shift:removed']) {
    test(`restoring result scope ${key} validates the saved shift identifier`, async ({ page, baseURL }) => {
      const state = await openSavedInfeasibility(page, {
        applicationURL: baseURL, routeOptions: { resultScopeKey: key },
      });
      const expected = key === 'shift:critical' ? key : 'general';
      await expect(tab(page, expected)).toHaveAttribute('aria-selected', 'true');
      await changeLanguage(page, state, 'de');
      await expect(tab(page, expected)).toHaveAttribute('aria-selected', 'true');
      expect(state.writes).toEqual([]);
      expect(state.errors).toEqual([]);
    });
  }
}
