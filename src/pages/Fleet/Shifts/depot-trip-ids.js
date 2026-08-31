const requireTripId = (trip, label) => {
  const id = typeof trip?.id === "string" ? trip.id.trim() : "";
  if (!id) {
    throw new Error(`Missing ${label} auxiliary trip id.`);
  }
  return id;
};

/**
 * Build the shift structure with mandatory depot connections.
 */
export const buildCompleteShiftTripIds = ({
  scheduledTripIds,
  departureTrip,
  returnTrip,
} = {}) => {
  if (!Array.isArray(scheduledTripIds) || scheduledTripIds.length === 0) {
    throw new Error("At least one scheduled trip id is required.");
  }

  const normalizedScheduledIds = scheduledTripIds.map((id) =>
    typeof id === "string" ? id.trim() : ""
  );
  if (normalizedScheduledIds.some((id) => !id)) {
    throw new Error("Every scheduled trip must have an id.");
  }

  return [
    requireTripId(departureTrip, "departure"),
    ...normalizedScheduledIds,
    requireTripId(returnTrip, "return"),
  ];
};
