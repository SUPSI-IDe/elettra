import { registerResultScopeLanguageTests } from '../../test-support/result-scope-language-scenarios.js';
import { test, expect } from '@playwright/test';
import { openSavedInfeasibility } from '../../test-support/deployed-infeasibility.js';
for (const mode of ['battery_only', 'charging_only', 'joint']) {
  for (const basis of ['mean', 'aggregate_q95']) {
    for (const source of ['result', 'diagnostic']) {
      test(`deployed ${mode} ${basis} ${source} renders the same saved limits after language changes`, async ({ page, baseURL }, info) => {
        const { saved, before, writes, errors } = await openSavedInfeasibility(page, { mode, basis, source, applicationURL: baseURL });
        const row = page.locator('[data-role="feasibility-critical-shifts"] tbody tr');
        await expect(row).toHaveCount(1);
        await expect(row.locator('td')).toHaveText(['8', '8', '10', '+2']);
        await expect(row).toHaveAttribute('data-source', source);
        await row.getByRole('button', { name: 'Current vehicle block', exact: true }).click();
        await expect(page.locator('[data-role="feasibility-shift-required-packs"] strong')).toHaveText('10 packs');
        await expect(page.locator('[data-role="feasibility-shift-common-packs"] strong')).toHaveText('8 packs');
        for (const language of ['it', 'de', 'fr', 'en']) {
          await page.locator('.language-select').selectOption(language);
          // The application remounts this page on language changes. Reselect
          // the block to verify numerical content independently of scope retention.
          await page.getByRole('tab', { name: 'Current vehicle block', exact: true }).click();
          await expect(page.locator('[data-role="feasibility-shift-level"]')).toBeVisible();
          await expect(page.locator('[data-role="aggregate-energy"] .result-kpis strong').first()).toHaveText('10 / 8');
          await expect(page.locator('[data-role="feasibility-shift-min-soc"], [data-role="feasibility-charging-plan"]')).toHaveCount(0);
          if (basis === 'aggregate_q95') {
            const consumption = page.locator('[data-role="feasibility-shift-predicted-consumption"]');
            await expect(consumption.locator('strong')).toHaveText('N/A');
            await consumption.getByRole('button').click();
            await expect(consumption.getByRole('tooltip')).toBeVisible();
            await expect(consumption.getByRole('tooltip')).toContainText('Q95');
            await consumption.getByRole('button').press('Escape');
          }
        }
        await page.screenshot({ path: info.outputPath('saved-infeasibility.png'), fullPage: true });
        expect(writes).toEqual([]);
        expect(errors).toEqual([]);
        expect(JSON.stringify(saved)).toBe(before);
      });
    }
  }
}

registerResultScopeLanguageTests(test, expect);
