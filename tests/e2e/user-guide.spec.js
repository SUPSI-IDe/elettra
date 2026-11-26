import { expect, test } from "@playwright/test";
import {
  GUIDE_BACKEND_BASELINE_VERSION,
  GUIDE_BASELINE_VERSION,
  guideContent,
} from "../../guide/content.js";

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

const OPERATING_CHAPTERS = [
  "fleet",
  "shifts",
  "feasibility",
  "results",
  "yearly",
  "comparison",
];
const REFERENCE_CHAPTERS = ["start", "practice", "api"];
const GUIDE_SECTIONS = ["use-cases", ...OPERATING_CHAPTERS, ...REFERENCE_CHAPTERS];

const LANGUAGES = {
  en: {
    landingLink: "User guide",
    guideTitle: "ELETTRA user guide",
    backLink: "Back to ELETTRA",
    navGroups: ["Operating guide", "Reference"],
    resultTerms: ["Start with General", "Check every vehicle block tab"],
    yearlyTerms: ["Review Costs and Emissions for the fleet", "physical bus count"],
    releaseTerms: {
      start: ["Home", "user guide"],
      fleet: ["9–13 m", "17–19 m", "LFP", "NMC", "Restore estimate", "Details opens a read-only view", "Line A_copy, Line A_copy_1"],
      shifts: ["GTFS", "complete server-side list", "Space-time", "Map", "Duplicate saves a copy immediately", "Use Edit on the saved copy", "Insert before", "Undo last change"],
      feasibility: ["one GTFS edition", "Duplicate", "1 plug", "N blocks", "150 × N"],
      results: ["Configured SOC window", "initial physical-maximum reference", "Export the complete feasibility evaluation", "Check export availability"],
      yearly: ["recorded provenance", "complete fleet", "schema 4", "schema 3", "Check the save status before closing", "previous response", "Retry"],
    },
  },
  de: {
    landingLink: "Benutzerhandbuch",
    guideTitle: "ELETTRA-Benutzerhandbuch",
    backLink: "Zurück zu ELETTRA",
    navGroups: ["Bedienungsanleitung", "Zum Nachschlagen"],
    resultTerms: ["Mit Allgemein beginnen", "Jeden Fahrzeugumlauf prüfen"],
    yearlyTerms: ["Kosten und Emissionen der Flotte prüfen", "Anzahl physischer Busse"],
    releaseTerms: {
      start: ["Startseite", "Benutzerhandbuch"],
      fleet: ["9–13 m", "17–19 m", "LFP", "NMC", "Schätzwert wiederherstellen", "Details öffnet eine schreibgeschützte Ansicht", "Linie A_Kopie, Linie A_Kopie_1"],
      shifts: ["GTFS", "vollständige serverseitige Liste", "Weg-Zeit", "Karte", "Duplizieren speichert sofort eine Kopie", "Bearbeiten in der Zeile der Kopie", "Davor einfügen", "Letzte Änderung rückgängig machen"],
      feasibility: ["GTFS-Ausgabe", "Duplizieren", "1 Ladepunkt", "N Umläufe", "150 × N"],
      results: ["Konfiguriertes SOC-Fenster", "physischen Maximum", "Die vollständige Machbarkeitsbewertung exportieren", "Verfügbarkeit des Exports prüfen"],
      yearly: ["aufgezeichnete Herkunft", "gesamte Flotte", "Schema 4", "Schema 3", "Speicherstatus vor dem Schliessen prüfen", "frühere Antwort", "Erneut versuchen"],
    },
  },
  fr: {
    landingLink: "Guide d’utilisation",
    guideTitle: "Guide d’utilisation ELETTRA",
    backLink: "Retour à ELETTRA",
    navGroups: ["Guide pratique", "Références"],
    resultTerms: ["Commencer par Général", "Vérifier chaque service"],
    yearlyTerms: ["Examiner les Coûts et les Émissions de la flotte", "nombre de bus physiques"],
    releaseTerms: {
      start: ["Accueil", "guide"],
      fleet: ["9 à 13 m", "17 à 19 m", "LFP", "NMC", "Rétablir l’estimation", "Détails ouvre une vue en lecture seule", "Ligne A_copie, Ligne A_copie_1"],
      shifts: ["GTFS", "liste complète côté serveur", "Espace-temps", "Carte", "Dupliquer enregistre immédiatement une copie", "Modifier sur la copie enregistrée", "Insérer avant", "Annuler la dernière modification"],
      feasibility: ["édition GTFS", "Dupliquer", "1 prise", "N services", "150 × N"],
      results: ["Fenêtre SOC configurée", "maximum physique", "Exporter l’évaluation de faisabilité complète", "Vérifier la disponibilité de l’export"],
      yearly: ["provenance enregistrée", "flotte complète", "schéma 4", "schéma 3", "Vérifier l’état de sauvegarde avant de fermer", "réponse précédente", "Réessayer"],
    },
  },
  it: {
    landingLink: "Guida utente",
    guideTitle: "Guida utente ELETTRA",
    backLink: "Torna a ELETTRA",
    navGroups: ["Guida operativa", "Riferimenti"],
    resultTerms: ["Iniziare da Generale", "Controllare ogni turno"],
    yearlyTerms: ["Esaminare Costi ed Emissioni della flotta", "numero di bus fisici"],
    releaseTerms: {
      start: ["Home", "guida utente"],
      fleet: ["9–13 m", "17–19 m", "LFP", "NMC", "Ripristina stima", "Dettagli apre una vista in sola lettura", "Linea A_copia, Linea A_copia_1"],
      shifts: ["GTFS", "elenco completo sul server", "Spazio-tempo", "Mappa", "Duplica salva subito una copia", "Modifica sulla copia salvata", "Inserisci prima", "Annulla ultima modifica"],
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

test("the guide uses the application language selector and keeps its header controls accessible", async ({ page }) => {
  const selectorAppearance = (selector) => selector.evaluate((select) => {
    const group = select.parentElement;
    const icon = group.querySelector("svg");
    const styles = (element, properties) => {
      const computed = getComputedStyle(element);
      return properties.map((property) => computed.getPropertyValue(property));
    };
    const dimensions = (element) => {
      const { width, height } = element.getBoundingClientRect();
      return { width, height };
    };

    return {
      options: Array.from(select.options, ({ value, text }) => [value, text]),
      selectSize: dimensions(select),
      selectStyles: styles(select, [
        "background-color", "border-top-color", "border-top-style", "border-top-width",
        "border-top-left-radius", "color", "cursor", "font-family", "font-size", "line-height",
        "padding-top", "padding-left",
      ]),
      groupStyles: styles(group, ["display", "align-items", "column-gap"]),
      iconSize: dimensions(icon),
      iconStyles: styles(icon, ["color", "fill", "stroke", "stroke-width"]),
      iconViewBox: icon.getAttribute("viewBox"),
      iconCircle: ["cx", "cy", "r"].map((attribute) => icon.querySelector("circle").getAttribute(attribute)),
      iconPath: icon.querySelector("path").getAttribute("d"),
    };
  });

  await page.goto("./#landing");
  await expectLandingGuideLink(page);
  const appSelector = page.getByRole("combobox", { name: "Select language", exact: true });
  await expect(appSelector).toBeInViewport({ ratio: 1 });
  const appAppearance = await selectorAppearance(appSelector);
  expect(appAppearance.options).toEqual([["en", "EN"], ["de", "DE"], ["fr", "FR"], ["it", "IT"]]);
  expect(appAppearance.selectSize).toEqual({ width: 56, height: 32 });
  expect(appAppearance.iconSize).toEqual({ width: 16, height: 16 });

  await page.getByRole("link", { name: "User guide", exact: true }).click();
  const header = page.locator(".guide-header");
  const guideSelector = header.getByRole("combobox", { name: "Select language", exact: true });
  await expect(guideSelector).toBeInViewport({ ratio: 1 });
  await expect(guideSelector).toBeEnabled();
  await expect(guideSelector).toHaveValue("en");
  await expect(header.locator(".language-icon")).toHaveAttribute("aria-hidden", "true");
  expect(await selectorAppearance(guideSelector)).toEqual(appAppearance);

  const back = header.getByRole("link", { name: /Back to ELETTRA$/ });
  const print = header.getByRole("button", { name: "Print guide", exact: true });
  await back.focus();
  await page.keyboard.press("Tab");
  await expect(guideSelector).toBeFocused();
  await expect(guideSelector).not.toHaveCSS("box-shadow", "none");
  await page.keyboard.press("Tab");
  await expect(print).toBeFocused();

  await page.setViewportSize({ width: 320, height: 720 });
  await guideSelector.selectOption("de");
  for (const control of [
    header.getByRole("link", { name: /Zurück zu ELETTRA$/ }),
    header.getByRole("combobox", { name: "Sprache auswählen", exact: true }),
    header.getByRole("button", { name: "Handbuch drucken", exact: true }),
  ]) {
    await expect(control).toBeInViewport({ ratio: 1 });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test("reference versions and the localized update date appear only in the guide footer, including print", async ({ page }) => {
  await page.goto("./guide/");
  const versions = `Frontend v${GUIDE_BASELINE_VERSION} · Backend v${GUIDE_BACKEND_BASELINE_VERSION}`;
  const footerMetadata = page.locator("footer dl.guide-meta");
  await expect(page.locator(".guide-meta")).toHaveCount(1);
  await expect(page.locator('header .guide-screenshot-note, .guide-hero .guide-screenshot-note, [data-guide-ui="screenshotNote"]')).toHaveCount(0);

  for (const [language, date] of Object.entries({
    en: "26 November 2026",
    de: "26. November 2026",
    fr: "26 novembre 2026",
    it: "26 novembre 2026",
  })) {
    await page.locator("#guide-language").selectOption(language);
    await expect(footerMetadata.locator("dt")).toHaveText([
      guideContent[language].ui.baselineLabel,
      guideContent[language].ui.updatedLabel,
    ]);
    await expect(footerMetadata.locator("dd")).toHaveText([versions, date]);
    for (const value of [versions, date]) {
      await expect(page.getByText(value, { exact: true })).toHaveCount(1);
      await expect(footerMetadata.getByText(value, { exact: true })).toBeVisible();
    }
  }

  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".guide-header")).toBeHidden();
  await expect(footerMetadata.getByText(versions, { exact: true })).toBeVisible();
  await expect(footerMetadata.getByText("26 novembre 2026", { exact: true })).toBeVisible();
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
  test(`Quick Start and chapter navigation work in ${language} on desktop and mobile`, async ({ page }) => {
    await page.goto("./guide/#use-cases");

    const languageSelector = page.locator("#guide-language");
    await languageSelector.selectOption(language);
    const { sections } = guideContent[language];
    const quickStart = sections[0];
    const quickStartSection = page.locator("#use-cases");
    const diagram = quickStartSection.locator("figure#use-cases-workflow");
    const diagramHeading = diagram.getByRole("heading", { name: quickStart.diagram.title, exact: true });
    const preparation = diagram.locator("ol.guide-flow-preparation");
    const branches = diagram.locator(".guide-flow-branches");
    const outcomes = diagram.locator(".guide-flow-outcomes");
    const outcomeColumns = outcomes.locator(":scope > .guide-flow-outcome");
    const registration = quickStartSection.getByRole("link", { name: quickStart.firstAccess, exact: true });

    const navigation = page.locator("#guide-nav");
    await expect(navigation.locator(".guide-nav-group")).toHaveText(labels.navGroups);
    await expect(navigation.getByRole("link")).toHaveText(sections.map(({ title }) => title));
    const entries = await navigation.locator(".guide-nav-group, a").evaluateAll(elements =>
      elements.map(element => element.getAttribute("href") ?? element.textContent.trim())
    );
    expect(entries).toEqual([
      "#use-cases",
      labels.navGroups[0],
      ...OPERATING_CHAPTERS.map(id => `#${id}`),
      labels.navGroups[1],
      ...REFERENCE_CHAPTERS.map(id => `#${id}`),
    ]);
    const headings = page.locator("#guide-sections > section > h2");
    await expect(headings).toHaveText(sections.map(({ title }) => title));
    for (const [index, id] of OPERATING_CHAPTERS.entries()) {
      await expect(page.locator(`#${id} > h2`)).toHaveText(new RegExp(`^${index + 1}\\. `));
    }
    for (const id of ["use-cases", ...REFERENCE_CHAPTERS]) {
      await expect(page.locator(`#${id} > h2`)).not.toHaveText(/^\d+\./);
    }

    await expect(quickStartSection.getByRole("table")).toHaveCount(0);
    await expect(quickStartSection.locator(".guide-case-workflow")).toHaveCount(0);
    await expect(registration).toHaveAttribute("href", "#registration");
    await expect(registration).toHaveText(quickStart.firstAccess);
    await registration.click();
    await expect(page).toHaveURL(/#registration$/);
    await expect(page.locator("#start #registration h3")).toBeInViewport();

    await expect(diagram).toBeVisible();
    await expect(diagram).toHaveAccessibleName(quickStart.diagram.title);
    await expect(diagram.getByRole("heading", { name: quickStart.diagram.preparation, exact: true })).toBeVisible();
    await expect(diagram.getByRole("heading", { name: quickStart.diagram.modes, exact: true })).toBeVisible();
    await expect(diagram.locator(".guide-flow-decision")).toHaveText(quickStart.diagram.decision);
    await expect(diagram.locator(
      "ol.guide-flow-preparation ~ .guide-flow-branches ~ .guide-flow-run ~ .guide-flow-decision ~ .guide-flow-outcomes",
    )).toHaveCount(1);
    const outcomePaths = [
      [quickStart.diagram.no, [["feasibility", quickStart.diagram.revise, "h2"]]],
      [quickStart.diagram.unknown, [["resolve-feasibility", quickStart.diagram.resolve, "h3"]]],
      [quickStart.diagram.yes, [
        ["yearly", quickStart.diagram.yearly, "h2"],
        ["comparison", quickStart.diagram.compare, "h2"],
      ]],
    ];
    await expect(outcomeColumns).toHaveCount(outcomePaths.length);
    await expect(outcomeColumns.nth(1).getByText(quickStart.diagram.unknownHint, { exact: true })).toBeVisible();
    await expect(outcomeColumns.last().getByText(quickStart.diagram.impacts, { exact: true })).toBeVisible();
    if (page.viewportSize().width > 600) {
      const [no, unknown, yes] = await outcomeColumns.evaluateAll(elements =>
        elements.map(element => element.getBoundingClientRect().toJSON())
      );
      expect(no.y).toBe(unknown.y);
      expect(unknown.y).toBe(yes.y);
      expect(no.right).toBeLessThan(unknown.left);
      expect(unknown.right).toBeLessThan(yes.left);
      expect(Math.abs(no.width - yes.width)).toBeLessThan(1);
      expect(Math.abs(unknown.width - yes.width)).toBeLessThan(1);
    }
    const outcomeDestinations = [];
    for (const [index, [label, destinations]] of outcomePaths.entries()) {
      const outcome = outcomeColumns.nth(index);
      await expect(outcome.getByText(label, { exact: true })).toBeVisible();
      outcomeDestinations.push([outcome.getByRole("link"), destinations]);
    }
    for (const [links, destinations] of [
      [preparation.getByRole("link"), [
        ["fleet", quickStart.diagram.fleet, "h2"],
        ["shifts", quickStart.diagram.shifts, "h2"],
        ["feasibility", quickStart.diagram.feasibility, "h2"],
      ]],
      [diagram.locator("a.guide-flow-run"), [
        ["run-evaluation", quickStart.diagram.run, "h3"],
      ]],
      ...outcomeDestinations,
    ]) {
      await expect(links).toHaveCount(destinations.length);
      for (const [index, [id, label, heading]] of destinations.entries()) {
        const link = links.nth(index);
        await expect(link).toHaveAccessibleName(label);
        await expect(link).toHaveAttribute("href", `#${id}`);
        await link.click();
        await expect(page).toHaveURL(new RegExp(`#${id}$`));
        await expect(page.locator(`#${id} > ${heading}`)).toBeInViewport();
      }
    }
    const branchLinks = branches.getByRole("link");
    await expect(branchLinks).toHaveCount(3);
    const invalidLinks = await page.locator('#guide-sections a[href^="#"]').evaluateAll(links =>
      links.filter(link => !document.getElementById(link.hash.slice(1))).map(link => link.hash)
    );
    expect(invalidLinks).toEqual([]);
    for (const [index, item] of quickStart.items.entries()) {
      const link = branchLinks.nth(index);
      await expect(link).toHaveAttribute("data-case", String(index + 1));
      await expect(link).toHaveAttribute("href", `#${item.id}`);
      for (const label of [`UC${index + 1} · ${item.modeLabel}`, item.title, item.summary]) {
        await expect(link.getByText(label, { exact: true })).toBeVisible();
      }

      await link.click();
      await expect(page).toHaveURL(new RegExp(`#${item.id}$`));
      const mode = page.locator(`#feasibility li.guide-use-case#${item.id}`);
      await expect(mode.getByRole("heading", { level: 4, name: item.modeLabel, exact: true })).toBeInViewport();
      await expect(mode.locator(":scope > ol > li")).toHaveText(item.instructions);
      const definitions = mode.locator(":scope > ol ~ dl");
      await expect(definitions.locator(":scope > dt, :scope > dd")).toHaveText([
        quickStart.scopeLabel,
        item.scope,
        quickStart.decisionLabel,
        item.decision,
      ]);
      const workflowLink = mode.getByRole("link", { name: quickStart.title, exact: true });
      await expect(workflowLink).toHaveAttribute("href", "#use-cases-workflow");
      await workflowLink.click();
      await expect(page).toHaveURL(/#use-cases-workflow$/);
      await expect(diagramHeading).toBeInViewport();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("./guide/#use-cases");
    await expect(outcomeColumns).toHaveCount(outcomePaths.length);
    const [no, unknown, yes] = await outcomeColumns.evaluateAll(elements =>
      elements.map(element => element.getBoundingClientRect().toJSON())
    );
    expect(no.x).toBe(unknown.x);
    expect(unknown.x).toBe(yes.x);
    expect(no.bottom).toBeLessThan(unknown.top);
    expect(unknown.bottom).toBeLessThan(yes.top);
    const mobileLink = branchLinks.first();
    const mobileCase = quickStart.items[0];
    await mobileLink.focus();
    await expect(mobileLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`#${mobileCase.id}$`));
    const mobileMode = page.locator(`#feasibility #${mobileCase.id}`);
    const mobileHeading = mobileMode.getByRole("heading", { level: 4, name: mobileCase.modeLabel, exact: true });
    await expect(mobileHeading).toBeInViewport();
    await page.reload();
    await expect(languageSelector).toHaveValue(language);
    await expect(mobileHeading).toBeInViewport();
    const mobileWorkflowLink = mobileMode.getByRole("link", { name: quickStart.title, exact: true });
    await mobileWorkflowLink.focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#use-cases-workflow$/);
    await expect(diagramHeading).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });

  test(`the SOH table and demand and SOC paragraphs are readable in ${language} at 320 px`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("./guide/#feasibility");
    await page.locator("#guide-language").selectOption(language);
    const sections = Object.fromEntries(guideContent[language].sections.map(section => [section.id, section]));
    const battery = sections.feasibility.items.find(({ table }) => table);
    const example = battery.table;
    const batteryItem = page.locator("#feasibility .guide-item").filter({
      has: page.getByRole("heading", { level: 3, name: battery.title, exact: true }),
    });
    const table = batteryItem.getByRole("table", { name: example.caption, exact: true });
    await expect(table.locator("caption")).toHaveText(example.caption);
    await expect(table.getByRole("columnheader")).toHaveText(example.columns);
    await expect(batteryItem.locator(":scope > p + table")).toHaveCount(1);
    await expect(batteryItem.locator(":scope > h3 + p")).toHaveText(battery.text);
    await expect(batteryItem.locator(":scope > table ~ p")).toHaveText(battery.paragraphs);
    const bodyRows = table.locator("tbody > tr");
    await expect(bodyRows).toHaveCount(example.rows.length);
    for (const [index, expectedRow] of example.rows.entries()) {
      const row = bodyRows.nth(index);
      await expect(row.getByRole("rowheader")).toHaveText(expectedRow[0]);
      await expect(row.getByRole("cell")).toHaveText(expectedRow.slice(1));
    }
    const lastCell = bodyRows.last().getByRole("cell").last();
    await lastCell.scrollIntoViewIfNeeded();
    await expect(lastCell).toBeInViewport();

    const demand = sections.results.items.find(({ id }) => id === "demand-soc");
    const demandItem = page.locator("#results #demand-soc");
    await page.goto("./guide/#demand-soc");
    await expect(demandItem.getByRole("heading", { level: 3, name: demand.title, exact: true })).toBeInViewport();
    await expect(demandItem.locator(":scope > p")).toHaveText([demand.text, ...demand.paragraphs]);
    await expect(page.locator("#use-cases").getByRole("table")).toHaveCount(0);
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
    const apiGuide = page.locator("#api #api-docs");
    await expect(apiGuide.getByRole("link", { name: "Swagger UI (/docs)" })).toHaveAttribute("href", "https://elettra.supsi.ch/docs");
    await expect(apiGuide.getByRole("link", { name: "OpenAPI (/openapi.json)" })).toHaveAttribute("href", "https://elettra.supsi.ch/openapi.json");
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

test("switching languages preserves the active use-case anchor and translates its mode", async ({ page }) => {
  await page.goto("./guide/#use-case-charging");
  for (const language of ["de", "fr", "it", "en"]) {
    await page.locator("#guide-language").selectOption(language);
    await expect(page).toHaveURL(/#use-case-charging$/);
    const mode = page.locator("#feasibility #use-case-charging").getByRole("heading", { level: 4 });
    await expect(mode).toBeInViewport();
    await expect(mode).toHaveText(guideContent[language].sections[0].items[1].modeLabel);
    await expect(page.locator("html")).toHaveAttribute("lang", language);
  }
});


test("a saved workflow URL opens Quick Start", async ({ page }) => {
  await page.goto("./guide/#workflow");
  await expect(page.locator("#use-cases > h2")).toBeInViewport();
  await expect(page.locator("#use-cases-workflow")).toBeVisible();
  await expect(page.locator("section#workflow")).toHaveCount(0);
});

test("feasibility links to Mean and Q95 guidance in the selected language", async ({ page }) => {
  await page.goto("./guide/#feasibility");
  await page.locator('#feasibility a[href="#mean-q95"]').click();
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
    await expect(result.locator('img')).toHaveCount(3);
    await expect(result.locator('img[src*="feasibility-infeasible"]')).toHaveCount(1);
    const blockImages = page.locator('#shifts img');
    await expect(blockImages).toHaveCount(2);
    for (const name of ['shift-planner', 'shift-visualisation']) {
      await expect(page.locator(`#shifts img[src*="${name}"]`)).toHaveCount(1);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    await page.setViewportSize({width:320,height:720});
    await result.getByRole('heading',{name:labels.q95,exact:true}).scrollIntoViewIfNeeded();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
    expect(errors).toEqual([]);
    expect(failed).toEqual([]);
  });
}
