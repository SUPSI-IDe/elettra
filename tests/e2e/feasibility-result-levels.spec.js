import { expect, test } from "@playwright/test";

const updateGuideScreenshots = process.env.UPDATE_GUIDE_SCREENSHOTS === "1";

const battery = (shiftName, packs, overrides = {}) => ({
  shift_name: shiftName,
  reference_packs: 6,
  base_packs: 6,
  optimized_packs: packs,
  required_total_packs: packs,
  max_physical_packs: 16,
  base_kwh: 300,
  optimized_kwh: packs * 50,
  max_physical_kwh: 800,
  physical_feasible: true,
  feasibility_status: "feasible",
  ...overrides,
});

const prediction = (id, shiftId, packs, consumption) => ({
  id,
  status: "completed",
  shift_id: shiftId,
  external_temp_celsius: -10,
  auxiliary_heating_type: "default",
  occupancy_percent: 100,
  contextual_parameters: {
    num_battery_packs: packs,
    battery_capacity_kwh: packs * 50,
    total_weight_kg: 18_000,
  },
  summary: {
    total_distance_km: 100,
    total_consumption_kwh: consumption,
    consumption_per_km_kwh: consumption / 100,
    total_drivetrain_kwh: consumption - 50,
    total_auxiliary_kwh: 50,
    quantiles: {
      q05: consumption - 20,
      q50: consumption,
      q95: consumption + 20,
    },
  },
});

const mountResults = async (page, {
  shiftIds = ["morning", "evening"],
  shiftNames: shiftNameOverrides = {},
  resultShiftNames: resultShiftNameOverrides = {},
  predictionRunIds,
  predictionOverrides = {},
  mode = "battery_only",
  chargingStations = [{
    stop_id: "depot",
    stop_name: "Depot",
    num_slots: 2,
    max_power_per_slot_kw: 150,
  }],
  installedChargers,
  stationUtilization,
  totalInstallationCostChf,
  includeInfrastructureInput = true,
  includeElectrificationFeasible = true,
  electrificationFeasible = true,
  electrificationSummary,
  runStatus = "completed",
  failure,
  legacyError,
  includeBatteryResults = true,
  includePerBusSummary = true,
  fixedBatteryPacks = 12,
  batteryResultOverrides = {},
  perBusSummaryOverrides = {},
  consumptionAnalysis,
  consumptionBasis,
  forecastVerification,
  batteryPolicy = {},
  solverStatus,
  infeasibilityDiagnostics,
  basisRunIds,
  initialReferencePredictionRunIds,
  selectedPredictionRunIds,
  dailyCycle,
  language = "en",
  gtfsProvenance,
  currentGtfs = [],
  initializerOptions = {},
} = {}) => {
  const requestedApiPaths = [];
  await page.addInitScript((selectedLanguage) => {
    localStorage.setItem("elettra_lang", selectedLanguage);
  }, language);
  const shiftNames = {
    morning: "Morning service",
    evening: "Evening service",
    ...shiftNameOverrides,
  };
  const resultShiftNames = {
    ...shiftNames,
    ...resultShiftNameOverrides,
  };
  const predictions = {
    "prediction-morning": prediction("prediction-morning", "morning", 8, 350),
    "prediction-evening": prediction("prediction-evening", "evening", 12, 550),
    ...predictionOverrides,
  };
  const batteryResults = Object.fromEntries(
    shiftIds.map((shiftId) => [
      shiftId,
      battery(
        resultShiftNames[shiftId],
        shiftId === "evening" ? 12 : 8,
        batteryResultOverrides[shiftId] ?? {},
      ),
    ]),
  );
  const defaultChargingSessions = {
    morning: [
      {
        start_minute: 60,
        end_minute: 90,
        duration_minutes: 30,
        station_stop_id: "depot",
        station_name: "Depot",
        energy_kwh: 60,
      },
      {
        start_minute: 720,
        end_minute: 730,
        duration_minutes: 10,
        station_stop_id: "depot",
        station_name: "Depot",
        energy_kwh: 20,
      },
    ],
    evening: [
      {
        start_minute: 1430,
        end_minute: 10,
        duration_minutes: 20,
        station_stop_id: "depot",
        station_name: "Depot",
        energy_kwh: 50,
      },
      {
        start_minute: 1500,
        end_minute: 1530,
        duration_minutes: 30,
        station_stop_id: "depot",
        station_name: "Depot",
        energy_kwh: 60,
      },
      {
        start_minute: 1600,
        end_minute: 1615,
        duration_minutes: 15,
        station_stop_id: "depot",
        station_name: "Depot",
        energy_kwh: 30,
      },
    ],
  };

  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    requestedApiPaths.push(path);

    if (path.endsWith("/api/v1/version")) {
      await route.fulfill({ json: { version: "feasibility-results-test" } });
      return;
    }

    if (path.endsWith("/api/v1/simulation/optimization-runs/level-test")) {
      await route.fulfill({
        json: {
          id: "level-test",
          name: "Multi-shift feasibility",
          mode,
          status: runStatus,
          input_params: {
            shift_ids: shiftIds,
            gtfs_provenance: gtfsProvenance,
            mode,
            consumption_basis: consumptionBasis,
            basis_run_ids: basisRunIds,
            daily_cycle: Boolean(dailyCycle),
            depot_peak_shaving: Boolean(dailyCycle),
            min_soc: 0.2,
            max_soc: 0.9,
            ...batteryPolicy,
            ...(includeInfrastructureInput ? { charging_stations: chargingStations } : {}),
            ...(mode === "charging_only" ? { fixed_battery_packs: fixedBatteryPacks } : {}),
          },
          prediction_run_ids:
            predictionRunIds ?? shiftIds.map((shiftId) => `prediction-${shiftId}`),
          results: {
            consumption_analysis: consumptionAnalysis,
            daily_cycle: dailyCycle,
            forecast_verification: forecastVerification,
            solver_status: solverStatus,
            infeasibility_diagnostics: infeasibilityDiagnostics,
            initial_reference_prediction_run_ids:
              initialReferencePredictionRunIds,
            selected_prediction_run_ids: selectedPredictionRunIds,
            ...(includeElectrificationFeasible
              ? { electrification_feasible: electrificationFeasible }
              : {}),
            ...(electrificationSummary === undefined
              ? {}
              : { electrification_summary: electrificationSummary }),
            ...(failure === undefined ? {} : { failure }),
            ...(legacyError === undefined ? {} : { error: legacyError }),
            ...(includeBatteryResults ? { battery_results: batteryResults } : {}),
            ...(includePerBusSummary
              ? {
                  per_bus_summary: shiftIds.map((shiftId) => ({
                    shift_id: shiftId,
                    shift_name: resultShiftNames[shiftId],
                    min_soc_kwh: shiftId === "evening" ? 60 : 120,
                    max_soc_kwh: shiftId === "evening" ? 500 : 400,
                    total_charged_kwh: shiftId === "evening" ? 140 : 80,
                    num_charging_sessions: shiftId === "evening" ? 3 : 2,
                    charging_sessions: defaultChargingSessions[shiftId] ?? [],
                    ...(perBusSummaryOverrides[shiftId] ?? {}),
                  })),
                }
              : {}),
            ...(installedChargers === undefined
              ? {}
              : { installed_chargers: installedChargers }),
            ...(stationUtilization === undefined
              ? {}
              : { station_utilization: stationUtilization }),
            ...(totalInstallationCostChf === undefined
              ? {}
              : { total_installation_cost_chf: totalInstallationCostChf }),
          },
        },
      });
      return;
    }

    if (path.endsWith('/simulation/prediction-runs/') && route.request().method()==='GET') {
      await route.fulfill({json:Object.values(predictions)});
      return;
    }
    const predictionId = Object.keys(predictions).find((id) => path.endsWith(`/${id}`));
    if (predictionId) {
      await route.fulfill({ json: predictions[predictionId] });
      return;
    }

    if (currentGtfs.length && path.endsWith('/api/v1/user/shifts/')) {
      await route.fulfill({json:shiftIds.map(id=>({id,name:shiftNames[id],gtfs_datasets:currentGtfs}))});
      return;
    }
    const shiftInfoMatch = path.match(/\/api\/v1\/user\/shifts\/([^/]+)\/info$/);
    if (shiftInfoMatch) {
      const shiftId = decodeURIComponent(shiftInfoMatch[1]);
      await route.fulfill({
        json: {
          id: shiftId,
          name: shiftNames[shiftId] ?? shiftId,
          structure: [],
        },
      });
      return;
    }

    if (path.endsWith("/api/v1/economic/defaults")) {
      await route.fulfill({ json: {} });
      return;
    }

    if (path.includes("/api/v1/user/shifts/") && path.endsWith("/yearly-distance")) {
      await route.fulfill({
        json: { daily_distance_km: 100, yearly_distance_km: 36_500 },
      });
      return;
    }

    await route.fulfill({ status: 404, json: { detail: "Unused by this test" } });
  });

  await page.goto("./");
  await page.evaluate(async (options) => {
    const template = await fetch(
      "/elettra/src/pages/Simulation/Runs/simulation-results.html",
    ).then((response) => response.text());
    document.body.innerHTML = template;
    const { initializeSimulationResults } = await import(
      "/elettra/src/pages/Simulation/Runs/simulation-results.js"
    );
    window.__cleanupSimulationResults = initializeSimulationResults(document, {
      runId: "level-test",
      ...options,
    });
  }, initializerOptions);
  return requestedApiPaths;
};

const scopeSelector = (page) => page.locator('[data-role="shift-tabs"]');

const selectShiftScope = async (page, shiftId) => {
  await scopeSelector(page)
    .locator(`[data-action="select-result-scope"][data-shift-id="${shiftId}"]`)
    .click();
};

const failedResultDerivedRequests = (paths) => paths.filter((path) =>
  path.includes("/prediction-runs") ||
  path.endsWith("/economic/defaults") ||
  path.includes("/economic/comparison") ||
  path.includes("/yearly-distance") ||
  path.includes("/environmental/"),
);

test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.__cleanupSimulationResults?.());
});

for (const mode of ["battery_only", "charging_only", "joint"]) {
  test(`accounts for the optimized charging plan in ${mode} energy adequacy`, async ({ page }) => {
    const meanDemandKwh = 644.0907143001715;
    const plannedChargingKwh = 84.09071430017156;
    await mountResults(page, {
      shiftIds: ["morning"],
      mode,
      fixedBatteryPacks: 16,
      predictionOverrides: {
        "prediction-morning": prediction(
          "prediction-morning",
          "morning",
          16,
          meanDemandKwh,
        ),
      },
      batteryResultOverrides: {
        morning: {
          reference_packs: 16,
          base_packs: 10,
          optimized_packs: 16,
          required_total_packs: 16,
          optimized_kwh: 800,
          max_physical_packs: 16,
          max_physical_kwh: 800,
          physical_feasible: true,
          feasibility_status: "feasible",
        },
      },
      perBusSummaryOverrides: {
        morning: {
          min_soc_kwh: 160,
          max_soc_kwh: 720,
          total_charged_kwh: plannedChargingKwh,
          num_charging_sessions: 2,
        },
      },
    });

    await selectShiftScope(page, "morning");

    const adequacy = page.locator(".efficiency-adequacy-panel");
    await expect(adequacy).toContainText("Vehicle block energy adequacy");
    await expect(adequacy.locator('[data-role="battery-adequacy-usable"]')).toHaveText("560.0 kWh (20%–90%)");
    await expect(adequacy.locator('[data-role="battery-adequacy-charging"]')).toContainText("84.1 kWh");
    await expect(adequacy.locator('[data-role="battery-adequacy-operational"]')).toContainText("644.1 kWh");
    await expect(adequacy.locator('[data-role="battery-adequacy-minimum-soc"]')).toHaveText("160.0 kWh — limit ≥ 160.0 kWh (20%)");
    await expect(adequacy.locator('[data-role="battery-adequacy-maximum-soc"]')).toHaveText("720.0 kWh — limit ≤ 720.0 kWh (90%)");
    await expect(adequacy.locator('[data-role="battery-adequacy-mean"]')).toContainText("feasible in optimized schedule");
    await expect(adequacy.locator('[data-role="battery-adequacy-mean"] .badge')).toHaveClass(/badge--positive/);

    const consumptionMetric = page.locator(
      '[data-role="feasibility-shift-predicted-consumption"]',
    );
    await expect(consumptionMetric).not.toHaveClass(/result-metric--negative/);
    const aggregateUsableCapacity = page.locator(
      '[data-role="aggregate-usable-capacity"]',
    );
    await expect(aggregateUsableCapacity).toHaveText('560 kWh');
    await expect(aggregateUsableCapacity.locator('..')).not.toHaveClass(
      /aggregate-energy-kpi--deficit/,
    );

    const energyAdequacy = page.locator('[data-role="feasibility-shift-energy-adequacy"]');
    await expect(energyAdequacy).toContainText("Available operational energy");
    await expect(energyAdequacy).toContainText("Operational energy margin — mean basis");
    await expect(energyAdequacy).toContainText("0.0 kWh");
    await expect(energyAdequacy).toContainText("Sensitivity drivers");
    await expect(page.locator('[data-role="feasibility-shift-sensitivity"]')).toHaveCount(0);

    const assessment = await page.evaluate(async () => {
      const { buildFeasibilityAssessment } = await import('/elettra/src/utils/feasibility-assessment.js');
      const [optimizationRun, predictionRuns] = await Promise.all([
        fetch('/api/v1/simulation/optimization-runs/level-test').then(response => response.json()),
        fetch('/api/v1/simulation/prediction-runs/').then(response => response.json()),
      ]);
      return buildFeasibilityAssessment({ optimizationRun, predictionRuns, scope: 'morning' });
    });
    expect(assessment.decisionConsumption.totalKwh).toBe(meanDemandKwh);
    expect(assessment.energyBalance.plannedChargingEnergyKwh).toBe(plannedChargingKwh);
    expect(assessment.energyBalance.usableBatteryEnergyKwh).toBe(560);
    expect(assessment.energyComparison.isDeficit).toBe(false);
    const displayedDemand = Number((await consumptionMetric.locator('strong').textContent()).replace(/[^\d.-]/g, ''));
    expect(displayedDemand).toBe(Math.round(assessment.decisionConsumption.totalKwh));

    if (mode === "charging_only") {
      await expect(
        page.locator('[data-role="feasibility-shift-coverage-status"]'),
      ).toHaveText("Covered by selected battery and planned charging");
    }
  });
}

test("explains reached and configured SOC limits for the selected shift", async ({ page }) => {
  await mountResults(page, {
    shiftIds: ["morning"],
    mode: "joint",
    forecastVerification: { status: "verified" },
    predictionOverrides: {
      "prediction-morning": prediction(
        "prediction-morning",
        "morning",
        10,
        350,
      ),
    },
    batteryResultOverrides: {
      morning: {
        reference_packs: 10,
        base_packs: 6,
        optimized_packs: 10,
        required_total_packs: 10,
        optimized_kwh: 500,
        max_physical_packs: 16,
        max_physical_kwh: 800,
        physical_feasible: true,
        feasibility_status: "feasible",
      },
    },
    perBusSummaryOverrides: {
      morning: {
        min_soc_kwh: 100,
        max_soc_kwh: 450,
        total_charged_kwh: 263.0127454632992,
        num_charging_sessions: 2,
      },
    },
  });

  await selectShiftScope(page, "morning");

  const configuredWindow = page.locator(".efficiency-param").filter({
    hasText: "Configured SoC window",
  });
  await expect(configuredWindow).toContainText("20% / 90%");

  const shiftSummary = page.locator('[data-role="feasibility-shift-summary"]');
  await expect(
    shiftSummary.locator('[data-role="feasibility-shift-min-soc"]'),
  ).toContainText("Minimum SOC reached");
  await expect(
    shiftSummary.locator('[data-role="feasibility-shift-max-soc"]'),
  ).toContainText("Maximum SOC reached");

  await page.locator("details.ya-more-information > summary").click();
  await expect(
    page.locator('.efficiency-subsection-title'),
  ).toContainText('Battery Sizing');
  await expect(
    page.locator('[data-role="forecast-verification"]'),
  ).toHaveText('Configuration verified');
  const batterySizingTable = page.locator('[data-role="battery-sizing-table"]');
  await expect(batterySizingTable.locator('thead th')).toContainText([
    'Selected packs',
    'Usable capacity (kWh)',
    'Maximum limit',
    'Feasibility',
  ]);
  await expect(batterySizingTable.locator('tbody tr').first().locator('td')).toHaveCount(4);
  const sizingBounds = await batterySizingTable.boundingBox();
  expect(sizingBounds.x + sizingBounds.width).toBeLessThanOrEqual(page.viewportSize().width);
  expect(await batterySizingTable.evaluate(table => table.parentElement.scrollWidth - table.parentElement.clientWidth)).toBeLessThanOrEqual(1);
  await expect(batterySizingTable.locator('.badge')).toHaveCSS('text-transform', 'none');
  await expect(page.locator('.feasibility-optimization-heading [data-role="forecast-verification"]')).toBeVisible();
  const sizingEffect = page.locator('[data-role="feasibility-sizing-effect"]');
  await expect(sizingEffect).toContainText('Sizing effect on energy consumption');
  await expect(sizingEffect.locator('tr[data-sizing-configuration]')).toHaveCount(1);
  await expect(sizingEffect.locator('[data-role="sizing-effect-decision-basis"]')).toContainText('Mean');
  await expect(sizingEffect.locator('[data-role="sizing-effect-decision-consumption"]')).toHaveText('350.0');
  await expect(
    page.locator('details[data-trip-predictions-run-id]'),
  ).toHaveCount(0);

  const adequacy = page.locator(".efficiency-adequacy-panel");
  await expect(adequacy).toContainText("Usable SOC window");
  await expect(adequacy.locator('[data-role="battery-adequacy-usable"]')).toHaveText(
    "350.0 kWh (20%–90%)",
  );
  await expect(adequacy).toContainText("Minimum SOC reached");
  await expect(adequacy.locator('[data-role="battery-adequacy-minimum-soc"]')).toHaveText(
    "100.0 kWh — limit ≥ 100.0 kWh (20%)",
  );
  await expect(adequacy).toContainText("Maximum SOC reached");
  await expect(adequacy.locator('[data-role="battery-adequacy-maximum-soc"]')).toHaveText(
    "450.0 kWh — limit ≤ 450.0 kWh (90%)",
  );
});

