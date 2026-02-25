/**
 * Default auxiliary consumption profile for bus models.
 *
 * This data is NOT user-editable — it is injected automatically
 * into the specs payload sent to the API.
 */

export const AUXILIARY_CONSUMPTION_KW_DEFAULTS = {
  default: {
    consumption_kw: [24, 16, 12, 8, 9, 10, 16],
    temperature_celsius: [-5, 0, 5, 10, 15, 20, 25],
  },
};
