import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  GUIDE_BASELINE_VERSION,
  GUIDE_BACKEND_BASELINE_VERSION,
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
  assert.match(guide, /<select\b[^>]*id="guide-language"[^>]*\bdisabled\b/);
  assert.match(guide, /id="guide-content"/);
  assert.equal(guide.match(/href="\.\.\/"/g)?.length, 2);
  assert.doesNotMatch(guide, /to verify|placeholder|asset to be supplied/i);
});

test("all supported guide languages expose the same complete section structure", () => {
  const expectedIds = [
    "use-cases",
    "fleet",
    "shifts",
    "feasibility",
    "results",
    "yearly",
    "comparison",
    "start",
    "practice",
    "api",
  ];
  const expectedFigureCounts = [0, 2, 2, 1, 3, 3, 1, 1, 0, 0];

  assert.deepEqual(Object.keys(guideContent).sort(), [...SUPPORTED_GUIDE_LANGUAGES].sort());

  for (const language of SUPPORTED_GUIDE_LANGUAGES) {
    const content = guideContent[language];
    assert.deepEqual(content.sections.map(({ id }) => id), expectedIds);
    assert.deepEqual(
      content.sections.map(({ figures = [], items }) =>
        figures.length + items.flatMap(item => item.figures ?? []).length
      ),
      expectedFigureCounts,
    );
    assert.ok(content.ui.title);
    assert.ok(content.ui.introduction);
    for (const section of content.sections) {
      assert.ok(section.title?.trim(), `${language}.${section.id} should have a title`);
      if (section.id !== "api") assert.ok(section.intro?.trim());
      if (section.id === "use-cases") continue;
      assert.ok(section.items.length, `${language}.${section.id} should have content`);
      assert.ok(section.items.every(({ title, text, modes, paragraphs }) =>
        title?.trim() && (text?.trim() || modes?.length || paragraphs?.length)
      ));
    }

    const sections = Object.fromEntries(content.sections.map(section => [section.id, section]));
    assert.ok(sections.start.items.some(({ id }) => id === "registration"));
    assert.ok(sections.results.items.some(({ id }) => id === "mean-q95"));
    const api = sections.api.items.find(({ id }) => id === "api-docs");
    assert.deepEqual(api?.links.map(({ href }) => new URL(href).pathname), ["/docs", "/openapi.json"]);
  }
});

test("Quick Start has localized workflow text and instructions for the three stable feasibility modes", () => {
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
    const feasibility = sections.find(({ id }) => id === "feasibility");
    assert.deepEqual(shape(useCases), shape(reference), language);
    assert.equal(typeof useCases.firstAccess, "string");
    assert.equal(useCases.columns, undefined);
    assert.equal(useCases.workflow, undefined);
    assert.ok(useCases.diagram.unknown.trim());
    assert.ok(useCases.diagram.resolve.trim());
    assert.ok(useCases.diagram.unknownHint.trim());
    assert.equal(new Set([useCases.diagram.no, useCases.diagram.unknown, useCases.diagram.yes]).size, 3);
    assert.ok(useCases.scopeLabel.trim());
    assert.ok(useCases.decisionLabel.trim());
    assert.deepEqual(useCases.items.map(({ id, mode }) => ({ id, mode })), [
      { id: "use-case-fleet", mode: "BATTERY_ONLY" },
      { id: "use-case-charging", mode: "CHARGING" },
      { id: "use-case-initial", mode: "JOINT" },
    ]);
    const modeKeys = ["mode_battery_only", "mode_charging", "mode_joint"];
    assert.deepEqual(useCases.items.map(item => item.modeLabel),
      modeKeys.map(key => translations[language][`simulation.${key}`]));
    assert.deepEqual(feasibility.items.filter(({ modes }) => modes).map(({ modes }) => modes), [useCases.items]);
    for (const item of useCases.items) {
      assert.ok(item.title.trim().endsWith("?"), `${language}.${item.id} should retain the planning question`);
      assert.ok(item.instructions.length >= 2, `${language}.${item.id} should explain the mode in steps`);
      assert.ok(item.instructions.every(step => typeof step === "string" && step.trim()));
      assert.ok(item.scope.trim(), `${language}.${item.id} should explain the scope`);
      assert.ok(item.decision.trim(), `${language}.${item.id} should explain the decision`);
    }
  }
});

