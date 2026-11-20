// Shared frozen two-bus design for annual assessment and TCO regressions.
export const yearlyFleetConfiguration = () => ({
  config: { fixedConfiguration: {
    busModelId: 'bus', fleet: { vehicleCount: 2 },
    investment: { rows: [
      { id: 'a', packs: 14, capacity: 700, busCost: 800000, batteryCost: 84000 },
      { id: 'b', packs: 14, capacity: 700, busCost: 800000, batteryCost: 84000 },
    ] },
    infrastructure: { dataAvailable: true, stations: [{ selected: true, installationCostChf: 400000,
      costBreakdown: { chargers_cost_chf: 110000, site_fixed_cost_chf: 250000, site_power_cost_chf: 40000 } }] },
  } },
  results: { yearlyTotals: { distanceKm: 100000, totalEnergyKwh: 160000 }, shiftResults: [
    { shiftId: 'a', status: 'completed', yearlyTotals: { distanceKm: 80000, totalEnergyKwh: 144000 } },
    { shiftId: 'b', status: 'completed', yearlyTotals: { distanceKm: 20000, totalEnergyKwh: 16000 } },
  ] },
});
