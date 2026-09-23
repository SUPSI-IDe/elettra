import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";


const readSource = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const createYearlyAnalysisHtml = readSource(
  "src/pages/Simulation/YearlyAnalysis/create-yearly-analysis.html"
);
const yearlyAnalysisResultsHtml = readSource(
  "src/pages/Simulation/YearlyAnalysis/yearly-analysis-results.html"
);
const simulationResultsHtml = readSource(
  "src/pages/Simulation/Runs/simulation-results.html"
);
const simulationRunsHtml = readSource(
  "src/pages/Simulation/Runs/simulation-runs.html"
);
const simulationRunsJs = readSource(
  "src/pages/Simulation/Runs/simulation-runs.js"
);

const openStyledPage = async (page) => {
  await page.goto("./");
};

const mountSourceElement = async (page, html, selector, wrap = false) => {
  await page.evaluate(
    ({ source, targetSelector, shouldWrap }) => {
      const parsed = new DOMParser().parseFromString(source, "text/html");
      const target = parsed.querySelector(targetSelector);
      if (!target) throw new Error(`Missing source element: ${targetSelector}`);

      if (shouldWrap) {
        const host = document.createElement("main");
        host.style.width = "100%";
        host.style.padding = "16px";
        host.append(target);
        document.body.replaceChildren(host);
      } else {
        document.body.replaceChildren(target);
      }
    },
    { source: html, targetSelector: selector, shouldWrap: wrap }
  );
};

const computedAlignments = (locator) =>
  locator.evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).textAlign)
  );


test.beforeEach(async ({ page }) => {
  await openStyledPage(page);
});


test("yearly scenario table preserves populated and colspan alignment", async ({
  page,
}) => {
  await mountSourceElement(
    page,
    createYearlyAnalysisHtml,
    ".create-yearly-analysis"
  );

  await expect(
    computedAlignments(page.locator(".ya-scenarios-table thead th"))
  ).resolves.toEqual(["center", "right", "right"]);
  await expect(
    computedAlignments(page.locator(".ya-scenarios-placeholder"))
  ).resolves.toEqual(["left"]);
  await expect(
    computedAlignments(page.locator(".ya-scenarios-table tfoot td"))
  ).resolves.toEqual(["left", "right"]);

  await page.locator('[data-role="scenarios-body"]').evaluate((tbody) => {
    tbody.innerHTML = `
      <tr>
        <td class="ya-scenarios-color-cell"><span class="ya-scenarios-swatch"></span></td>
        <td class="ya-scenarios-number">-5</td>
        <td class="ya-scenarios-number">180</td>
      </tr>
      <tr>
        <td class="ya-scenarios-color-cell"><span class="ya-scenarios-swatch"></span></td>
        <td class="ya-scenarios-number">25</td>
        <td class="ya-scenarios-number">185</td>
      </tr>`;
  });

  await expect(
    computedAlignments(page.locator(".ya-scenarios-table tbody td"))
  ).resolves.toEqual([
    "center",
    "right",
    "right",
    "center",
    "right",
    "right",
  ]);
});


test("environmental grouped headers center only spanning labels", async ({
  page,
}) => {
  await page.evaluate(() => {
    const host = document.createElement("main");
    host.className = "simulation-results-page";
    host.innerHTML = `
      <table class="emissions-recap-table emissions-recap-table--env" data-case="comparison">
        <thead>
          <tr class="env-header-main">
            <th rowspan="2">Indicator</th>
            <th colspan="2">Electric bus</th>
            <th colspan="2">Diesel bus</th>
            <th colspan="2">Difference</th>
            <th rowspan="2">Reduction</th>
          </tr>
          <tr class="env-header-sub">
            <th>Yearly</th><th>Per km</th>
            <th>Yearly</th><th>Per km</th>
            <th>Yearly</th><th>Per km</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CO2</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>50%</td>
          </tr>
        </tbody>
      </table>
      <table class="emissions-recap-table emissions-recap-table--env" data-case="electric-only">
        <thead>
          <tr class="env-header-main"><th rowspan="2">Indicator</th><th colspan="2">Electric bus</th></tr>
          <tr class="env-header-sub"><th>Yearly</th><th>Per km</th></tr>
        </thead>
        <tbody><tr><td>CO2</td><td>1</td><td>2</td></tr></tbody>
      </table>`;
    document.body.replaceChildren(host);
  });

  await expect(
    computedAlignments(
      page.locator('[data-case="comparison"] .env-header-main th')
    )
  ).resolves.toEqual(["left", "center", "center", "center", "right"]);
  await expect(
    computedAlignments(
      page.locator('[data-case="comparison"] .env-header-sub th')
    )
  ).resolves.toEqual(Array(6).fill("right"));
  await expect(
    computedAlignments(page.locator('[data-case="comparison"] tbody td'))
  ).resolves.toEqual(["left", ...Array(7).fill("right")]);
  await expect(
    computedAlignments(
      page.locator('[data-case="electric-only"] .env-header-main th')
    )
  ).resolves.toEqual(["left", "center"]);
});


