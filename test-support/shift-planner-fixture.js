export const plannerCatalog = [
  { id: "night-other", route_id: "line", line: "1", from_stop_id: "other", to_stop_id: "last", from_name: "Other terminus", to_name: "Last terminus", first_arrival: null, departure_time: "24:15:00", arrival_time: "24:20:00" },
  { id: "night-b", route_id: "line", line: "1", from_stop_id: "b2", to_stop_id: "last", from_parent: "station", from_name: "Station platform 2", to_name: "Last terminus", first_arrival: "24:15:00", departure_time: "24:15:00", arrival_time: "24:35:00" },
  { id: "too-early", route_id: "line", line: "1", from_stop_id: "a", to_stop_id: "b1", from_name: "Town", to_name: "Station platform 1", departure_time: "23:30:00", arrival_time: "23:40:00" },
  { id: "night-c", route_id: "line", line: "1", from_stop_id: "b3", to_stop_id: "last", from_parent: "station", from_name: "Station platform 3", to_name: "Last terminus", first_arrival: "24:15:00", departure_time: "24:17:00", arrival_time: "24:25:00" },
  { id: "night-a", route_id: "line", line: "1", from_stop_id: "a", to_stop_id: "b1", to_parent: "station", from_name: "Town", to_name: "Station platform 1", first_arrival: "23:50:00", departure_time: "23:55:00", arrival_time: "24:15:00" },
];

export const plannerApi = ({ path }) => {
  if (path.endsWith("/shift-planner/catalog")) return { json: plannerCatalog };
  if (path.endsWith("/shift-planner/route")) return { json: { duration_seconds: 900, distance_m: 3500 } };
};

export const plannerField = (page, name) => page.locator(`[data-field="${name}"]`);
export const plannerAction = (page, name) => page.locator(`[data-action="${name}"]`);
export const plannerTrip = (page, id) => page.locator(`[data-role="catalog"] [data-trip-id="${id}"] :is([data-action="select-trip"], [data-action="add-direct-trip"])`);

export const startPlanner = async (page) => {
  await plannerField(page, "weekday").selectOption("monday");
  await plannerField(page, "depot").selectOption("depot");
  await plannerField(page, "start-time").fill("23:45");
  await plannerField(page, "start-time").press("Tab");
  await plannerField(page, "line").selectOption("line");
};
