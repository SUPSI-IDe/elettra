import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test.beforeEach(async ({ context }) => {
  await context.route("**/api/v1/version", route => route.fulfill({
    json: { version: "test" },
  }));
});

test("the optimized bundle opens authenticated home and returns from the guide", async ({ page, context }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await context.addInitScript(() => {
    localStorage.setItem("access_token", "bundle-home-test");
    localStorage.setItem("elettra.usageNotice.dismissed.v1", "true");
  });
  await context.route("**/auth/me", route => route.fulfill({ json: { id: "bundle-user", email: "bundle@example.invalid" } }));
  await context.route("**/api/v1/**", route => route.fulfill({ json: { version: "test" } }));
  await page.goto("./#landing");
  await expect(page).toHaveURL(/#home$/);
  await expect(page.locator(".home-card")).toHaveCount(6);
  await page.goto("./guide/");
  await page.locator('header [data-guide-ui="backToApp"]').click();
  await expect(page).toHaveURL(/#home$/);
  await expect(page.locator(".home-page")).toBeVisible();
  expect(errors).toEqual([]);
});

test("the optimized bundle renders the application and public guide", async ({
  page,
}) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("./#landing");

  await expect(page.locator(".landing-page")).toBeVisible();
  const guideLink = page.locator('.landing-page a[href="./guide/"]');
  await expect(guideLink).toBeVisible();

  await guideLink.click();
  await expect(page).toHaveURL(/\/elettra\/guide\/$/);
  await expect(page.locator("h1")).toContainText("ELETTRA");
  expect(pageErrors).toEqual([]);
});


test("the optimized guide packages diagnostic guidance and all current screenshots", async ({page}) => {
  const version=JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8')).version;
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto('./guide/');
  await expect(page.locator('.guide-meta')).toContainText(`Frontend v${version}`);
  await expect(page.locator('.guide-figure img')).toHaveCount(12);
  for(const image of await page.locator('.guide-figure img').all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(()=>image.evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);
  }
  for(const language of ['en','de','fr','it']) {
    await page.locator('#guide-language').selectOption(language);
    await expect(page.locator('#results')).toContainText('N/A');
    await expect(page.locator('#results')).toContainText('—');
    await expect(page.locator('#results img[src*="feasibility-infeasible"]')).toHaveCount(1);
    await expect(page.locator('#fleet img[src*="bus-model-battery"]')).toHaveCount(1);
    const steps = page.locator('#shifts .guide-item img');
    await expect(steps.nth(0)).toHaveAttribute('src', /shift-planner/);
    await expect(steps.nth(1)).toHaveAttribute('src', /shift-composer/);
  }
  expect(errors).toEqual([]);
});
