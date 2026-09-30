// Reporting boundary only. All optimization power limits remain DC.
export const GRID_TO_BUS_EFFICIENCY = 0.94;
export const gridFromDc = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error("Invalid DC energy/power");
  return number / GRID_TO_BUS_EFFICIENCY;
};
