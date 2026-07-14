import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const esm = await import('../dist/index.js');
const cjs = require('../dist/index.cjs');

const EXPECTED_PHASES = [
  'precondition',
  'fixture',
  'arrange',
  'act',
  'observe',
  'assert-primary',
  'assert-side',
  'assert-negative',
  'snapshot',
  'teardown',
  'report',
];
const EXPECTED_KINDS = [
  'unit',
  'ui-logic',
  'ui',
  'db-transaction',
  'data-exchange',
  'auth-flow',
  'e2e',
  'simulation',
];
const EXPECTED_SCOPES = ['single', 'pair', 'multi', 'system'];
const EXPECTED_LIFECYCLES = ['declared', 'assigned', 'collected', 'verified', 'archived'];

function assertVocabulary(mod, label) {
  assert.deepEqual(mod.TEST_PHASES, EXPECTED_PHASES, `${label} TEST_PHASES drifted`);
  assert.deepEqual(mod.TEST_KINDS, EXPECTED_KINDS, `${label} TEST_KINDS drifted`);
  assert.deepEqual(mod.TEST_SCOPES, EXPECTED_SCOPES, `${label} TEST_SCOPES drifted`);
  assert.deepEqual(mod.TEST_LIFECYCLES, EXPECTED_LIFECYCLES, `${label} TEST_LIFECYCLES drifted`);

  const gateIds = mod.GATE_KINDS.map((kind) => kind.id);
  assert.deepEqual(
    mod.ALL_GATE_KIND_IDS,
    gateIds,
    `${label} ALL_GATE_KIND_IDS must mirror GATE_KINDS`,
  );
  assert.equal(new Set(gateIds).size, gateIds.length, `${label} gate kind ids must be unique`);

  assert.ok(mod.WORK_DOMAINS.length >= 10, `${label} must expose work domains`);
  const domainIds = new Set(mod.WORK_DOMAINS.map((domain) => domain.id));
  assert.deepEqual(
    mod.ALL_DOMAIN_IDS,
    [...domainIds],
    `${label} ALL_DOMAIN_IDS must mirror WORK_DOMAINS`,
  );

  const gateIdSet = new Set(gateIds);
  for (const domain of mod.WORK_DOMAINS) {
    assert.ok(domain.subDomains.length > 0, `${label} ${domain.id} must have subdomains`);
    assert.ok(domain.qualityGates.length > 0, `${label} ${domain.id} must have quality gates`);
    for (const gate of domain.qualityGates) {
      assert.ok(
        gateIdSet.has(gate.kind),
        `${label} ${domain.id}.${gate.id} uses unknown gate kind ${gate.kind}`,
      );
    }
  }

  const dbSchema = mod.getSubDomain('data-infra', 'db-schema');
  assert.equal(
    dbSchema?.name,
    'DB & Schema',
    `${label} getSubDomain should resolve known subdomain`,
  );
}

assertVocabulary(esm, 'esm');
assertVocabulary(cjs, 'cjs');

const dts = await readFile(new URL('../dist/index.d.ts', import.meta.url), 'utf-8');
for (const marker of [
  'type TestPhase',
  'type TestKind',
  'type TestScope',
  'type TestLifecycle',
  'type QualityGateSpec',
  'type TestPhase, type TestScope',
]) {
  assert.ok(dts.includes(marker), `index.d.ts is missing ${marker}`);
}

console.log(
  `test-types smoke ok: ${EXPECTED_PHASES.length} phases, ${esm.GATE_KINDS.length} gate kinds, ${esm.WORK_DOMAINS.length} domains`,
);