test("the SOH examples and the demand and SOC paragraphs are complete in every guide language", () => {
  for (const language of SUPPORTED_GUIDE_LANGUAGES) {
    const sections = Object.fromEntries(guideContent[language].sections.map(section => [section.id, section]));
    const batteryItems = sections.feasibility.items.filter(({ table }) => table);
    assert.equal(batteryItems.length, 1, `${language} should have one SOH table`);
    const { caption, columns, rows } = batteryItems[0].table;
    assert.ok(caption.trim());
    assert.ok(columns.length >= 3);
    assert.ok(columns.every(column => column.trim()));
    assert.equal(rows.length, 2);
    for (const [index, usableEnergy] of ["175", "250"].entries()) {
      assert.equal(rows[index].length, columns.length);
      assert.ok(rows[index].every(cell => cell.trim()));
      assert.ok(rows[index].some(cell => cell.includes(usableEnergy)));
    }

    const demand = sections.results.items.find(({ id }) => id === "demand-soc");
    assert.ok(demand, `${language} should explain demand and SOC`);
    const { paragraphs } = demand;
    assert.ok(paragraphs.length >= 2);
    assert.ok(paragraphs.every(paragraph => paragraph.trim()));
    assert.ok(paragraphs.some(paragraph => paragraph.includes("Q95")));
    assert.ok(paragraphs.some(paragraph => paragraph.includes("SOC")));
  }
});

test("the guide baseline follows the frontend version and exposes a valid update date", async () => {
  const packageJson = JSON.parse(await readProjectFile("package.json"));
  assert.equal(GUIDE_BASELINE_VERSION, packageJson.version);
  assert.equal(Number.isNaN(Date.parse(GUIDE_UPDATED_AT)), false);
  assert.deepEqual(
    SUPPORTED_GUIDE_LANGUAGES.map((language) => guideContent[language].ui.updatedValue),
    ["26 November 2026", "26. November 2026", "26 novembre 2026", "26 novembre 2026"],
  );
});

test("the guide documents compact row actions and localized duplicate names", () => {
  const expectedTerms = {
    en: { feasibility: ["View details", "Rename", "Duplicate", "Delete", "_copy", "without selecting the row"], yearly: ["View details", "Rename", "Duplicate", "Delete", "_copy", "occupancy"] },
    de: { feasibility: ["Details anzeigen", "Umbenennen", "Duplizieren", "Löschen", "_Kopie", "ohne Zeilenauswahl"], yearly: ["Details anzeigen", "Umbenennen", "Duplizieren", "Löschen", "_Kopie", "Belegung"] },
    fr: { feasibility: ["Afficher les détails", "Renommer", "Dupliquer", "Supprimer", "_copie", "sans sélectionner la ligne"], yearly: ["Afficher les détails", "Renommer", "Dupliquer", "Supprimer", "_copie", "occupation"] },
    it: { feasibility: ["Visualizza dettagli", "Rinomina", "Duplica", "Elimina", "_copia", "senza selezionare la riga"], yearly: ["Visualizza dettagli", "Rinomina", "Duplica", "Elimina", "_copia", "occupazione"] },
  };

  for (const language of SUPPORTED_GUIDE_LANGUAGES) {
    const sections = Object.fromEntries(
      guideContent[language].sections.map((section) => [section.id, section]),
    );
    for (const [sectionId, terms] of Object.entries(expectedTerms[language])) {
      const serialized = JSON.stringify(sections[sectionId]);
      for (const term of terms) {
        assert.ok(serialized.includes(term), `${language}.${sectionId} is missing ${term}`);
      }
    }
  }
});

