import { evaluateProjectDesign } from '../src/utils/yearly-fleet-tco.js';

export function fixtureProjectTco({ scopes, horizon, rate }) {
  return { scopes: scopes.map(({ id, km, electric, diesel }) => ({
    id, electric: evaluateProjectDesign(electric, km, horizon, rate),
    diesel: evaluateProjectDesign(diesel, km, horizon, rate),
  })) };
}
