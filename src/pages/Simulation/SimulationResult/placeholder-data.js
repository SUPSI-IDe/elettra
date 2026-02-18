/**
 * Placeholder simulation result data.
 * Replace with real API responses once the endpoint is implemented.
 */

/**
 * Compute placeholder results based on custom variable inputs.
 * Values are rough estimates for demonstration purposes.
 */
export const computePlaceholderResults = ({
  dieselPrice = 1.3,
  dieselConsumption = 2,
  passengers = 60,
  electricityPrice = 0.02,
  chargingStrategy = "depot_only",
} = {}) => {
  // Annual km driven (placeholder: 60,000 km/year)
  const annualKm = 60000;
  const busLifeYears = 10;
  const passengerFactor = passengers / 100;

  // --- Diesel bus costs ---
  const dieselFuelCost = dieselPrice * dieselConsumption * annualKm;
  const dieselMaintenance = 18000;
  const dieselOtherCosts = 8000;
  const dieselInitialCost = 250000;

  // --- Electric bus costs ---
  const electricConsumptionKwh = 1.2; // kWh per km
  const electricEnergyCost =
    electricityPrice * electricConsumptionKwh * annualKm;
  const electricMaintenance = 10000;
  const chargerCostAnnual = chargingStrategy === "depot_only" ? 5000 : 12000;
  const electricOtherCosts = 4000;
  const electricInitialCost = 450000;

  // --- Annual costs breakdown ---
  const annualCosts = {
    diesel: {
      consumptionAndMaintenance: dieselFuelCost + dieselMaintenance,
      chargers: 0,
      otherCosts: dieselOtherCosts,
      get total() {
        return this.consumptionAndMaintenance + this.chargers + this.otherCosts;
      },
    },
    electric: {
      consumptionAndMaintenance: electricEnergyCost + electricMaintenance,
      chargers: chargerCostAnnual,
      otherCosts: electricOtherCosts,
      get total() {
        return this.consumptionAndMaintenance + this.chargers + this.otherCosts;
      },
    },
  };

  // --- Break point analysis (cumulative cost over years) ---
  const breakPointData = [];
  for (let year = 0; year <= busLifeYears; year++) {
    breakPointData.push({
      year,
      diesel: dieselInitialCost + annualCosts.diesel.total * year,
      electric: electricInitialCost + annualCosts.electric.total * year,
    });
  }

  // --- Efficiency: CHF/km stacked bar data ---
  const dieselCostPerKm = (dieselFuelCost + dieselMaintenance) / annualKm;
  const dieselChargerPerKm = 0;
  const dieselOtherPerKm = dieselOtherCosts / annualKm;

  const electricCostPerKm =
    (electricEnergyCost + electricMaintenance) / annualKm;
  const electricChargerPerKm = chargerCostAnnual / annualKm;
  const electricOtherPerKm = electricOtherCosts / annualKm;

  const efficiencyCostPerKm = {
    diesel: {
      consumptionAndMaintenance: dieselCostPerKm,
      chargers: dieselChargerPerKm,
      otherCosts: dieselOtherPerKm,
      get total() {
        return this.consumptionAndMaintenance + this.chargers + this.otherCosts;
      },
    },
    electric: {
      consumptionAndMaintenance: electricCostPerKm,
      chargers: electricChargerPerKm,
      otherCosts: electricOtherPerKm,
      get total() {
        return this.consumptionAndMaintenance + this.chargers + this.otherCosts;
      },
    },
  };

  // --- Efficiency: line chart (cumulative cost/km over years) ---
  const efficiencyLineData = [];
  for (let year = 0; year <= busLifeYears; year++) {
    // Amortised total cost per km including initial purchase
    const dieselTotalPerKm =
      (dieselInitialCost + annualCosts.diesel.total * year) /
      (annualKm * Math.max(year, 1));
    const electricTotalPerKm =
      (electricInitialCost + annualCosts.electric.total * year) /
      (annualKm * Math.max(year, 1));
    efficiencyLineData.push({
      year,
      diesel: dieselTotalPerKm,
      electric: electricTotalPerKm,
    });
  }

  // --- Emissions saved (electric bus savings vs diesel) ---
  const dieselEmissionFactor = 2.68; // kg CO2 per liter of diesel
  const dieselNOFactor = 0.0046; // kg NO per liter of diesel
  const dieselPM10Factor = 0.00036; // kg PM10 per liter of diesel

  const dieselCO2Annual =
    (dieselConsumption * annualKm * dieselEmissionFactor) / 1000; // tonnes/year
  const dieselNOAnnual = (dieselConsumption * annualKm * dieselNOFactor) / 1000; // tonnes/year
  const dieselPM10Annual = dieselConsumption * annualKm * dieselPM10Factor; // kg/year

  // Electric bus has near-zero direct emissions
  const electricCO2Annual = 0.72; // tonnes/year (indirect grid emissions)
  const electricNOAnnual = 0; // tonnes/year
  const electricPM10Annual = 0; // kg/year

  const emissionsSaved = {
    co2: dieselCO2Annual - electricCO2Annual, // ton/year saved
    no: dieselNOAnnual - electricNOAnnual, // ton/year saved
    pm10: dieselPM10Annual - electricPM10Annual, // kg/year saved
  };

  // --- Emissions saved line chart (cumulative savings over years) ---
  const totalAnnualSaved = emissionsSaved.co2 + emissionsSaved.no; // tonnes/year combined
  const emissionsSavedLine = [];
  for (let year = 0; year <= busLifeYears; year++) {
    emissionsSavedLine.push({
      year,
      saved: totalAnnualSaved * year,
    });
  }

  return {
    annualCosts,
    breakPointData,
    efficiencyCostPerKm,
    efficiencyLineData,
    emissionsSaved,
    emissionsSavedLine,
  };
};
