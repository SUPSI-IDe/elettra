import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  GUIDE_BASELINE_VERSION,
  GUIDE_UPDATED_AT,
  SUPPORTED_GUIDE_LANGUAGES,
  guideContent,
} from "../guide/content.js";
import { translations } from "../src/i18n/translations.js";

const readProjectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the landing page links to the public user guide", async () => {
  const landing = await readProjectFile("src/pages/Auth/landing.html");
  assert.equal(landing.match(/href="\.\/guide\/"/g)?.length, 1);
  assert.match(landing, /data-i18n="landing\.user_guide"/);

  for (const authView of ["login", "register"]) {
    const html = await readProjectFile(`src/pages/Auth/${authView}.html`);
    assert.doesNotMatch(html, /href="\.\/guide\/"/);
    assert.doesNotMatch(html, /landing\.user_guide/);
  }
});

test("the authenticated shell keeps a translated user-guide link at the bottom of the sidebar", async () => {
  const shell = await readProjectFile("index.html");
  const styles = await readProjectFile("src/style.css");

  assert.equal(shell.match(/class="nav-guide-link"/g)?.length, 1);
  assert.equal(shell.match(/href="\.\/guide\/"/g)?.length, 1);
  assert.match(shell, /class="nav-guide-link"[\s\S]*target="_blank"/);
  assert.match(shell, /class="nav-guide-link"[\s\S]*rel="noopener noreferrer"/);
  assert.match(shell, /data-i18n-aria-label="nav\.user_guide_new_tab"/);
  assert.match(shell, /data-i18n="landing\.user_guide"/);
  assert.match(styles, /nav \.nav-links \{[\s\S]*flex: 1 1 auto;[\s\S]*overflow-y: auto;/);
  assert.match(styles, /\.nav-guide \{[\s\S]*flex: 0 0 auto;/);

  for (const language of SUPPORTED_GUIDE_LANGUAGES) {
    assert.ok(translations[language]["landing.user_guide"]);
    assert.ok(translations[language]["nav.user_guide_new_tab"]);
  }
});

test("the public guide contains the expected accessible shell", async () => {
  const guide = await readProjectFile("guide/index.html");
  assert.match(guide, /id="guide-language"/);
  assert.match(guide, /id="guide-content"/);
  assert.equal(guide.match(/href="\.\.\/"/g)?.length, 2);
  assert.doesNotMatch(guide, /to verify|placeholder|asset to be supplied/i);
});

test("all supported guide languages expose the same complete section structure", () => {
  const expectedIds = [
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
  const expectedFigureCounts = [0, 1, 0, 1, 1, 1, 2, 2, 0, 0];

  assert.deepEqual(Object.keys(guideContent).sort(), [...SUPPORTED_GUIDE_LANGUAGES].sort());

  for (const language of SUPPORTED_GUIDE_LANGUAGES) {
    const content = guideContent[language];
    assert.deepEqual(content.sections.map(({ id }) => id), expectedIds);
    assert.deepEqual(
      content.sections.map(({ figures }) => figures?.length ?? 0),
      expectedFigureCounts,
    );
    assert.ok(content.ui.title);
    assert.ok(content.ui.introduction);
    assert.ok(content.sections.every(({ title, intro, items }) =>
      title && intro && items.length >= 3 && items.every(({ title: itemTitle, text }) => itemTitle && text)
    ));
  }
});

test("use cases have complete translations, stable modes and valid documentation links", () => {
  const failureGuidanceTerms = {
    en: ["not completed", "correction guidance"],
    de: ["nicht abgeschlossen", "Korrekturhinweisen"],
    fr: ["n’est pas terminée", "conseils de correction"],
    it: ["non viene completata", "suggerimenti correttivi"],
  };
  const shape = (value) => {
    if (Array.isArray(value)) return value.map(shape);
    if (typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, shape(entry)]));
    }
    assert.equal(typeof value, "string");
    assert.ok(value.trim());
    return "string";
  };
  const reference = guideContent.en.sections[0];

  for (const language of SUPPORTED_GUIDE_LANGUAGES) {
    const { sections } = guideContent[language];
    const useCases = sections[0];
    assert.deepEqual(shape(useCases), shape(reference), language);
    assert.deepEqual(useCases.items.map(({ id, mode }) => ({ id, mode })), [
      { id: "use-case-fleet", mode: "BATTERY_ONLY" },
      { id: "use-case-charging", mode: "CHARGING" },
      { id: "use-case-initial", mode: "JOINT" },
    ]);
    const serializedUseCases = JSON.stringify(useCases);
    for (const term of failureGuidanceTerms[language]) {
      assert.ok(serializedUseCases.includes(term), `${language} use cases are missing ${term}`);
    }
    const ids = sections.map(({ id }) => id);
    for (const item of useCases.items) {
      assert.deepEqual(item.steps.map(({ section }) => section), [
        "fleet", "shifts", "feasibility", "feasibility", "results", "yearly",
      ]);
      assert.ok(item.steps.every(({ section }) => ids.includes(section)));
    }
  }
});

