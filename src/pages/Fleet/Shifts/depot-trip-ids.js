const requireTripId = (trip, label) => {
  const id = typeof trip?.id === "string" ? trip.id.trim() : "";
  if (!id) {
    throw Object.assign(new Error(`Missing ${label} auxiliary trip id.`), { code: "invalid_auxiliary_trip_response" });
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
    throw Object.assign(new Error("At least one scheduled trip id is required."), { code: "invalid_shift_trip" });
  }

  const normalizedScheduledIds = scheduledTripIds.map((id) =>
    typeof id === "string" ? id.trim() : ""
  );
  if (normalizedScheduledIds.some((id) => !id)) {
    throw Object.assign(new Error("Every scheduled trip must have an id."), { code: "invalid_shift_trip" });
  }

  return [
    requireTripId(departureTrip, "departure"),
    ...normalizedScheduledIds,
    requireTripId(returnTrip, "return"),
  ];
};
