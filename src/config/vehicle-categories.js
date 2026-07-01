export const LCA_SOURCE = "Energie Schweiz LCA database";

export const VEHICLE_CATEGORIES = [
  {
    key: "midi_electric_bus_9m",
    label: "Midi electric bus — 9 m",
    lengthM: 9,
    size: "9m",
    defaultSpecLength: "9",
    defaultPassengerCapacity: 34,
    lcaVehicleName: "Midibus9mBEV-depot2020",
    tooltipI18nKey: "buses.vehicle_category_tooltip_midi_9m",
    legacySizes: ["9m", "9", "9.0", "9.0m"],
  },
  {
    key: "standard_electric_bus_12_13m",
    label: "Standard electric bus — 12/13 m",
    lengthM: 13,
    size: "13m",
    defaultSpecLength: "12",
    defaultPassengerCapacity: 64,
    lcaVehicleName: "City busSingle deck13m-cityBEV-depot2020",
    tooltipI18nKey: "buses.vehicle_category_tooltip_standard_12_13m",
    legacySizes: [
      "12m",
      "12",
      "12.0",
      "12.0m",
      "13m",
      "13",
      "13.0",
      "13.0m",
      "13m-city",
    ],
  },
  {
    key: "articulated_electric_bus_18m",
    label: "Articulated electric bus — 18 m",
    lengthM: 18,
    size: "18m",
    defaultSpecLength: "18",
    defaultPassengerCapacity: 150,
    lcaVehicleName: "City busArticulated18mBEV-depot2020",
    tooltipI18nKey: "buses.vehicle_category_tooltip_articulated_18m",
    legacySizes: ["18m", "18", "18.0", "18.0m"],
  },
];

const normalizeValue = (value) =>
  value === null || value === undefined
    ? ""
    : String(value).trim().toLowerCase();

const normalizeSize = (value) => normalizeValue(value).replace(/\s+/g, "");

export const getVehicleCategoryByKey = (key) =>
  VEHICLE_CATEGORIES.find((category) => category.key === key) || null;

export const getVehicleCategoryByLcaName = (vehicleName) => {
  const normalized = normalizeValue(vehicleName);
  return (
    VEHICLE_CATEGORIES.find(
      (category) => normalizeValue(category.lcaVehicleName) === normalized
    ) || null
  );
};

export const inferVehicleCategoryFromSpecs = (specs = {}) => {
  const byKey = getVehicleCategoryByKey(specs.vehicle_reference_key);
  if (byKey) return byKey;

  const byLcaName = getVehicleCategoryByLcaName(
    specs.lca?.vehicle_name ?? specs.lca_vehicle_name
  );
  if (byLcaName) return byLcaName;

  const sizeCandidates = [
    specs.size,
    specs.bus_size,
    specs.lca_size,
    specs.bus_length_m,
    specs.length_m,
  ]
    .map(normalizeSize)
    .filter(Boolean);

  return (
    VEHICLE_CATEGORIES.find((category) =>
      category.legacySizes.some((legacySize) =>
        sizeCandidates.includes(normalizeSize(legacySize))
      )
    ) || null
  );
};

export const buildVehicleCategorySpecs = (
  category,
  passengerCapacity,
  lcaVehicle = null
) => {
  if (!category) return {};
  const normalizedPassengerCapacity = Number(passengerCapacity);
  const resolvedPassengerCapacity = Number.isFinite(normalizedPassengerCapacity)
    ? normalizedPassengerCapacity
    : category.defaultPassengerCapacity;

  const lcaVehicleId = lcaVehicle?.id ?? lcaVehicle?.vehicle_id ?? null;

  return {
    vehicle_reference_key: category.key,
    size: category.size,
    length_m: category.lengthM,
    bus_length_m: category.lengthM,
    passenger_capacity: resolvedPassengerCapacity,
    max_passengers: resolvedPassengerCapacity,
    lca: {
      ...(lcaVehicleId ? { vehicle_id: lcaVehicleId } : {}),
      vehicle_name: category.lcaVehicleName,
      passenger_capacity: resolvedPassengerCapacity,
      source: LCA_SOURCE,
    },
  };
};

export const getCuratedLcaVehicle = (vehicles = [], category) => {
  if (!category || !Array.isArray(vehicles)) return null;
  return (
    vehicles.find((vehicle) => {
      const name = vehicle?.name ?? vehicle?.vehicle_name ?? "";
      const isActive = vehicle?.active !== false && vehicle?.is_active !== false;
      return (
        isActive &&
        normalizeValue(name) === normalizeValue(category.lcaVehicleName)
      );
    }) || null
  );
};
