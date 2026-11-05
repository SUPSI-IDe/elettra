import { expect, test } from "@playwright/test";

test("the optimized bundle opens authenticated home and returns from the guide", async ({ page, context }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await context.addInitScript(() => localStorage.setItem("access_token", "bundle-home-test"));
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
