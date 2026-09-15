export const buildLifecyclePhaseBar = (label, phases, backendResult = null, divisor = 1) => {
  const phaseTotal = phases.reduce((sum, phase) => sum + phase.value, 0);
  const backendTotal = backendResult?.total == null ? null : Number(backendResult.total);
  return {
    label,
    phases,
    total:
      Number.isFinite(backendTotal) && Number.isFinite(divisor) && divisor > 0
        ? backendTotal / divisor
        : phaseTotal,
  };
};
