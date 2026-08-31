const readTripId = (trip) =>
  typeof trip?.id === "string" ? trip.id.trim() : "";

/**
 * Normalize auxiliary-trip responses across backend deployments.
 *
 * Current backends return `{ trip, elevation_job }`, while older versions
 * returned the created trip directly. Frontend callers always receive the
 * trip record itself.
 */
export const normalizeAuxiliaryTripResponse = (payload) => {
  const trip = payload?.trip ?? payload;

  if (!readTripId(trip)) {
    throw new Error("Auxiliary trip response is missing trip.id.");
  }

  return trip;
};
