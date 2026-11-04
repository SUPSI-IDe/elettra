import { expect, test } from "@playwright/test";
import { guideContent } from "../../guide/content.js";

// Assert anchor destinations without racing smooth-scroll animations between clicks.
test.use({ reducedMotion: "reduce" });

const GUIDE_SECTIONS = [
  "use-cases",
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
    resultTerms: ["Start with General", "Check every vehicle block tab"],
    yearlyTerms: ["Use Efficiency, Costs and Emissions", "annual DC energy"],
  },
  de: {
    landingLink: "Benutzerhandbuch",
    guideTitle: "ELETTRA-Benutzerhandbuch",
    backLink: "Zurück zu ELETTRA",
    resultTerms: ["Mit Allgemein beginnen", "Jeden Fahrzeugumlauf prüfen"],
    yearlyTerms: ["Effizienz, Kosten und Emissionen verwenden", "jährlichen DC-Energie"],
  },
  fr: {
    landingLink: "Guide d’utilisation",
    guideTitle: "Guide d’utilisation ELETTRA",
    backLink: "Retour à ELETTRA",
    resultTerms: ["Commencer par Général", "Vérifier chaque service"],
    yearlyTerms: ["Utiliser Efficacité, Coûts et Émissions", "énergie DC annuelle"],
  },
  it: {
    landingLink: "Guida utente",
    guideTitle: "Guida utente ELETTRA",
    backLink: "Torna a ELETTRA",
    resultTerms: ["Iniziare da Generale", "Controllare ogni turno"],
    yearlyTerms: ["Usare Efficienza, Costi ed Emissioni", "energia DC annuale"],
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
  await expect(navigationLinks).toHaveCount(GUIDE_SECTIONS.length + 3);

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
  test(`use cases and workflow navigation are translated and fit the viewport in ${language}`, async ({ page }) => {
    await page.goto("./guide/#use-cases");
    await page.locator("#guide-language").selectOption(language);
    const content = guideContent[language].sections[0];
    const diagram = page.locator(".guide-flow");

    await expect(page.locator("#use-cases > h2")).toHaveText(content.title);
    await expect(diagram.locator("figcaption h3")).toHaveText(content.diagram.title);
    await expect(diagram.locator("figcaption p")).toHaveText(content.diagram.description);
    await expect(diagram).toHaveAccessibleName(content.diagram.title);
    await expect(diagram).toHaveAccessibleDescription(content.diagram.description);
    for (const label of Object.values(content.diagram)) {
      await expect(diagram).toContainText(label);
    }
    for (const item of content.items) {
      await expect(page.locator(`#${item.id} > h3`)).toContainText(item.title);
      await expect(page.locator(`#${item.id}`)).toContainText(item.scope);
      await diagram.locator(`a[href="#${item.id}"]`).first().click();
      await expect(page.locator(`#${item.id} > h3`)).toBeInViewport();
      await expect(page).toHaveURL(new RegExp(`#${item.id}$`));
      await page.locator(`#guide-nav a[href="#${item.id}"]`).click();
      await expect(page.locator(`#${item.id} > h3`)).toBeInViewport();
    }
    const invalidLinks = await page.locator('#use-cases a[href^="#"]').evaluateAll((links) =>
      links.filter((link) => !document.getElementById(link.hash.slice(1))).map((link) => link.hash)
    );
    expect(invalidLinks).toEqual([]);
    await diagram.locator(".guide-flow-revise").click();
    await expect(diagram.locator("h3")).toBeInViewport();
    await diagram.locator('a[href="#yearly"]').click();
    await expect(page.locator("#yearly > h2")).toBeInViewport();
    await diagram.locator('a[href="#comparison"]').click();
    await expect(page.locator("#comparison > h2")).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.reload();
    await expect(page.locator("#guide-language")).toHaveValue(language);
    await expect(page.locator("#comparison > h2")).toBeInViewport();
    await page.setViewportSize({ width: 320, height: 720 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });

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
    for (const term of labels.resultTerms) {
      await expect(page.locator("section#results")).toContainText(term);
    }
    for (const term of labels.yearlyTerms) {
      await expect(page.locator("section#yearly")).toContainText(term);
    }

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

test("switching languages preserves the active use-case anchor and updates its diagram", async ({ page }) => {
  await page.goto("./guide/#use-case-charging");
  for (const language of ["de", "fr", "it", "en"]) {
    await page.locator("#guide-language").selectOption(language);
    await expect(page).toHaveURL(/#use-case-charging$/);
    await expect(page.locator("#use-case-charging > h3")).toBeInViewport();
    await expect(page.locator(".guide-flow-decision")).toHaveText(guideContent[language].sections[0].diagram.decision);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
  }
});


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
