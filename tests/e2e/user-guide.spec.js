import { expect, test } from "@playwright/test";
import { guideContent } from "../../guide/content.js";

// Assert anchor destinations without racing smooth-scroll animations between clicks.
test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/version", (route) => route.fulfill({
    json: { version: "user-guide-test" },
  }));
  await page.route("**/api/v1/agency/agencies/**", (route) => route.fulfill({
    json: [],
  }));
});

const figureCount = guideContent.en.sections.flatMap(({ figures = [], items }) =>
  [...figures, ...items.flatMap(item => item.figures ?? [])]
).length;

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
    yearlyTerms: ["Review Costs and Emissions for the fleet", "physical bus count"],
    releaseTerms: {
      start: ["Home", "user guide"],
      fleet: ["9–13 m", "17–19 m", "LFP", "NMC", "Restore estimate", "Details opens a read-only view", "Line A_copy, Line A_copy_1"],
      shifts: ["GTFS", "complete server-side list", "Space-time", "Map", "Duplicate saves a copy immediately", "Use Edit on the saved copy", "Manage intermediate stays", "Apply to block or Cancel"],
      feasibility: ["one GTFS edition", "Duplicate", "1 plug", "N blocks", "150 × N"],
      results: ["Configured SOC window", "initial physical-maximum reference", "Export the complete feasibility evaluation", "Check export availability"],
      yearly: ["recorded provenance", "complete fleet", "schema 4", "schema 3", "Check the save status before closing", "previous response", "Retry"],
    },
  },
  de: {
    landingLink: "Benutzerhandbuch",
    guideTitle: "ELETTRA-Benutzerhandbuch",
    backLink: "Zurück zu ELETTRA",
    resultTerms: ["Mit Allgemein beginnen", "Jeden Fahrzeugumlauf prüfen"],
    yearlyTerms: ["Kosten und Emissionen der Flotte prüfen", "Anzahl physischer Busse"],
    releaseTerms: {
      start: ["Startseite", "Benutzerhandbuch"],
      fleet: ["9–13 m", "17–19 m", "LFP", "NMC", "Schätzwert wiederherstellen", "Details öffnet eine schreibgeschützte Ansicht", "Linie A_Kopie, Linie A_Kopie_1"],
      shifts: ["GTFS", "vollständige serverseitige Liste", "Weg-Zeit", "Karte", "Duplizieren speichert sofort eine Kopie", "Bearbeiten in der Zeile der Kopie", "Zwischenaufenthalte bearbeiten", "In Umlauf übernehmen oder Abbrechen"],
      feasibility: ["GTFS-Ausgabe", "Duplizieren", "1 Ladepunkt", "N Umläufe", "150 × N"],
      results: ["Konfiguriertes SOC-Fenster", "physischen Maximum", "Die vollständige Machbarkeitsbewertung exportieren", "Verfügbarkeit des Exports prüfen"],
      yearly: ["aufgezeichnete Herkunft", "gesamte Flotte", "Schema 4", "Schema 3", "Speicherstatus vor dem Schliessen prüfen", "frühere Antwort", "Erneut versuchen"],
    },
  },
  fr: {
    landingLink: "Guide d’utilisation",
    guideTitle: "Guide d’utilisation ELETTRA",
    backLink: "Retour à ELETTRA",
    resultTerms: ["Commencer par Général", "Vérifier chaque service"],
    yearlyTerms: ["Examiner les Coûts et les Émissions de la flotte", "nombre de bus physiques"],
    releaseTerms: {
      start: ["Accueil", "guide"],
      fleet: ["9 à 13 m", "17 à 19 m", "LFP", "NMC", "Rétablir l’estimation", "Détails ouvre une vue en lecture seule", "Ligne A_copie, Ligne A_copie_1"],
      shifts: ["GTFS", "liste complète côté serveur", "Espace-temps", "Carte", "Dupliquer enregistre immédiatement une copie", "Modifier sur la copie enregistrée", "Gérer les pauses intermédiaires", "Appliquer au service ou Annuler"],
      feasibility: ["édition GTFS", "Dupliquer", "1 prise", "N services", "150 × N"],
      results: ["Fenêtre SOC configurée", "maximum physique", "Exporter l’évaluation de faisabilité complète", "Vérifier la disponibilité de l’export"],
      yearly: ["provenance enregistrée", "flotte complète", "schéma 4", "schéma 3", "Vérifier l’état de sauvegarde avant de fermer", "réponse précédente", "Réessayer"],
    },
  },
  it: {
    landingLink: "Guida utente",
    guideTitle: "Guida utente ELETTRA",
    backLink: "Torna a ELETTRA",
    resultTerms: ["Iniziare da Generale", "Controllare ogni turno"],
    yearlyTerms: ["Esaminare Costi ed Emissioni della flotta", "numero di bus fisici"],
    releaseTerms: {
      start: ["Home", "guida utente"],
      fleet: ["9–13 m", "17–19 m", "LFP", "NMC", "Ripristina stima", "Dettagli apre una vista in sola lettura", "Linea A_copia, Linea A_copia_1"],
      shifts: ["GTFS", "elenco completo sul server", "Spazio-tempo", "Mappa", "Duplica salva subito una copia", "Modifica sulla copia salvata", "Gestisci soste intermedie", "Applica al turno o Annulla"],
      feasibility: ["una sola edizione GTFS", "Duplica", "1 presa", "N turni", "150 × N"],
      results: ["Intervallo SOC configurato", "massimo fisico", "Esportare la valutazione di fattibilità completa", "Verificare la disponibilità dell’esportazione"],
      yearly: ["provenienza registrata", "flotta completa", "schema 4", "schema 3", "Controllare lo stato del salvataggio prima di chiudere", "risposte precedenti", "Riprova"],
    },
  },
};