test("every guide language covers the user-facing workflows added in 0.9.0 and 0.10.0", () => {
  const expectedTerms = {
    en: {
      start: ["Home", "user guide", "CARTO", "latest available GTFS edition", "indicative"],
      fleet: ["Details opens a read-only view", "Edit to complete missing fields in older custom stops", "position the map manually"],
      shifts: ["Both fields are locked", "complete server-side list", "Duplicate saves a copy immediately", "dependent evaluation blocks deletion", "Space-time", "Map", "Dashed segments"],
      feasibility: ["one GTFS edition", "Duplicate", "compatible forecasts are unavailable"],
      results: ["recorded", "Configured SOC window", "initial physical-maximum reference", "expandable white cards"],
      yearly: ["GTFS edition", "recorded provenance"],
    },
    de: {
      start: ["Startseite", "Benutzerhandbuch", "CARTO", "neueste verfügbare GTFS-Ausgabe", "Orientierung"],
      fleet: ["Details öffnet eine schreibgeschützte Ansicht", "fehlende Angaben älterer Haltestellen unter Bearbeiten", "tragen Sie Adresse und Stadt von Hand ein"],
      shifts: ["Beide Felder sind gesperrt", "vollständige serverseitige Liste", "Duplizieren speichert sofort eine Kopie", "abhängige Bewertung das Löschen blockiert", "Weg-Zeit", "Karte", "Gestrichelte Abschnitte"],
      feasibility: ["GTFS-Ausgabe", "Duplizieren", "unvollständig"],
      results: ["aufgezeichnete", "Konfiguriertes SOC-Fenster", "physischen Maximum", "aufklappbare weisse Karten"],
      yearly: ["GTFS-Ausgabe", "aufgezeichnete Herkunft"],
    },
    fr: {
      start: ["Accueil", "guide", "CARTO", "dernière édition GTFS disponible", "indicative"],
      fleet: ["Détails ouvre une vue en lecture seule", "Modifier pour compléter les données manquantes des anciens arrêts", "placez le réticule manuellement"],
      shifts: ["Ces champs sont verrouillés", "liste complète côté serveur", "Dupliquer enregistre immédiatement une copie", "évaluation dépendante bloque la suppression", "Espace-temps", "Carte", "Les pointillés"],
      feasibility: ["édition GTFS", "Dupliquer", "partiellement"],
      results: ["enregistrée", "Fenêtre SOC configurée", "maximum physique", "cartes blanches dépliables"],
      yearly: ["édition GTFS", "provenance enregistrée"],
    },
    it: {
      start: ["Home", "guida utente", "CARTO", "ultima edizione GTFS disponibile", "indicativa"],
      fleet: ["Dettagli apre una vista in sola lettura", "Modifica per completare i dati mancanti delle fermate storiche", "posizionare manualmente la mappa"],
      shifts: ["I due campi rimangono bloccati", "elenco completo sul server", "Duplica salva subito una copia", "valutazione dipendente blocca l’eliminazione", "Spazio-tempo", "Mappa", "tratti tratteggiati"],
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
      feasibility: ["General", "vehicle block", "selected battery", "planned charging", "Aggregate Q95", "Not determined", "How to resolve"],
      yearly: ["General", "vehicle block", "Efficiency", "Costs", "Emissions", "physical bus count"],
    },
    de: {
      feasibility: ["Allgemein", "Fahrzeugumlauf", "eigene Batterie", "geplanten Ladevorgänge", "aggregiertes Q95", "Nicht bestimmt", "So beheben"],
      yearly: ["Allgemein", "Fahrzeugumlauf", "Effizienz", "Kosten", "Emissionen", "Anzahl physischer Busse"],
    },
    fr: {
      feasibility: ["Général", "service voiture", "propre batterie", "recharges planifiées", "Q95 agrégé", "non déterminée", "Comment résoudre"],
      yearly: ["Général", "service voiture", "Efficacité", "Coûts", "Émissions", "nombre de bus physiques"],
    },
    it: {
      feasibility: ["Generale", "turno macchina", "propria batteria", "ricariche pianificate", "Q95 aggregato", "Non determinata", "Come risolvere"],
      yearly: ["Generale", "turno macchina", "Efficienza", "Costi", "Emissioni", "numero di bus fisici"],
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
    assert.equal(feasibility.figures.length, 3);
    assert.equal(yearly.figures.length, 3);
  }
});

test("every guide language distinguishes owned vehicle CAPEX from allocated shared infrastructure", () => {
  const expectedTerms = {
    en: ["belongs in full", "an equal share per representative bus"],
    de: ["vollständig", "einem gleichen Anteil je repräsentativem Bus"],
    fr: ["intégralement", "à parts égales par bus représentatif"],
    it: ["integralmente", "una quota uguale per bus rappresentativo"],
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
    guideContent.en.sections.flatMap(({ figures = [], items }) =>
      [...figures, ...items.flatMap(item => item.figures ?? [])].map(({ src }) => src)
    )
  );

  assert.ok(sources.size > 0);
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

test("all guide languages explain diagnostic batteries, mixed feasibility verdicts and unavailable Q95 data", () => {
  const vocabulary = {
    en: { battery: ['missing packs', 'physical maximum', 'not a verified installable battery', 'next departure', 'verified operation'], status: ['orange', 'one profile is feasible and the other infeasible', 'no verified verdict'], q95: ['N/A', 'tooltip', '—', 'missing value', 'Trip-level quantiles'], help: ['keyboard focus', 'tap', 'Escape'] },
    de: { battery: ['fehlenden Packs', 'physische Maximum', 'keine verifizierte installierbare Batterie', 'nächsten Abfahrt', 'verifizierter Betrieb'], status: ['oranges', 'ein Profil machbar und das andere nicht machbar', 'kein verifiziertes Urteil'], q95: ['N/A', 'Tooltip', '—', 'fehlenden Wert', 'Fahrtquantile'], help: ['Tastaturfokus', 'Antippen', 'Escape'] },
    fr: { battery: ['packs manquants', 'maximum physique', 'pas une batterie installable vérifiée', 'prochain départ', 'exploitation vérifiée'], status: ['orange', 'un profil est faisable et l’autre non', 'aucun verdict vérifié'], q95: ['N/A', 'infobulle', '—', 'valeur manquante', 'quantiles par course'], help: ['focus clavier', 'toucher', 'Échap'] },
    it: { battery: ['pacchi mancanti', 'massimo fisico', 'non una batteria installabile verificata', 'prossima partenza', 'esercizio verificato'], status: ['arancione', 'un profilo è fattibile e l’altro no', 'senza un esito verificato'], q95: ['N/A', 'tooltip', '—', 'valore mancante', 'quantili delle singole corse'], help: ['tastiera', 'tocco', 'Esc'] },
  };
  for (const language of SUPPORTED_GUIDE_LANGUAGES) {
    const items = guideContent[language].sections.find(({id}) => id === 'results').items;
    for (const [topic, words] of Object.entries(vocabulary[language])) {
      assert.ok(items.some(({text, paragraphs = []}) => {
        const itemText = [text, ...paragraphs].join(" ");
        return words.every(word => itemText.includes(word));
      }), `${language} must explain ${topic} coherently`);
    }
  }
});

test("the guide prepares depots before composing trips and preserves verified-result context", () => {
  const terms = {
    en: {boundaries:'Define the vehicle block boundaries',trips:'Filter and add scheduled trips',feasible:'For a feasible design',verified:'physically verified',separate:'separate lines'},
    de: {boundaries:'Grenzen des Fahrzeugumlaufs festlegen',trips:'Fahrplanfahrten filtern und hinzufügen',feasible:'machbaren Design',verified:'physisch verifizierten',separate:'getrennten Zeilen'},
    fr: {boundaries:'Définir les limites du service voiture',trips:'Filtrer et ajouter les courses planifiées',feasible:'configuration faisable',verified:'physiquement vérifié',separate:'deux lignes'},
    it: {boundaries:'Definire i limiti del servizio',trips:'Filtrare e aggiungere le corse programmate',feasible:'configurazione fattibile',verified:'fisicamente verificato',separate:'due righe'},
  };
  for (const language of SUPPORTED_GUIDE_LANGUAGES) {
    const sections = Object.fromEntries(guideContent[language].sections.map(s => [s.id,s]));
    const titles = sections.shifts.items.map(({title}) => title);
    const expected = terms[language];
    assert.ok(titles.indexOf(expected.boundaries) >= 0);
    assert.ok(titles.indexOf(expected.boundaries) < titles.indexOf(expected.trips));
    assert.ok(sections.results.items.some(({ text }) => text?.includes(expected.feasible)));
    assert.ok(sections.results.items.some(({ text }) => text?.includes(expected.verified)));
    assert.ok(sections.yearly.items.some(({text}) => text.includes('Min') && text.includes('Max') && text.includes(expected.separate)));
  }
});

test("Markdown chapters share the published guide baseline and document the three-step editor", async () => {
  for (const chapter of ['overview','fleet-management','shifts-and-routes','feasibility-evaluation','simulation-results','yearly-analysis','comparison-and-export']) {
    const text = await readProjectFile(`docs/user-guide/${chapter}.md`);
    assert.ok(
      text.trimEnd().endsWith(`> Reference versions: Frontend v${GUIDE_BASELINE_VERSION} · Backend v${GUIDE_BACKEND_BASELINE_VERSION}\n>\n> Last updated: ${new Date(GUIDE_UPDATED_AT + " UTC").toISOString().slice(0, 10)}`),
      `${chapter} should end with the guide’s reference versions and update date`,
    );
  }
  const shifts = await readProjectFile('docs/user-guide/shifts-and-routes.md');
  assert.deepEqual([...shifts.matchAll(/^### \d\. (.+)$/gm)].map(match => match[1]), ['Set up the block','Compose the day','Review and save']);
  assert.match(shifts,/Undo last\s+change/);
  assert.match(shifts, /Duplicate\*\* saves a new copy directly to the list/);
  assert.match(shifts, /while the programme contains activities/);

  const fleet = await readProjectFile("docs/user-guide/fleet-management.md");
  assert.match(fleet, /Details\*\* opens a read-only view/);
  assert.match(fleet, /If the lookup fails, position the map\s+manually/);
});
