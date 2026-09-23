import { expect, test } from "@playwright/test";


const mountFeasibilityTableFixtures = async (page) => {
  await page.goto("./");
  await page.evaluate(() => {
    const host = document.createElement("main");
    host.setAttribute("aria-label", "Feasibility table alignment fixtures");
    host.innerHTML = `
      <div class="efficiency-table-wrap">
        <table class="efficiency-table" data-case="battery-sizing">
          <thead>
            <tr>
              <th>Optimized Packs</th>
              <th>
                <span class="efficiency-label-with-info">
                  Optimized usable (kWh)
                  <button type="button" class="efficiency-info-icon">i</button>
                </span>
              </th>
              <th>Max Physical</th>
              <th>Required</th>
              <th>Excess</th>
              <th class="efficiency-th-text">Feasibility</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="efficiency-td-num efficiency-td-highlight">15</td>
              <td class="efficiency-td-num efficiency-td-highlight">525</td>
              <td class="efficiency-td-num">16</td>
              <td class="efficiency-td-num">15</td>
              <td class="efficiency-td-num">0</td>
              <td><span class="badge badge--compact badge--positive">Feasible</span></td>
            </tr>
            <tr>
              <td class="efficiency-td-num efficiency-td-highlight">—</td>
              <td class="efficiency-td-num efficiency-td-highlight">—</td>
              <td class="efficiency-td-num">12</td>
              <td class="efficiency-td-num"><strong>14</strong></td>
              <td class="efficiency-td-num">2</td>
              <td><span class="badge badge--compact badge--negative">Infeasible</span></td>
            </tr>
            <tr>
              <td class="efficiency-td-num">—</td>
              <td class="efficiency-td-num">—</td>
              <td class="efficiency-td-num">—</td>
              <td class="efficiency-td-num">—</td>
              <td class="efficiency-td-num">—</td>
              <td><span class="badge badge--compact badge--neutral">—</span></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="efficiency-table-wrap">
        <table class="efficiency-table" data-case="charging-infrastructure">
          <thead>
            <tr>
              <th class="efficiency-th-text">Stop</th>
              <th>Slots</th>
              <th>kW / plug</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Central Station</td>
              <td class="efficiency-td-num">4</td>
              <td class="efficiency-td-num">150</td>
            </tr>
            <tr>
              <td>Depot</td>
              <td class="efficiency-td-num">—</td>
              <td class="efficiency-td-num">—</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="efficiency-table-wrap">
        <table class="efficiency-table" data-case="charging-configuration">
          <thead>
            <tr>
              <th class="efficiency-th-text">Stop</th>
              <th class="efficiency-th-text">Status</th>
              <th>Plugs</th>
              <th>kW / plug</th>
              <th>Total power (kW)</th>
              <th>Slot costs</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Central Station</td>
              <td>Installed</td>
              <td class="efficiency-td-num">2</td>
              <td class="efficiency-td-num">150</td>
              <td class="efficiency-td-num">300</td>
              <td class="efficiency-td-num">CHF 30'000, CHF 30'000</td>
            </tr>
            <tr>
              <td>Depot</td>
              <td>Configured</td>
              <td class="efficiency-td-num">1</td>
              <td class="efficiency-td-num">100</td>
              <td class="efficiency-td-num">100</td>
              <td class="efficiency-td-num">CHF 20'000</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="efficiency-table-wrap">
        <table class="efficiency-table" data-case="energy-predictions">
          <thead>
            <tr>
              <th># Packs</th>
              <th>Capacity (kWh)</th>
              <th>Total Q50 (kWh)</th>
              <th>Specific Q95 (kWh/km)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="efficiency-td-num">14</td>
              <td class="efficiency-td-num">700</td>
              <td class="efficiency-td-num">502.7</td>
              <td class="efficiency-td-num efficiency-td-highlight">3.102</td>
            </tr>
            <tr>
              <td class="efficiency-td-num">15</td>
              <td class="efficiency-td-num">750</td>
              <td class="efficiency-td-num">500.1</td>
              <td class="efficiency-td-num efficiency-td-highlight">3.080</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="efficiency-infeasibility-notice">
        <div class="efficiency-table-wrap">
          <table class="efficiency-table" data-case="infeasible-breakdown">
            <thead>
              <tr>
                <th class="efficiency-th-text">Shift</th>
                <th>Required Packs</th>
                <th>Required usable (kWh)</th>
                <th>Max Physical Packs</th>
                <th>Max usable (kWh)</th>
                <th>Excess Packs</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Morning service</td>
                <td class="efficiency-td-num"><strong>18</strong></td>
                <td class="efficiency-td-num"><strong>630</strong></td>
                <td class="efficiency-td-num">16</td>
                <td class="efficiency-td-num">
                  <span class="efficiency-limit-cell">
                    <span>560</span>
                    <span class="efficiency-limit-cell__warning">Limit exceeded</span>
                  </span>
                </td>
                <td class="efficiency-td-num">2</td>
              </tr>
              <tr>
                <td>Evening service with a longer localized name</td>
                <td class="efficiency-td-num">17</td>
                <td class="efficiency-td-num">595</td>
                <td class="efficiency-td-num">16</td>
                <td class="efficiency-td-num">560</td>
                <td class="efficiency-td-num">1</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="infeasibility-tab-notice">
        <div class="efficiency-table-wrap">
          <table class="efficiency-table" data-case="infeasible-max-physical">
            <thead>
              <tr>
                <th class="efficiency-th-text">Shift</th>
                <th>Max Physical Packs</th>
                <th>
                  <span class="efficiency-label-with-info">
                    Max usable (kWh)
                    <button type="button" class="efficiency-info-icon">i</button>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Morning service</td>
                <td class="efficiency-td-num">16</td>
                <td class="efficiency-td-num">560</td>
              </tr>
              <tr>
                <td>Missing-capacity service</td>
                <td class="efficiency-td-num">—</td>
                <td class="efficiency-td-num">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="efficiency-table-wrap">
        <table class="efficiency-table" data-case="empty-state">
          <thead>
            <tr>
              <th># Packs</th>
              <th>Capacity</th>
              <th>Weight</th>
              <th>Distance</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="4" class="efficiency-no-data">No prediction data available.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <table data-case="unrelated-table">
        <thead><tr><th>Unrelated heading</th></tr></thead>
        <tbody><tr><td>Unrelated value</td></tr></tbody>
      </table>
    `;
    document.body.replaceChildren(host);
  });
};

