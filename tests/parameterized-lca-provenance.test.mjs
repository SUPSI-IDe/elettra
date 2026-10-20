import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { translations } from "../src/i18n/translations.js";
import {
  getParameterizedLcaDisclosure,
  mapParameterizedLca,
} from "../src/pages/Simulation/YearlyAnalysis/parameterized-lca.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/grid94-lca.json", import.meta.url), "utf8"),
).base;

test("collects the provenance, energy policy, limitations and vehicle warnings returned by the backend", () => {
  const raw = structuredClone(fixture);
  raw.vehicles[0].warnings = ["Battery warning", "Battery warning", "  Range warning  "];
  const before = structuredClone(raw);

  assert.deepEqual(getParameterizedLcaDisclosure(raw), {
    methodologyVersion: raw.methodology_version,
    dataVersion: raw.provenance.data_version,
    dataSource: raw.provenance.base_url,
    dieselHeatingMethodology: raw.provenance.diesel_heating_methodology,
    energyPolicy: raw.energy_boundary.policy,
    gridToBusEfficiency: raw.energy_boundary.grid_to_bus_efficiency,
    limitations: raw.limitations,
    warnings: ["Battery warning", "Range warning"],
  });
  assert.deepEqual(raw, before, "building the disclosure must not mutate the backend response");
});

test("optional provenance fields and empty lists produce a stable disclosure", () => {
  assert.deepEqual(getParameterizedLcaDisclosure({
    methodology_version: " method-v1 ",
    provenance: { data_version: " data-v1 ", base_url: "" },
    energy_boundary: { policy: " policy-v1 ", grid_to_bus_efficiency: NaN },
    limitations: [],
    vehicles: [{ warnings: [] }],
  }), {
    methodologyVersion: "method-v1",
    dataVersion: "data-v1",
    dataSource: null,
    dieselHeatingMethodology: null,
    energyPolicy: "policy-v1",
    gridToBusEfficiency: null,
    limitations: [],
    warnings: [],
  });

  assert.deepEqual(getParameterizedLcaDisclosure(null), {
    methodologyVersion: null,
    dataVersion: null,
    dataSource: null,
    dieselHeatingMethodology: null,
    energyPolicy: null,
    gridToBusEfficiency: null,
    limitations: [],
    warnings: [],
  });
});

test("mapped LCA state keeps provenance and limitations available to all consumers", () => {
  const mapped = mapParameterizedLca(structuredClone(fixture));

  assert.deepEqual(mapped.structured.provenance, fixture.provenance);
  assert.deepEqual(mapped.structured.limitations, fixture.limitations);
  assert.deepEqual(mapped.structured.energyBoundary, fixture.energy_boundary);
  assert.deepEqual(mapped.emissionsMetadata.limitations, fixture.limitations);
  assert.notEqual(mapped.structured.provenance, fixture.provenance);
  assert.notEqual(mapped.structured.limitations, fixture.limitations);
});

test("every locale labels all backend provenance and limitation fields", () => {
  const keys = [
    "yearly_analysis.lca_provenance",
    "yearly_analysis.lca_methodology_version",
    "yearly_analysis.lca_data_version",
    "yearly_analysis.lca_data_source",
    "yearly_analysis.lca_diesel_heating_methodology",
    "yearly_analysis.lca_energy_policy",
    "yearly_analysis.lca_grid_efficiency",
    "yearly_analysis.lca_limitations",
    "yearly_analysis.lca_no_limitations",
    "yearly_analysis.lca_warnings",
  ];

  for (const locale of ["en", "de", "fr", "it"]) {
    for (const key of keys) {
      assert.equal(typeof translations[locale][key], "string", `${locale}: ${key}`);
      assert.ok(translations[locale][key].trim().length > 0, `${locale}: ${key}`);
      assert.notEqual(translations[locale][key], key, `${locale}: ${key}`);
    }
  }
});
