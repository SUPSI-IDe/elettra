import { expect, test } from "@playwright/test";

const DISMISSED_KEY = "elettra.usageNotice.dismissed.v1";

const installApiMocks = async (context) => {
  await context.route("**/auth/**", (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/auth/login") {
      return route.fulfill({
        json: { access_token: "usage-notice-token", token_type: "bearer" },
      });
    }
    return route.fulfill({
      json: {
        id: "usage-notice-user",
        email: "notice@example.invalid",
        full_name: "Notice test",
      },
    });
  });
};

const signIn = async (page) => {
  await page.goto("./#login");
  await page.locator("#login-email").fill("notice@example.invalid");
  await page.locator("#login-password").fill("test-only-password");
  await page.locator('[data-action="submit-login"]').click();
  await expect(page).toHaveURL(/#home$/);
};

const signOut = async (page) => {
  await page.getByRole("button", { name: "User menu", exact: true }).click();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page).toHaveURL(/#login$/);
};

test.beforeEach(async ({ context, page }) => {
  await page.addInitScript((key) => localStorage.removeItem(key), DISMISSED_KEY);
  await installApiMocks(context);
});

test("the notice reappears until the browser preference is selected", async ({ page }) => {
  await signIn(page);

  const notice = page.getByRole("dialog", { name: "Important notice" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("preliminary feasibility analyses");
  await notice.getByRole("button", { name: "I understand" }).click();
  await expect(notice).toBeHidden();
  expect(await page.evaluate((key) => localStorage.getItem(key), DISMISSED_KEY)).toBeNull();

  await signOut(page);
  await signIn(page);
  await expect(notice).toBeVisible();

  await notice.getByRole("checkbox", {
    name: "Do not show this notice again in this browser",
  }).check();
  await notice.getByRole("button", { name: "I understand" }).click();
  expect(await page.evaluate((key) => localStorage.getItem(key), DISMISSED_KEY)).toBe("true");

  await signOut(page);
  await signIn(page);
  await expect(notice).toBeHidden();
});

test("a validated existing session receives the localized notice", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "usage-notice-token");
    localStorage.setItem("elettra_lang", "it");
  });

  await page.goto("./#home");

  const notice = page.getByRole("dialog", { name: "Avviso importante" });
  await expect(notice).toBeVisible();
  await expect(notice).toContainText("strumento libero e gratuito");
  await expect(notice.getByRole("checkbox")).toHaveAccessibleName(
    "Non mostrare più questo avviso su questo browser",
  );
});