const expectEveryCellCentered = async (table, expectedCellCount) => {
  const cells = table.locator("th, td");
  await expect(cells).toHaveCount(expectedCellCount);
  const alignments = await cells.evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).textAlign)
  );
  expect(alignments).toEqual(Array(expectedCellCount).fill("center"));
};


test.beforeEach(async ({ page }) => {
  await mountFeasibilityTableFixtures(page);
});


test("centers every feasible-results table cell", async ({ page }) => {
  await expectEveryCellCentered(
    page.locator('[data-case="battery-sizing"]'),
    24
  );
  await expectEveryCellCentered(
    page.locator('[data-case="charging-infrastructure"]'),
    9
  );
  await expectEveryCellCentered(
    page.locator('[data-case="charging-configuration"]'),
    18
  );
  await expectEveryCellCentered(
    page.locator('[data-case="energy-predictions"]'),
    12
  );
});


test("centers every infeasible-results table cell", async ({ page }) => {
  await expectEveryCellCentered(
    page.locator('[data-case="infeasible-breakdown"]'),
    18
  );
  await expectEveryCellCentered(
    page.locator('[data-case="infeasible-max-physical"]'),
    9
  );
});


test("centers empty and modifier cells without affecting unrelated tables", async ({
  page,
}) => {
  await expectEveryCellCentered(page.locator('[data-case="empty-state"]'), 5);

  const unrelatedCells = page.locator(
    '[data-case="unrelated-table"] th, [data-case="unrelated-table"] td'
  );
  await expect(unrelatedCells).toHaveCount(2);
  const unrelatedAlignments = await unrelatedCells.evaluateAll((elements) =>
    elements.map((element) => getComputedStyle(element).textAlign)
  );
  expect(unrelatedAlignments).toEqual(["left", "left"]);
});
