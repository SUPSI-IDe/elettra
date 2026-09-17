import { expect, test } from "@playwright/test";


const GUIDE_SECTIONS = [
  "start",
  "workflow",
  "fleet",
  "shifts",
  "feasibility",
  "results",
  "yearly",
  "comparison",
  "practice",
];

const LANGUAGES = {
  en: {
    landingLink: "User guide",
    guideTitle: "ELETTRA user guide",
    backLink: "Back to ELETTRA",
  },
  de: {
    landingLink: "Benutzerhandbuch",
    guideTitle: "ELETTRA-Benutzerhandbuch",
    backLink: "Zurück zu ELETTRA",
  },
  fr: {
    landingLink: "Guide d’utilisation",
    guideTitle: "Guide d’utilisation ELETTRA",
    backLink: "Retour à ELETTRA",
  },
  it: {
    landingLink: "Guida utente",
    guideTitle: "Guida utente ELETTRA",
    backLink: "Torna a ELETTRA",
  },
};

const expectLandingGuideLink = async (page, name = LANGUAGES.en.landingLink) => {
  await expect(page).toHaveURL(/\/elettra\/#landing$/);
  await expect(page.locator(".landing-page")).toBeVisible();
  await expect(page.locator('.landing-page a[href="./guide/"]')).toHaveCount(1);
  await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
};


test("the bare application URL opens the landing page with one guide link", async ({
  page,
}) => {
  await page.goto("./");

  await expectLandingGuideLink(page);
  await expect(page.locator('a[href="./guide/"]')).toHaveCount(1);
});


test("the guide link exists only on the landing view", async ({ page }) => {
  await page.goto("./#landing");
  await expectLandingGuideLink(page);

  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/elettra\/#login$/);
  await expect(page.locator('a[href="./guide/"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Back to landing page" }).click();
  await expectLandingGuideLink(page);

  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  await expect(page).toHaveURL(/\/elettra\/#register$/);
  await expect(page.locator('a[href="./guide/"]')).toHaveCount(0);

  await page.getByRole("button", { name: "Back to landing page" }).click();
  await expectLandingGuideLink(page);
});


test("the landing page opens the guide and browser history preserves the passage", async ({
  page,
}) => {
  await page.goto("./#landing");
  await page.getByRole("link", { name: LANGUAGES.en.landingLink, exact: true }).click();

  await expect(page).toHaveURL(/\/elettra\/guide\/$/);
  await expect(
    page.getByRole("heading", { level: 1, name: LANGUAGES.en.guideTitle })
  ).toBeVisible();

  await page.goBack();
  await expectLandingGuideLink(page);

  await page.goForward();
  await expect(page).toHaveURL(/\/elettra\/guide\/$/);
  await expect(
    page.getByRole("heading", { level: 1, name: LANGUAGES.en.guideTitle })
  ).toBeVisible();
});


test("both guide return links lead explicitly to the landing page", async ({ page }) => {
  for (const returnLink of ["header", "footer"]) {
    await page.goto("./guide/");

    const link = page.locator(`${returnLink} a[data-guide-ui="backToApp"]`);
    await expect(link).toHaveAttribute("href", "../#landing");
    await link.click();
    await expectLandingGuideLink(page);
  }
});


test("every guide section is reachable from the guide navigation", async ({ page }) => {
  await page.goto("./guide/");

  const navigationLinks = page.locator("#guide-nav a");
  await expect(navigationLinks).toHaveCount(GUIDE_SECTIONS.length);

  for (const sectionId of GUIDE_SECTIONS) {
    const link = page.locator(`#guide-nav a[href="#${sectionId}"]`);
    await expect(link).toHaveCount(1);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/elettra/guide/#${sectionId}$`));
    await expect(page.locator(`section#${sectionId} > h2`)).toBeInViewport();
  }
});


test("a direct guide-section URL can return to the landing page", async ({ page }) => {
  for (const sectionId of GUIDE_SECTIONS) {
    await page.goto(`./guide/#${sectionId}`);
    await expect(page.locator(`section#${sectionId} > h2`)).toBeInViewport();
    await page.locator('header a[data-guide-ui="backToApp"]').click();
    await expectLandingGuideLink(page);
  }
});


for (const [language, labels] of Object.entries(LANGUAGES)) {
  test(`landing-to-guide-to-landing preserves the ${language} language`, async ({
    page,
  }) => {
    await page.goto("./#landing");
    await page.locator(".language-select").selectOption(language);
    await expectLandingGuideLink(page, labels.landingLink);

    await page.getByRole("link", { name: labels.landingLink, exact: true }).click();
    await expect(page.locator("#guide-language")).toHaveValue(language);
    await expect(
      page.getByRole("heading", { level: 1, name: labels.guideTitle })
    ).toBeVisible();

    await page.reload();
    await expect(page.locator("#guide-language")).toHaveValue(language);
    await expect(
      page.getByRole("heading", { level: 1, name: labels.guideTitle })
    ).toBeVisible();

    await page.getByRole("link", { name: labels.backLink, exact: true }).first().click();
    await expect(page.locator(".language-select")).toHaveValue(language);
    await expectLandingGuideLink(page, labels.landingLink);
  });

  test(`a ${language} selection in the guide is retained on the landing page`, async ({
    page,
  }) => {
    await page.goto("./guide/");
    await page.locator("#guide-language").selectOption(language);
    await expect(
      page.getByRole("heading", { level: 1, name: labels.guideTitle })
    ).toBeVisible();

    await page.getByRole("link", { name: labels.backLink, exact: true }).first().click();
    await expect(page.locator(".language-select")).toHaveValue(language);
    await expectLandingGuideLink(page, labels.landingLink);
  });
}


test("the guide screenshots load and the guide fits the viewport", async ({ page }) => {
  await page.goto("./guide/");

  await expect(page.locator(".guide-figure img")).toHaveCount(8);
  await expect(page.locator(".guide-figure figcaption")).toHaveCount(8);
  for (const image of await page.locator(".guide-figure img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() =>
      image.evaluate((element) => element.complete && element.naturalWidth > 0)
    ).toBe(true);
  }

  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
  expect(hasHorizontalOverflow).toBe(false);
});