test("the guide baseline follows the frontend version and exposes a valid update date", async () => {
  const packageJson = JSON.parse(await readProjectFile("package.json"));
  assert.equal(GUIDE_BASELINE_VERSION, packageJson.version);
  assert.equal(Number.isNaN(Date.parse(GUIDE_UPDATED_AT)), false);
  assert.deepEqual(
    SUPPORTED_GUIDE_LANGUAGES.map((language) => guideContent[language].ui.updatedValue),
    ["9 November 2026", "9. November 2026", "9 novembre 2026", "9 novembre 2026"],
  );
});

test("every guide language covers the user-facing workflows added in 0.9.0 and 0.10.0", () => {
  const expectedTerms = {
    en: {
      start: ["Home", "user guide"],
      fleet: ["Details", "older custom stops"],
      shifts: ["GTFS", "complete server-side list", "Duplicate"],
      feasibility: ["one GTFS edition", "Duplicate", "partial copy"],
      results: ["recorded", "Configured SOC window", "initial physical-maximum reference", "expandable white cards"],
      yearly: ["GTFS edition", "recorded provenance"],
    },
    de: {
      start: ["Startseite", "Benutzerhandbuch"],
      fleet: ["Details", "ältere Haltestellen"],
      shifts: ["GTFS", "vollständige serverseitige Liste", "Duplizieren"],
      feasibility: ["GTFS-Ausgabe", "Duplizieren", "unvollständig"],
      results: ["aufgezeichnete", "Konfiguriertes SOC-Fenster", "physischen Maximum", "aufklappbare weisse Karten"],
      yearly: ["GTFS-Ausgabe", "aufgezeichnete Herkunft"],
    },
    fr: {
      start: ["Accueil", "guide"],
      fleet: ["Détails", "anciens arrêts"],
      shifts: ["GTFS", "liste complète côté serveur", "Dupliquer"],
      feasibility: ["édition GTFS", "Dupliquer", "partiellement"],
      results: ["enregistrée", "Fenêtre SOC configurée", "maximum physique", "cartes blanches dépliables"],
      yearly: ["édition GTFS", "provenance enregistrée"],
    },
    it: {
      start: ["Home", "guida utente"],
      fleet: ["Dettagli", "fermate storiche"],
      shifts: ["GTFS", "elenco completo sul server", "Duplica"],
      feasibility: ["una sola edizione GTFS", "Duplica", "parzialmente"],
      results: ["registrata", "Intervallo SOC configurato", "massimo fisico", "schede bianche espandibili"],
      yearly: ["edizione GTFS", "provenienza registrata"],
    },
  };

  const sectionItemCounts = guideContent.en.sections.map(({ items }) => items.length);
  for (const language of SUPPORTED_GUIDE_LANGUAGES) {
    const sections = Object.fromEntries(
      guideContent[language].sections.map((section) => [section.id, section]),
    );
    assert.deepEqual(
      guideContent[language].sections.map(({ items }) => items.length),
      sectionItemCounts,
      `${language} guide sections have diverging item counts`,
    );
    for (const [sectionId, terms] of Object.entries(expectedTerms[language])) {
      const serialized = JSON.stringify(sections[sectionId]);
      for (const term of terms) {
        assert.ok(serialized.includes(term), `${language}.${sectionId} is missing ${term}`);
      }
    }
  }
});

