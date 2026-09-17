import { expect, test } from "@playwright/test";


test("the landing page opens the public user guide", async ({ page }) => {
  await page.goto("./#landing");

  await page.getByRole("link", { name: "User guide" }).click();

  await expect(page).toHaveURL(/\/elettra\/guide\/$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "ELETTRA user guide" })
  ).toBeVisible();
});


test("the guide translates, remembers the language and fits the viewport", async ({
  page,
}) => {
  await page.goto("./guide/");

  await expect(page.locator(".guide-figure img")).toHaveCount(8);
  await expect(page.locator(".guide-figure figcaption")).toHaveCount(8);
  for (const image of await page.locator(".guide-figure img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() =>
      image.evaluate((element) => element.complete && element.naturalWidth > 0)
    ).toBe(true);
  }

  await page.locator("#guide-language").selectOption("it");
  await expect(
    page.getByRole("heading", { level: 1, name: "Guida utente ELETTRA" })
  ).toBeVisible();

  await page.reload();

  await expect(page.locator("#guide-language")).toHaveValue("it");
  await expect(
    page.getByRole("heading", { level: 1, name: "Guida utente ELETTRA" })
  ).toBeVisible();
  await expect(page.locator(".guide-back-link")).toHaveAttribute("href", "../");

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalOverflow).toBe(false);
});
