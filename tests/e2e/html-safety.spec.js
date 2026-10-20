import { expect, test } from "@playwright/test";

const TEXT_PAYLOAD =
  `Fleet & <img src=x onerror="window.__elettraXss += 1">` +
  `<svg onload='window.__elettraXss += 10'></svg>` +
  `<script>window.__elettraXss += 100</script> "quoted" 'apostrophe'`;
const ATTRIBUTE_PAYLOAD = `record" autofocus onfocus="window.__elettraXss += 1000`;

test("user and API values stay inert in every fleet and run renderer", async ({ page }) => {
  await page.goto("./#landing");

  const result = await page.evaluate(
    async ({ textPayload, attributePayload }) => {
      window.__elettraXss = 0;

      const moduleUrl = (path) => new URL(path, document.baseURI).href;
      const [
        tables,
        customStops,
        shiftRenderers,
        shiftsPage,
        addSimulation,
        stopHelpers,
        simulationRuns,
        yearlyRuns,
      ] = await Promise.all([
        import(moduleUrl("src/dom/tables.js")),
        import(moduleUrl("src/pages/Fleet/Custom Stops/custom-stops.js")),
        import(moduleUrl("src/pages/Fleet/Shifts/shift-renderers.js")),
        import(moduleUrl("src/pages/Fleet/Shifts/shifts.js")),
        import(moduleUrl("src/pages/Simulation/Runs/add-simulation.js")),
        import(moduleUrl("src/pages/Simulation/shared/stop-helpers.js")),
        import(moduleUrl("src/pages/Simulation/Runs/simulation-runs.js")),
        import(moduleUrl("src/pages/Simulation/YearlyAnalysis/yearly-analysis-runs.js")),
      ]);

      const host = document.createElement("section");
      host.id = "html-safety-test-host";
      document.body.append(host);

      const appendTableBody = (name) => {
        const table = document.createElement("table");
        table.dataset.testTable = name;
        const tbody = document.createElement("tbody");
        table.append(tbody);
        host.append(table);
        return tbody;
      };

      const modelBody = appendTableBody("models");
      tables.renderModels(modelBody, [
        {
          id: attributePayload,
          name: textPayload,
          specs: {
            model_type: textPayload,
            bus_length_m: textPayload,
            cost: textPayload,
            bus_lifetime: textPayload,
            max_passengers: textPayload,
            battery_pack_size_kwh: textPayload,
            max_charging_power_kw: textPayload,
          },
        },
      ]);

      const busBody = appendTableBody("buses");
      tables.renderBusesList(
        busBody,
        [
          {
            id: attributePayload,
            name: textPayload,
            description: textPayload,
            bus_model_id: "model-1",
          },
        ],
        { "model-1": { name: textPayload, description: textPayload } }
      );

      const customStopBody = appendTableBody("custom-stops");
      customStops.renderCustomStopRows(customStopBody, [
        { id: attributePayload, name: textPayload, address: textPayload },
      ]);

      const shiftBody = appendTableBody("shifts");
      shiftsPage.renderShiftRows(shiftBody, [
        {
          id: attributePayload,
          name: textPayload,
          bus_id: attributePayload,
          bus_model_name: textPayload,
          _resolved_start_label: textPayload,
          _resolved_end_label: textPayload,
          _resolved_daily_distance_label: textPayload,
          _resolved_route_label: textPayload,
        },
      ]);

      const tripBody = appendTableBody("shift-trips");
      shiftRenderers.renderShiftTrips(tripBody, [
        {
          id: attributePayload,
          trip_id: attributePayload,
          departure_time: textPayload,
          arrival_time: textPayload,
          start_stop_name: textPayload,
          end_stop_name: textPayload,
        },
      ]);

      const scheduledTripBody = appendTableBody("scheduled-trips");
      shiftRenderers.renderScheduledTrips({
        tbody: scheduledTripBody,
        trips: [
          {
            id: attributePayload,
            trip_id: attributePayload,
            departure_time: textPayload,
            arrival_time: textPayload,
            start_stop_name: textPayload,
            end_stop_name: textPayload,
          },
        ],
        eligibleTrips: [
          {
            id: attributePayload,
            trip_id: attributePayload,
            departure_time: textPayload,
            arrival_time: textPayload,
            start_stop_name: textPayload,
            end_stop_name: textPayload,
          },
        ],
      });

      const routeSelect = document.createElement("select");
      const busSelect = document.createElement("select");
      const depotSelect = document.createElement("select");
      host.append(routeSelect, busSelect, depotSelect);
      shiftRenderers.renderRouteOptions(routeSelect, [
        { id: attributePayload, route_short_name: textPayload },
      ]);
      shiftRenderers.renderBusOptions(
        busSelect,
        [{ id: attributePayload, bus_model_id: "model-1" }],
        { "model-1": { name: textPayload } }
      );
      shiftRenderers.renderDepotOptions(depotSelect, [
        { id: attributePayload, name: textPayload },
      ]);

      const addSimulationShiftBody = appendTableBody("add-simulation-shifts");
      addSimulation.renderShiftRows(addSimulationShiftBody, [
        {
          id: attributePayload,
          name: textPayload,
          _resolved_bus_model: textPayload,
          _resolved_daily_distance_label: textPayload,
          _resolved_yearly_distance_label: textPayload,
        },
      ]);

      const stopTable = document.createElement("table");
      stopTable.dataset.testTable = "charging-stops";
      const stopHead = document.createElement("thead");
      const stopBody = document.createElement("tbody");
      stopTable.append(stopHead, stopBody);
      host.append(stopTable);
      stopHelpers.renderStopsTable(
        stopHead,
        stopBody,
        [{ stop_id: attributePayload, stop_name: textPayload, isCustom: true }],
        "battery_only"
      );

      const runBody = appendTableBody("simulation-runs");
      simulationRuns.renderSimulationRunRows(runBody, [
        {
          id: attributePayload,
          status: attributePayload,
          name: textPayload,
          input_params: { name: textPayload, mode: textPayload },
          _resolved_shift_name: textPayload,
          _resolved_bus_model_name: textPayload,
        },
      ]);

      const yearlyBody = appendTableBody("yearly-runs");
      yearlyBody.innerHTML = yearlyRuns.buildYearlyAnalysisRowsMarkup([
        {
          id: attributePayload,
          name: textPayload,
          features: {
            meta: { shiftNames: [textPayload], modeLabel: textPayload },
            config: { mode: "unknown" },
            status: attributePayload,
          },
        },
      ]);

      const eventAttributes = Array.from(host.querySelectorAll("*")).flatMap(
        (element) =>
          Array.from(element.attributes)
            .filter((attribute) => attribute.name.toLowerCase().startsWith("on"))
            .map((attribute) => `${element.tagName}:${attribute.name}`)
      );

      return {
        hostText: host.textContent,
        executableElementCount: host.querySelectorAll("img, svg, script").length,
        eventAttributes,
        ids: {
          model: modelBody.querySelector("tr")?.dataset.id,
          bus: busBody.querySelector("tr")?.dataset.id,
          customStop: customStopBody.querySelector("tr")?.dataset.id,
          shift: shiftBody.querySelector("tr")?.dataset.id,
          shiftName: shiftBody.querySelector("tr")?.dataset.name,
          trip: tripBody.querySelector("tr")?.dataset.tripId,
          addSimulation: addSimulationShiftBody.querySelector("tr")?.dataset.id,
          stop: stopBody.querySelector("tr")?.dataset.stopId,
          simulationRun: runBody.querySelector("tr")?.dataset.id,
          yearlyRun: yearlyBody.querySelector("tr")?.dataset.id,
        },
        optionValues: [
          routeSelect.options[1]?.value,
          busSelect.options[1]?.value,
          depotSelect.options[1]?.value,
        ],
        optionText: [routeSelect.textContent, busSelect.textContent, depotSelect.textContent],
      };
    },
    { textPayload: TEXT_PAYLOAD, attributePayload: ATTRIBUTE_PAYLOAD }
  );

  await page.waitForTimeout(100);

  expect(await page.evaluate(() => window.__elettraXss)).toBe(0);
  expect(result.executableElementCount).toBe(0);
  expect(result.eventAttributes).toEqual([]);
  expect(result.hostText).toContain(TEXT_PAYLOAD);
  expect(result.ids).toEqual({
    model: ATTRIBUTE_PAYLOAD,
    bus: ATTRIBUTE_PAYLOAD,
    customStop: ATTRIBUTE_PAYLOAD,
    shift: ATTRIBUTE_PAYLOAD,
    shiftName: TEXT_PAYLOAD,
    trip: ATTRIBUTE_PAYLOAD,
    addSimulation: ATTRIBUTE_PAYLOAD,
    stop: ATTRIBUTE_PAYLOAD,
    simulationRun: ATTRIBUTE_PAYLOAD,
    yearlyRun: ATTRIBUTE_PAYLOAD,
  });
  expect(result.optionValues).toEqual([
    ATTRIBUTE_PAYLOAD,
    ATTRIBUTE_PAYLOAD,
    ATTRIBUTE_PAYLOAD,
  ]);
  for (const optionText of result.optionText) {
    expect(optionText).toContain(TEXT_PAYLOAD);
  }
});