test("compares the initial physical maximum with the selected forecast", async ({ page }) => {
  await mountResults(page, {
    shiftIds: ["morning"],
    mode: "joint",
    predictionRunIds: ["prediction-morning-reference", "prediction-morning-selected"],
    predictionOverrides: {
      "prediction-morning-reference": prediction(
        "prediction-morning-reference",
        "morning",
        8,
        693.3,
      ),
      "prediction-morning-selected": prediction(
        "prediction-morning-selected",
        "morning",
        3,
        626.6,
      ),
    },
    initialReferencePredictionRunIds: {
      morning: "prediction-morning-reference",
    },
    selectedPredictionRunIds: {
      morning: "prediction-morning-selected",
    },
    forecastVerification: { status: "verified" },
    batteryResultOverrides: {
      morning: {
        reference_packs: 8,
        base_packs: 3,
        optimized_packs: 3,
        required_total_packs: 3,
        optimized_kwh: 150,
        max_physical_packs: 8,
        max_physical_kwh: 400,
      },
    },
  });

  await selectShiftScope(page, "morning");
  await page.locator("details.ya-more-information > summary").click();

  const sizingEffect = page.locator('[data-role="feasibility-sizing-effect"]');
  await expect(sizingEffect.locator(':scope > .helper-text')).toHaveCount(0);
  const initialRow = sizingEffect.locator('tr[data-sizing-configuration="initial"]');
  const selectedRow = sizingEffect.locator('tr[data-sizing-configuration="selected"]');
  await expect(initialRow.locator('th')).toHaveText('Maximum limit');
  await expect(initialRow.locator('td').first()).toHaveText('8');
  await expect(initialRow).toContainText('693.3');
  await expect(selectedRow.locator('th')).toHaveText('Selected');
  await expect(selectedRow.locator('td').first()).toHaveText('3');
  await expect(selectedRow).toContainText('626.6');
  await expect(sizingEffect.locator('tbody > tr').nth(0)).toHaveAttribute(
    'data-sizing-configuration',
    'initial',
  );
  await expect(sizingEffect.locator('tbody > tr').nth(1)).toHaveAttribute(
    'data-sizing-configuration',
    'selected',
  );
  await expect(sizingEffect.locator('[data-role="sizing-effect-mean-change"]')).toHaveCount(0);
});

test("shows one selected row when initial and selected use the same forecast", async ({ page }) => {
  await mountResults(page, {
    shiftIds: ["morning"],
    mode: "joint",
    initialReferencePredictionRunIds: {
      morning: "prediction-morning",
    },
    selectedPredictionRunIds: {
      morning: "prediction-morning",
    },
    forecastVerification: { status: "verified" },
  });

  await selectShiftScope(page, "morning");
  await page.locator("details.ya-more-information > summary").click();

  const sizingEffect = page.locator('[data-role="feasibility-sizing-effect"]');
  await expect(sizingEffect.locator('tr[data-sizing-configuration]')).toHaveCount(1);
  await expect(
    sizingEffect.locator('tr[data-sizing-configuration="selected"]'),
  ).toContainText('Selected');
});

test("separates the common result from one selected shift without an aggregate option", async ({ page }) => {
  const dataset = {
    gtfs_year: 2027,
    gtfs_file_date: "2026-11-04",
    valid_from: "2026-12-13",
    valid_to: "2027-12-11",
  };
  await mountResults(page, {
    gtfsProvenance: {
      version: 1,
      source: "recorded",
      shifts: { morning: [dataset], evening: [dataset] },
    },
    currentGtfs: [dataset],
  });

  const general = page.locator('[data-role="feasibility-general-level"]');
  const shiftDetail = page.locator('[data-role="feasibility-shift-level"]');
  const selector = page.locator('[data-role="shift-tabs"]');

  await expect(page.locator(".results-toolbar")).toHaveCount(0);
  await expect(page.locator('[data-role="results-page-title"]')).toHaveText(
    "Feasibility evaluation results - Multi-shift feasibility",
  );
  await expect(
    page.locator('.page-header [data-action="toggle-sim-data"]'),
  ).toHaveText("View raw feasibility data");
  await expect(general).toBeVisible();
  await expect(shiftDetail).toHaveCount(0);
  await expect(page.locator(".results-tabs")).toHaveCount(0);
  await expect(page.locator(".results-tab")).toHaveCount(0);
  await expect(page.locator('[data-role="feasibility-shift-predictions"]')).toHaveCount(0);
  await expect(general).toContainText("Fleet evaluation");
  const fleetHelp=general.locator('h3 .fleet-evaluation-info');
  await expect(general.locator('.feasibility-level__subtitle')).toHaveCount(0);
  await expect(fleetHelp.getByRole('tooltip')).toBeHidden();
  await fleetHelp.click();
  await expect(fleetHelp.getByRole('tooltip')).toBeVisible();
  await expect(fleetHelp.getByRole('tooltip')).toHaveText('Battery sizes and bus investment for all selected vehicle blocks, with shared charging infrastructure.');
  await fleetHelp.press('Escape');
  await expect(fleetHelp.getByRole('tooltip')).toBeHidden();
  const demand=general.locator('[data-role="feasibility-demand-basis"]');
  await expect(demand).toHaveText('Mean-based demand scenario');
  await expect(general.locator('.feasibility-level__header-meta')).not.toContainText('Decision basis:');
  await expect(general.locator('.feasibility-level__scenario-mode [data-role="feasibility-overall-status"]')).toHaveCount(1);
  const scenarioMode=await general.locator('.feasibility-level__scenario-mode').evaluate(element => {
    const children=[...element.children];
    return children.map(child => {
      const style=getComputedStyle(child);const bounds=child.getBoundingClientRect();return {top:bounds.top,center:(bounds.top+bounds.bottom)/2,
        font:style.font,fontWeight:style.fontWeight,color:style.color};
    });
  });
  expect(scenarioMode[0].font).toBe(scenarioMode[1].font);
  expect(scenarioMode[0].fontWeight).toBe('600');
  expect(scenarioMode[0].color).toBe(scenarioMode[1].color);
  if (page.viewportSize().width>620) expect(Math.abs(scenarioMode[0].top-scenarioMode[1].top)).toBeLessThan(1);
  if (page.viewportSize().width>620) expect(Math.abs(scenarioMode[0].center-scenarioMode[2].center)).toBeLessThan(1);
  await expect(general.locator('[data-role="feasibility-mode"]')).toHaveText(
    "Optimization mode: Battery only",
  );
  await expect(general.locator('[data-role="feasibility-overall-status"]')).toHaveText(
    "All vehicle blocks are feasible",
  );
  await expect(general.locator('[data-role="feasibility-overall-status"]')).toHaveClass(
    /feasibility-overall-status--feasible/,
  );
  await expect(general.locator('[data-role="feasibility-fleet-battery"]')).toContainText("12");
  await expect(general.locator('[data-role="feasibility-shift-count"]')).toContainText("2");
  await expect(general.locator('[data-role="feasibility-limiting-shifts"]')).toContainText("Evening service");
  await expect(general.locator('[data-station-status="fixed"]')).toContainText("Fixed");
  await expect(general.locator('[data-role="feasibility-active-locations"]')).toHaveText("1");
  await expect(general.locator('[data-role="feasibility-total-plugs"]')).toHaveText("2");
  await expect(general.locator('[data-role="feasibility-total-power"]')).toHaveText("300 kW DC");
  await expect(general.locator('[data-role="feasibility-fleet-battery"] tbody tr')).toHaveCount(2);
  await expect(general.locator('[data-role="feasibility-fleet-battery"] tfoot')).toContainText("20");
  await expect(general.locator(".feasibility-general-card__value small")).toHaveCount(0);
  await expect(general.locator(".feasibility-infrastructure-metrics small")).toHaveCount(0);
  await expect(general.locator(".feasibility-level__eyebrow")).toHaveCount(0);
  const generalPresentation = await general.evaluate((section) => {
    const cardStyle = getComputedStyle(section);
    const metricGrid = section.querySelector(".result-metric-grid");
    const metric = section.querySelector(".result-metric");
    return {
      background: cardStyle.backgroundColor,
      borderStyle: cardStyle.borderStyle,
      shadow: cardStyle.boxShadow,
      metricGridColumns: metricGrid ? getComputedStyle(metricGrid).gridTemplateColumns : "",
      metricBackground: metric ? getComputedStyle(metric).backgroundColor : "",
    };
  });
  expect(generalPresentation).toMatchObject({
    background: "rgb(255, 255, 255)",
    borderStyle: "solid",
    metricBackground: "rgba(0, 0, 0, 0)",
  });
  expect(generalPresentation.shadow).not.toBe("none");
  expect(generalPresentation.metricGridColumns).not.toBe("");
  const generalMetricLayout = await general.evaluate((section) => {
    const pairs = [
      ...section.querySelectorAll(".feasibility-general-card__heading"),
      ...section.querySelectorAll(".feasibility-infrastructure-metrics > div"),
    ].map((row) => {
      const label = row.querySelector(":scope > span");
      const value = row.querySelector(
        ":scope > .feasibility-general-card__value, :scope > .feasibility-general-card__result .feasibility-general-card__value, :scope > strong",
      );
      if (!label || !value) return null;
      const labelStyle = getComputedStyle(label);
      const valueStyle = getComputedStyle(value);
      const labelBox = label.getBoundingClientRect();
      const valueBox = value.getBoundingClientRect();
      return {
        labelFontFamily: labelStyle.fontFamily,
        valueFontFamily: valueStyle.fontFamily,
        labelFontSize: labelStyle.fontSize,
        valueFontSize: valueStyle.fontSize,
        topDifference: Math.abs(labelBox.top - valueBox.top),
      };
    }).filter(Boolean);
    return { pairs, viewportWidth: window.innerWidth };
  });
  expect(generalMetricLayout.pairs).toHaveLength(6);
  generalMetricLayout.pairs.forEach((pair) => {
    expect(pair.labelFontFamily).toBe(pair.valueFontFamily);
    expect(pair.labelFontSize).toBe(pair.valueFontSize);
    if (generalMetricLayout.viewportWidth > 620) {
      expect(pair.topDifference).toBeLessThanOrEqual(1);
    }
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);

  if (updateGuideScreenshots) {
    await page.setViewportSize({ width: 1000, height: 850 });
    await page.locator(".results-main").evaluate((main) => { main.scrollTop = 0; });
    await page.keyboard.press('Escape');
    await page.locator(':focus').evaluateAll(elements => elements.forEach(element => element.blur()));
    await page.mouse.move(0, 0);
    await expect(page.locator('[role="tooltip"]:visible')).toHaveCount(0);
    await page.screenshot({ path: "guide/images/feasibility-efficiency.png" });
  }

  await expect(selector).toBeVisible();
  await expect(selector).toHaveAttribute("role", "tablist");
  await expect(selector.locator('[data-action="select-result-scope"]')).toHaveCount(3);
  await expect(selector).not.toContainText("All");
  const generalTab = selector.getByRole("tab", { name: "General" });
  await expect(generalTab).toHaveAttribute("aria-selected", "true");
  await expect(generalTab).toHaveAttribute("tabindex", "0");

  await selectShiftScope(page, "morning");
  await expect(general).toHaveCount(0);
  await expect(shiftDetail).toBeVisible();
  await expect(page.locator(".results-tabs, .results-tab")).toHaveCount(0);
  await expect(
    shiftDetail.locator('[data-role="feasibility-selected-shift"]'),
  ).toHaveClass(/sr-only/);
  await expect(shiftDetail).not.toContainText("Vehicle block detail");
  await expect(shiftDetail).not.toContainText(
    "Energy demand and operating details for the selected vehicle block.",
  );

  const shiftSummary = shiftDetail.locator('[data-role="feasibility-shift-summary"]');
  await expect(shiftSummary.locator('[data-role="feasibility-shift-coverage-status"]')).toHaveText("Covered by selected battery and planned charging");
  for (const metric of ['required-packs', 'common-packs', 'pack-margin', 'physical-limit']) {
    await expect(shiftSummary.locator(`[data-role="feasibility-shift-${metric}"]`)).toHaveCount(0);
  }
  await expect(shiftSummary.locator('[data-role="feasibility-shift-min-soc"]')).toContainText("120.0");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-charged-energy"]')).toContainText("80.0");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-session-count"]')).toContainText("2");
  await expect(
    shiftSummary.locator('[data-role="feasibility-shift-predicted-consumption"]'),
  ).toHaveText(/Prediction consumption per vehicle block \(kWh\)\s+350/);
  await expect(
    shiftSummary.locator('[data-role="feasibility-shift-predicted-consumption-per-km"]'),
  ).toHaveText(/Prediction consumption per km \(kWh\/km\)\s+3\.500/);
  await expect(shiftSummary.locator('.result-metric')).toHaveCount(6);
  await expect(shiftSummary.locator(".feasibility-shift-metrics strong small")).toHaveCount(0);
  const shiftMetricLayout = await shiftSummary
    .locator(".feasibility-shift-metrics")
    .evaluate((grid) => {
      const rows = [...grid.querySelectorAll(":scope > article")].map((row) => {
        const label = row.querySelector(":scope > span:first-child");
        const value = row.querySelector("strong");
        if (!label || !value) return null;
        const labelStyle = getComputedStyle(label);
        const valueStyle = getComputedStyle(value);
        const labelBox = label.getBoundingClientRect();
        const valueBox = value.getBoundingClientRect();
        return {
          labelFontFamily: labelStyle.fontFamily,
          valueFontFamily: valueStyle.fontFamily,
          labelFontSize: labelStyle.fontSize,
          valueFontSize: valueStyle.fontSize,
          topDifference: Math.abs(labelBox.top - valueBox.top),
        };
      }).filter(Boolean);
      return { rows, viewportWidth: window.innerWidth };
    });
  expect(shiftMetricLayout.rows).toHaveLength(6);
  shiftMetricLayout.rows.forEach((row) => {
    expect(row.labelFontFamily).toBe(row.valueFontFamily);
    expect(row.labelFontSize).toBe(row.valueFontSize);
    if (shiftMetricLayout.viewportWidth > 620) {
      expect(row.topDifference).toBeLessThanOrEqual(1);
    }
  });
  const chargingPlan = shiftDetail.locator('[data-role="feasibility-charging-plan"]');
  const chargingSessions = chargingPlan.locator('[data-role="feasibility-charging-session"]');
  await expect(chargingPlan).toHaveAttribute("data-status", "complete");
  await expect(chargingPlan).not.toHaveAttribute("open", "");
  await expect(chargingPlan.locator(":scope > summary")).toHaveText("Charging plan");
  await expect(chargingPlan.locator('[data-role="feasibility-charging-plan-count"]')).toHaveCount(0);
  await expect(chargingSessions.first()).toBeHidden();
  await chargingPlan.locator(":scope > summary").click();
  await expect(chargingPlan).toHaveAttribute("open", "");
  await expect(chargingSessions.first()).toBeVisible();
  await expect(chargingSessions).toHaveCount(2);
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-location"]')).toHaveText("Depot");
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-start"]')).toContainText("01:00");
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-end"]')).toContainText("01:30");
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-duration"]')).toContainText("30");
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-energy"]')).toContainText("60.0");
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-average-power"]')).toContainText("120.0");
  await expect(chargingSessions.first().locator(".feasibility-charging-session__location")).toContainText(/Charging session 1:\s*Depot/);
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-duration"]')).toContainText(/Planned stop\s*30 min/);
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-energy"]')).toContainText(/Energy charged\s*60\.0 kWh/);
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-average-power"]')).toContainText(/Average power \(Connected time\):\s*120\.0 kW/);

  await expect(chargingSessions.first().locator('.feasibility-charging-session__metrics > div')).toHaveCount(3);
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-average-power"]')).toBeHidden();
  await chargingSessions.first().getByRole('button', {name:'Charging details',exact:true}).click();
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-average-power"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-average-power"]')).toBeHidden();

  const visualAnalysis = shiftDetail.locator('[data-role="feasibility-shift-visual-analysis"]');
  const energyAdequacy = shiftDetail.locator('[data-role="feasibility-shift-energy-adequacy"]');
  await expect(visualAnalysis).toHaveAttribute("data-status", "available");
  await expect(visualAnalysis.locator("h3")).toHaveText("Visual analysis");
  await expect(visualAnalysis.locator("svg")).toHaveCount(2);
  await expect(visualAnalysis).not.toContainText("Compare simulated");
  await expect(visualAnalysis).not.toContainText("exceedance probability");
  await expect(visualAnalysis).not.toContainText(
    "Compare drivetrain and auxiliary demand for each battery-pack scenario.",
  );
  const chartCardLayout = await visualAnalysis
    .locator(".efficiency-chart-card")
    .evaluateAll((cards) => ({
      viewportWidth: window.innerWidth,
      cards: cards.map((card) => {
        const box = card.getBoundingClientRect();
        return { top: box.top, height: box.height };
      }),
    }));
  expect(chartCardLayout.cards).toHaveLength(2);
  if (chartCardLayout.viewportWidth > 900) {
    expect(Math.abs(chartCardLayout.cards[0].top - chartCardLayout.cards[1].top)).toBeLessThanOrEqual(1);
    expect(Math.abs(chartCardLayout.cards[0].height - chartCardLayout.cards[1].height)).toBeLessThanOrEqual(1);
  }
  await expect(energyAdequacy).toHaveAttribute("data-feasibility", "feasible");
  await expect(energyAdequacy).toContainText("Vehicle block energy adequacy");
  await expect(energyAdequacy).toContainText("Sensitivity drivers");
  await expect(energyAdequacy).toContainText("350.0 kWh");
  await expect(energyAdequacy).not.toContainText("550.0 kWh");
  await expect(visualAnalysis.locator(".efficiency-adequacy-panel")).toHaveCount(0);
  await expect(energyAdequacy.locator(".efficiency-adequacy-panel")).toHaveCount(1);
  await expect(shiftDetail).not.toContainText("Sensitivity / Feasibility Insight");

  if (updateGuideScreenshots) {
    await page.setViewportSize({ width: 1900, height: 1000 });
    await page.locator(".results-main").evaluate((main) => { main.scrollTop = 0; });
    await page.screenshot({ path: "guide/images/feasibility-sizing.png" });
  }

  const shiftSectionOrder = await shiftDetail
    .locator(".feasibility-level__content > *")
    .evaluateAll((elements) => elements.slice(0, 5).map((element) => element.dataset.role));
  expect(shiftSectionOrder).toEqual([
    "feasibility-shift-summary",
    "aggregate-energy",
    "feasibility-shift-visual-analysis",
    "feasibility-shift-energy-adequacy",
    "feasibility-charging-plan",
  ]);

  const chargingLayout = await chargingPlan.evaluate((plan) => {
    const list = plan.querySelector('[data-role="feasibility-charging-session-list"]');
    const session = plan.querySelector('[data-role="feasibility-charging-session"]');
    const visual = plan.parentElement?.querySelector(
      '[data-role="feasibility-shift-visual-analysis"]',
    );
    const sensitivityCard = plan.parentElement?.querySelector(
      '[data-role="feasibility-shift-energy-adequacy"]',
    );
    if (!list || !session || !visual || !sensitivityCard) return null;
    const sessionStyle = getComputedStyle(session);
    const location = session.querySelector(".feasibility-charging-session__location");
    const duration = session.querySelector(
      '[data-role="feasibility-charging-session-duration"]',
    );
    const sessionRows = sessionStyle.gridTemplateRows
      .split(" ")
      .filter(Boolean);
    return {
      viewportWidth: window.innerWidth,
      fitsViewport: session.getBoundingClientRect().right <= window.innerWidth,
      listOverflowX: getComputedStyle(list).overflowX,
      sessionDisplay: sessionStyle.display,
      locationDisplay: location ? getComputedStyle(location).display : null,
      durationDisplay: duration ? getComputedStyle(duration).display : null,
      sessionRows,
      sessionHeight: session.getBoundingClientRect().height,
      visualBeforePlan:
        visual.getBoundingClientRect().top < plan.getBoundingClientRect().top,
      sensitivityBeforePlan:
        sensitivityCard.getBoundingClientRect().top < plan.getBoundingClientRect().top,
      metricValuesFit: [...session.querySelectorAll(".feasibility-charging-session__metrics dd")]
        .every((value) => value.scrollWidth <= value.clientWidth),
    };
  });
  expect(chargingLayout).toMatchObject({
    listOverflowX: "auto",
    sessionDisplay: "grid",
    locationDisplay: "flex",
    durationDisplay: "flex",
    visualBeforePlan: true,
    sensitivityBeforePlan: true,
    metricValuesFit: true,
  });
  expect(chargingLayout.fitsViewport).toBe(true);
  expect(chargingLayout?.sessionRows).toHaveLength(chargingLayout.viewportWidth < 1100 ? 3 : 1);
  expect(chargingLayout?.sessionHeight).toBeLessThanOrEqual(chargingLayout.viewportWidth < 1100 ? 180 : 90);

  const moreInformation = shiftDetail.locator("details.ya-more-information");
  const sizingEffect = moreInformation.locator(
    '[data-role="feasibility-sizing-effect"]',
  );
  await expect(moreInformation).toHaveClass(/result-card/);
  await expect(moreInformation.locator(":scope > summary")).toHaveClass(
    /feasibility-disclosure__toggle/,
  );
  const disclosurePresentation = await page.evaluate(() => {
    const charging = document.querySelector('[data-role="feasibility-charging-plan"]');
    const more = document.querySelector("details.ya-more-information");
    const read = (element) => {
      const style = getComputedStyle(element);
      const summary = element?.querySelector(":scope > summary");
      const summaryStyle = summary ? getComputedStyle(summary) : null;
      return {
        background: style.backgroundColor,
        borderRadius: style.borderRadius,
        borderStyle: style.borderStyle,
        summaryBackground: summaryStyle?.backgroundColor,
        summaryCursor: summaryStyle?.cursor,
        toggleSymbol: summaryStyle
          ? getComputedStyle(summary, "::before").content
          : null,
      };
    };
    return { charging: read(charging), more: read(more) };
  });
  expect(disclosurePresentation.more).toEqual(disclosurePresentation.charging);
  expect(disclosurePresentation.more).toMatchObject({
    background: "rgb(255, 255, 255)",
    borderStyle: "solid",
    summaryCursor: "pointer",
    toggleSymbol: '"▸"',
  });
  await expect(moreInformation).not.toHaveAttribute("open", "");
  await expect(sizingEffect).toBeHidden();
  await moreInformation.locator(":scope > summary").click();
  await expect(moreInformation).toHaveAttribute("open", "");
  await expect(
    moreInformation.locator(".ya-more-information__content > .efficiency-section").first(),
  ).not.toContainText("Prediction consumption per vehicle block");
  await expect(sizingEffect).toBeVisible();
  await expect(sizingEffect.locator("h3").first()).toHaveText(
    "Sizing effect on energy consumption",
  );
  await expect(sizingEffect.locator('[data-role="sizing-effect-decision-consumption"]')).toHaveText("350.0");
  await expect(sizingEffect.locator("svg")).toHaveCount(0);
  const lastMoreInformationSection = await moreInformation
    .locator(".ya-more-information__content > *")
    .last()
    .getAttribute("data-role");
  expect(lastMoreInformationSection).toBe("feasibility-sizing-effect");

  await expect(shiftDetail.locator('[data-role="feasibility-selected-shift"]')).toHaveText("Morning service");

  await selector.getByRole("tab", { name: "Evening service" }).click();
  await expect(shiftDetail.locator('[data-role="feasibility-selected-shift"]')).toHaveText("Evening service");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-coverage-status"]')).toHaveText("Largest selected battery");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-required-packs"]')).toHaveCount(0);
  await expect(shiftSummary.locator('[data-role="feasibility-shift-pack-margin"]')).toHaveCount(0);
  await expect(shiftSummary.locator('[data-role="feasibility-shift-min-soc"]')).toContainText("60.0");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-charged-energy"]')).toContainText("140.0");
  await expect(shiftSummary.locator('[data-role="feasibility-shift-session-count"]')).toContainText("3");
  await expect(chargingPlan.locator('[data-role="feasibility-charging-plan-count"]')).toHaveCount(0);
  await expect(chargingPlan).toHaveAttribute("open", "");
  await expect(chargingSessions).toHaveCount(3);
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-start"]')).toContainText("23:50");
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-end"]')).toContainText("00:10");
  await expect(chargingSessions.first().locator('[data-role="feasibility-charging-session-end"]')).toContainText("next day");
  await expect(chargingSessions.nth(1).locator('[data-role="feasibility-charging-session-start"]')).toContainText("01:00");
  await expect(chargingSessions.nth(1).locator('[data-role="feasibility-charging-session-start"]')).toContainText("next day");
  await expect(visualAnalysis).toHaveAttribute("data-status", "available");
  await expect(energyAdequacy).toHaveAttribute("data-feasibility", "feasible");
  await expect(energyAdequacy).toContainText("550.0 kWh");
  await expect(energyAdequacy).not.toContainText("350.0 kWh");
  await expect(moreInformation).toHaveAttribute("open", "");
  await expect(sizingEffect).toBeVisible();
  await expect(sizingEffect.locator('[data-role="sizing-effect-decision-consumption"]')).toHaveText("550.0");
  await generalTab.click();
  await expect(general.locator('[data-role="feasibility-fleet-battery"]')).toContainText("12");
  await expect(general.locator('[data-role="feasibility-limiting-shifts"]')).toContainText("Evening service");
  await expect(shiftDetail).toHaveCount(0);
  await expect(page.locator(".results-tabs, .results-tab")).toHaveCount(0);
  await expect(page.locator('[data-role="feasibility-shift-predictions"]')).toHaveCount(0);
});

