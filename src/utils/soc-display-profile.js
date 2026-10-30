// The solver books a trip's consumption in the arrival-minute balance.
// For display only, spread that energy between departure and arrival, leaving
// every charging increment and the final stored SOC unchanged.
export function interpolateTripConsumption(soc, profile, intervals, energies) {
  if (!Array.isArray(soc) || !Array.isArray(intervals) || !Array.isArray(energies)
      || intervals.length !== energies.length || (profile.step_minutes ?? 1) !== 1) return soc;
  const displayed = [...soc];
  intervals.forEach((trip, index) => {
    const start = trip.departure_minute - profile.first_minute;
    const end = trip.arrival_minute - profile.first_minute;
    const energy = energies[index];
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0
        || end <= start || end + 1 >= soc.length || !Number.isFinite(energy)
        // Regenerative surplus can be curtailed at max SOC: don't redistribute
        // it without knowing the accepted amount.
        || energy < 0) return;
    for (let minute = start + 1; minute <= end; minute++) {
      displayed[minute] -= energy * (minute - start) / (end - start);
    }
  });
  return displayed;
}