const expectLandingGuideLink = async (page, name = LANGUAGES.en.landingLink) => {
  await page.waitForLoadState("load");
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
  await expect(page.locator('#primary-nav a[href="./guide/"]')).toHaveCount(1);
  await expect(page.locator('#primary-nav a[href="./guide/"]')).toBeHidden();
});


test("the public guide link stays on the landing view while the authenticated link stays hidden", async ({ page }) => {
  await page.goto("./#landing");
  await expectLandingGuideLink(page);
  const sidebarLink = page.locator("#primary-nav .nav-guide-link");
  await expect(sidebarLink).toHaveCount(1);
  await expect(sidebarLink).toBeHidden();

  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(/\/elettra\/#login$/);
  await expect(page.locator('.landing-page a[href="./guide/"]')).toHaveCount(0);
  await expect(sidebarLink).toBeHidden();

  await page.getByRole("button", { name: "Back to landing page" }).click();
  await expectLandingGuideLink(page);

  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  await expect(page).toHaveURL(/\/elettra\/#register$/);
  await expect(page.locator('.landing-page a[href="./guide/"]')).toHaveCount(0);
  await expect(sidebarLink).toBeHidden();

  await page.getByRole("button", { name: "Back to landing page" }).click();
  await expectLandingGuideLink(page);
});


test("the authenticated sidebar opens the translated guide in a new tab", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("access_token", "user-guide-test-token");
    localStorage.setItem("elettra_lang", "it");
  });
  await page.route("**/auth/me", (route) => route.fulfill({
    json: { id: "guide-user", email: "guide@example.invalid" },
  }));

  await page.goto("./#about");
  const sidebarLink = page.locator("#primary-nav .nav-guide-link");
  if (!(await sidebarLink.isVisible())) {
    await page.locator(".nav-toggle").click();
  }
  await expect(sidebarLink).toBeVisible();
  await expect(sidebarLink).toHaveText(/Guida utente/);
  await expect(sidebarLink).toHaveAttribute("target", "_blank");
  await expect(sidebarLink).toHaveAttribute("rel", "noopener noreferrer");
  await expect(sidebarLink).toHaveAttribute(
    "aria-label",
    "Guida utente (si apre in una nuova scheda)",
  );

  const [navigationBox, guideLinkBox] = await Promise.all([
    page.locator("#primary-nav").boundingBox(),
    sidebarLink.boundingBox(),
  ]);
  expect(navigationBox).not.toBeNull();
  expect(guideLinkBox).not.toBeNull();
  const bottomGap =
    navigationBox.y + navigationBox.height - (guideLinkBox.y + guideLinkBox.height);
  expect(bottomGap).toBeGreaterThanOrEqual(0);
  expect(bottomGap).toBeLessThanOrEqual(16);

  const popupPromise = page.waitForEvent("popup");
  await sidebarLink.click();
  const guide = await popupPromise;
  await expect(guide).toHaveURL(/\/elettra\/guide\/$/);
  await expect(guide.getByRole("heading", { level: 1, name: "Guida utente ELETTRA" })).toBeVisible();
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


test("both guide return links resolve to the landing page for visitors", async ({ page }) => {
  for (const returnLink of ["header", "footer"]) {
    await page.goto("./guide/");

    const link = page.locator(`${returnLink} a[data-guide-ui="backToApp"]`);
    await expect(link).toHaveAttribute("href", "../");
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
  const returnLink = page.locator('header a[data-guide-ui="backToApp"]');
  for (const sectionId of GUIDE_SECTIONS) {
    await page.goto(`./guide/#${sectionId}`);
    await expect(page.locator(`section#${sectionId} > h2`)).toBeInViewport();
    await expect(returnLink).toHaveAttribute("href", "../");
  }
  await returnLink.click();
  await expectLandingGuideLink(page);
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
    for (const [sectionId, terms] of Object.entries(labels.releaseTerms)) {
      for (const term of terms) {
        await expect(page.locator(`section#${sectionId}`)).toContainText(term);
      }
    }

    await page.reload();
    await expect(page.locator("#guide-language")).toHaveValue(language);
    await expect(
      page.getByRole("heading", { level: 1, name: labels.guideTitle })
    ).toBeVisible();

    await page.getByRole("link", { name: labels.backLink, exact: true }).first().click();
    await page.waitForLoadState("load");
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
    await page.waitForLoadState("load");
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


test("the workflow opens Mean and Q95 guidance in the selected language", async ({ page }) => {
  await page.goto("./guide/#workflow");
  await page.locator('#workflow a[href="#mean-q95"]').click();
  for (const lang of ["de", "fr", "it", "en"]) {
    await page.locator("#guide-language").selectOption(lang);
    const results = guideContent[lang].sections.find(section => section.id === "results");
    const item = results.items.find(item => item.id === "mean-q95");
    const heading = page.locator("#results #mean-q95").getByRole("heading", { level: 3, name: item.title, exact: true });
    await expect(heading).toBeInViewport();
    await expect(page).toHaveURL(/#mean-q95$/);
  }
});

test("each guide language has its own screenshots and matching full-size links", async ({ page }) => {
  await page.goto("./guide/#shifts");
  const visited = new Set();
  for (const language of ["en", "de", "fr", "it"]) {
    await page.locator("#guide-language").selectOption(language);
    const images = page.locator(".guide-figure img");
    await expect(images).toHaveCount(figureCount);
    const sources = await images.evaluateAll(elements => elements.map(img => [img.src, img.closest("a").href]));
    for (const [src, fullSize] of sources) {
      expect(fullSize).toBe(src);
      expect(visited.has(src)).toBe(false);
      visited.add(src);
    }
  }
  expect(visited.size).toBe(figureCount * Object.keys(LANGUAGES).length);
});

test("the guide screenshots load and the guide fits the viewport", async ({ page }) => {
  await page.goto("./guide/");

  await expect(page.locator(".guide-figure img")).toHaveCount(figureCount);
  await expect(page.locator(".guide-figure figcaption")).toHaveCount(figureCount);
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

for (const [language, labels] of Object.entries({
  en: {battery:'Read infeasible battery estimates',status:'Distinguish infeasible, failed and unavailable',q95:'Interpret missing Q95 consumption',help:'Find contextual help'},
  de: {battery:'Batterieschätzungen bei Nichtmachbarkeit lesen',status:'Nicht machbar, fehlgeschlagen und nicht verfügbar unterscheiden',q95:'Fehlenden Q95-Verbrauch einordnen',help:'Kontexthilfe finden'},
  fr: {battery:'Lire les estimations de batterie non faisables',status:'Distinguer non-faisabilité, échec et résultat indisponible',q95:'Interpréter une consommation Q95 absente',help:'Trouver les explications contextuelles'},
  it: {battery:'Leggere le stime di batteria nei casi non fattibili',status:'Distinguere non fattibilità, calcolo non riuscito e dato indisponibile',q95:'Interpretare il consumo Q95 mancante',help:'Trovare le spiegazioni contestuali'},
})) {
  test(`diagnostic guidance, Q95 availability and new screenshots are readable in ${language}`, async ({page}) => {
    const errors=[];
    const failed=[];
    page.on('pageerror',error => errors.push(error.message));
    page.on('requestfailed',request => failed.push(request.url()));
    await page.goto('./guide/#results');
    await page.locator('#guide-language').selectOption(language);
    const result=page.locator('#results');
    for(const title of Object.values(labels)) {
      const heading=result.getByRole('heading',{name:title,exact:true});
      await heading.scrollIntoViewIfNeeded();
      await expect(heading).toBeVisible();
    }
    const q95=result.locator('.guide-item').filter({has:page.getByRole('heading',{name:labels.q95,exact:true})});
    await expect(q95).toContainText('N/A');
    await expect(q95).toContainText('—');
    for(const [section,suffix] of [['results','feasibility-infeasible'],['shifts','shift-composer']]) {
      const image=page.locator(`#${section} img`);
      const sources=await image.evaluateAll(images => images.map(img=>img.src));
      expect(sources.some(src=>src.includes(suffix))).toBe(true);
      await expect(image).toHaveCount(3);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.setViewportSize({width:320,height:720});
    await result.getByRole('heading',{name:labels.q95,exact:true}).scrollIntoViewIfNeeded();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
  });
}