test("supports keyboard navigation, duplicate names, safe labels, and horizontal overflow", async ({ page }) => {
  const unsafeName = '<img src=x onerror="window.__scopeXss = true">Shared service';
  await mountResults(page, {
    shiftNames: {
      morning: unsafeName,
      evening: unsafeName,
    },
  });

  const selector = scopeSelector(page);
  const tabs = selector.getByRole("tab");
  const generalTab = selector.getByRole("tab", { name: "General" });
  const morningTab = selector.getByRole("tab", { name: `${unsafeName} (1)` });
  const eveningTab = selector.getByRole("tab", { name: `${unsafeName} (2)` });

  await expect(tabs).toHaveCount(3);
  await expect(selector.locator("img")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__scopeXss)).toBeUndefined();
  await expect(selector).toHaveCSS("overflow-x", "auto");
  await expect(morningTab).toHaveCSS("white-space", "nowrap");

  await generalTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(morningTab).toHaveAttribute("aria-selected", "true");
  await expect(morningTab).toBeFocused();
  await expect(page.locator('[data-role="feasibility-selected-shift"]')).toHaveText(unsafeName);

  await page.keyboard.press("End");
  await expect(eveningTab).toHaveAttribute("aria-selected", "true");
  await expect(eveningTab).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await expect(generalTab).toHaveAttribute("aria-selected", "true");
  await expect(generalTab).toBeFocused();

  await page.keyboard.press("ArrowLeft");
  await expect(eveningTab).toHaveAttribute("aria-selected", "true");
  await expect(eveningTab).toBeFocused();
  await page.keyboard.press("Home");
  await expect(generalTab).toHaveAttribute("aria-selected", "true");
  await expect(generalTab).toBeFocused();
});

test("never reuses another shift prediction when the selected shift has none", async ({ page }) => {
  await mountResults(page, {
    predictionRunIds: ["prediction-morning"],
  });

  await selectShiftScope(page, "evening");

  const energyAdequacy = page.locator('[data-role="feasibility-shift-energy-adequacy"]');
  await expect(energyAdequacy).toBeVisible();
  await expect(energyAdequacy).not.toContainText("350.0 kWh");
  await expect(energyAdequacy).not.toContainText("-10 °C");

  const visualAnalysis = page.locator('[data-role="feasibility-shift-visual-analysis"]');
  await expect(visualAnalysis).toHaveAttribute("data-status", "unavailable");
  await expect(visualAnalysis.locator('[data-role="feasibility-shift-visual-analysis-empty"]')).toHaveText(
    "No prediction data available.",
  );
  await expect(visualAnalysis.locator("svg")).toHaveCount(0);

  await page.locator("details.ya-more-information > summary").click();
  await expect(
    page.locator('[data-role="feasibility-sizing-effect"]'),
  ).toHaveCount(0);
});

test("does not match predictions from an equally named but differently identified shift", async ({ page }) => {
  await mountResults(page, {
    shiftNames: {
      morning: "Shared service name",
      evening: "Shared service name",
    },
    predictionRunIds: ["prediction-morning"],
    predictionOverrides: {
      "prediction-morning": {
        ...prediction("prediction-morning", "morning", 8, 350),
        shift_name: "Shared service name",
      },
    },
  });

  await selectShiftScope(page, "evening");
  await page.locator("details.ya-more-information > summary").click();

  await expect(
    page.locator('[data-role="feasibility-sizing-effect"]'),
  ).toHaveCount(0);
});

test("does not present an aggregate multi-shift prediction as one physical shift", async ({ page }) => {
  await mountResults(page, {
    predictionRunIds: ["prediction-aggregate"],
    predictionOverrides: {
      "prediction-aggregate": {
        ...prediction("prediction-aggregate", undefined, 12, 900),
        shift_ids: ["morning", "evening"],
      },
    },
  });

  await selectShiftScope(page, "morning");
  await page.locator("details.ya-more-information > summary").click();
  await expect(
    page.locator('[data-role="feasibility-sizing-effect"]'),
  ).toHaveCount(0);
});

test("keeps general and the physical shift available for a single-shift result", async ({ page }) => {
  await mountResults(page, { shiftIds: ["morning"] });

  const selector = scopeSelector(page);
  await expect(selector).toBeVisible();
  await expect(selector.getByRole("tab")).toHaveCount(2);
  await expect(selector.getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-role="feasibility-shift-count"]')).toContainText("1");
  await expect(page.locator('[data-role="feasibility-selected-shift"]')).toHaveCount(0);
  await selectShiftScope(page, "morning");
  await expect(page.locator('[data-role="feasibility-selected-shift"]')).toHaveText("Morning service");
  await expect(page.locator('[data-role="feasibility-fleet-battery"]')).toHaveCount(0);
});

