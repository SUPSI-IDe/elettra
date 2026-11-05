import { expect, test } from "@playwright/test";

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