test("v0.2 annual assessment and comparison renderers keep backend values inert", async ({
  page,
}) => {
  await page.goto("./#landing");

  const result = await page.evaluate(
    async ({ textPayload, attributePayload }) => {
      window.__elettraXss = 0;
      const moduleUrl = (path) => new URL(path, document.baseURI).href;
      const [parameterizedLca, yearlyResults, analysisComparison] =
        await Promise.all([
          import(
            moduleUrl(
              "src/pages/Simulation/YearlyAnalysis/parameterized-lca.js"
            )
          ),
          import(
            moduleUrl(
              "src/pages/Simulation/YearlyAnalysis/yearly-analysis-results.js"
            )
          ),
          import(
            moduleUrl(
              "src/pages/Simulation/AnalysisComparison/analysis-comparison.js"
            )
          ),
        ]);

      const host = document.createElement("section");
      host.id = "annual-html-safety-test-host";
      document.body.append(host);

      const phases = {
        direct: 1,
        directNonExhaust: 1,
        energyChain: 1,
        maintenance: 1,
        vehicle: 1,
        endOfLife: 1,
        infrastructure: 1,
      };
      const lcaHost = document.createElement("div");
      host.append(lcaHost);
      parameterizedLca.renderParameterizedLca(
        lcaHost,
        {
          methodology_version: textPayload,
          annual_km: 100,
          vehicle_count: attributePayload,
          energy_boundary: {
            dc_kwh: 94,
            grid_kwh: 100,
            charging_losses_kwh: 6,
          },
          indicators: {
            gwp100a: {
              electricity_operation: 1,
              diesel_heating: 1,
              other_lifecycle: 1,
              total: 7,
              diesel_comparator_total: 7,
              phases,
              diesel_comparator_phases: phases,
            },
          },
          vehicles: [
            {
              shift_id: textPayload,
              annual_km: 100,
              battery_capacity_kwh: 400,
              battery_chemistry: textPayload,
              passengers: 50,
              lifetime_bus: 12,
              lifetime_battery: 8,
              lifetime_diesel_bus: 12,
              warnings: [textPayload],
            },
          ],
          provenance: { data_version: textPayload },
        },
        () => textPayload
      );

      const yearlyPanel = document.createElement("section");
      yearlyPanel.dataset.panel = "emissions";
      yearlyPanel.innerHTML = `
        <div data-role="ya-env-controls"></div>
        <div data-role="ya-env-kpis"></div>
        <div data-role="ya-env-table"></div>
        <div data-role="ya-env-methodology"></div>
      `;
      host.append(yearlyPanel);
      const makeIndicator = (key) => ({
        key,
        unit: textPayload,
        display_unit: textPayload,
        ebus_total: 1,
        normalized_ebus_per_km: 1,
        normalized_unit: textPayload,
      });
      yearlyResults.renderEmissionsPanel(yearlyPanel, {
        status: "done",
        yearlyDistanceKm: 100,
        electricYearly: {
          gwp100a: { total: 1, unit: textPayload, ...phases },
          nox: { total: 1, unit: textPayload },
          pm10: { total: 1, unit: textPayload },
        },
        dieselYearly: null,
        structured: {
          assumptions: { yearly_distance_km: 100 },
          dataCompleteness: { status: "complete" },
          indicators: [
            makeIndicator("gwp100a"),
            makeIndicator("nox"),
            makeIndicator("pm10"),
          ],
        },
      });

      const comparisonHost = document.createElement("section");
      comparisonHost.innerHTML = `
        <div data-role="panel-overview"></div>
        <div data-role="panel-efficiency"></div>
        <div data-role="panel-cost"></div>
        <div data-role="panel-emissions"></div>
        <div data-role="panel-details"></div>
      `;
      host.append(comparisonHost);
      const comparisonModel = {
        shiftCount: 1,
        scenarioCount: 1,
        sectionStatus: { costs: "ready", emissions: "ready" },
        efficiency: {
          totalEnergyKwh: 1,
          drivetrainEnergyKwh: 1,
          auxiliaryEnergyKwh: 1,
          energyPerKm: 1,
        },
        cost: {
          totalAnnualCost: 1,
          energyOpex: 1,
          maintenanceOpex: 1,
          vehicleCapexAnnual: 1,
          dieselTotalAnnual: 1,
          annualSaving: 1,
          costPerKm: 1,
        },
        emissions: {
          co2TotalTons: 1,
          co2PerKm: 1,
          indicators: [
            {
              key: textPayload,
              ebus: 1,
              diesel: 1,
              unit: attributePayload,
            },
          ],
          dataCompleteness: { status: "complete" },
        },
      };
      analysisComparison.renderPanels(
        comparisonHost,
        comparisonModel,
        comparisonModel
      );

      const eventAttributes = Array.from(host.querySelectorAll("*")).flatMap(
        (element) =>
          Array.from(element.attributes)
            .filter((attribute) => attribute.name.toLowerCase().startsWith("on"))
            .map((attribute) => `${element.tagName}:${attribute.name}`)
      );

      return {
        text: host.textContent,
        executableElementCount: host.querySelectorAll("img, svg, script").length,
        eventAttributes,
      };
    },
    { textPayload: TEXT_PAYLOAD, attributePayload: ATTRIBUTE_PAYLOAD }
  );

  await page.waitForTimeout(100);

  expect(await page.evaluate(() => window.__elettraXss)).toBe(0);
  expect(result.executableElementCount).toBe(0);
  expect(result.eventAttributes).toEqual([]);
  expect(result.text).toContain(TEXT_PAYLOAD);
  expect(result.text).toContain(ATTRIBUTE_PAYLOAD);
});

