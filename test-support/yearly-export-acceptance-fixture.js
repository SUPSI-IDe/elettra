import { readFileSync } from 'node:fs';

const reference = JSON.parse(readFileSync(new URL('../tests/fixtures/grid94-lca.json', import.meta.url), 'utf8')).base;
const phases = ['direct', 'directNonExhaust', 'energyChain', 'maintenance', 'vehicle', 'endOfLife', 'infrastructure'];
const total = values => values.reduce((sum, value) => sum + value, 0);

export function annualExportFixture({ uniform = false, heating = 'default', rate = .03 } = {}) {
  const rows = ['a', 'b', 'c'].map((id, index) => ({ id, name: `Block ${id.toUpperCase()}`,
    modelName: 'Frozen bus', packs: !uniform && index === 2 ? 12 : 8,
    capacity: !uniform && index === 2 ? 600 : 400,
    busCost: 400000, packCost: 10000, batteryCost: !uniform && index === 2 ? 120000 : 80000,
  }));
  const scenario = (energy, distance) => ({ scenarioId: 'mild', label: 'Mild', temperature: 0, occurrences: 365,
    kpis: { totalEnergyKwh: energy, distanceKm: distance, drivetrainEnergyKwh: energy * .75,
      auxiliaryEnergyKwh: energy * .25, energyPerKm: energy / distance,
      quantiles: { q05: energy * .9, q50: energy, q95: energy * 1.1 },
      consumptionPerKmQuantiles: { q05: energy * .9 / distance, q50: energy / distance, q95: energy * 1.1 / distance },
    } });
  const totals = (energy, distance) => ({ totalEnergyKwh: energy * 365, distanceKm: distance * 365,
    drivetrainEnergyKwh: energy * .75 * 365, auxiliaryEnergyKwh: energy * .25 * 365 });
  const snapshot = { name: 'Frozen bus', bus_length_m: 12, cost: 400000, battery_pack_cost: 10000,
    battery_pack_size_kwh: 50, bus_lifetime: 12, battery_pack_lifetime: 8 };
  const dataset = { gtfs_year: 2026, gtfs_file_date: '2026-01-01', valid_from: '2026-01-01', valid_to: '2026-12-31' };
  const analysis = { id: 'annual-export-acceptance', name: 'Annual export acceptance', features: {
    config: { mode: 'joint', bus_model_id: 'bus-1', shift_ids: rows.map(row => row.id), bus_model_snapshot: snapshot,
      min_soc: .2, max_soc: .9, occupancy_percent: 60, auxiliary_heating_type: heating,
      weather_reference: { weather_temperature_series_id: 'frozen-weather', depot_name: 'Depot' },
      fixedConfiguration: { fixed: true, mode: 'joint', busModelId: 'bus-1', shiftIds: rows.map(row => row.id),
        sourceOptimizationRunId: 'frozen-feasibility', soc: { minFraction: .2, maxFraction: .9 },
        fleet: { dataAvailable: true, source: 'optimization_per_bus_summary', vehicleCount: 3, vehicleCountByShift: { a: 1, b: 1, c: 1 } },
        investment: { rows }, battery: { packs: uniform ? 8 : 12, uniform, packSizeKwh: 50, nominalKwh: uniform ? 400 : 600 },
        infrastructure: { dataAvailable: true, resultAvailable: true, selectionComplete: true, scope: 'shared',
          totalInstallationCostChf: 250000, stations: [{ stopId: 'depot', stopName: 'Depot', selected: true,
            status: 'installed', slots: 2, powerPerSlotKw: 150, totalPowerKw: 300, installationCostChf: 250000,
            costBreakdown: { chargers_cost_chf: 100000, site_fixed_cost_chf: 100000, site_power_cost_chf: 50000 } }] },
        shifts: rows.map(row => ({ shiftId: row.id, shiftName: row.name,
          battery: { selectedPacks: row.packs, optimizedPacks: row.packs }, operation: { chargingSessions: [] } })),
      },
    },
    meta: { shiftNames: rows.map(row => row.name), busModelName: 'Frozen bus', sizingTemp: 0 },
    scenarios: [{ scenarioId: 'mild', label: 'Mild', temperature: 0, occurrences: 365 }],
    assessment_assumptions: { tco: { rate } },
    gtfs_provenance: { shifts: Object.fromEntries(rows.map(row => [row.id, [dataset]])) },
    results: { schemaVersion: 2, status: 'completed', baseFeasible: true, optimizedPacks: uniform ? 8 : 12,
      yearlyTotals: totals(300, 200), scenarioResults: [scenario(300, 200)],
      shiftResults: rows.map((row, index) => ({ shiftId: row.id, shiftName: row.name, status: 'completed',
        yearlyTotals: totals([100, 50, 150][index], [60, 40, 100][index]),
        scenarioResults: [scenario([100, 50, 150][index], [60, 40, 100][index])] })),
    },
  } };
  // Repricing the current catalogue must not change the frozen investment.
  const busModel = { id: 'bus-1', name: 'Current catalogue bus', specs: { ...snapshot, cost: 999999, battery_pack_cost: 999999 } };
  return { analysis, busModel };
}

