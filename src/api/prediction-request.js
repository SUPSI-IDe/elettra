const text = (value) =>
  value === null || value === undefined ? "" : String(value);

/**
 * Build a prediction-run request without selecting a model by default.
 *
 * The backend owns the deployed model through CONSUMPTION_MODEL_RELEASE and
 * persists the resolved release on every prediction run.  An explicit model
 * is included only for callers that deliberately select one.
 */
export const buildPredictionRunRequestBody = ({
  shift_ids,
  bus_model_id,
  model_name,
  external_temp_celsius,
  occupancy_percent,
  auxiliary_heating_type,
  quantiles,
  num_battery_packs,
  contextual_parameters,
  yearly_analysis_id,
} = {}) => {
  const body = {
    shift_ids,
    bus_model_id,
    external_temp_celsius: Number(external_temp_celsius),
    occupancy_percent: Number(occupancy_percent),
    auxiliary_heating_type,
  };

  const explicitModelName = text(model_name).trim();
  if (explicitModelName) body.model_name = explicitModelName;
  if (Array.isArray(quantiles) && quantiles.length) body.quantiles = quantiles;
  if (num_battery_packs != null) {
    body.num_battery_packs = Number(num_battery_packs);
  }
  if (contextual_parameters && typeof contextual_parameters === "object") {
    body.contextual_parameters = contextual_parameters;
  }
  if (yearly_analysis_id) body.yearly_analysis_id = yearly_analysis_id;

  return body;
};
