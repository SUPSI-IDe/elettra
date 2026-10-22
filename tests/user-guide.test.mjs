import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  GUIDE_BASELINE_VERSION,
  GUIDE_UPDATED_AT,
  SUPPORTED_GUIDE_LANGUAGES,
  guideContent,
} from "../guide/content.js";

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

test("the public guide contains the expected accessible shell", async () => {
  const guide = await readProjectFile("guide/index.html");
  assert.match(guide, /id="guide-language"/);
  assert.match(guide, /id="guide-content"/);
  assert.equal(guide.match(/href="\.\.\/#landing"/g)?.length, 2);
  assert.doesNotMatch(guide, /to verify|placeholder|asset to be supplied/i);
});

test("all supported guide languages expose the same complete section structure", () => {
  const expectedIds = [
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
  const expectedFigureCounts = [1, 0, 1, 1, 1, 2, 2, 0, 0];

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

test("the guide baseline follows the frontend version and exposes a valid update date", async () => {
  const packageJson = JSON.parse(await readProjectFile("package.json"));
  assert.equal(GUIDE_BASELINE_VERSION, packageJson.version);
  assert.equal(Number.isNaN(Date.parse(GUIDE_UPDATED_AT)), false);
});

test("every guide language explains the two-level feasibility and yearly result navigation", () => {
  const expectedTerms = {
    en: {
      feasibility: ["General", "shift", "common battery", "planned charging"],
      yearly: ["General", "shift", "Efficiency", "Costs", "Emissions", "annual DC energy"],
    },
    de: {
      feasibility: ["Allgemein", "Dienst", "gemeinsamen Batterie", "geplanten Ladevorgänge"],
      yearly: ["Allgemein", "Dienst", "Effizienz", "Kosten", "Emissionen", "jährlichen DC-Energie"],
    },
    fr: {
      feasibility: ["Général", "service", "batterie commune", "recharges planifiées"],
      yearly: ["Général", "service", "Efficacité", "Coûts", "Émissions", "énergie DC annuelle"],
    },
    it: {
      feasibility: ["Generale", "turno", "batteria comune", "ricariche pianificate"],
      yearly: ["Generale", "turno", "Efficienza", "Costi", "Emissioni", "energia DC annuale"],
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
