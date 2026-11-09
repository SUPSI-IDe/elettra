import { expect, test } from "@playwright/test";
import { translations } from "../../src/i18n/translations.js";

const updateGuideScreenshots = process.env.UPDATE_GUIDE_SCREENSHOTS === "1";

const seedSession = async (context) => context.addInitScript(() => {
  // Seed once: logout and expiry must still survive a full page reload.
  if (!localStorage.getItem("home-test-initialized")) {
    localStorage.setItem("access_token", "home-test-token");
    localStorage.setItem("home-test-initialized", "true");
  }
});

test.beforeEach(async ({ context }) => {
  await context.route("**/auth/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/auth/login") {
      return route.fulfill({ json: { access_token: "home-test-token", token_type: "bearer" } });
    }
    return route.fulfill({ json: { id: "home-user", email: "home@example.invalid", full_name: "Home test" } });
  });
  await context.route("**/api/v1/**", (route) => route.fulfill({
    json: route.request().url().endsWith("/version") ? { version: "test" } : [],
  }));
});

const expectHome = async (page) => {
  await expect(page).toHaveURL(/\/elettra\/#home$/);
  await expect(page.locator(".home-page")).toBeVisible();
  await expect(page.locator(".home-card")).toHaveCount(6);
  await expect(page.locator(".landing-page, .login-page, .register-page")).toHaveCount(0);
  await expect(page.locator('.nav-links [data-partial="home"]')).toHaveAttribute("aria-current", "page");
};

const openMenu = async (page) => {
  if (await page.locator(".nav-toggle").isVisible()) await page.locator(".nav-toggle").click();
};

test("visitors see the public landing and home requires login", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator(".landing-page")).toBeVisible();
  await page.goto("./#home");
  await expect(page).toHaveURL(/#login$/);
  await expect(page.locator(".login-page")).toBeVisible();
  await expect(page.locator("#primary-nav")).toBeHidden();
});

test("successful login opens home and Back never displays a guest screen", async ({ page }) => {
  await page.goto("./#login");
  await page.locator("#login-email").fill("home@example.invalid");
  await page.locator("#login-password").fill("test-only-password");
  await page.locator('[data-action="submit-login"]').click();
  await expectHome(page);
  await page.goBack();
  await expectHome(page);
  await page.goForward();
  await expectHome(page);
  await page.reload();
  await expectHome(page);
});

test("existing sessions resolve the root and guest URLs to home", async ({ page, context }) => {
  await seedSession(context);
  for (const url of ["./", "./#landing", "./#login", "./#register", "./#home"]) {
    await page.goto(url);
    await expectHome(page);
  }
});

test("all six cards open their section and the logo returns home", async ({ page, context }) => {
  await seedSession(context);
  await page.goto("./");
  const routes = ["buses", "custom-stops", "shifts", "simulation-runs", "yearly-analysis-runs", "analysis-comparison"];
  for (const slug of routes) {
    await expectHome(page);
    await page.locator(`[data-home-route="${slug}"]`).click();
    await expect(page).toHaveURL(new RegExp(`#${slug}$`));
    await expect(page.locator(".home-page")).toHaveCount(0);
    await expect(page.locator(`.nav-links [data-partial="${slug}"]`)).toHaveAttribute("aria-current", "page");
    await openMenu(page);
    await page.getByRole("link", { name: "ELETTRA home", exact: true }).click();
    await expectHome(page);
    if (await page.locator(".nav-toggle").isVisible()) await expect(page.locator("#primary-nav")).not.toBeVisible();
  }
});