test("escaped values round-trip as the original visible text", async ({ page }) => {
  await page.goto("./#landing");

  const roundTrip = await page.evaluate(async (payload) => {
    const moduleUrl = new URL("src/ui-helpers.js", document.baseURI).href;
    const { escapeHtml, textContent, toText } = await import(moduleUrl);
    const textNodeHost = document.createElement("div");
    const attributeHost = document.createElement("div");

    textNodeHost.innerHTML = `<span>${escapeHtml(payload)}</span>`;
    attributeHost.innerHTML = `<span title="${escapeHtml(payload)}"></span>`;

    const directTextHost = document.createElement("span");
    directTextHost.textContent = toText(payload);

    return {
      visibleText: textNodeHost.textContent,
      attributeValue: attributeHost.firstElementChild?.getAttribute("title"),
      directText: directTextHost.textContent,
      compatibilityAlias: textContent(payload),
      encodedValue: escapeHtml(payload),
      childElementCount: textNodeHost.querySelectorAll("*").length,
    };
  }, TEXT_PAYLOAD);

  expect(roundTrip.visibleText).toBe(TEXT_PAYLOAD);
  expect(roundTrip.attributeValue).toBe(TEXT_PAYLOAD);
  expect(roundTrip.directText).toBe(TEXT_PAYLOAD);
  expect(roundTrip.compatibilityAlias).toBe(roundTrip.encodedValue);
  expect(roundTrip.childElementCount).toBe(1);
});