test("every guide language explains the two-level feasibility and yearly result navigation", () => {
  const expectedTerms = {
    en: {
      feasibility: ["General", "vehicle block", "selected battery", "planned charging", "Aggregate Q95", "not determined", "How to resolve"],
      yearly: ["General", "vehicle block", "Efficiency", "Costs", "Emissions", "annual DC energy"],
    },
    de: {
      feasibility: ["Allgemein", "Fahrzeugumlauf", "eigene Batterie", "geplanten Ladevorgänge", "aggregiertes Q95", "Nicht bestimmt", "So beheben"],
      yearly: ["Allgemein", "Fahrzeugumlauf", "Effizienz", "Kosten", "Emissionen", "jährlichen DC-Energie"],
    },
    fr: {
      feasibility: ["Général", "service voiture", "propre batterie", "recharges planifiées", "Q95 agrégé", "non déterminée", "Comment résoudre"],
      yearly: ["Général", "service voiture", "Efficacité", "Coûts", "Émissions", "énergie DC annuelle"],
    },
    it: {
      feasibility: ["Generale", "turno macchina", "propria batteria", "ricariche pianificate", "Q95 aggregato", "non determinata", "Come risolvere"],
      yearly: ["Generale", "turno macchina", "Efficienza", "Costi", "Emissioni", "energia DC annuale"],
    },
  };

  for (const language of SUPPORTED_GUIDE_LANGUAGES) {
    const sections = guideContent[language].sections;
    const feasibility = sections.find(({ id }) => id === "results");
    const yearly = sections.find(({ id }) => id === "yearly");
    const feasibilityText = JSON.stringify(feasibility);
    const yearlyText = JSON.stringify(yearly);

    for (const term of expectedTerms[language].feasibility) {
      assert.ok(feasibilityText.includes(term), `${language} feasibility guide is missing ${term}`);
    }
    for (const term of expectedTerms[language].yearly) {
      assert.ok(yearlyText.includes(term), `${language} yearly guide is missing ${term}`);
    }
    assert.equal(feasibility.figures.length, 2);
    assert.equal(yearly.figures.length, 2);
  }
});

test("every guide language distinguishes owned vehicle CAPEX from allocated shared infrastructure", () => {
  const expectedTerms = {
    en: ["belongs in full", "only its cost is allocated"],
    de: ["vollständig", "nur ihre Kosten"],
    fr: ["intégralement", "seul son coût"],
    it: ["integralmente", "solo il suo costo"],
  };

  for (const language of SUPPORTED_GUIDE_LANGUAGES) {
    const yearly = guideContent[language].sections.find(({ id }) => id === "yearly");
    const yearlyText = JSON.stringify(yearly);
    for (const term of expectedTerms[language]) {
      assert.ok(yearlyText.includes(term), `${language} yearly guide is missing ${term}`);
    }
  }
});

test("every referenced guide screenshot is packaged locally", async () => {
  const sources = new Set(
    guideContent.en.sections.flatMap(({ figures = [] }) =>
      figures.map(({ src }) => src)
    )
  );

  assert.equal(sources.size, 8);
  await Promise.all([...sources].map((src) => access(new URL(src))));
});

test("guide content contains no editorial placeholders", () => {
  const serialized = JSON.stringify(guideContent);
  assert.doesNotMatch(
    serialized,
    /\*to verify\*|\btodo\b|\bplaceholder\b|asset to be supplied/i,
  );
});


test("the release version has a changelog entry required by the publishing workflow", async () => {
  const packageJson = JSON.parse(await readProjectFile("package.json"));
  const changelog = await readProjectFile("CHANGELOG.md");
  assert.ok(changelog.split("\n").some(line => line.startsWith(`## [${packageJson.version}]`)));
});
