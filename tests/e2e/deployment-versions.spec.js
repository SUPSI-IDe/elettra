import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const frontendVersion = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")).version;

test("versions remain visible while session validation is waiting", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("access_token", "local-pending-session"));
  let releaseSession;
  const sessionResponse = new Promise(resolve => { releaseSession = resolve; });
  await page.route("**/auth/me", async route => {
    await sessionResponse;
    await route.fulfill({status: 401, json: {detail: "Expired test session"}});
  });
  await page.route("**/api/v1/version", route => route.fulfill({json: {version: "1.2.3"}}));
  await page.goto("./");
  await expect(page.locator('[data-role="deployment-versions"]')).toHaveText(`Frontend v${frontendVersion} · Backend v1.2.3`);
  releaseSession();
});

test("footer shows the loaded frontend and the version returned by the backend", async ({ page }) => {
  await page.route("**/api/v1/version", async route => {
    await route.fulfill({ json: { version: "9.8.7-test" } });
  });
  await page.goto("./");
  const footer = page.locator('[data-role="deployment-versions"]');
  await expect(footer).toHaveText(`Frontend v${frontendVersion} · Backend v9.8.7-test`);
  await expect(footer).toBeVisible();
  expect(await footer.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

for (const response of [{ status: 503, json: {} }, { json: {} }]) {
  test(`footer remains usable without a backend version (${response.status ?? "empty"})`, async ({ page }) => {
    await page.route("**/api/v1/version", route => route.fulfill(response));
    await page.goto("./");
    await expect(page.locator('[data-role="deployment-versions"]')).toHaveText(`Frontend v${frontendVersion} · Backend unavailable`);
    await page.locator('.language-select').selectOption('it');
    await expect(page.locator('[data-role="deployment-versions"]')).toContainText('Backend non disponibile');
    await expect(page.locator('.layout-article')).toBeVisible();
  });
}