/** Deterministic backend-shaped response: one mean vehicle per physical group. */
export function annualExportLca(analysis, values = {}) {
  const features = analysis.features, saved = features.assessment_assumptions?.tco ?? {};
  const mileage = values.annualKmByShift ?? saved.annualKmByShift ?? {};
  const physical = features.config.fixedConfiguration.investment.rows;
  const grouped = new Map();
  for (const row of physical) {
    const key = JSON.stringify([row.modelName, row.packs, row.capacity]);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  const vehicles = [...grouped.values()].map(members => {
    const count = members.length;
    const records = members.map(member => {
      const technical = features.results.shiftResults.find(shift => shift.shiftId === member.id).yearlyTotals;
      const km = mileage[member.id] ?? technical.distanceKm;
      return { km, dc: technical.totalEnergyKwh * km / technical.distanceKm };
    });
    const km = total(records.map(record => record.km)) / count;
    const dc = total(records.map(record => record.dc)) / count;
    const liters = features.config.auxiliary_heating_type === 'diesel' ? km * .01 : 0;
    const indicators = Object.fromEntries(Object.entries(reference.vehicles[0].indicators).map(([key, original]) => {
      const factor = km / reference.vehicles[0].annual_km;
      const result = { ...original };
      for (const field of ['phases', 'diesel_comparator_phases', 'diesel_heating_phases']) {
        result[field] = Object.fromEntries(phases.map(phase => [phase, original[field][phase] * factor]));
      }
      result.diesel_heating_phases = Object.fromEntries(phases.map(phase => [phase,
        original.diesel_heating_phases[phase] * liters / reference.vehicles[0].diesel_heating_liters]));
      result.diesel_heating = total(Object.values(result.diesel_heating_phases));
      for (const phase of phases) result.phases[phase] += result.diesel_heating_phases[phase] - original.diesel_heating_phases[phase] * factor;
      result.electricity_operation = original.electricity_operation * factor;
      result.other_lifecycle = original.other_lifecycle * factor;
      result.total = result.electricity_operation + result.other_lifecycle + result.diesel_heating;
      result.diesel_comparator_total = original.diesel_comparator_total * factor;
      result.saving = result.diesel_comparator_total - result.total;
      return [key, result];
    }));
    return { ...structuredClone(reference.vehicles[0]), shift_id: `group-${members[0].id}`,
      shift_ids: members.map(member => member.id), vehicle_count: count, aggregation: 'interchangeable_buses',
      bus_length_m: 12, battery_capacity_kwh: members[0].capacity, annual_km: km, dc_kwh: dc,
      actual_dc_consumption_kwh_per_100km: dc / km * 100,
      diesel_heating_liters: liters, lifetime_bus: values.bodyLife ?? saved.bodyLife ?? 12,
      lifetime_battery: values.batteryLife ?? saved.batteryLife ?? 8,
      lifetime_diesel_bus: values.dieselLife ?? saved.dieselLife ?? 12,
      diesel_consumption_l_per_km: values.dieselConsumption ?? saved.dieselConsumption ?? .4318, indicators,
    };
  });
  const indicators = Object.fromEntries(Object.keys(reference.indicators).map(key => {
    const result = { unit: reference.indicators[key].unit };
    for (const field of ['electricity_operation', 'diesel_heating', 'other_lifecycle', 'total', 'diesel_comparator_total', 'saving']) {
      result[field] = total(vehicles.map(vehicle => vehicle.indicators[key][field] * vehicle.vehicle_count));
    }
    for (const field of ['phases', 'diesel_comparator_phases', 'diesel_heating_phases']) {
      result[field] = Object.fromEntries(phases.map(phase => [phase,
        total(vehicles.map(vehicle => vehicle.indicators[key][field][phase] * vehicle.vehicle_count))]));
    }
    return [key, result];
  }));
  const dc = total(vehicles.map(vehicle => vehicle.dc_kwh * vehicle.vehicle_count));
  return { ...structuredClone(reference), vehicles, indicators, vehicle_count: physical.length, representative_count: vehicles.length,
    annual_km: total(vehicles.map(vehicle => vehicle.annual_km * vehicle.vehicle_count)),
    energy_boundary: { policy: 'grid-to-bus-dc-94-v1', dc_kwh: dc, grid_kwh: dc / .94,
      charging_losses_kwh: dc / .94 - dc, grid_to_bus_efficiency: .94 },
  };
}
