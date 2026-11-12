import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const frontendVersion = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
).version;

test("the version lookup starts while session validation is waiting", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("access_token", "local-pending-session"));
  let releaseSession;
  const sessionResponse = new Promise((resolve) => { releaseSession = resolve; });
  await page.route("**/auth/me", async (route) => {
    await sessionResponse;
    await route.fulfill({
      json: {
        id: "version-test-user",
        email: "version@example.invalid",
        full_name: "Version test",
      },
    });
  });
  await page.route("**/api/v1/version", (route) =>
    route.fulfill({ json: { version: "1.2.3" } }));

  const versionRequest = page.waitForRequest("**/api/v1/version");
  const navigation = page.goto("./#about");
  await versionRequest;
  releaseSession();
  await navigation;

  await expect(page.locator('[data-role="frontend-version"]')).toHaveText(`v${frontendVersion}`);
  await expect(page.locator('[data-role="backend-version"]')).toHaveText("v1.2.3");
});

test("About shows the loaded frontend and the version returned by the backend", async ({ page }) => {
  await page.route("**/api/v1/version", (route) =>
    route.fulfill({ json: { version: "9.8.7-test" } }));

  await page.goto("./#about");

  await expect(page.getByRole("heading", { name: "Application versions" })).toBeVisible();
  await expect(page.locator('[data-role="frontend-version"]')).toHaveText(`v${frontendVersion}`);
  await expect(page.locator('[data-role="backend-version"]')).toHaveText("v9.8.7-test");
  await expect(page.locator("footer")).not.toContainText("Frontend");
});

for (const response of [{ status: 503, json: {} }, { json: {} }]) {
  test(`About remains usable without a backend version (${response.status ?? "empty"})`, async ({ page }) => {
    await page.route("**/api/v1/version", (route) => route.fulfill(response));
    await page.goto("./#about");

    await expect(page.locator('[data-role="backend-version"]')).toHaveText("Unavailable");
    await page.locator(".language-select").selectOption("it");
    await expect(page.locator('[data-role="backend-version"]')).toHaveText("Non disponibile");
    await expect(page.locator(".about-page")).toBeVisible();
  });
}
