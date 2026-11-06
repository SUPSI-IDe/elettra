import assert from 'node:assert/strict';
import test from 'node:test';
import {datasetKey, dateLabel, sortDatasets, datasetSummaryHtml, provenanceForShift} from '../src/utils/gtfs-datasets.js';
const older = {gtfs_year:2026, gtfs_file_date:'2025-09-27', valid_from:'2025-12-14', valid_to:'2026-12-12'};
const newest = {gtfs_year:2027, gtfs_file_date:'2026-11-04', valid_from:'2026-12-13', valid_to:'2027-12-11'};
const t = key => key;
test('default edition is the newest year then file date without mutating the catalog', () => {
  const sameYear = {...newest, gtfs_file_date:'2026-08-22'};
  const catalog = [sameYear, older, newest];
  assert.deepEqual(sortDatasets(catalog), [newest,sameYear,older]);
  assert.equal(catalog[0], sameYear);
  assert.notEqual(datasetKey(sameYear), datasetKey(newest));
  assert.equal(dateLabel(newest.gtfs_file_date), '04/11/2026');
});
test('summary distinguishes missing GTFS, unavailable metadata, mixed editions and calendar range', () => {
  assert.match(datasetSummaryHtml([], t), /gtfs.none/);
  assert.match(datasetSummaryHtml(undefined, t), /gtfs.unavailable/);
  const html = datasetSummaryHtml([older,newest], t);
  assert.match(html, /gtfs.mixed/);
  assert.match(html, /13\/12\/2026–11\/12\/2027/);
  assert.doesNotMatch(datasetSummaryHtml([{...newest,gtfs_year:'<script>'}], t), /<script>/);
});
test('recorded provenance remains authoritative even after the current shift changes', () => {
  const snapshot = {version:1, shifts:{one:[older],empty:[]}};
  for (const record of [{input_params:{gtfs_provenance:snapshot}},{features:{gtfs_provenance:snapshot}}]) {
    assert.deepEqual(provenanceForShift(record,'one',{gtfs_datasets:[newest]}), {datasets:[older],source:'recorded'});
    assert.deepEqual(provenanceForShift(record,'empty',{gtfs_datasets:[newest]}), {datasets:[],source:'recorded'});
  }
  assert.deepEqual(provenanceForShift({},'one',{gtfs_datasets:[older]}), {datasets:[older],source:'current'});
  assert.deepEqual(provenanceForShift({},'deleted',null), {datasets:undefined,source:'current'});
});
