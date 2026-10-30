const number = value => {
  if (value == null || (typeof value === 'string' && !value.trim()) || typeof value === 'boolean') return null;
  const result = Number(value);
  return Number.isFinite(result) && result >= 0 ? result : null;
};
const completeSum = values => values.length && values.every(value => value !== null)
  ? values.reduce((sum, value) => sum + value, 0) : null;

// One bus per selected vehicle block. Never price virtual diagnostic excess packs.
export function buildFleetInvestment(run = {}, currentModel = {}) {
  const results = run.results ?? {};
  const batteries = results.battery_results ?? {};
  const summaries = new Map((results.per_bus_summary ?? []).map(row => [row.shift_id, row]));
  const ids = [...new Set([...(run.input_params?.shift_ids ?? []), ...Object.keys(batteries), ...summaries.keys()])];
  const sharedModelId = run.bus_model_id ?? run.input_params?.bus_model_id;
  const fallbackAllowed = sharedModelId && currentModel.id === sharedModelId;
  const rows = ids.map(id => {
    const battery = batteries[id] ?? {};
    const summary = summaries.get(id) ?? {};
    const packs = number(battery.optimized_packs ?? summary.optimized_packs);
    const required = number(battery.required_total_packs);
    const packSize = number(battery.pack_size_kwh) ?? (
      number(battery.max_physical_packs) > 0 && number(battery.max_physical_kwh) !== null
        ? number(battery.max_physical_kwh) / number(battery.max_physical_packs) : null);
    const capacity = number(battery.selected_nominal_kwh) ?? (
      packs !== null && packSize !== null ? packs * packSize :
        required === null || required === packs ? number(battery.optimized_kwh) : null);
    const snapshot = battery.investment_cost_source === 'bus_model_snapshot';
    let busCost = number(battery.bus_cost_chf);
    let packCost = number(battery.battery_pack_cost_chf);
    let usesCurrentPrices = false;
    if (!snapshot && fallbackAllowed) {
      if (busCost === null && number(currentModel.cost) !== null) {
        busCost = number(currentModel.cost);
        usesCurrentPrices = true;
      }
      if (packCost === null && number(currentModel.battery_pack_cost) !== null) {
        packCost = number(currentModel.battery_pack_cost);
        usesCurrentPrices = true;
      }
    }
    const batteryCost = packs !== null && packCost !== null
      ? packs * packCost : number(battery.selected_battery_cost_chf);
    return {
      id, name: summary.shift_name ?? battery.shift_name ?? id,
      modelName: battery.bus_model_name ?? summary.bus_model_name ?? '',
      packs, capacity, busCost, packCost, batteryCost,
      totalCost: busCost !== null && batteryCost !== null ? busCost + batteryCost : null,
      usesCurrentPrices,
    };
  });
  return {
    rows,
    totals: Object.fromEntries(['packs', 'capacity', 'busCost', 'batteryCost', 'totalCost']
      .map(key => [key, completeSum(rows.map(row => row[key]))])),
    usesCurrentPrices: rows.some(row => row.usesCurrentPrices),
    missingPrices: rows.some(row => row.totalCost === null),
    verified: results.electrification_feasible === true,
  };
}