test("renders unavailable values safely when a historical result has no shift details", async ({ page }) => {
  await mountResults(page, {
    shiftIds: [],
    includeInfrastructureInput: false,
  });

  const selector = scopeSelector(page);
  await expect(selector).toBeVisible();
  await expect(selector.getByRole("tab")).toHaveCount(1);
  await expect(selector.getByRole("tab", { name: "General" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-role="feasibility-shift-count"]')).toContainText("0");
  await expect(page.locator('[data-role="feasibility-fleet-battery"] tbody tr')).toHaveCount(0);
  await expect(page.locator('[data-role="feasibility-fleet-battery"] tfoot')).toContainText("—");
  await expect(page.locator('[data-role="feasibility-infrastructure-unavailable"]')).toBeVisible();
  await expect(page.locator('[data-role="feasibility-shift-summary"]')).toHaveCount(0);
  await expect(page.locator('[data-role="feasibility-charging-plan"]')).toHaveCount(0);
});

test('historical navigation keeps a block without saved identifiers unavailable', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mountResults(page, { shiftIds: [], predictionRunIds: [],
    includeBatteryResults: false, includePerBusSummary: false,
    initializerOptions: { shiftId: 'historical-block', shiftName: 'Historical block' } });
  await selectShiftScope(page, 'historical-block');
  await expect(page.locator('[data-role="feasibility-shift-level"]')).toBeVisible();
  const summary = page.locator('[data-role="feasibility-shift-summary"]');
  await expect(summary).toContainText('Operational details are not available for this vehicle block.');
  await expect(summary.locator('strong')).toHaveCount(0);
  await expect(page.locator('[data-role="feasibility-charging-plan"]')).toHaveCount(0);
  await expect(page.locator('[data-role="feasibility-sizing-effect"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("shows an overall infeasible status with no invented critical shifts", async ({ page }) => {
  await mountResults(page, { electrificationFeasible: false });

  const general = page.locator('[data-role="feasibility-general-level"]');
  const status = general.locator('[data-role="feasibility-overall-status"]');
  await expect(status).toHaveText("Not all vehicle blocks are feasible");
  await expect(status).toHaveClass(/feasibility-overall-status--infeasible/);
  await expect(page.locator('[data-role="feasibility-failure-general"]')).toHaveCount(0);
  await expect(general.locator('[data-role="feasibility-fleet-battery"]')).toHaveCount(0);
  await expect(general.locator('[data-role="feasibility-infrastructure"]')).toHaveCount(0);
  await expect(general.locator('[data-role="feasibility-critical-shifts"]')).toContainText('does not identify');
  await expect(general.locator('[data-role="feasibility-critical-shifts"] tbody tr')).toHaveCount(0);
});

for (const consumptionBasis of ['mean', 'aggregate_q95']) {
  test(`infeasible General shows only critical shifts and pack limits for ${consumptionBasis}`, async ({ page }) => {
    await mountResults(page, {
      mode: 'joint', consumptionBasis, electrificationFeasible: false,
      shiftNames: { evening: 'Current critical block' },
      batteryResultOverrides: { evening: {
        optimized_packs: 16, required_total_packs: 18, excess_packs: 2,
        physical_feasible: false, feasibility_status: 'infeasible',
        max_physical_packs: 16,
        bus_cost_chf: 300000, battery_pack_cost_chf: 6000,
      } },
      dailyCycle: { status: 'verified', per_shift: {}, stations: {} },
    });
    const general = page.locator('[data-role="feasibility-general-level"]');
    await expect(general).toContainText('The displayed demand profile is not feasible');
    const critical = general.locator('[data-role="feasibility-critical-shifts"]');
    await expect(critical.locator('tbody tr')).toHaveCount(1);
    await expect(critical.locator('tbody th')).toHaveText('Current critical block');
    await expect(critical.locator('tbody td')).toHaveText(['16', '16', '18', '+2']);
    await expect(critical).not.toContainText('Morning service');
    await expect(general.locator('[data-role="feasibility-fleet-battery"], [data-role="feasibility-infrastructure"]')).toHaveCount(0);
    await expect(page.locator('[data-role="depot-cycle"]')).toHaveCount(0);
    await expect(general).not.toContainText('CHF');
    await selectShiftScope(page, 'morning');
    await expect(page.locator('[data-role="feasibility-shift-min-soc"]')).toBeVisible();
    await scopeSelector(page).getByRole('tab', { name: 'General', exact: true }).click();
    await expect(critical.locator('tbody tr')).toHaveCount(1);
  });
}

test("keeps a missing historical overall status visibly unknown", async ({ page }) => {
  await mountResults(page, { includeElectrificationFeasible: false });

  const status = page.locator('[data-role="feasibility-overall-status"]');
  await expect(status).toHaveText("Feasibility status unavailable");
  await expect(status).toHaveClass(/feasibility-overall-status--unknown/);
});

test("distinguishes a shift with no required charging from missing schedule details", async ({ page }) => {
  await mountResults(page, {
    shiftIds: ["morning"],
    perBusSummaryOverrides: {
      morning: {
        total_charged_kwh: 0,
        num_charging_sessions: 0,
        charging_sessions: [],
      },
    },
  });

  await selectShiftScope(page, "morning");

  const plan = page.locator('[data-role="feasibility-charging-plan"]');
  await expect(plan).toHaveAttribute("data-status", "empty");
  await expect(plan.locator('[data-role="feasibility-charging-plan-count"]')).toHaveCount(0);
  await expect(plan.locator('[data-role="feasibility-charging-plan-empty"]')).toContainText("No charging sessions are required");
  await expect(plan.locator('[data-role="feasibility-charging-session-list"]')).toHaveCount(0);
});

test("explains when sessions are reported without time and location rows", async ({ page }) => {
  await mountResults(page, {
    shiftIds: ["morning"],
    perBusSummaryOverrides: {
      morning: {
        num_charging_sessions: 2,
        charging_sessions: [],
      },
    },
  });

  await selectShiftScope(page, "morning");

  const plan = page.locator('[data-role="feasibility-charging-plan"]');
  await expect(plan).toHaveAttribute("data-status", "unavailable");
  await expect(plan.locator('[data-role="feasibility-charging-plan-count"]')).toHaveCount(0);
  await expect(plan.locator('[data-role="feasibility-charging-plan-unavailable"]')).toContainText("2 charging sessions are reported");
  await expect(plan.locator('[data-role="feasibility-charging-session-list"]')).toHaveCount(0);
});

test("does not present missing historical charging fields as a zero-session result", async ({ page }) => {
  await mountResults(page, {
    shiftIds: ["morning"],
    perBusSummaryOverrides: {
      morning: {
        num_charging_sessions: undefined,
        charging_sessions: undefined,
      },
    },
  });

  await selectShiftScope(page, "morning");

  const plan = page.locator('[data-role="feasibility-charging-plan"]');
  await expect(plan).toHaveAttribute("data-status", "unavailable");
  await expect(plan.locator('[data-role="feasibility-charging-plan-count"]')).toHaveCount(0);
  await expect(plan.locator('[data-role="feasibility-charging-plan-unavailable"]')).toContainText("Charging times and locations are not available");
  await expect(plan.locator('[data-role="feasibility-charging-plan-empty"]')).toHaveCount(0);
});

test("keeps available rows visible when the reported charging plan is partial", async ({ page }) => {
  await mountResults(page, {
    shiftIds: ["morning"],
    perBusSummaryOverrides: {
      morning: {
        num_charging_sessions: 2,
        charging_sessions: [{
          start_minute: 720,
          end_minute: 730,
          duration_minutes: 10,
          station_stop_id: "terminal",
          station_name: "Central terminal",
          energy_kwh: 25,
        }],
      },
    },
  });

  await selectShiftScope(page, "morning");

  const plan = page.locator('[data-role="feasibility-charging-plan"]');
  await expect(plan).toHaveAttribute("data-status", "partial");
  await expect(plan.locator('[data-role="feasibility-charging-plan-partial"]')).toContainText("1 of 2 reported charging sessions");
  await expect(plan.locator('[data-role="feasibility-charging-session"]')).toHaveCount(1);
  await expect(plan.locator('[data-role="feasibility-charging-session-location"]')).toHaveText("Central terminal");
  await expect(plan.locator('[data-role="feasibility-charging-session-start"]')).toContainText("12:00");
  await expect(plan.locator('[data-role="feasibility-charging-session-end"]')).toContainText("12:10");
});

test("renders charging locations as text without interpreting backend HTML", async ({ page }) => {
  await mountResults(page, {
    shiftIds: ["morning"],
    perBusSummaryOverrides: {
      morning: {
        num_charging_sessions: 1,
        charging_sessions: [{
          start_minute: 720,
          end_minute: 730,
          duration_minutes: 10,
          station_stop_id: '<svg onload="window.__chargingXss = true">',
          station_name: '<img src=x onerror="window.__chargingXss = true">Depot',
          energy_kwh: 25,
        }],
      },
    },
  });

  await selectShiftScope(page, "morning");

  const plan = page.locator('[data-role="feasibility-charging-plan"]');
  await expect(plan.locator('[data-role="feasibility-charging-session-location"]')).toHaveText('<img src=x onerror="window.__chargingXss = true">Depot');
  await expect(plan.locator("img, svg")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__chargingXss)).toBeUndefined();
});

test("shows an infeasible shift as a shortfall against the common physical battery", async ({ page }) => {
  await mountResults(page, {
    shiftIds: ["morning"],
    batteryResultOverrides: {
      morning: {
        optimized_packs: 16,
        required_total_packs: 18,
        optimized_kwh: 900,
        max_physical_packs: 16,
        max_physical_kwh: 800,
        excess_packs: 2,
        physical_feasible: false,
        feasibility_status: "infeasible",
      },
    },
  });

  await selectShiftScope(page, "morning");

  const summary = page.locator('[data-role="feasibility-shift-summary"]');
  await expect(summary.locator('[data-role="feasibility-shift-coverage-status"]')).toHaveText("Battery shortfall");
  await expect(summary.locator('[data-role="feasibility-shift-required-packs"]')).toContainText("18");
  await expect(summary.locator('[data-role="feasibility-shift-common-packs"]')).toContainText("16");
  await expect(summary.locator('[data-role="feasibility-shift-pack-margin"]')).toContainText("-2");
  await expect(summary.locator('[data-role="feasibility-shift-physical-limit"]')).toContainText("Exceeds physical pack limit");
  await expect(page.locator('[data-role="feasibility-shift-visual-analysis"]')).toHaveCount(0);
  await expect(page.locator('[data-role="feasibility-shift-energy-adequacy"]')).toHaveCount(0);
  await expect(summary.locator('[data-role="feasibility-shift-required-packs"]')).toContainText('Vehicle block battery requirement');
  for (const role of ['min-soc', 'max-soc', 'charged-energy', 'session-count']) {
    await expect(summary.locator(`[data-role="feasibility-shift-${role}"]`)).toHaveCount(0);
  }
  await expect(page.locator('[data-role="feasibility-charging-plan"]')).toHaveCount(0);
});

for (const consumptionBasis of ['mean', 'aggregate_q95']) {
  test(`hides diagnostic SOC and charging for a fixed battery shortfall with ${consumptionBasis}`, async ({ page }) => {
    await mountResults(page, {
      shiftIds: ['morning'], mode: 'charging_only', consumptionBasis,
      electrificationFeasible: false,
      batteryResultOverrides: { morning: {
        optimized_packs: 10, required_total_packs: 13, excess_packs: 3,
        max_physical_packs: 16, physical_feasible: undefined,
        feasibility_status: undefined,
      } },
      perBusSummaryOverrides: { morning: {
        min_soc_kwh: 18800.5, max_soc_kwh: 19184,
        total_charged_kwh: 900, num_charging_sessions: 1,
        charging_sessions: [{ start_minute: 720, end_minute: 730,
          duration_minutes: 10, station_stop_id: 'depot', energy_kwh: 900 }],
      } },
    });
    await selectShiftScope(page, 'morning');
    const summary = page.locator('[data-role="feasibility-shift-summary"]');
    await expect(summary).toContainText('Battery shortfall');
    await expect(summary.locator('[data-role="feasibility-shift-required-packs"]')).toContainText('13');
    await expect(summary.locator('[data-role="feasibility-shift-physical-limit"]')).toContainText('Within physical pack limit');
    await expect(summary.locator('[data-role="feasibility-shift-predicted-consumption"]')).toBeVisible();
    for (const role of ['min-soc', 'max-soc', 'charged-energy', 'session-count']) {
      await expect(summary.locator(`[data-role="feasibility-shift-${role}"]`)).toHaveCount(0);
    }
    await expect(page.locator('[data-role="feasibility-charging-plan"]')).toHaveCount(0);
  });
}

test("keeps each shift feasibility independent from an infeasible overall result", async ({ page }) => {
  await mountResults(page, {
    electrificationFeasible: false,
    batteryResultOverrides: {
      evening: {
        physical_feasible: false,
        feasibility_status: "infeasible",
      },
    },
  });

  await selectShiftScope(page, "morning");
  const energyAdequacy = page.locator('[data-role="feasibility-shift-energy-adequacy"]');
  await expect(energyAdequacy).toHaveAttribute("data-feasibility", "feasible");
  await expect(page.locator('[data-role="feasibility-shift-visual-analysis"] svg')).toHaveCount(2);

  await selectShiftScope(page, "evening");
  await expect(energyAdequacy).toHaveCount(0);
  await expect(page.locator('[data-role="feasibility-shift-visual-analysis"] svg')).toHaveCount(0);
  await expect(page.locator('[data-role="feasibility-shift-min-soc"]')).toHaveCount(0);
  await expect(page.locator('[data-role="feasibility-charging-plan"]')).toHaveCount(0);
  await selectShiftScope(page, "morning");
  await expect(page.locator('[data-role="feasibility-shift-min-soc"]')).toBeVisible();
  await expect(page.locator('[data-role="feasibility-charging-plan"]')).toBeVisible();
});

test("shows an unknown shift status without hiding available visual analysis", async ({ page }) => {
  await mountResults(page, {
    shiftIds: ["morning"],
    includeElectrificationFeasible: false,
    batteryResultOverrides: {
      morning: {
        optimized_packs: undefined,
        required_total_packs: undefined,
        physical_feasible: undefined,
        feasibility_status: undefined,
      },
    },
  });

  await selectShiftScope(page, "morning");

  const energyAdequacy = page.locator('[data-role="feasibility-shift-energy-adequacy"]');
  await expect(energyAdequacy).toHaveAttribute("data-feasibility", "unknown");
  await expect(page.locator('[data-role="feasibility-shift-visual-analysis"]')).toHaveAttribute(
    "data-status",
    "available",
  );
});

test("shows one complete shared infrastructure for joint optimization across every shift", async ({ page }) => {
  await mountResults(page, {
    mode: "joint",
    chargingStations: [
      {
        stop_id: "depot",
        stop_name: "Depot",
        num_slots: 3,
        max_power_per_slot_kw: 150,
        max_total_power_kw: 400,
      },
      {
        stop_id: "terminal",
        stop_name: "Terminal",
        num_slots: 2,
        max_power_per_slot_kw: 100,
      },
    ],
    installedChargers: {
      depot: { stop_name: "Depot", num_slots: 2, cost_chf: 30_000 },
      terminal: { stop_name: "Terminal", num_slots: 0, cost_chf: 0 },
    },
    stationUtilization: {
      depot: { peak_concurrent_buses: 2, total_energy_kwh: 420.5 },
      terminal: { peak_concurrent_buses: 0, total_energy_kwh: 0 },
    },
    totalInstallationCostChf: 30_000,
  });

  const infrastructure = page.locator('[data-role="feasibility-infrastructure"]');
  await expect(page.locator('[data-role="feasibility-mode"]')).toHaveText(
    "Optimization mode: Joint",
  );
  await expect(infrastructure).toContainText("Configuration available");
  await expect(infrastructure.locator('tbody tr')).toHaveCount(2);
  await expect(infrastructure.locator('[data-station-status="installed"]')).toContainText("Installed");
  await expect(infrastructure.locator('[data-station-status="rejected"]')).toContainText("Not installed");
  await expect(infrastructure.locator('[data-role="feasibility-active-locations"]')).toHaveText("1");
  await expect(infrastructure.locator('[data-role="feasibility-total-plugs"]')).toHaveText("2");
  await expect(infrastructure.locator('[data-role="feasibility-total-power"]')).toContainText("300");
  await expect(infrastructure.locator('[data-role="feasibility-total-installation-cost"]')).toContainText(/30['’]000/);
  await expect(infrastructure.locator('[data-station-status="installed"]')).toContainText("420.5");

  await selectShiftScope(page, "evening");
  await scopeSelector(page).getByRole("tab", { name: "General" }).click();
  await expect(infrastructure.locator('[data-role="feasibility-active-locations"]')).toHaveText("1");
  await expect(infrastructure.locator('tbody tr')).toHaveCount(2);
});

test("keeps unresolved candidates visible without presenting partial totals as final", async ({ page }) => {
  await mountResults(page, {
    mode: "charging_only",
    chargingStations: [
      { stop_id: "resolved", stop_name: "Resolved", num_slots: 2, max_power_per_slot_kw: 100 },
      { stop_id: "pending", stop_name: "Pending", num_slots: 1, max_power_per_slot_kw: 150 },
    ],
    installedChargers: {
      resolved: { stop_name: "Resolved", num_slots: 1, cost_chf: 10_000 },
    },
  });

  const infrastructure = page.locator('[data-role="feasibility-infrastructure"]');
  await expect(page.locator('[data-role="feasibility-mode"]')).toHaveText(
    "Optimization mode: Charging",
  );
  await expect(infrastructure).toContainText("Configuration incomplete");
  await expect(infrastructure.locator('[data-role="feasibility-infrastructure-incomplete"]')).toBeVisible();
  await expect(infrastructure.locator('[data-station-status="candidate"]')).toContainText("Candidate");
  await expect(infrastructure.locator('[data-role="feasibility-active-locations"]')).toHaveText("—");
  await expect(infrastructure.locator('[data-role="feasibility-total-plugs"]')).toHaveText("—");
  await expect(infrastructure.locator('[data-role="feasibility-total-power"]')).toHaveText("—");
});

test("distinguishes a resolved configuration with no charging locations from missing data", async ({ page }) => {
  await mountResults(page, {
    mode: "joint",
    chargingStations: [],
    installedChargers: {},
    totalInstallationCostChf: 0,
  });

  await expect(page.locator('[data-role="feasibility-infrastructure-empty"]')).toBeVisible();
  await expect(page.locator('.feasibility-infrastructure-metrics')).toHaveCount(0);
});

test('raw feasibility data are accessible from the header in both scopes', async ({ page }) => {
  await mountResults(page);
  await expect(page.locator('.page-header [data-action="back"]')).toHaveCount(0);
  const access = page.locator('.page-header');
  await expect(access.getByRole('button', { name: 'View raw feasibility data' })).toBeVisible();
  await access.getByRole('button', { name: 'View raw feasibility data' }).click();
  const overlay = page.locator('[data-role="sim-data-overlay"]');
  await expect(overlay).toBeVisible();
  await overlay.locator('[data-action="close-sim-data"]').first().click();
  await selectShiftScope(page, 'morning');
  await access.getByRole('button', { name: 'View raw feasibility data' }).click();
  await expect(overlay).toBeVisible();
  await overlay.locator('[data-action="close-sim-data"]').first().click();
  await expect(overlay).toBeHidden();
});

const aggregateAnalysis = () => ({
  status: 'available', optimization_basis: 'mean',
  per_shift: { morning: {
    status: 'available', selected_packs: 8, max_packs: 16, pack_size_kwh: 50,
    nominal_kwh: 400, usable_kwh: 280, min_soc: .2, max_soc: .9, state_of_health: 1,
    verified_soc_kwh: [360,200,260,120],
    trajectory_validation: {samples:100000,completion_probability:.932},
    reference: {battery_packs:8},
    statistics: {samples:100000,seed:42,mean_total_kwh:300,q95_total_kwh:360,q95_monte_carlo_ci95_kwh:[359.8,360.2],precision_met:true,
      total_energy_histogram:{bin_edges_kwh:[240,260,280,300,320,340,360,380],counts:[1000,9000,25000,35000,20000,5000,5000]}},
    cases: {
      mean: {required_usable_kwh:240,margin_kwh:40,total_consumption_kwh:300,accepted_charge_kwh:60,soc_kwh:[360,200,260,120],first_minute:480},
      aggregate_q95: {required_usable_kwh:300,margin_kwh:-20,total_consumption_kwh:360,accepted_charge_kwh:60,soc_kwh:[360,170,230,60],first_minute:480},
    },
  }},
});

for (const mode of ['battery_only','charging_only','joint']) {
  test(`aggregate energy exposes usable capacity, timed charging and Q95 deficit in ${mode}`, async ({page}) => {
    await mountResults(page, {mode,shiftIds:['morning'],consumptionBasis:'mean',consumptionAnalysis:aggregateAnalysis(),forecastVerification:{status:'verified'}});
    await selectShiftScope(page,'morning');
    const card=page.locator('[data-role="aggregate-energy"]');
    await expect(card).toHaveAttribute('data-status','available');
    await expect(card.locator('.aggregate-pack--chosen')).toHaveCount(8);
    await expect(card.locator('.aggregate-pack--unused')).toHaveCount(8);
    await expect(card).toContainText('400 kWh');
    await expect(card).toContainText('280 kWh');
    await expect(card.locator('[data-basis="aggregate_q95"]')).toContainText('deficit 20 kWh');
    await expect(card.locator('.aggregate-soc svg')).toBeVisible();
    await expect(card.locator('[role="tooltip"]').filter({hasText:'93.2%'})).toContainText('independently simulated trajectories');
    await expect(card.locator('.aggregate-soc--verified')).toHaveCount(1);
    await expect(page.locator('[data-role="efficiency-consumption-coverage-chart"]')).toHaveCount(0);
    const box=await card.boundingBox();
    expect(box.x+box.width).toBeLessThanOrEqual(page.viewportSize().width+1);
    if(process.env.FE12_SCREENSHOTS) await card.screenshot({path:`/tmp/elettra-fe12-${mode}-${page.viewportSize().width}.png`});
  });
}

test('compact sizing effect shows the verified aggregate Q95 decision value', async ({page}) => {
  const analysis = aggregateAnalysis();
  analysis.optimization_basis = 'aggregate_q95';
  const q95Prediction = prediction(
    'prediction-morning',
    'morning',
    8,
    300,
  );
  q95Prediction.summary.quantiles.q95 = 470;

  await mountResults(page, {
    shiftIds: ['morning'],
    mode: 'joint',
    consumptionBasis: 'aggregate_q95',
    consumptionAnalysis: analysis,
    forecastVerification: {status: 'verified'},
    predictionOverrides: {'prediction-morning': q95Prediction},
  });
  await selectShiftScope(page, 'morning');
  await page.locator('details.ya-more-information > summary').click();

  const sizingEffect = page.locator('[data-role="feasibility-sizing-effect"]');
  await expect(
    sizingEffect.locator('[data-role="sizing-effect-decision-basis"]'),
  ).toContainText('Q95');
  await expect(
    sizingEffect.locator('[data-role="sizing-effect-decision-consumption"]'),
  ).toHaveText('360.0');
  await expect(
    sizingEffect.locator('[data-role="sizing-effect-decision-specific"]'),
  ).toHaveText('3.600');
  await expect(
    sizingEffect.locator('[data-role="sizing-effect-decision-drivetrain"]'),
  ).toHaveText('310.0');
  await expect(
    sizingEffect.locator('[data-role="sizing-effect-decision-auxiliary"]'),
  ).toHaveText('50.0');
  await expect(sizingEffect).not.toContainText('470.0 kWh');
});

test('choosing Q95 preserves current design until an explicit optimization is started', async ({page}) => {
  let writes=0;
  await mountResults(page,{shiftIds:['morning'],consumptionBasis:'mean',consumptionAnalysis:aggregateAnalysis(),forecastVerification:{status:'verified'}});
  await page.route('**/optimization-runs/level-test/basis/aggregate_q95', route => {
    const started=route.request().method()==='POST'; if(started) writes++;
    return route.fulfill({json:{optimization_run_id:started?'new-q95':null,status:started?'pending':'not_calculated'}});
  });
  await selectShiftScope(page,'morning');
  const card=page.locator('[data-role="aggregate-energy"]');
  await card.locator('select').selectOption('aggregate_q95');
  await expect(card.locator('[data-role="aggregate-basis-message"]')).toContainText('No compatible result');
  await expect(card.locator('[data-role="aggregate-current-basis"]')).toHaveText('Mean');
  await expect(card.locator('.aggregate-pack--chosen')).toHaveCount(8);
  expect(writes).toBe(0);
  await page.evaluate(() => document.addEventListener('partial:request',event=>{window.__basisNavigation=event.detail;event.stopImmediatePropagation();},true));
  await card.locator('[data-role="aggregate-basis-action"]').click();
  await expect.poll(()=>writes).toBe(1);
  await expect.poll(()=>page.evaluate(()=>window.__basisNavigation?.runId)).toBe('new-q95');
});

test('a cached Q95 result opens without starting another optimization', async ({page}) => {
  let writes=0;
  await mountResults(page,{shiftIds:['morning'],consumptionBasis:'mean',consumptionAnalysis:aggregateAnalysis(),forecastVerification:{status:'verified'}});
  await page.route('**/optimization-runs/level-test/basis/aggregate_q95',route=>{
    if(route.request().method()==='POST') writes++;
    return route.fulfill({json:{optimization_run_id:'cached-q95',status:'completed'}});
  });
  await selectShiftScope(page,'morning');
  const card=page.locator('[data-role="aggregate-energy"]');
  await card.locator('select').selectOption('aggregate_q95');
  await expect(card.locator('[data-role="aggregate-basis-action"]')).toHaveText('Open evaluation');
  await page.evaluate(()=>document.addEventListener('partial:request',event=>{window.__basisNavigation=event.detail;event.stopImmediatePropagation();},true));
  await card.locator('[data-role="aggregate-basis-action"]').click();
  await expect.poll(()=>page.evaluate(()=>window.__basisNavigation?.runId)).toBe('cached-q95');
  expect(writes).toBe(0);
});

test('the requested Q95 basis survives result rerenders without changing the stored result or starting work', async ({page})=>{
  let writes=0;
  await mountResults(page,{shiftIds:['morning'],consumptionBasis:'mean',consumptionAnalysis:aggregateAnalysis(),forecastVerification:{status:'verified'}});
  await page.route('**/optimization-runs/level-test/basis/aggregate_q95',route=>{
    if(route.request().method()==='POST') writes++;
    return route.fulfill({json:{optimization_run_id:null,status:null}});
  });
  await selectShiftScope(page,'morning');
  const card=page.locator('[data-role="aggregate-energy"]');
  await card.locator('select').selectOption('aggregate_q95');
  await expect(card.locator('[data-role="aggregate-basis-message"]')).toContainText('No compatible result');
  await page.getByRole('tab',{name:'General',exact:true}).click();
  await selectShiftScope(page,'morning');
  await expect(card.locator('select')).toHaveValue('aggregate_q95');
  await expect(card.locator('[data-role="aggregate-basis-message"]')).toContainText('No compatible result');
  await expect(card.locator('[data-role="aggregate-current-basis"]')).toHaveText('Mean');
  await expect(card.locator('.aggregate-pack--chosen')).toHaveCount(8);
  expect(writes).toBe(0);
});

test('historical infeasible results show virtual packs separately without invented aggregate margins', async ({page})=>{
  await mountResults(page,{shiftIds:['morning'],electrificationFeasible:false,batteryResultOverrides:{morning:{optimized_packs:16,required_total_packs:17,excess_packs:1,optimized_kwh:850,physical_feasible:false}}});
  await selectShiftScope(page,'morning');
  const card=page.locator('[data-role="aggregate-energy"]');
  await expect(card.locator('.aggregate-pack--chosen')).toHaveCount(16);
  await expect(card.locator('.aggregate-pack--excess')).toHaveCount(1);
  const kpis=card.locator('.result-kpis');
  await expect(kpis.locator('strong').first()).toHaveText('17 / 16');
  await expect(kpis.locator('strong').first()).toHaveClass('aggregate-pack-count--exceeded');
  await expect(kpis).toContainText('Estimated required / installable packs');
  await expect(kpis.locator('strong').nth(1)).toHaveText('800 kWh');
  await expect(kpis).toContainText('Selected battery · nominal capacity');
  await expect(card.locator('.aggregate-warning')).toHaveCount(0);
  await expect(card.locator('[role="tooltip"]').first()).toContainText('estimated shortfall');
  await expect(card.locator('.aggregate-demand')).toHaveCount(0);
});

test('highlights the energy deficit when usable capacity is below predicted consumption', async ({page})=>{
  const infeasiblePrediction = prediction(
    'prediction-morning',
    'morning',
    8,
    668,
  );
  infeasiblePrediction.contextual_parameters.battery_capacity_kwh = 800;

  await mountResults(page, {
    shiftIds: ['morning'],
    mode: 'joint',
    electrificationFeasible: false,
    predictionOverrides: {
      'prediction-morning': infeasiblePrediction,
    },
    batteryResultOverrides: {
      morning: {
        optimized_packs: 8,
        required_total_packs: 10,
        excess_packs: 2,
        optimized_kwh: 800,
        max_physical_packs: 8,
        max_physical_kwh: 800,
        physical_feasible: false,
        feasibility_status: 'infeasible',
      },
    },
    perBusSummaryOverrides: {
      morning: {
        total_charged_kwh: 0,
        num_charging_sessions: 0,
        charging_sessions: [],
      },
    },
  });

  await selectShiftScope(page, 'morning');

  const consumption = page.locator(
    '[data-role="feasibility-shift-predicted-consumption"]',
  );
  await expect(consumption).toHaveClass(/result-metric--negative/);
  await expect(consumption).toContainText(
    'Prediction consumption per vehicle block (kWh)',
  );
  await expect(consumption.locator('strong')).toHaveText('668');
  await expect(consumption.locator('strong')).toHaveClass(
    /feasibility-shift-metric--negative/,
  );

  const usableCapacity = page.locator(
    '[data-role="aggregate-usable-capacity"]',
  );
  await expect(usableCapacity).toHaveText('560 kWh < 668 kWh');
  await expect(usableCapacity.locator('..')).toHaveClass(
    /aggregate-energy-kpi--deficit/,
  );

  await page.locator('details.ya-more-information > summary').click();
  const moreInformation = page.locator(
    '.feasibility-more-information__content',
  );
  await expect(
    moreInformation.getByRole('heading', {
      name: 'Optimization Results',
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    moreInformation.locator('.efficiency-subsection-title'),
  ).toHaveCount(0);
  await expect(
    moreInformation.locator('[data-role="forecast-verification"]'),
  ).toHaveCount(0);
  await expect(
    moreInformation.locator('[data-role="feasibility-selected-predictions"]'),
  ).toHaveCount(0);
  await expect(
    moreInformation.locator('[data-role="feasibility-shift-predictions"]'),
  ).toHaveCount(0);
});

test('keeps only complete optimization results for a feasible shift in an infeasible evaluation', async ({page})=>{
  await mountResults(page, {
    shiftIds: ['morning', 'evening'],
    mode: 'joint',
    electrificationFeasible: false,
    batteryResultOverrides: {
      morning: {
        optimized_packs: 8,
        required_total_packs: 8,
        max_physical_packs: 8,
        max_physical_kwh: 400,
        physical_feasible: true,
        feasibility_status: 'feasible',
      },
      evening: {
        optimized_packs: 12,
        required_total_packs: 14,
        excess_packs: 2,
        max_physical_packs: 12,
        max_physical_kwh: 600,
        physical_feasible: false,
        feasibility_status: 'infeasible_requires_excess_packs',
      },
    },
  });

  await selectShiftScope(page, 'morning');
  await page.locator('details.ya-more-information > summary').click();
  const moreInformation = page.locator(
    '.feasibility-more-information__content',
  );
  await expect(
    moreInformation.locator('.efficiency-subsection-title'),
  ).toContainText('Battery Sizing');
  await expect(
    moreInformation.locator('[data-role="feasibility-selected-predictions"]'),
  ).toHaveCount(0);
  await expect(
    moreInformation.locator('[data-role="feasibility-shift-predictions"]'),
  ).toHaveCount(0);

  await selectShiftScope(page, 'evening');
  await expect(
    moreInformation.locator('.efficiency-subsection-title'),
  ).toHaveCount(0);
  await expect(
    moreInformation.locator('[data-role="feasibility-selected-predictions"]'),
  ).toHaveCount(0);
  await expect(
    moreInformation.locator('[data-role="feasibility-shift-predictions"]'),
  ).toHaveCount(0);
});

test('uses the optimized SOC profile instead of summed per-trip Q95 values', async ({page})=>{
  const q95Prediction = prediction(
    'prediction-morning',
    'morning',
    8,
    477.5705679386675,
  );
  q95Prediction.contextual_parameters.battery_capacity_kwh = 800;
  q95Prediction.summary.quantiles.q95 = 608.696882907938;
  q95Prediction.summary.total_distance_km = 186.41020257636706;

  await mountResults(page, {
    shiftIds: ['morning'],
    mode: 'joint',
    consumptionBasis: 'aggregate_q95',
    consumptionAnalysis: {
      status: 'unverified',
      optimization_basis: 'aggregate_q95',
      per_shift: {},
    },
    forecastVerification: { status: 'physical_limits_exceeded' },
    predictionOverrides: {
      'prediction-morning': q95Prediction,
    },
    batteryResultOverrides: {
      morning: {
        optimized_packs: 8,
        required_total_packs: 8,
        excess_packs: 0,
        optimized_kwh: 800,
        max_physical_packs: 8,
        max_physical_kwh: 800,
        physical_feasible: true,
        feasibility_status: 'feasible',
      },
    },
    perBusSummaryOverrides: {
      morning: {
        min_soc_kwh: 212.94093742871453,
        max_soc_kwh: 720,
        total_charged_kwh: 0,
        num_charging_sessions: 0,
        charging_sessions: [],
        energy_timeline: {
          first_minute: 310,
          step_minutes: 1,
          soc_kwh: [720, 212.94093742871453],
          charge_kwh: [0],
        },
      },
    },
  });

  await selectShiftScope(page, 'morning');

  const consumption = page.locator(
    '[data-role="feasibility-shift-predicted-consumption"]',
  );
  await expect(consumption.locator('strong')).toHaveText('507');
  await expect(consumption).not.toContainText('609');
  await expect(consumption).not.toHaveClass(/result-metric--negative/);
  await expect(
    page.locator('[data-role="feasibility-shift-predicted-consumption-per-km"] strong'),
  ).toHaveText('2.720');

  const usableCapacity = page.locator(
    '[data-role="aggregate-usable-capacity"]',
  );
  await expect(usableCapacity).toHaveText('560 kWh');
  await expect(usableCapacity.locator('..')).not.toHaveClass(
    /aggregate-energy-kpi--deficit/,
  );
  await expect(
    page.locator('[data-role="feasibility-shift-coverage-status"]'),
  ).toHaveText('Largest selected battery');
});

test('uses the Q95 optimizer demand in the physical-limit warning', async ({page})=>{
  const q95Prediction = prediction(
    'prediction-morning',
    'morning',
    8,
    663.403137683198,
  );
  q95Prediction.contextual_parameters.battery_capacity_kwh = 800;
  q95Prediction.summary.quantiles.q95 = 846.6104571889231;
  q95Prediction.summary.total_distance_km = 263.6913714014552;

  await mountResults(page, {
    shiftIds: ['morning'],
    mode: 'joint',
    electrificationFeasible: false,
    consumptionBasis: 'aggregate_q95',
    consumptionAnalysis: {
      status: 'unverified',
      optimization_basis: 'aggregate_q95',
      per_shift: {},
    },
    forecastVerification: { status: 'physical_limits_exceeded' },
    predictionOverrides: {
      'prediction-morning': q95Prediction,
    },
    electrificationSummary: {
      status: 'infeasible',
      infeasible_buses: [{
        shift_id: 'morning',
        shift_name: 'Morning service',
        required_total_packs: 10,
        required_total_kwh: 1000,
        max_physical_packs: 8,
        max_physical_kwh: 800,
        excess_packs: 2,
      }],
    },
    batteryResultOverrides: {
      morning: {
        optimized_packs: 8,
        required_total_packs: 10,
        excess_packs: 2,
        optimized_kwh: 1000,
        max_physical_packs: 8,
        max_physical_kwh: 800,
        physical_feasible: false,
        feasibility_status: 'infeasible_requires_excess_packs',
      },
    },
    perBusSummaryOverrides: {
      morning: {
        min_soc_kwh: 201.14553265912934,
        max_soc_kwh: 900,
        total_charged_kwh: 0,
        num_charging_sessions: 0,
        charging_sessions: [],
        energy_timeline: {
          first_minute: 310,
          step_minutes: 1,
          soc_kwh: [900, 201.14553265912934],
          charge_kwh: [0],
        },
      },
    },
  });

  await selectShiftScope(page, 'morning');
  await page.locator('details.ya-more-information > summary').click();

  const warning = page.locator('.efficiency-limit-cell__warning');
  await expect(warning).toHaveText(
    'Limit exceeded: vehicle block needs 699 kWh.',
  );
  await expect(warning).not.toContainText('663');
});

test('uses the optimized SOC profile when selected packs differ from the mean prediction', async ({page})=>{
  const referencePrediction = prediction(
    'prediction-morning',
    'morning',
    8,
    435.82845128406973,
  );
  referencePrediction.contextual_parameters.battery_capacity_kwh = 800;
  referencePrediction.summary.total_distance_km = 169.87065962512102;

  await mountResults(page, {
    shiftIds: ['morning'],
    mode: 'joint',
    consumptionBasis: 'mean',
    consumptionAnalysis: {
      status: 'unverified',
      optimization_basis: 'mean',
      per_shift: {},
    },
    forecastVerification: { status: 'physical_limits_exceeded' },
    predictionOverrides: {
      'prediction-morning': referencePrediction,
    },
    batteryResultOverrides: {
      morning: {
        optimized_packs: 6,
        required_total_packs: 6,
        excess_packs: 0,
        optimized_kwh: 600,
        max_physical_packs: 8,
        max_physical_kwh: 800,
        physical_feasible: true,
        feasibility_status: 'feasible',
      },
    },
    perBusSummaryOverrides: {
      morning: {
        min_soc_kwh: 122.75790359399056,
        max_soc_kwh: 540,
        total_charged_kwh: 0,
        num_charging_sessions: 0,
        charging_sessions: [],
        energy_timeline: {
          first_minute: 310,
          step_minutes: 1,
          soc_kwh: [540, 122.75790359399056],
          charge_kwh: [0],
        },
      },
    },
  });

  await selectShiftScope(page, 'morning');

  const consumption = page.locator(
    '[data-role="feasibility-shift-predicted-consumption"]',
  );
  await expect(consumption.locator('strong')).toHaveText('417');
  await expect(consumption).not.toContainText('436');
  await expect(consumption).not.toHaveClass(/result-metric--negative/);
  await expect(
    page.locator('[data-role="feasibility-shift-predicted-consumption-per-km"] strong'),
  ).toHaveText('2.456');

  const usableCapacity = page.locator(
    '[data-role="aggregate-usable-capacity"]',
  );
  await expect(usableCapacity).toHaveText('420 kWh');
  await expect(usableCapacity.locator('..')).not.toHaveClass(
    /aggregate-energy-kpi--deficit/,
  );
});

for (const [required, excess, unavailable] of [[18,8,2],[13,3,0]]) {
  test(`charging-only diagnostic ${required} packs does not add all excess beyond the physical limit`, async ({page})=>{
    await mountResults(page,{mode:'charging_only',shiftIds:['morning'],electrificationFeasible:false,
      batteryResultOverrides:{morning:{optimized_packs:10,required_total_packs:required,excess_packs:excess,
        optimized_kwh:required*50,physical_feasible:false}}});
    const critical = page.locator('[data-role="feasibility-critical-shifts"]');
    await expect(critical.locator('tbody td')).toHaveText(['10', '16', String(required), `+${required - 10}`]);
    await expect(page.locator('[data-role="feasibility-infrastructure"]')).toHaveCount(0);
    await selectShiftScope(page,'morning');
    const card=page.locator('[data-role="aggregate-energy"]');
    await expect(card.locator('.aggregate-pack--chosen')).toHaveCount(10);
    await expect(card.locator('.aggregate-pack--unused')).toHaveCount(6);
    await expect(card.locator('.aggregate-pack--excess')).toHaveCount(unavailable);
    await expect(card).toContainText('500 kWh');
    await expect(card.locator('.result-kpis strong').first()).toHaveText(`${required} / 16`);
    await expect(card.locator('.aggregate-warning')).toHaveCount(0);
    const summary=page.locator('[data-role="feasibility-shift-summary"]');
    await expect(summary).toContainText('Battery shortfall');
    await expect(summary.locator('[data-role="feasibility-shift-physical-limit"]')).toContainText(
      unavailable ? 'Exceeds physical pack limit' : 'Within physical pack limit');
    await expect(card).not.toContainText('Physical limit exceeded');
  });
}

for (const mode of ['battery_only','charging_only','joint']) {
  test(`paired ${mode} changes the full design without starting another calculation`, async ({page}) => {
    let writes=0;
    const ids={mean:'level-test',aggregate_q95:'paired-q95'};
    await mountResults(page,{mode,shiftIds:['morning'],consumptionBasis:'mean',
      consumptionAnalysis:aggregateAnalysis(),forecastVerification:{status:'verified'},basisRunIds:ids});
    const original=await page.evaluate(async()=> (await fetch('/api/v1/simulation/optimization-runs/level-test')).json());
    const other=structuredClone(original);
    other.id=ids.aggregate_q95; other.name='Q95 design';other.input_params.consumption_basis='aggregate_q95';
    other.results.battery_results.morning={...battery('Morning service',9),reference_packs:9};
    other.results.installed_chargers={depot:{stop_name:'Depot',num_slots:3,cost_chf:9000}};
    other.results.total_installation_cost_chf=9000;
    other.results.consumption_analysis.optimization_basis='aggregate_q95';
    Object.assign(other.results.consumption_analysis.per_shift.morning,{selected_packs:9,nominal_kwh:450,usable_kwh:315});
    const otherDetail=other.results.consumption_analysis.per_shift.morning;
    otherDetail.reference.battery_packs=9;
    otherDetail.statistics.mean_total_kwh=320;
    otherDetail.statistics.q95_total_kwh=380;
    otherDetail.statistics.total_energy_histogram.bin_edges_kwh=otherDetail.statistics.total_energy_histogram.bin_edges_kwh.map(v=>v+20);
    await page.route('**/optimization-runs/paired-q95',route=>route.fulfill({json:other}));
    await page.route('**/optimization-runs/level-test/basis/aggregate_q95',route=>{
      if(route.request().method()==='POST')writes++;
      return route.fulfill({json:{optimization_run_id:ids.aggregate_q95,status:'completed'}});
    });
    const header=page.locator('[data-role="paired-basis-switch"]');
    await expect(header).toBeVisible();
    await expect(header).toContainText('entire displayed design');
    await expect(header.locator('[data-role="aggregate-basis-message"]')).toBeHidden();
    const basisInfo=header.getByRole('button',{name:'Show optimized result',exact:true});
    await basisInfo.click();
    await expect(basisInfo.getByRole('tooltip')).toBeVisible();
    await basisInfo.press('Escape');
    const scopeBounds=await page.locator('[data-role="shift-tabs"]').boundingBox();
    const basisBounds=await header.boundingBox();
    expect(basisBounds.x+basisBounds.width).toBeLessThanOrEqual(page.viewportSize().width);
    if(page.viewportSize().width>700){
      expect(basisBounds.x).toBeGreaterThanOrEqual(scopeBounds.x+scopeBounds.width);
      expect(Math.abs((basisBounds.y+basisBounds.height/2)-(scopeBounds.y+scopeBounds.height/2))).toBeLessThan(3);
    }
    await selectShiftScope(page,'morning');
    const card=page.locator('[data-role="aggregate-energy"]');
    await expect(card.locator('.aggregate-demand[data-basis="mean"]')).toHaveCount(1);
    await expect(card.locator('[data-basis="aggregate_q95"]')).toHaveCount(0);
    const histogram=card.locator('[data-role="energy-distribution"]');
    await expect(histogram).toBeVisible();
    const chartBounds = await card.locator('.aggregate-charts > figure').evaluateAll(elements =>
      elements.map(el => { const { x, y, width } = el.getBoundingClientRect(); return { x, y, width }; })
    );
    expect(chartBounds).toHaveLength(2);
    if (page.viewportSize().width > 900) {
      expect(Math.abs(chartBounds[0].y - chartBounds[1].y)).toBeLessThan(1);
      expect(chartBounds[1].x).toBeGreaterThanOrEqual(chartBounds[0].x + chartBounds[0].width);
    } else {
      expect(chartBounds[1].y).toBeGreaterThan(chartBounds[0].y);
    }
    await expect(histogram).toHaveAttribute('data-packs','8');
    await expect(histogram.locator('[data-role="energy-distribution-marker"]')).toHaveCount(1);
    await expect(histogram.locator('[data-role="energy-distribution-marker"]')).toHaveAttribute('data-value','300');
    const decisionConsumption=page.locator('[data-role="feasibility-shift-predicted-consumption"]');
    const decisionConsumptionPerKm=page.locator('[data-role="feasibility-shift-predicted-consumption-per-km"]');
    await expect(decisionConsumption.locator('strong')).toHaveText('300');
    await expect(decisionConsumptionPerKm.locator('strong')).toHaveText('3.000');
    await expect(card.locator('.aggregate-demand strong')).toHaveCount(0);
    await expect(card).toContainText('Energy charged during the vehicle block');
    const capacityInfo=card.getByRole('button',{name:'Usable capacity required to complete the vehicle block',exact:true});
    await capacityInfo.click();
    await expect(capacityInfo.getByRole('tooltip')).toBeVisible();
    await expect(capacityInfo.getByRole('tooltip')).toContainText('selected battery mass');
    await card.getByRole('button',{name:'Simulated vehicle block completion',exact:true}).click();
    await expect(card.getByRole('tooltip').filter({hasText:'93.2%'})).toBeVisible();
    await expect(card.locator('select')).toHaveCount(0);
    await expect(card.locator('[data-role="aggregate-basis-action"]')).toBeHidden();
    await page.evaluate(()=>{
      window.__originalResultsPage=document.querySelector('.simulation-results-page');
      document.addEventListener('partial:request',event=>{
        window.__basisNavigation=event.detail;event.stopImmediatePropagation();
      },{capture:true,once:true});
    });
    await header.locator('select').selectOption('aggregate_q95');
    await expect(header.locator('select')).toHaveValue('aggregate_q95');
    await expect(card.locator('.aggregate-pack--chosen')).toHaveCount(9);
    await expect(page.locator('[data-shift-id="morning"]')).toHaveAttribute('aria-selected','true');
    expect(await page.evaluate(()=>window.__basisNavigation)).toBeUndefined();
    expect(await page.evaluate(()=>window.__originalResultsPage===document.querySelector('.simulation-results-page'))).toBe(true);
    await expect(card.locator('[data-role="aggregate-current-basis"]')).toHaveText('Q95');
    await expect(card.locator('.aggregate-demand[data-basis="aggregate_q95"]')).toHaveCount(1);
    await expect(card.locator('[data-basis="mean"]')).toHaveCount(0);
    await expect(histogram).toHaveAttribute('data-packs','9');
    await expect(histogram).toBeVisible();
    await expect(histogram.locator('[data-role="energy-distribution-marker"]')).toHaveCount(1);
    await expect(histogram.locator('[data-role="energy-distribution-marker"]')).toHaveAttribute('data-basis','aggregate_q95');
    await expect(histogram.locator('[data-role="energy-distribution-marker"]')).toHaveAttribute('data-value','380');
    await expect(decisionConsumption.locator('strong')).toHaveText('380');
    await expect(decisionConsumptionPerKm.locator('strong')).toHaveText('3.800');
    await expect(page.locator('[data-role="charging-info"]')).toContainText('3');
    await expect(card.locator('.aggregate-soc svg')).toBeVisible();
    expect(writes).toBe(0);
  });
}

for (const status of ['pending','failed']) {
  test(`paired ${status} result never relabels the current design or offers a duplicate calculation`,async({page})=>{
    await mountResults(page,{shiftIds:['morning'],consumptionBasis:'mean',
      consumptionAnalysis:aggregateAnalysis(),forecastVerification:{status:'verified'},
      basisRunIds:{mean:'level-test',aggregate_q95:'paired-q95'}});
    await page.route('**/optimization-runs/level-test/basis/aggregate_q95',route=>{
      expect(route.request().method()).toBe('GET');
      return route.fulfill({json:{optimization_run_id:'paired-q95',status}});
    });
    await selectShiftScope(page,'morning');
    const card=page.locator('[data-role="aggregate-energy"]');
    const header=page.locator('[data-role="paired-basis-switch"]');
    await header.locator('select').selectOption('aggregate_q95');
    await expect(header.locator('select')).toHaveValue('mean');
    await expect(card.locator('[data-role="aggregate-current-basis"]')).toHaveText('Mean');
    await expect(card.locator('[data-role="aggregate-basis-action"]')).toBeHidden();
    await expect(header.locator('[data-role="aggregate-basis-message"]')).toContainText(
      status==='pending'?'already running':'unavailable or failed');
  });
}

test('daily depot cycle separates energy and discloses simulated peak shaving', async ({page}) => {
  const dailyCycle={status:'verified',peak_shaving:{status:'optimized'},per_shift:{morning:{
    ready:true,depot_name:'Depot',slot_number:1,depot_arrival_minute:1080,next_departure_minute:1800,
    target_soc_kwh:360,departure_soc_kwh:360,during_shift_kwh:80,outside_shift_kwh:220,total_charged_kwh:300,
    charging_intervals:[{start_minute:1081,end_minute:1800,power_kw_dc:18.36,energy_kwh:220}],
  }},stations:{depot:{stop_name:'Depot',is_depot:true,during_shift_kwh:80,outside_shift_kwh:220,
    total_charged_kwh:300,available_power_kw_dc:100,previous_plan_peak_kw_dc:100,simulated_peak_kw_dc:18.36}}};
  await mountResults(page,{shiftIds:['morning'],dailyCycle,forecastVerification:{status:'verified'},totalInstallationCostChf:0});
  const infrastructureHeader=page.locator('.feasibility-infrastructure__header');
  const help=infrastructureHeader.locator('h4 .infrastructure-info');
  await expect(infrastructureHeader.locator('p')).toHaveCount(0);
  await expect(help.getByRole('tooltip')).toBeHidden();
  await help.click();
  await expect(help.getByRole('tooltip')).toBeVisible();
  await expect(help.getByRole('tooltip')).toHaveText('Chargers shared by the selected buses. Daily-cycle results below include depot charging before the next departure.');
  await help.press('Escape');
  await expect(help.getByRole('tooltip')).toBeHidden();
  const card=page.locator('[data-role="depot-cycle"]');
  await expect(card).toContainText('1 / 1 buses ready');
  await expect(card).toContainText('220 kWh');
  await expect(page.locator('[data-role="feasibility-total-installation-cost"]')).toContainText('Not evaluated');
  const peak=card.locator('[data-role="depot-peak-shaving"]');
  await expect(peak).not.toHaveAttribute('open');
  await peak.locator('summary').click();
  await expect(peak).toContainText('Other site loads are excluded');
  await selectShiftScope(page,'morning');
  await expect(card).toContainText('06:00 +1');
  await expect(card).toContainText('360 / 360 kWh');
  await expect(card).toContainText('plug is reserved for the whole stay');
});


test("shows every selected battery and complete vehicle investment totals", async ({ page }) => {
  await mountResults(page, {
    mode: 'joint',
    installedChargers: {depot: {stop_name: 'Depot', num_slots: 2, cost_chf: 548947.3684210526,
      cost_breakdown: {station_type: 'depot', chargers_cost_chf: 220000, site_fixed_cost_chf: 250000,
        site_power_cost_chf: 78947.36842105263, total_cost_chf: 548947.3684210526}}},
    totalInstallationCostChf: 548947.3684210526,
    batteryResultOverrides: {
      morning: { investment_cost_source: "bus_model_snapshot", bus_cost_chf: 300000, battery_pack_cost_chf: 6000 },
      evening: { investment_cost_source: "bus_model_snapshot", bus_cost_chf: 400000, battery_pack_cost_chf: 7000 },
    },
  });
  const fleet = page.locator('[data-role="feasibility-fleet-battery"]');
  await expect(fleet.locator('tbody tr').nth(0)).toContainText('Morning service');
  await expect(fleet.locator('tbody tr').nth(0).locator('td')).toHaveText(['8', '400', "CHF 300'000", "CHF 48'0008 × CHF 6'000", "CHF 348'000"]);
  await expect(fleet.locator('tbody tr').nth(1).locator('td')).toHaveText(['12', '600', "CHF 400'000", "CHF 84'00012 × CHF 7'000", "CHF 484'000"]);
  await expect(fleet.locator('tfoot td')).toHaveText(['20', "1'000", "CHF 700'000", "CHF 132'000", "CHF 832'000"]);
  const infrastructure = page.locator('.infrastructure-cost-breakdown');
  const fleetHelp=fleet.locator('h4 .investment-info');
  const infrastructureHelp=infrastructure.locator(':scope > summary .investment-info');
  await expect(fleet.locator(':scope > p').filter({hasText:'One bus per vehicle block.'})).toHaveCount(0);
  await expect(infrastructure.locator(':scope > p')).toHaveCount(0);
  for (const [help,explanation] of [
    [fleetHelp,'One bus per vehicle block. Battery cost = selected packs × price per pack. Bus total excludes charging infrastructure.'],
    [infrastructureHelp,'One-time investment for the selected infrastructure, in CHF. Fixed infrastructure is included in battery-only evaluations.'],
  ]) {
    await expect(help.getByRole('tooltip')).toBeHidden();
    await help.click();
    await expect(help.getByRole('tooltip')).toBeVisible();
    await expect(help.getByRole('tooltip')).toHaveText(explanation);
    await help.press('Escape');
    await expect(help.getByRole('tooltip')).toBeHidden();
  }
  await expect(infrastructure).toHaveAttribute('open','');
  await expect(infrastructure.locator('tbody td')).toHaveText(['Depot', 'Depot', "CHF 220'000", "CHF 250'000", "CHF 78'947", "CHF 548'947"]);
  await expect(infrastructure.locator('tfoot td')).toHaveText(["CHF 220'000", "CHF 250'000", "CHF 78'947", "CHF 548'947"]);
  await expect(page.locator('[data-role="feasibility-total-installation-cost"]')).toHaveText("CHF 548'947");
  await expect(fleet).not.toContainText('kCHF');
  await expect(infrastructure).not.toContainText('kCHF');

  await selectShiftScope(page, 'morning');
  await expect(fleet).toHaveCount(0);
  await scopeSelector(page).getByRole('tab', { name: 'General' }).click();
  await expect(fleet.locator('tfoot td').last()).toHaveText("CHF 832'000");
});

test("uses current shift metadata instead of stale result names throughout the general level", async ({ page }) => {
  await mountResults(page, {
    shiftNames: {
      morning: "Current morning block",
      evening: "Current evening block",
    },
    resultShiftNames: {
      morning: "Historical morning name",
      evening: "Historical evening name",
    },
  });

  const selector = scopeSelector(page);
  await expect(selector.getByRole("tab", { name: "Current morning block" })).toBeVisible();
  await expect(selector.getByRole("tab", { name: "Current evening block" })).toBeVisible();

  const fleetRows = page.locator('[data-role="feasibility-fleet-battery"] tbody tr');
  await expect(fleetRows.nth(0)).toContainText("Current morning block");
  await expect(fleetRows.nth(1)).toContainText("Current evening block");
  await expect(page.locator('[data-role="feasibility-general-level"]')).not.toContainText(
    "Historical morning name",
  );
  await expect(page.locator('[data-role="feasibility-limiting-shifts"]')).toContainText(
    "Current evening block",
  );
});

test("explains a failed multi-shift evaluation at general and individual shift level", async ({ page }) => {
  const requestedApiPaths = await mountResults(page, {
    shiftIds: ["valid-one", "invalid", "valid-two"],
    shiftNames: {
      "valid-one": "40101",
      invalid: "40104",
      "valid-two": "40105",
    },
    predictionRunIds: [],
    runStatus: "failed",
    includeElectrificationFeasible: false,
    includeBatteryResults: false,
    includePerBusSummary: false,
    legacyError: "40104: daily repetition requires matching depots",
    failure: {
      code: "input_validation_failed",
      phase: "input_validation",
      issues: [{
        code: "daily_cycle_depot_mismatch",
        shift_id: "invalid",
        shift_name: "Historical 40104",
        message: "Historical 40104 starts and ends at different depots.",
        details: {
          start_stop_id: "depot-2",
          start_stop_name: "TPL Rimessa 2",
          end_stop_id: "depot-1",
          end_stop_name: "TPL Rimessa 1",
        },
      }],
      shift_outcomes: [
        {
          shift_id: "valid-one",
          shift_name: "Historical 40101",
          status: "not_evaluated",
          blocked_by_shift_ids: ["invalid"],
        },
        {
          shift_id: "invalid",
          shift_name: "Historical 40104",
          status: "validation_failed",
          failure_codes: ["daily_cycle_depot_mismatch"],
        },
        {
          shift_id: "valid-two",
          shift_name: "Historical 40105",
          status: "not_evaluated",
          blocked_by_shift_ids: ["invalid"],
        },
      ],
    },
  });

  const general = page.locator('[data-role="feasibility-failure-general"]');
  await expect(general).toBeVisible();
  await expect(general).toContainText("Evaluation not completed");
  await expect(general).toContainText(
    "This does not mean that the configuration is infeasible.",
  );
  await expect(general.locator('[data-role="feasibility-failure-guidance"]')).toContainText(
    "Edit vehicle block 40104 so that it uses the same departure and return depot",
  );
  await expect(page.locator('[data-role="feasibility-general-level"]')).toHaveCount(0);
  await expect(page.locator('[data-role="feasibility-fleet-battery"]')).toHaveCount(0);
  await expect(page.locator(".results-shift-tabs")).toContainText("40101");
  await expect(page.locator(".results-shift-tabs")).toContainText("40104");
  await expect(page.locator(".results-shift-tabs")).toContainText("40105");

  const outcomeRows = general.locator("tbody tr");
  await expect(outcomeRows).toHaveCount(3);
  await expect(outcomeRows.nth(0)).toContainText("40101");
  await expect(outcomeRows.nth(0)).toContainText("Not evaluated");
  await expect(outcomeRows.nth(0)).toContainText("40104");
  await expect(outcomeRows.nth(1)).toContainText("40104");
  await expect(outcomeRows.nth(1)).toContainText("Input validation failed");
  await expect(outcomeRows.nth(1)).toContainText("TPL Rimessa 2");
  await expect(outcomeRows.nth(1)).toContainText("TPL Rimessa 1");

  await selectShiftScope(page, "invalid");
  const invalidDetail = page.locator('[data-role="feasibility-failure-shift"]');
  await expect(invalidDetail).toBeVisible();
  await expect(invalidDetail).toHaveAttribute("data-failure-status", "validation_failed");
  await expect(invalidDetail.locator('[data-role="feasibility-failure-shift-name"]')).toHaveText("40104");
  await expect(invalidDetail.locator('[data-role="feasibility-failure-reason"]')).toContainText(
    "TPL Rimessa 2",
  );
  await expect(invalidDetail.locator('[data-role="feasibility-failure-reason"]')).toContainText(
    "TPL Rimessa 1",
  );
  await expect(invalidDetail.locator('[data-role="feasibility-failure-guidance"]')).toContainText(
    "Edit vehicle block 40104 so that it uses the same departure and return depot",
  );
  await expect(page.locator('[data-role="feasibility-shift-summary"]')).toHaveCount(0);

  await selectShiftScope(page, "valid-one");
  const blockedDetail = page.locator('[data-role="feasibility-failure-shift"]');
  await expect(blockedDetail).toHaveAttribute("data-failure-status", "not_evaluated");
  await expect(blockedDetail.locator('[data-role="feasibility-failure-shift-name"]')).toHaveText("40101");
  await expect(blockedDetail.locator('[data-role="feasibility-failure-reason"]')).toContainText(
    "40104",
  );
  await expect(blockedDetail.locator('[data-role="feasibility-failure-blocked-by"]')).toContainText(
    "40104",
  );
  await expect(blockedDetail.locator('[data-role="feasibility-failure-guidance"]')).toContainText(
    "Correct the blocking vehicle block(s) 40104",
  );
  await expect(page.locator('[data-action="toggle-sim-data"]')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    ),
  ).toBe(false);
  expect(failedResultDerivedRequests(requestedApiPaths)).toEqual([]);
});

test("renders the legacy depot remediation in Italian with emphasized danger styling", async ({ page }) => {
  await mountResults(page, {
    language: "it",
    shiftIds: ["invalid"],
    shiftNames: { invalid: "40104" },
    predictionRunIds: [],
    runStatus: "failed",
    includeElectrificationFeasible: false,
    includeBatteryResults: false,
    includePerBusSummary: false,
    legacyError: "40104: daily repetition requires the existing trips to start and end at the same depot; no transfers are added",
  });

  const guidance = page.locator(
    '[data-role="feasibility-failure-general"] [data-role="feasibility-failure-guidance"]',
  );
  await expect(guidance).toContainText("Come risolvere:");
  await expect(guidance).toContainText(
    "Modifica il turno macchina 40104 impostando lo stesso deposito di partenza e ritorno e ricrea i relativi collegamenti con il deposito. Quindi rilancia la valutazione di fattibilità.",
  );
  const style = await guidance.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      color: computed.color,
      fontWeight: Number.parseInt(computed.fontWeight, 10),
    };
  });
  expect(style.color).toBe("rgb(211, 47, 47)");
  expect(style.fontWeight).toBeGreaterThanOrEqual(600);
});

test("keeps legacy failure text safe and skips derived result requests", async ({ page }) => {
  const unsafeMessage = '<img data-role="failure-injected" src=x onerror="window.__failureXss=true"> Legacy calculation failure';
  const requestedApiPaths = await mountResults(page, {
    runStatus: "failed",
    legacyError: unsafeMessage,
    includeElectrificationFeasible: false,
    includeBatteryResults: false,
    includePerBusSummary: false,
  });

  const general = page.locator('[data-role="feasibility-failure-general"]');
  await expect(general).toBeVisible();
  await expect(general).toContainText(unsafeMessage);
  await expect(general.locator('[data-role="feasibility-failure-guidance"]')).toContainText(
    "Check the selected vehicle blocks, bus model and charging infrastructure",
  );
  await expect(page.locator('[data-role="failure-injected"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.__failureXss)).toBeUndefined();

  await selectShiftScope(page, "morning");
  const shift = page.locator('[data-role="feasibility-failure-shift"]');
  await expect(shift).toBeVisible();
  await expect(shift.locator('[data-role="feasibility-failure-reason"]')).toContainText(
    unsafeMessage,
  );
  expect(failedResultDerivedRequests(requestedApiPaths)).toEqual([]);
});

test("shows a stable diagnostic for historical failed runs without an error payload", async ({ page }) => {
  const requestedApiPaths = await mountResults(page, {
    runStatus: "failed",
    includeElectrificationFeasible: false,
    includeBatteryResults: false,
    includePerBusSummary: false,
  });

  const general = page.locator('[data-role="feasibility-failure-general"]');
  await expect(general).toBeVisible();
  await expect(general).toContainText("Evaluation not completed");
  await expect(general).toContainText(
    "The calculation did not produce a feasibility result.",
  );
  await expect(page.locator('[data-role="feasibility-general-level"]')).toHaveCount(0);
  await expect(page.locator('[data-role="feasibility-no-solution"]')).toHaveCount(0);
  expect(failedResultDerivedRequests(requestedApiPaths)).toEqual([]);
});

for(const recorded of [true,false]) {
  test(`GTFS provenance distinguishes ${recorded?'recorded mixed editions':'historical current blocks'} in feasibility results`,async({page})=>{
    const old={gtfs_year:2025,gtfs_file_date:'2025-10-02',valid_from:'2024-12-15',valid_to:'2025-12-13'};
    const latest={gtfs_year:2027,gtfs_file_date:'2026-11-04',valid_from:'2026-12-13',valid_to:'2027-12-11'};
    const current={gtfs_year:2026,gtfs_file_date:'2025-09-27',valid_from:'2025-12-14',valid_to:'2026-12-12'};
    const snapshot={version:1,source:'recorded',shifts:{morning:[old],evening:[latest]}};
    await mountResults(page, {gtfsProvenance:recorded?snapshot:undefined,currentGtfs:[current]});
    const panel=page.locator('[data-role="analysis-gtfs"]');
    await expect(panel).toBeVisible();
    await expect(panel).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(panel.locator('.gtfs-disclosure__label')).toHaveCSS('color', 'rgb(28, 28, 28)');
    const rows=panel.locator('[data-role="gtfs-metadata"]');
    await expect(rows).toHaveCount(recorded ? 2 : 1);
    await expect(rows.first()).toBeHidden();
    await expect(panel.locator('summary')).toContainText(recorded ? 'Multiple GTFS datasets' : '2026 · file 27/09/2025');
    await expect(panel.locator('details')).not.toHaveAttribute('open', '');
    await panel.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(rows.first()).toBeVisible();
    await expect(panel.locator('.gtfs-metadata__source')).toHaveCount(0);
    if(recorded) {
      await expect(rows.nth(0)).toContainText('2025 ·');
      await expect(rows.nth(1)).toContainText('2027 ·');
      await expect(rows.nth(1)).toContainText('13/12/2026–11/12/2027');
    } else {
      await expect(rows.nth(0)).toContainText('2026 ·');
      await expect(rows).toHaveCount(1);
    }
  });
}


test('shared recorded GTFS version uses one compact header disclosure',async({page})=>{
    const dataset={gtfs_year:2027,gtfs_file_date:'2026-11-04',valid_from:'2026-12-13',valid_to:'2027-12-11'};
    const snapshot={version:1,source:'recorded',shifts:{morning:[dataset],evening:[dataset]}};
    await mountResults(page, {gtfsProvenance:snapshot,currentGtfs:[dataset]});
    const panel=page.locator('[data-role="analysis-gtfs"]');
    await expect(page.locator('.page-header [data-role="analysis-gtfs"]')).toBeVisible();
    await expect(panel).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(panel.locator('summary')).toContainText('2027 · file 04/11/2026');
    await expect(panel.locator('summary')).not.toContainText('Current block data');
    await expect(panel.locator('[data-role="gtfs-metadata"]')).toHaveCount(1);
    await expect(panel.locator('[data-role="gtfs-metadata"]')).toBeHidden();
    await expect(panel.locator('details')).not.toHaveAttribute('open', '');
    await panel.locator('summary').click();
    await expect(panel.locator('[data-role="gtfs-metadata"]')).toBeVisible();
    await expect(panel).toContainText('13/12/2026–11/12/2027');
    await expect(panel.locator('.gtfs-metadata__source')).toHaveCount(0);
    await panel.locator('summary').click();
    await expect(panel.locator('[data-role="gtfs-metadata"]')).toBeHidden();
});

test('charging cards distinguish available time from active time and keep details in accessible help', async ({page}) => {
  await mountResults(page, {shiftIds:['morning'], perBusSummaryOverrides:{morning:{
    num_charging_sessions:1, total_charged_kwh:10,
    charging_sessions:[{station_name:'Terminal',station_stop_id:'terminal',start_minute:600,end_minute:607,
      duration_minutes:7,technical_minutes:1,layover_reduction_minutes:2,available_charging_minutes:4,
      active_charging_minutes:2,idle_available_minutes:2,energy_kwh:10}],
  }}});
  await selectShiftScope(page,'morning');
  const plan=page.locator('[data-role="feasibility-charging-plan"]');
  await plan.locator(':scope > summary').click();
  const row=plan.locator('[data-role="feasibility-charging-session"]');
  await expect(row.locator('.feasibility-charging-session__metrics > div')).toHaveCount(3);
  await expect(row.locator('[data-role="feasibility-charging-session-duration"]')).toContainText('7 min');
  await expect(row.locator('[data-role="charging-availableChargingMinutes"]')).toContainText('4 min');
  await expect(row.locator('[data-role="feasibility-charging-session-energy"]')).toContainText('10.0 kWh');
  const help=row.getByRole('button',{name:'Charging details',exact:true});
  const tooltip=row.locator('[role="tooltip"]');
  await expect(tooltip).toBeHidden();
  expect(await row.innerText()).not.toContain('Average power');
  await help.focus();
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('Active charging time: 2 min');
  await expect(tooltip).toContainText('Technical time: 1 min');
  await expect(tooltip).toContainText('Layover reduction: 2 min');
  const box=await tooltip.boundingBox();
  expect(box.y).toBeGreaterThanOrEqual(0);expect(box.y+box.height).toBeLessThanOrEqual(page.viewportSize().height);
  await page.keyboard.press('Escape');await expect(tooltip).toBeHidden();
  await help.blur();await help.click();await expect(tooltip).toBeVisible();
  await page.locator('[data-role="feasibility-charging-session-location"]').click();
  await expect(tooltip).toBeHidden();
});

// The same physical shortfall can be returned directly (412) or in a
// daytime-only diagnostic after an infeasible daily cycle (405).
for (const mode of ['battery_only', 'charging_only', 'joint']) {
  for (const consumptionBasis of ['mean', 'aggregate_q95']) {
    for (const source of ['result', 'diagnostic']) {
      test(`uniform infeasible ${mode} ${consumptionBasis} ${source}: General table opens one battery`, async ({ page }) => {
        const warnings = [];
        page.on('pageerror', error => warnings.push(error.message));
        const critical = battery('Old saved name', 8, {
          required_total_packs: 10, max_physical_packs: 8, max_physical_kwh: 400,
          physical_feasible: false, excess_packs: 2,
          feasibility_status: 'infeasible_requires_excess_packs',
        });
        await mountResults(page, {
          mode, consumptionBasis, fixedBatteryPacks: 8, electrificationFeasible: false,
          solverStatus: source === 'result' ? 'optimal' : 'infeasible',
          forecastVerification: {status: source === 'result' ? 'physical_limits_exceeded' : 'infeasible'},
          includeBatteryResults: source === 'result', includePerBusSummary: source === 'result',
          batteryResultOverrides: {evening: critical}, dailyCycle: {status: 'unverified'},
          infeasibilityDiagnostics: source === 'diagnostic' ? {
            status: 'available', forecast_verification: {status: 'physical_limits_exceeded'},
            battery_results: {evening: critical}, reasons: [],
          } : undefined,
        });
        const general = page.locator('[data-role="feasibility-general-level"]');
        const row = general.locator('[data-role="feasibility-critical-shifts"] tbody tr');
        await expect(row).toHaveCount(1);
        await expect(row.locator('td')).toHaveText(['8', '8', '10', '+2']);
        await expect(row).toHaveAttribute('data-source', source);
        await expect(row.locator('.infeasibility-pack-limit')).toHaveAttribute('title', '2 packs beyond the installable maximum');
        const constraints = general.locator('[data-role="infeasibility-context"]');
        await expect(constraints).toBeHidden();
        await constraints.locator('..').click();
        await expect(constraints).toBeVisible();
        await expect(constraints).toContainText('estimated battery requirement exceeds the installable maximum');
        await constraints.locator('..').press('Escape');
        await expect(constraints).toBeHidden();
        await expect(general.locator('.helper-text, .aggregate-warning')).toHaveCount(0);
        await expect(general.locator('[data-role="infeasibility-next-departure"]')).toHaveAttribute('data-status', 'unverified');
        await expect(page.locator('[data-role="aggregate-energy"], [data-role="feasibility-infrastructure"], [data-role="depot-cycle"]')).toHaveCount(0);
        await expect(general).not.toContainText('CHF');
        if (mode === 'joint' && consumptionBasis === 'mean') {
          await page.screenshot({path: test.info().outputPath(`uniform-${source}-general.png`), fullPage: true});
        }
        if (updateGuideScreenshots && mode === 'joint' && consumptionBasis === 'mean' && source === 'diagnostic') {
          await page.setViewportSize({width: 1100, height: 800});
          await page.mouse.move(0, 0);
          await page.screenshot({path: 'guide/images/feasibility-infeasible.png'});
        }
        await row.getByRole('button', {name: 'Evening service', exact: true}).click();
        await expect(scopeSelector(page).getByRole('tab', {name: 'Evening service', exact: true})).toHaveAttribute('aria-selected', 'true');
        const card = page.locator('[data-role="aggregate-energy"]');
        await expect(card).toHaveCount(1);
        await expect(card.locator('.aggregate-pack--chosen')).toHaveCount(8);
        await expect(card.locator('.aggregate-pack--excess')).toHaveCount(2);
        await expect(card.locator('.result-kpis strong').first()).toHaveText('10 / 8');
        await expect(page.locator('[data-role="feasibility-shift-summary"]')).toBeVisible();
        await expect(page.locator('[data-role="feasibility-shift-summary"] h4')).toHaveText('Vehicle block summary');
        await expect(page.locator('[data-role="feasibility-shift-required-packs"] strong')).toHaveText('10 packs');
        await expect(page.locator('[data-role="feasibility-shift-common-packs"] strong')).toHaveText('8 packs');
        await expect(card.locator('h3')).toHaveText('Battery and energy margin');
        await expect(card.locator('.aggregate-warning')).toHaveCount(0);
        const estimateHelp = card.locator('.result-card__subtitle .infeasibility-info');
        await expect(estimateHelp.getByRole('tooltip')).toBeHidden();
        await estimateHelp.focus();
        await expect(estimateHelp.getByRole('tooltip')).toBeVisible();
        await expect(estimateHelp.getByRole('tooltip')).toContainText('Battery mass and energy margins have not been verified');
        const box = await estimateHelp.getByRole('tooltip').boundingBox();
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
        await estimateHelp.press('Escape');
        await expect(estimateHelp.getByRole('tooltip')).toBeHidden();
        const legendHelp = card.locator('.aggregate-pack-key .infeasibility-info');
        await legendHelp.click();
        await expect(legendHelp.getByRole('tooltip')).toBeVisible();
        await expect(legendHelp.getByRole('tooltip')).toContainText('Blue: usable SOC band');
        await legendHelp.press('Escape');
        await expect(page.locator('[data-role="infeasibility-consumption-scope"]')).toHaveCount(consumptionBasis === 'aggregate_q95' ? 0 : 1);
        const sections = await page.locator('[data-role="feasibility-shift-level"] > .feasibility-level__content > *').evaluateAll(elements =>
          elements.map(element => element.getAttribute('data-role') ?? (element.matches('details.ya-more-information') ? 'more-information' : 'other')));
        expect(sections).toEqual(['feasibility-shift-summary', 'aggregate-energy', 'more-information']);
        await page.locator('details.ya-more-information > summary').click();
        await expect(page.locator('details.ya-more-information')).toContainText('Operating Conditions');
        await expect(page.locator('details.ya-more-information')).toContainText('Optimization Results');
        await expect(page.locator('[data-role="infeasibility-context"]')).toContainText('Evening service');
        await expect(page.locator('[data-role="infeasibility-context"]')).not.toContainText('Old saved name');
        await expect(page.locator('[data-role="feasibility-shift-min-soc"], [data-role="depot-cycle"], [data-role="feasibility-charging-plan"]')).toHaveCount(0);
        await scopeSelector(page).getByRole('tab', {name: 'General', exact: true}).click();
        await expect(row.locator('td')).toHaveText(['8', '8', '10', '+2']);
        expect(warnings).toEqual([]);
      });
    }
  }
}

const depotReasons = [
  {code: 'depot_power', shift_id: 'evening', shift_name: 'Saved name', stop_name: 'Depot',
    required_recharge_kwh: 340.7, maximum_recharge_kwh: 319, minimum_shortfall_kwh: 21.7,
    available_power_kw_dc: 32.5, minimum_average_power_kw_dc: 34.7},
  {code: 'depot_no_plug', shift_id: 'evening', shift_name: 'Saved name', stop_name: 'Depot', required_recharge_kwh: 340.7},
  {code: 'depot_time', shift_id: 'evening', shift_name: 'Saved name', stop_name: 'Depot', required_recharge_kwh: 340.7},
  {code: 'depot_plugs', shift_ids: ['evening'], stop_name: 'Depot', required_plugs: 2, available_plugs: 1},
  {code: 'depot_constraints'},
];
for (const reason of depotReasons) {
  test(`uniform infeasible depot reason ${reason.code} preserves sufficient battery without claiming a feasible cycle`, async ({page}) => {
    await mountResults(page, {
      solverStatus: 'infeasible', electrificationFeasible: false,
      includeBatteryResults: false, includePerBusSummary: false, dailyCycle: {status: 'unverified'},
      infeasibilityDiagnostics: {status: 'available', forecast_verification: {status: 'verified'},
        battery_results: {evening: battery('Evening service', 12)}, reasons: [reason]},
    });
    const general = page.locator('[data-role="feasibility-general-level"]');
    const help = general.getByRole('button', {name: 'Identified constraints', exact: true});
    await expect(general.locator(`[data-reason="${reason.code}"]`)).toBeHidden();
    await help.click();
    await expect(general.locator(`[data-reason="${reason.code}"]`)).toBeVisible();
    if (reason.code === 'depot_power') await expect(help.getByRole('tooltip')).toContainText('21.7 kWh are missing');
    await help.press('Escape');
    await expect(general.locator('[data-role="infeasibility-context"]')).toHaveAttribute('data-cycle-status', 'identified');
    const rows = general.locator('[data-role="feasibility-critical-shifts"] tbody tr');
    await expect(rows).toHaveCount(reason.code === 'depot_constraints' ? 0 : 1);
    if (reason.code !== 'depot_constraints') await expect(rows.locator('td')).toHaveText(['12', '16', '12', '0']);
    await selectShiftScope(page, 'evening');
    await expect(page.locator('[data-role="aggregate-energy"] .result-card__subtitle [role="tooltip"]')).toContainText('battery has been verified for the vehicle block');
    await expect(page.locator('[data-role="aggregate-energy"] .result-card__subtitle [role="tooltip"]')).toContainText('complete daily cycle remains infeasible');
    await expect(page.locator('[data-role="depot-cycle"], [data-role="feasibility-charging-plan"]')).toHaveCount(0);
    await selectShiftScope(page, 'morning');
    await expect(page.locator('[data-role="infeasibility-battery-unavailable"]')).toBeVisible();
    await expect(page.locator('[data-role="aggregate-energy"]')).toHaveCount(0);
    await expect(page.locator('[data-role="infeasibility-context"]')).not.toContainText('NaN');
  });
}

for (const status of ['unavailable', 'available']) {
  test(`uniform infeasible ${status} incomplete diagnostics show unknowns, never zero energy`, async ({page}) => {
    await mountResults(page, {
      solverStatus: 'infeasible', electrificationFeasible: false,
      includeBatteryResults: false, includePerBusSummary: false, dailyCycle: {status: 'unverified'},
      infeasibilityDiagnostics: {status, reason: 'time_budget_exhausted',
        reasons: [{code: 'depot_power', shift_id: 'evening'}, {code: 'future_reason'}],
        battery_results: status === 'available' ? {evening: {
          shift_name: 'Evening service', physical_feasible: false,
        }} : {}},
    });
    const general = page.locator('[data-role="feasibility-general-level"]');
    await expect(general.locator('[data-role="infeasibility-context"]')).toContainText('A detailed diagnosis is not available');
    const rows = general.locator('[data-role="feasibility-critical-shifts"] tbody tr');
    await expect(rows).toHaveCount(status === 'available' ? 1 : 0);
    if (status === 'available') await expect(rows.locator('td')).toHaveText(['—', '—', '—', '—']);
    await selectShiftScope(page, 'evening');
    await expect(page.locator('[data-role="infeasibility-battery-unavailable"]')).toBeVisible();
    await expect(page.locator('[data-role="aggregate-energy"]')).toHaveCount(0);
    await expect(page.locator('[data-role="infeasibility-context"]')).not.toContainText(/NaN|undefined|simulation\.diagnostic_future/);
  });
}

for (const mode of ['battery_only', 'charging_only', 'joint']) {
  for (const consumptionBasis of ['mean', 'aggregate_q95']) {
    test(`feasible ${mode} ${consumptionBasis} markup is unchanged by irrelevant diagnostics`, async ({page}) => {
      await mountResults(page, {mode, consumptionBasis});
      const general = page.locator('[data-role="feasibility-general-level"]');
      await expect(general).toBeVisible();
      const beforeGeneral = await general.innerHTML();
      await selectShiftScope(page, 'morning');
      const card = page.locator('[data-role="aggregate-energy"]');
      await expect(card).toBeVisible();
      const beforeBattery = await card.innerHTML();
      await mountResults(page, {mode, consumptionBasis, infeasibilityDiagnostics: {
        status: 'available', battery_results: {morning: battery('Misleading diagnostic', 30)}, reasons: depotReasons,
      }});
      await expect(general).toBeVisible();
      expect(await general.innerHTML()).toBe(beforeGeneral);
      await selectShiftScope(page, 'morning');
      await expect(card).toBeVisible();
      expect(await card.innerHTML()).toBe(beforeBattery);
      await expect(page.locator('[data-role="infeasibility-context"]')).toHaveCount(0);
    });
  }
}

for (const language of ['it', 'de', 'fr']) {
  test(`uniform infeasibility vocabulary is localized in ${language}`, async ({page}) => {
    await mountResults(page, {language, shiftIds: ['morning'], electrificationFeasible: false,
      dailyCycle: {status: 'unverified'}, batteryResultOverrides: {morning: {
        optimized_packs: 8, required_total_packs: 10, excess_packs: 2, physical_feasible: false,
        max_physical_packs: 8,
      }}});
    const general = page.locator('[data-role="feasibility-general-level"]');
    await expect(general.locator('[data-role="infeasibility-context"]')).toBeHidden();
    await general.locator('[data-role="infeasibility-context"]').locator('..').click();
    await expect(general.locator('[data-role="infeasibility-context"]')).toBeVisible();
    await expect(general).not.toContainText(/simulation\.|Identified constraints|Missing packs/);
  });
}

for (const status of ['time_budget_exhausted', 'solver_not_optimal', 'iteration_limit', 'cycle_detected']) {
  test(`unverified ${status} is not presented as an established infeasible result`, async ({page}) => {
    await mountResults(page, {
      electrificationFeasible: false, forecastVerification: {status},
      infeasibilityDiagnostics: {status: 'available', battery_results: {evening: battery('Evening', 30)},
        reasons: [{code: 'depot_constraints'}]},
    });
    await expect(page.locator('[data-role="feasibility-overall-status"]')).toHaveText('Feasibility status unavailable');
    await expect(page.locator('[data-role="infeasibility-context"], [data-role="feasibility-critical-shifts"]')).toHaveCount(0);
  });
}

test('incomplete main battery records show unknown counts and no fabricated energy', async ({page}) => {
  await mountResults(page, {
    shiftIds: ['morning'], electrificationFeasible: false,
    batteryResultOverrides: {morning: {optimized_packs: 8, max_physical_packs: 8,
      required_total_packs: null, max_physical_kwh: null, physical_feasible: false}},
  });
  await expect(page.locator('[data-role="feasibility-critical-shifts"] tbody td')).toHaveText(['8', '8', '—', '—']);
  await page.getByRole('button', {name: 'Morning service', exact: true}).click();
  await expect(page.locator('[data-role="infeasibility-battery-unavailable"]')).toBeVisible();
  await expect(page.locator('[data-role="aggregate-energy"]')).toHaveCount(0);
});

test('historical diagnostic-only shifts remain reachable when the input shift list is absent', async ({page}) => {
  await mountResults(page, {shiftIds: [], includeBatteryResults: false, includePerBusSummary: false,
    electrificationFeasible: false, solverStatus: 'infeasible', infeasibilityDiagnostics: {
      status: 'available', reasons: [], battery_results: {evening: battery('Evening service', 8, {
        required_total_packs: 10, max_physical_packs: 8, max_physical_kwh: 400, excess_packs: 2,
        physical_feasible: false,
      })},
    }});
  const row = page.locator('[data-role="feasibility-critical-shifts"] tbody tr');
  await expect(row).toHaveCount(1);
  await row.getByRole('button').click();
  await expect(page.locator('[data-role="aggregate-energy"]')).toBeVisible();
  await expect(scopeSelector(page).getByRole('tab', {name: 'Evening service', exact: true})).toHaveAttribute('aria-selected', 'true');
});

for (const consumptionBasis of ['mean', 'aggregate_q95']) {
  test(`uniform shift 412 trajectory ${consumptionBasis} labels diagnostic consumption and retains physical capacity`, async ({page}) => {
    const demand = consumptionBasis === 'mean' ? 462.4068608267054 : 496.40931589610295;
    await mountResults(page, {
      shiftIds: ['morning'], shiftNames: {morning: '41201_weekday'}, mode: 'joint',
      electrificationFeasible: false, solverStatus: 'optimal', consumptionBasis,
      forecastVerification: {status: 'physical_limits_exceeded'},
      batteryPolicy: {min_soc: 0.4, max_soc: 0.9, state_of_health: 0.7},
      consumptionAnalysis: {status: 'unverified'},
      batteryResultOverrides: {morning: {
        optimized_packs: 8, required_total_packs: consumptionBasis === 'mean' ? 34 : 36,
        max_physical_packs: 8, max_physical_kwh: 320, pack_size_kwh: 40,
        excess_packs: consumptionBasis === 'mean' ? 26 : 28,
        physical_feasible: false, feasibility_status: 'infeasible_requires_excess_packs',
        battery_energy: {usable_capacity_kwh: 112},
      }},
      perBusSummaryOverrides: {morning: {total_charged_kwh: 0, num_charging_sessions: 0,
        energy_timeline: {first_minute: 0, step_minutes: 1, soc_kwh: [856.8, 856.8 - demand], charge_kwh: [0]},
      }},
    });
    await selectShiftScope(page, 'morning');
    await expect(page.locator('[data-role="feasibility-shift-predicted-consumption"] strong')).toHaveText(consumptionBasis === 'mean' ? '462' : '496');
    const scope = page.locator('[data-role="infeasibility-consumption-scope"]');
    await expect(scope).toHaveAttribute('data-source', 'solver_trajectory');
    await expect(page.locator('.q95-consumption-info')).toHaveCount(0);
    await expect(scope).toContainText('not been verified at its full mass');
    await expect(scope).toBeHidden();
    await scope.locator('..').click();
    await expect(scope).toBeVisible();
    await scope.locator('..').press('Escape');
    await expect(scope).toBeHidden();
    await expect(page.locator('[data-role="aggregate-usable-capacity"]')).toHaveText(`112 kWh < ${consumptionBasis === 'mean' ? '462' : '496'} kWh`);
    await expect(page.locator('[data-role="feasibility-shift-min-soc"], [data-role="feasibility-charging-plan"], .aggregate-soc')).toHaveCount(0);
    await page.screenshot({path:test.info().outputPath(`412-detail-${consumptionBasis}.png`), fullPage:true});
  });

  test(`uniform shift 405 reference ${consumptionBasis} shows a full detail without inventing aggregate Q95 or charging`, async ({page}) => {
    await mountResults(page, {
      shiftIds: ['morning'], shiftNames: {morning: '40501_weekday'}, mode: 'joint',
      electrificationFeasible: false, solverStatus: 'infeasible', consumptionBasis,
      forecastVerification: {status: 'infeasible'},
      batteryPolicy: {min_soc: 0.4, max_soc: 0.9, state_of_health: 0.7},
      includeBatteryResults: false, includePerBusSummary: false,
      infeasibilityDiagnostics: {status:'available', forecast_verification:{status:'physical_limits_exceeded'},
        reasons:[], battery_results:{morning: battery('40501_weekday',8,{
          base_packs:3, max_physical_packs:8, max_physical_kwh:800, pack_size_kwh:100,
          required_total_packs:consumptionBasis === 'mean' ? 21 : 22,
          excess_packs:consumptionBasis === 'mean' ? 13 : 14, physical_feasible:false,
          battery_energy:{usable_capacity_kwh:280},
        })}},
    });
    await selectShiftScope(page, 'morning');
    const consumption = page.locator('[data-role="feasibility-shift-predicted-consumption"]');
    await expect(consumption.locator('strong')).toHaveText(consumptionBasis === 'mean' ? '350' : 'N/A');
    const scope=page.locator('[data-role="infeasibility-consumption-scope"]');
    if (consumptionBasis === 'mean') {
      await expect(scope).toHaveAttribute('data-source','reference_forecast');
      await expect(scope).toContainText('Reference forecast at 8 battery packs');
      await expect(scope).toBeHidden();
      await consumption.getByRole('button').click();
      await expect(scope).toBeVisible();
      await consumption.getByRole('button').press('Escape');
      await expect(consumption.locator('.q95-consumption-info')).toHaveCount(0);
    } else {
      await expect(scope).toHaveCount(0);
      const help = consumption.getByRole('button', {name:'Why Q95 consumption is unavailable'});
      const tooltip = help.getByRole('tooltip');
      await expect(tooltip).toBeHidden();
      await help.click();
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toHaveText('Q95 consumption for this vehicle block is not included in the saved result.');
      const box = await tooltip.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize().width);
      await help.press('Escape');
      await expect(tooltip).toBeHidden();
      await help.blur();
      await help.focus();
      await expect(tooltip).toBeVisible();
      await help.press('Escape');
      const specific = page.locator('[data-role="feasibility-shift-predicted-consumption-per-km"]');
      await expect(specific.locator('strong')).toHaveText('—');
      await expect(specific.locator('button, [role="tooltip"]')).toHaveCount(0);
    }
    await expect(consumption).not.toHaveClass(/result-metric--negative/);
    await expect(page.locator('[data-role="aggregate-usable-capacity"]')).toHaveText('280 kWh');
    await page.locator('details.ya-more-information > summary').click();
    await expect(page.locator('details.ya-more-information')).toContainText('Operating Conditions');
    await expect(page.locator('details.ya-more-information')).toContainText('State of Health');
    await expect(page.locator('details.ya-more-information')).toContainText('100 kWh');
    await expect(page.locator('details.ya-more-information .efficiency-infeasibility-notice tbody tr')).toHaveCount(1);
    await expect(page.locator('details.ya-more-information .efficiency-limit-cell__warning')).toHaveCount(0);
    await expect(page.locator('[data-role="feasibility-shift-charged-energy"], [data-role="feasibility-charging-plan"], .aggregate-soc')).toHaveCount(0);
    await page.screenshot({path:test.info().outputPath(`405-detail-${consumptionBasis}.png`), fullPage:true});
  });

  test(`uniform shift 40509 ${consumptionBasis} has no invented excess packs or full-cycle certification`, async ({page}) => {
    await mountResults(page, {
      shiftIds:['morning'], shiftNames:{morning:'40509_weekday'}, mode:'joint', consumptionBasis,
      electrificationFeasible:false, solverStatus:'infeasible', forecastVerification:{status:'infeasible'},
      includeBatteryResults:false, includePerBusSummary:false, dailyCycle:{status:'unverified'},
      batteryPolicy:{min_soc:0.4,max_soc:0.9,state_of_health:0.7},
      infeasibilityDiagnostics:{status:'available',forecast_verification:{status:'physical_limits_exceeded'},
        reasons:[],battery_results:{morning:battery('40509_weekday',4,{
          base_packs:3,required_total_packs:4,max_physical_packs:8,max_physical_kwh:800,
          pack_size_kwh:100,excess_packs:0,physical_feasible:true,
          battery_energy:{usable_capacity_kwh:140},
        })}},
    });
    await selectShiftScope(page,'morning');
    const summary=page.locator('[data-role="feasibility-shift-summary"]');
    await expect(summary.locator('[data-role="feasibility-shift-coverage-status"]')).toHaveText('No battery shortfall identified');
    await expect(summary.locator('[data-role="feasibility-shift-coverage-status"]')).toHaveClass(/result-status--neutral/);
    await expect(summary.locator('[data-role="feasibility-shift-required-packs"] strong')).toHaveText('4 packs');
    await expect(summary.locator('[data-role="feasibility-shift-common-packs"] strong')).toHaveText('4 packs');
    const card=page.locator('[data-role="aggregate-energy"]');
    await expect(card.locator('.aggregate-pack--chosen')).toHaveCount(4);
    await expect(card.locator('.aggregate-pack--unused')).toHaveCount(4);
    await expect(card.locator('.aggregate-pack--excess')).toHaveCount(0);
    await expect(card).not.toContainText('Extra packs beyond the selected configuration');
    await expect(card).toContainText('complete daily cycle has not been verified');
    await expect(page.locator('[data-role="infeasibility-context"]')).not.toContainText('Extra packs beyond the selected configuration');
    await expect(page.locator('[data-role="feasibility-shift-predicted-consumption"]')).not.toHaveClass(/result-metric--negative/);
    await expect(page.locator('[data-role="forecast-verification"]')).toHaveCount(0);
    await expect(page.locator('[data-role="depot-cycle"], [data-role="feasibility-charging-plan"], [data-role="feasibility-shift-min-soc"]')).toHaveCount(0);
    await page.screenshot({path:test.info().outputPath(`40509-detail-${consumptionBasis}.png`),fullPage:true});
  });
}

for (const [language, explanation] of [
  ['it', 'Il consumo Q95 per questo turno non è presente nel risultato salvato.'],
  ['de', 'Der Q95-Verbrauch dieses Fahrzeugumlaufs ist im gespeicherten Ergebnis nicht enthalten.'],
  ['fr', 'La consommation Q95 de ce service voiture ne figure pas dans le résultat enregistré.'],
]) {
  test(`missing Q95 consumption has localized N/A help only on consumption in ${language}`, async ({page}) => {
    await mountResults(page, {language, shiftIds:['morning'], consumptionBasis:'aggregate_q95',
      electrificationFeasible:false, solverStatus:'infeasible',
      includeBatteryResults:false, includePerBusSummary:false,
      infeasibilityDiagnostics:{status:'available', reasons:[], battery_results:{morning:battery('Morning service',8,{
        required_total_packs:10,excess_packs:2,physical_feasible:false,
      })}},
    });
    await selectShiftScope(page,'morning');
    const consumption=page.locator('[data-role="feasibility-shift-predicted-consumption"]');
    await expect(consumption.locator('strong')).toHaveText('N/A');
    await consumption.getByRole('button').click();
    await expect(consumption.getByRole('tooltip')).toHaveText(explanation);
    await expect(consumption.getByRole('tooltip')).toBeVisible();
    const specific=page.locator('[data-role="feasibility-shift-predicted-consumption-per-km"]');
    await expect(specific.locator('strong')).toHaveText('—');
    await expect(specific.locator('button')).toHaveCount(0);
    await expect(page.locator('[data-role="infeasibility-consumption-scope"]')).toHaveCount(0);
  });
}

test('infeasibility cleanup keeps table explanations in contextual help', async ({page}) => {
  await mountResults(page, {shiftIds:['morning'], electrificationFeasible:false,
    batteryResultOverrides:{morning:{optimized_packs:8,required_total_packs:10,
      max_physical_packs:8,excess_packs:2,physical_feasible:false}}});
  const table=page.locator('[data-role="feasibility-critical-shifts"]');
  const required=table.getByRole('button',{name:'Estimated required packs',exact:true});
  const missing=table.getByRole('button',{name:'Missing packs',exact:true});
  await expect(required.getByRole('tooltip')).toBeHidden();
  await expect(missing.getByRole('tooltip')).toBeHidden();
  await required.click();
  await expect(required.getByRole('tooltip')).toBeVisible();
  await expect(required.getByRole('tooltip')).toContainText('not a verified battery size');
  await missing.click();
  await expect(required.getByRole('tooltip')).toBeHidden();
  await expect(missing.getByRole('tooltip')).toBeVisible();
  await expect(missing.getByRole('tooltip')).toContainText('relative to the selected battery');
  await page.getByRole('heading',{level:1}).click();
  await expect(missing.getByRole('tooltip')).toBeHidden();
  await expect(table.locator('tbody td')).toHaveText(['8','8','10','+2']);
  await expect(table.locator('.helper-text, .aggregate-warning')).toHaveCount(0);
});

test('infeasibility cleanup retains separate depot constraints and scopes shift help', async ({page}) => {
  await mountResults(page,{solverStatus:'infeasible',electrificationFeasible:false,
    includeBatteryResults:false,includePerBusSummary:false,
    infeasibilityDiagnostics:{status:'available',forecast_verification:{status:'verified'},
      battery_results:{morning:battery('Morning service',8),evening:battery('Evening service',12)},
      reasons:[{...depotReasons[0],shift_id:'morning',stop_name:'North depot'},
        {...depotReasons[0],shift_id:'evening',stop_name:'South depot'}]}});
  const help=page.getByRole('button',{name:'Identified constraints',exact:true});
  await expect(help.getByRole('tooltip')).toBeHidden();
  await help.click();
  await expect(help.getByRole('tooltip').locator('[data-reason="depot_power"]')).toHaveCount(2);
  await expect(help.getByRole('tooltip')).toContainText('North depot');
  await expect(help.getByRole('tooltip')).toContainText('South depot');
  await expect(help.getByRole('tooltip')).toContainText('21.7 kWh are missing');
  await selectShiftScope(page,'evening');
  await help.click();
  await expect(help.getByRole('tooltip')).toBeVisible();
  await expect(help.getByRole('tooltip')).toContainText('South depot');
  await expect(help.getByRole('tooltip')).not.toContainText('North depot');
});

test('wraps all nine 405 sizing vehicle blocks within the General summary cell', async ({page}) => {
  const names=Array.from({length:9},(_,i) => `405${String(i+1).padStart(2,'0')}_weekday`);
  await mountResults(page, {mode:'joint',language:'it',shiftIds:names,
    shiftNames:Object.fromEntries(names.map(name => [name,name])),
    predictionOverrides:Object.fromEntries(names.map(name => [`prediction-${name}`,prediction(`prediction-${name}`,name,8,350)])),
  });
  const cell=page.locator('[data-role="feasibility-limiting-shifts"]');
  const value=cell.locator('.feasibility-general-card__value--text');
  await expect(value).toHaveText(names.join(', '));
  await expect(cell.locator('.result-metric__label')).toHaveText('Turni macchina con la batteria scelta più grande');
  for (const width of [1280,900,390]) {
    await page.setViewportSize({width,height:900});
    const layout=await cell.evaluate(element => {
      const value=element.querySelector('.feasibility-general-card__value--text');
      const label=element.querySelector('.result-metric__label');
      const r=value.getBoundingClientRect(),l=label.getBoundingClientRect(),c=element.getBoundingClientRect();
      return {overflow:value.scrollWidth>value.clientWidth+1,
        inside:r.left>=c.left && r.right<=c.right,
        multiline:r.height>parseFloat(getComputedStyle(value).lineHeight)*1.5,
        separated:l.right<=r.left || l.bottom<=r.top,
        topDifference:Math.abs(l.top-r.top)};
    });
    expect(layout.overflow,`${width}px`).toBe(false);
    expect(layout.inside,`${width}px`).toBe(true);
    expect(layout.multiline,`${width}px`).toBe(true);
    expect(layout.separated,`${width}px`).toBe(true);
    if (width>620) expect(layout.topDifference).toBeLessThan(1);
  }
  await page.setViewportSize({width:1280,height:900});
  await page.screenshot({path:test.info().outputPath('405-sizing-shifts.png'),fullPage:true});
});