test("dense list tables remain readable and scroll only when needed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => {
    const host = document.createElement("main");
    host.style.width = "100%";
    host.style.padding = "16px";
    host.innerHTML = `
      <div class="bus-models" data-case="buses">
        <table><thead><tr>
          <th class="checkbox">Select</th><th class="name">Name</th><th class="model">Vehicle category</th>
          <th>Size</th><th>Cost</th><th>Lifetime</th><th>Passengers</th><th>Battery</th><th>Charging</th>
        </tr></thead><tbody><tr>
          <td class="checkbox">x</td><td class="name">AA_NF_fleet_014e4f3e</td><td class="model">Articulated electric bus — 18 m</td>
          <td>18</td><td>900</td><td>12</td><td>131</td><td>525</td><td>450</td>
        </tr></tbody></table>
      </div>
      <div class="shifts-table" data-case="shifts">
        <table><thead><tr>
          <th class="checkbox">Select</th><th class="name">Shift</th><th class="bus">Bus</th>
          <th class="start">Start</th><th class="end">End</th><th class="distance">Distance</th><th>Route</th><th class="actions">Actions</th>
        </tr></thead><tbody><tr>
          <td class="checkbox">x</td><td class="name">fleet_00_40101</td><td class="bus">AA_NF_fleet_d6594d11</td>
          <td>05:42</td><td>20:52</td><td>118.8 km</td><td>32 trips</td><td class="actions">Visualize</td>
        </tr></tbody></table>
      </div>
      <div class="simulation-runs-table" data-case="runs">
        <table><thead><tr>
          <th class="checkbox">Select</th><th class="name">Name</th><th class="created">Created</th><th class="day">Bus</th>
          <th class="main-parameters">Parameters</th><th class="type">Mode</th><th class="status">Status</th>
          <th class="feasibility">Feasibility</th><th class="results">Results</th>
        </tr></thead><tbody><tr>
          <td class="checkbox">x</td><td class="name">Test optimization name</td><td class="created">02.06.2026, 17:13</td><td class="day">AA_NF_test_00c71993</td>
          <td class="main-parameters">15 C, 50%, [10-95]%</td><td class="type">charging_only</td><td class="status">Completed</td>
          <td class="feasibility">Feasible</td><td class="results">Results</td>
        </tr></tbody></table>
      </div>`;
    document.body.replaceChildren(host);
  });

  const measurements = async () =>
    page.locator("[data-case]").evaluateAll((wrappers) =>
      Object.fromEntries(
        wrappers.map((wrapper) => {
          const table = wrapper.querySelector("table");
          return [
            wrapper.dataset.case,
            {
              clientWidth: wrapper.clientWidth,
              scrollWidth: wrapper.scrollWidth,
              tableWidth: table.getBoundingClientRect().width,
            },
          ];
        })
      )
    );

  const desktop = await measurements();
  for (const result of Object.values(desktop)) {
    expect(result.scrollWidth).toBeLessThanOrEqual(result.clientWidth + 1);
  }

  const busTextWidths = await page
    .locator('[data-case="buses"] tbody :is(.name, .model)')
    .evaluateAll((cells) => cells.map((cell) => cell.getBoundingClientRect().width));
  expect(busTextWidths[0]).toBeGreaterThanOrEqual(200);
  expect(busTextWidths[1]).toBeGreaterThanOrEqual(232);

  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = await measurements();
  expect(mobile.buses.scrollWidth).toBeGreaterThan(mobile.buses.clientWidth);
  expect(mobile.buses.tableWidth).toBeGreaterThanOrEqual(1215);
  expect(mobile.shifts.scrollWidth).toBeGreaterThan(mobile.shifts.clientWidth);
  expect(mobile.shifts.tableWidth).toBeGreaterThanOrEqual(927);
  expect(mobile.runs.scrollWidth).toBeGreaterThan(mobile.runs.clientWidth);
  expect(mobile.runs.tableWidth).toBeGreaterThanOrEqual(1151);
});


