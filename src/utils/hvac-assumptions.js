export const summarizeHvacAssumptions = (payload) => {
  const runs = Array.isArray(payload?.runs) ? payload.runs : [];
  const groups = new Map();
  for (const run of runs) {
    const assumptions = run.assumptions ?? {};
    const temperature = Number(run.temperature_c);
    const key = `${assumptions.policy_id}:${temperature}`;
    const group = groups.get(key) ?? { temperature, policy: assumptions.policy_id,
      ghiWeighted: 0, minutes: 0, tripKwh: 0, terminalKwh: 0,
      hasTerminal: false, solarUsed: assumptions.solar_used !== false, occurrences: assumptions.cluster_occurrences ?? 1 };
    const ghi = assumptions.ghi_reference_wm2 ?? assumptions.ghi_trip_weighted_mean_wm2;
    const minutes = Number(assumptions.trip_minutes) || 1;
    if (Number.isFinite(ghi)) { group.ghiWeighted += ghi * minutes; group.minutes += minutes; }
    const components = run.components ?? {};
    group.tripKwh += Number(components.total_hvac_in_trip_electrical_kwh ?? components.total_hvac_electrical_kwh) || 0;
    group.terminalKwh += Number(components.total_hvac_terminal_electrical_kwh) || 0;
    group.hasTerminal ||= components.total_hvac_terminal_electrical_kwh != null;
    groups.set(key, group);
  }
  return {
    runs,
    policies: [...new Set(runs.map(run => run.assumptions?.policy_id).filter(Boolean))],
    rows: [...groups.values()].sort((a,b) => a.temperature-b.temperature).map(row => ({ ...row,
      ghi: row.minutes ? row.ghiWeighted / row.minutes : row.solarUsed && row.policy === 'legacy-fixed-100-v1' ? 100 : null })),
    timezones: [...new Set(runs.map(run => run.assumptions?.agency_timezone).filter(Boolean))],
    years: [...new Set(runs.map(run => run.assumptions?.typical_year).filter(Boolean))],
    weatherChecksums: [...new Set(runs.map(run => run.assumptions?.weather_snapshot_sha256).filter(Boolean))],
  };
};
