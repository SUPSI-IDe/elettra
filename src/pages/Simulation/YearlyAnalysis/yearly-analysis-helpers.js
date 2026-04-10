/**
 * Reusable data transformation helpers for yearly analysis tables and charts.
 *
 * All functions accept raw scenario data from `features.results` and return
 * derived structures ready for rendering. Missing quantile fields are handled
 * gracefully — old analyses without uncertainty data still produce valid output.
 */

const fin = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/* ── Sorting ──────────────────────────────────────────────────────── */

export const sortByTemperature = (scenarios) =>
  [...scenarios].sort((a, b) => (a.temperature ?? 0) - (b.temperature ?? 0));

/* ── Quantile helpers ─────────────────────────────────────────────── */

export const hasQuantiles = (q) =>
  q != null && (q.q05 != null || q.q50 != null || q.q95 != null);

export const medianOrFallback = (quantiles, scalar) =>
  fin(quantiles?.q50) ?? fin(scalar);

export const formatUncertainty = (q, decimals = 1) => {
  if (!hasQuantiles(q)) return null;
  const q50 = fin(q.q50);
  const q05 = fin(q.q05);
  const q95 = fin(q.q95);
  const mid = q50 != null ? q50.toFixed(decimals) : "—";
  if (q05 != null && q95 != null) return `${mid} (${q05.toFixed(decimals)}–${q95.toFixed(decimals)})`;
  return mid;
};

/* ── Per-scenario derived fields ──────────────────────────────────── */

export const enrichScenario = (sr) => {
  if (sr.error || !sr.kpis) return { ...sr, derived: null };

  const k = sr.kpis;
  const occ = sr.occurrences ?? 0;

  const totalKwh = fin(k.totalEnergyKwh);
  const drvKwh = fin(k.drivetrainEnergyKwh);
  const auxKwh = fin(k.auxiliaryEnergyKwh);
  const distKm = fin(k.distanceKm);
  const epk = fin(k.energyPerKm);

  const yearlyTotal = totalKwh != null ? totalKwh * occ : null;
  const yearlyDrv = drvKwh != null ? drvKwh * occ : null;
  const yearlyAux = auxKwh != null ? auxKwh * occ : null;
  const yearlyDist = distKm != null ? distKm * occ : null;

  const q = k.quantiles;
  const yearlyQ05 = hasQuantiles(q) && fin(q.q05) != null ? q.q05 * occ : null;
  const yearlyQ50 = hasQuantiles(q) && fin(q.q50) != null ? q.q50 * occ : null;
  const yearlyQ95 = hasQuantiles(q) && fin(q.q95) != null ? q.q95 * occ : null;

  const epkQ = k.consumptionPerKmQuantiles;

  return {
    ...sr,
    derived: {
      yearlyTotal,
      yearlyDrv,
      yearlyAux,
      yearlyDist,
      yearlyQ05,
      yearlyQ50,
      yearlyQ95,
      efficiencyMedian: medianOrFallback(epkQ, epk),
      efficiencyQ05: fin(epkQ?.q05),
      efficiencyQ95: fin(epkQ?.q95),
      auxiliaryPerKm: fin(k.auxiliaryPerKmKwh),
      drivetrainPerKm: fin(k.drivetrainPerKmKwh),
      drvPerKmQ05: fin(k.drivetrainPerKmQuantiles?.q05),
      drvPerKmQ50: fin(k.drivetrainPerKmQuantiles?.q50),
      drvPerKmQ95: fin(k.drivetrainPerKmQuantiles?.q95),
    },
  };
};

export const enrichAllScenarios = (scenarioResults) =>
  sortByTemperature((scenarioResults ?? []).map(enrichScenario));

/* ── Yearly aggregation ───────────────────────────────────────────── */

export const computeYearlySummary = (enriched, yearlyTotals = {}, nominalDailyKm = null) => {
  const validScenarios = enriched.filter((s) => s.derived);
  const totalOcc = validScenarios.reduce((s, sr) => s + (sr.occurrences ?? 0), 0);

  const energy = fin(yearlyTotals.totalEnergyKwh);
  const drv = fin(yearlyTotals.drivetrainEnergyKwh);
  const aux = fin(yearlyTotals.auxiliaryEnergyKwh);
  const dist = fin(yearlyTotals.distanceKm);
  const nomDist = fin(nominalDailyKm) != null && totalOcc > 0 ? nominalDailyKm * totalOcc : null;

  const avgEfficiency = energy != null && dist != null && dist > 0 ? energy / dist : null;
  const auxShare = energy != null && aux != null && energy > 0 ? (aux / energy) * 100 : null;
  const drvShare = energy != null && drv != null && energy > 0 ? (drv / energy) * 100 : null;

  return { energy, drv, aux, dist, nomDist, avgEfficiency, auxShare, drvShare, totalOcc };
};

/* ── Yearly contribution shares ───────────────────────────────────── */

export const computeContributions = (enriched) => {
  const valid = enriched.filter((s) => s.derived);
  const grandTotal = valid.reduce((s, sr) => s + (sr.derived.yearlyTotal ?? 0), 0);

  return valid.map((sr) => ({
    label: sr.label,
    temperature: sr.temperature,
    occurrences: sr.occurrences,
    yearlyDrv: sr.derived.yearlyDrv,
    yearlyAux: sr.derived.yearlyAux,
    yearlyTotal: sr.derived.yearlyTotal,
    yearlyQ05: sr.derived.yearlyQ05,
    yearlyQ50: sr.derived.yearlyQ50,
    yearlyQ95: sr.derived.yearlyQ95,
    share: grandTotal > 0 && sr.derived.yearlyTotal != null
      ? (sr.derived.yearlyTotal / grandTotal) * 100
      : null,
  }));
};

/* ── Chart-ready data: Plot 1 (efficiency by temperature) ─────────── */

export const buildEfficiencyByTemp = (enriched) =>
  enriched
    .filter((s) => s.derived)
    .map((s) => ({
      label: s.label,
      temperature: s.temperature,
      occurrences: s.occurrences,
      distanceKm: fin(s.kpis?.distanceKm),
      efficiency: s.derived.efficiencyMedian,
      q05: s.derived.efficiencyQ05,
      q95: s.derived.efficiencyQ95,
      auxPerKm: s.derived.auxiliaryPerKm,
      drvPerKm: s.derived.drivetrainPerKm,
    }));

/* ── Chart-ready data: Plot 2 (annual energy contribution) ────────── */

export const buildAnnualContribution = (enriched) =>
  enriched
    .filter((s) => s.derived)
    .map((s) => ({
      label: s.label,
      temperature: s.temperature,
      occurrences: s.occurrences,
      yearlyDrv: s.derived.yearlyDrv ?? 0,
      yearlyAux: s.derived.yearlyAux ?? 0,
      yearlyTotal: s.derived.yearlyTotal ?? 0,
      yearlyQ05: s.derived.yearlyQ05,
      yearlyQ50: s.derived.yearlyQ50,
      yearlyQ95: s.derived.yearlyQ95,
    }));
