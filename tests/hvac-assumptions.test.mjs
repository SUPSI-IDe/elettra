import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeHvacAssumptions } from '../src/utils/hvac-assumptions.js';

test('annual GHI uses trip minutes across duties and HVAC components remain separate', () => {
  const runs = [10,30].map((minutes,i) => ({ temperature_c: 9.6,
    assumptions: { policy_id: 'annual-pvgis-local-cap10-v1', trip_minutes: minutes,
      ghi_trip_weighted_mean_wm2: i ? 200 : 100, cluster_occurrences: 65,
      weather_snapshot_sha256: 'same', agency_timezone: 'Europe/Zurich', typical_year: 2030 },
    components: { total_hvac_in_trip_electrical_kwh: 10, total_hvac_terminal_electrical_kwh: 3,
      total_hvac_electrical_kwh: 13 } }));
  const result = summarizeHvacAssumptions({runs});
  assert.equal(result.rows[0].ghi, 175);
  assert.equal(result.rows[0].tripKwh, 20);
  assert.equal(result.rows[0].terminalKwh, 6);
  assert.equal(result.rows[0].occurrences, 65);
  assert.deepEqual(result.weatherChecksums, ['same']);
});

test('historical summaries retain fixed GHI and do not invent terminal consumption', () => {
  const result = summarizeHvacAssumptions({ runs: [{temperature_c: 5,
    assumptions: {policy_id: 'legacy-fixed-100-v1'}, components: {total_hvac_electrical_kwh: 15}}] });
  assert.equal(result.rows[0].ghi, 100);
  assert.equal(result.rows[0].tripKwh, 15);
  assert.equal(result.rows[0].hasTerminal, false);
  const greybox = summarizeHvacAssumptions({runs:[{temperature_c:5,
    assumptions:{policy_id:'legacy-fixed-100-v1',solar_used:false}}]});
  assert.equal(greybox.rows[0].ghi, null);
});

test('feasibility retains one solar value at each selected temperature', () => {
  const result = summarizeHvacAssumptions({ runs: [17,10,25].map(temperature => ({temperature_c:temperature,
    assumptions:{policy_id:'feasibility-ghi-temperature-cap10-v1',ghi_reference_wm2:({10:50,17:800,25:1000})[temperature]}})) });
  assert.deepEqual(result.rows.map(row=>[row.temperature,row.ghi]), [[10,50],[17,800],[25,1000]]);
});