test("yearly result tabs contain localized overflow on narrow screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await mountSourceElement(page, yearlyAnalysisResultsHtml, ".ya-tabs", true);

  const translations = [
    ["Overview", "Efficiency", "Costs", "Emissions"],
    ["Überblick", "Effizienz", "Kosten", "Emissionen"],
    ["Aperçu", "Efficacité", "Coûts", "Émissions"],
    ["Riepilogo", "Efficienza", "Costi", "Emissioni"],
  ];

  for (const labels of translations) {
    await page.locator(".ya-tab").evaluateAll((tabs, values) => {
      tabs.forEach((tab, index) => {
        tab.textContent = values[index];
      });
    }, labels);

    const metrics = await page.locator(".ya-tabs").evaluate((tabs) => ({
      clientWidth: tabs.clientWidth,
      scrollWidth: tabs.scrollWidth,
      overflowX: getComputedStyle(tabs).overflowX,
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }));

    expect(metrics.overflowX).toBe("auto");
    expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
    expect(metrics.bodyScrollWidth).toBe(metrics.bodyClientWidth);
  }
});


test("result pages own their action classes and align actions consistently", async ({
  page,
}) => {
  await mountSourceElement(
    page,
    simulationResultsHtml,
    ".simulation-results-page"
  );
  await expect(page.locator(".simulation-results-page .results-actions")).toHaveCount(1);
  await expect(page.locator(".simulation-results-page .ya-results-actions")).toHaveCount(0);
  await expect(
    page.locator(".simulation-results-page .results-actions > .btn-close-results")
  ).toHaveCount(1);
  await expect(
    page.locator(".simulation-results-page .results-actions").evaluate(
      (element) => getComputedStyle(element).justifyContent
    )
  ).resolves.toBe("flex-end");

  await mountSourceElement(
    page,
    yearlyAnalysisResultsHtml,
    ".yearly-analysis-results"
  );
  await expect(page.locator(".yearly-analysis-results .ya-results-actions")).toHaveCount(1);
  await expect(
    page.locator(".yearly-analysis-results .ya-results-actions").evaluate(
      (element) => getComputedStyle(element).justifyContent
    )
  ).resolves.toBe("flex-end");
});


test("created dates do not inherit action-column styling", async ({ page }) => {
  expect(simulationRunsHtml).toMatch(
    /<th class="created"[^>]*data-sort-key="created_at"/
  );
  expect(simulationRunsJs).toContain(
    '<td class="created">${textContent(created)}</td>'
  );
  expect(simulationRunsJs).not.toContain(
    '<td class="actions">${textContent(created)}</td>'
  );

  await mountSourceElement(page, simulationRunsHtml, ".simulation-runs");
  await page.locator('[data-role="simulation-runs-body"]').evaluate((tbody) => {
    tbody.innerHTML = `
      <tr>
        <td class="checkbox">x</td>
        <td class="name">Evaluation</td>
        <td class="created">02.06.2026, 17:13</td>
        <td class="day">Bus</td>
        <td class="main-parameters">Parameters</td>
        <td class="type">Mode</td>
        <td class="status">Completed</td>
        <td class="feasibility">Feasible</td>
        <td class="results">Results</td>
      </tr>`;
  });

  const styles = await page.locator(".simulation-runs-table tbody tr").evaluate((row) => {
    const name = row.querySelector(".name");
    const created = row.querySelector(".created");
    return {
      nameBackground: getComputedStyle(name).backgroundColor,
      createdBackground: getComputedStyle(created).backgroundColor,
      createdAlignment: getComputedStyle(created).textAlign,
    };
  });

  expect(styles.createdBackground).toBe(styles.nameBackground);
  expect(styles.createdAlignment).toBe("center");
});