test("deep links, the Home menu entry, keyboard logo and history stay usable", async ({ page, context }) => {
  await seedSession(context);
  await page.goto("./#buses");
  await expect(page).toHaveURL(/#buses$/);
  await expect(page.locator(".home-page")).toHaveCount(0);
  await openMenu(page);
  await page.locator('.nav-links [data-partial="home"]').click();
  await expectHome(page);
  await page.goBack();
  await expect(page).toHaveURL(/#buses$/);
  await page.goForward();
  await expectHome(page);
  await page.locator(".footer-about-link").click();
  await expect(page).toHaveURL(/#about$/);
  await openMenu(page);
  await page.locator("a.logo").focus();
  await page.keyboard.press("Enter");
  await expectHome(page);
});

test("guide opened from the sidebar returns to home with the session intact", async ({ page, context }) => {
  await seedSession(context);
  await page.goto("./#home");
  await expectHome(page);
  await openMenu(page);
  const popup = page.waitForEvent("popup");
  await page.locator(".nav-guide-link").click();
  const guide = await popup;
  await expect(guide).toHaveURL(/\/guide\/$/);
  await guide.locator('header [data-guide-ui="backToApp"]').click();
  await expectHome(guide);
  await expect(guide.locator(".user-name")).toHaveText("Home test");
});

test("returning home cancels a slower page that is still loading", async ({ page, context }) => {
  await seedSession(context);
  await page.goto("./#home");
  await expectHome(page);
  let releasePage;
  let requestedPage;
  const release = new Promise(resolve => { releasePage = resolve; });
  const requested = new Promise(resolve => { requestedPage = resolve; });
  await page.route("**/pages/About/about.html?**", async route => {
    requestedPage(route.request().url());
    await release;
    await route.continue();
  });
  await page.locator(".footer-about-link").click();
  const pendingUrl = await requested;
  await openMenu(page);
  await page.locator("a.logo").click();
  await expectHome(page);
  const finished = page.waitForResponse(response => response.url().includes("/pages/About/about.html?"));
  releasePage();
  await (await finished).finished();
  // Let the superseded import resolve before checking the rendered page.
  await page.evaluate(async url => { await import(url); }, pendingUrl);
  await expectHome(page);
});

test("both guide return links resolve authenticated direct visits to home", async ({ page, context }) => {
  await seedSession(context);
  for (const selector of ["header", "footer"]) {
    await page.goto("./guide/#yearly");
    await page.locator(`${selector} [data-guide-ui="backToApp"]`).click();
    await expectHome(page);
  }
});

test("session expiry in the guide returns to the public landing", async ({ page, context }) => {
  await seedSession(context);
  await page.goto("./#home");
  await expectHome(page);
  await page.goto("./guide/");
  await context.route("**/auth/me", (route) => route.fulfill({ status: 401, json: { detail: "Expired session" } }));
  await page.locator('header [data-guide-ui="backToApp"]').click();
  await expect(page).toHaveURL(/#landing$/);
  await expect(page.locator(".landing-page")).toBeVisible();
  await expect(page.locator("#primary-nav")).toBeHidden();
  await page.goto("./#home");
  await expect(page).toHaveURL(/#login$/);
});

test("logout protects home even through browser history and reload", async ({ page, context }) => {
  await seedSession(context);
  await page.goto("./#home");
  await expectHome(page);
  await page.getByRole("button", { name: "User menu", exact: true }).click();
  await page.getByRole("button", { name: "Logout", exact: true }).click();
  await expect(page).toHaveURL(/#login$/);
  await page.goBack();
  await expect(page).toHaveURL(/#login$/);
  await expect(page.locator(".home-page")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".login-page")).toBeVisible();
});

for (const lang of ["en", "it", "de", "fr"]) {
  test(`home and guide chapters are translated and responsive in ${lang}`, async ({ page, context }, testInfo) => {
    await seedSession(context);
    await page.goto("./#home");
    await page.locator(".language-select").selectOption(lang);
    await expectHome(page);
    const dict = translations[lang];
    const labels = page.locator(".home-page [data-i18n]");
    for (const label of await labels.all()) {
      await expect(label).toHaveText(dict[await label.getAttribute("data-i18n")]);
    }
    for (const link of await page.locator(".home-chapter-link").all()) {
      await expect(link).toHaveAttribute("target", "_blank");
      const popup = page.waitForEvent("popup");
      await link.click();
      const guide = await popup;
      const chapter = new URL(guide.url()).hash;
      await expect(guide.locator(`${chapter} > h2`)).toBeVisible();
      await expect(guide.locator("#guide-language")).toHaveValue(lang);
      await guide.close();
    }
    await page.reload();
    await expectHome(page);
    await expect(page.locator(".home-intro h1")).toHaveText(dict["home.title"]);
    await page.setViewportSize({ width: testInfo.project.name === "chromium" ? 1440 : 390, height: 1100 });
    const screenshot = testInfo.outputPath(`home-${lang}.png`);
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach("Home layout", { path: screenshot, contentType: "image/png" });
    if (updateGuideScreenshots && lang === "en") {
      await page.screenshot({
        path: "guide/images/application-shell.png",
        fullPage: true,
      });
    }
    for (const width of [1440, 820, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      expect(await page.locator(".home-page").evaluate(el => el.scrollWidth > el.clientWidth)).toBe(false);
    }
  });
}
