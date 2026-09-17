import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  SUPPORTED_GUIDE_LANGUAGES,
  guideContent,
} from "../guide/content.js";

const readProjectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the landing page links to the public user guide", async () => {
  const landing = await readProjectFile("src/pages/Auth/landing.html");
  assert.match(landing, /href="\.\/guide\/"/);
  assert.match(landing, /data-i18n="landing\.user_guide"/);
});

test("the public guide contains the expected accessible shell", async () => {
  const guide = await readProjectFile("guide/index.html");
  assert.match(guide, /id="guide-language"/);
  assert.match(guide, /id="guide-content"/);
  assert.match(guide, /href="\.\.\/"/);
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
