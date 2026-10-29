// @def.boundary query-api-spec
// @def.doc query-api-spec

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoredRecord } from '@qa-sdk/core';
import {
  InMemoryPrefixRegistry,
  MetaRegistry,
  RelationalEngine,
  composeQuery,
  computeStateRanges,
  gateAwareResolve,
  gateFilterRanges,
  queryAcrossVersions,
  resolvePatternPolicy,
  type MetaRegistryInput,
  type AddressStateCacheRecord,
  type DimStateSpec,
  type PrefixRegistryRecord,
} from 'index-meta';
import { createApp } from './app.js';
import { InMemoryPolicyRuleStore } from './stores/in-memory-policy-rule-store.js';
import type { StoredPolicyRule } from './stores/policy-rule-store.js';

const AT = new Date('2026-01-01T00:00:00.000Z');
const LATER = new Date('2026-01-01T00:05:00.000Z');

function req(app: ReturnType<typeof createApp>, method: string, path: string, body?: unknown) {
  const init: RequestInit = { method };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { 'Content-Type': 'application/json' };
  }

  return app.request(path, init);
}

function buildShapeRecord(
  prefix: string,
  versionId: string,
  capacities: number[],
): PrefixRegistryRecord {
  if (capacities.length === 1) {
    return {
      prefix,
      versionId,
      capacity: capacities[0]!,
    };
  }

  return {
    prefix,
    versionId,
    capacity: capacities.reduce((product, value) => product * value, 1),
    refs: capacities.map((capacity, index) => ({
      prefix: `${prefix}-dim-${index + 1}`,
      versionId,
      capacity,
    })),
  };
}

const QUERY_REGISTRY_INPUT: MetaRegistryInput = {
  dims: {
    role: {
      kind: { type: 'string_enum' },
      snapshots: {
        rv1: { entries: ['admin', 'editor'] },
        rv2: { entries: ['editor', 'admin', 'viewer'] },
        rv3: { entries: ['viewer'] },
      },
    },
    action: {
      kind: { type: 'string_enum' },
      snapshots: { av1: { entries: ['read', 'write'] } },
    },
    resource: {
      kind: { type: 'string_enum' },
      snapshots: { resv1: { entries: ['dashboard', 'settings'] } },
    },
    subject_kind: {
      kind: { type: 'string_enum' },
      snapshots: { skv1: { entries: ['user', 'group'] } },
    },
    predicate: {
      kind: { type: 'string_enum' },
      snapshots: { pv1: { entries: ['has', 'belongs_to'] } },
    },
    object_kind: {
      kind: { type: 'string_enum' },
      snapshots: { okv1: { entries: ['role', 'resource'] } },
    },
    format: {
      kind: { type: 'string_enum' },
      snapshots: { fv1: { entries: ['pdf', 'html'] } },
    },
    lang: {
      kind: { type: 'string_enum' },
      snapshots: { lv1: { entries: ['ko', 'en'] } },
    },
    quality_tier: {
      kind: { type: 'index_ref', indexId: 'doc_meta' },
      snapshots: { qtv1: { entries: [0, 2, 3] } },
    },
  },
  indices: {
    perm: {
      dims: ['role', 'action', 'resource'],
      versions: {
        v1: { snapshots: { role: 'rv1', action: 'av1', resource: 'resv1' } },
        v2: { snapshots: { role: 'rv2', action: 'av1', resource: 'resv1' } },
        v3: { snapshots: { role: 'rv3', action: 'av1', resource: 'resv1' } },
      },
    },
    rel: {
      dims: ['subject_kind', 'predicate', 'object_kind'],
      versions: {
        v1: {
          snapshots: {
            subject_kind: 'skv1',
            predicate: 'pv1',
            object_kind: 'okv1',
          },
        },
      },
    },
    doc_meta: {
      dims: ['format', 'lang'],
      versions: {
        v1: { snapshots: { format: 'fv1', lang: 'lv1' } },
      },
    },
    article: {
      dims: ['quality_tier'],
      versions: {
        v1: { snapshots: { quality_tier: 'qtv1' } },
      },
    },
  },
};

function buildGateRecord(
  prefix: string,
  versionId: string,
  shape: readonly number[],
  specs: readonly DimStateSpec[],
): AddressStateCacheRecord {
  const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges(shape, specs);

  return {
    prefix,
    versionId,
    specs: [...specs],
    reservedRanges,
    inactiveRanges,
    openRanges,
    computedAt: AT.toISOString(),
  };
}

describe('query-service', () => {
  let policyRuleStore: InMemoryPolicyRuleStore<unknown>;
  let prefixRegistry: InMemoryPrefixRegistry;
  let metaRegistry: MetaRegistry;
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(AT);

    policyRuleStore = new InMemoryPolicyRuleStore<unknown>();
    prefixRegistry = new InMemoryPrefixRegistry();
    metaRegistry = new MetaRegistry(QUERY_REGISTRY_INPUT);
    await prefixRegistry.register(buildShapeRecord('perm', 'v1', [4, 3]));

    app = createApp({
      policyRuleStore,
      prefixRegistry,
      metaRegistry,
      version: 'test',
      getUptimeSeconds: () => 42,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('GET /health returns service status', async () => {
    const response = await app.request('/health');
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toEqual({
      status: 'ok',
      policy_rule_store: 'InMemoryPolicyRuleStore',
      uptime_seconds: 42,
      version: 'test',
    });
  });

  it('supports CRUD across /rules endpoints', async () => {
    const createResponse = await req(app, 'POST', '/rules', {
      indexId: 'perm',
      versionId: 'v1',
      pattern: [1, null],
      value: { effect: 'allow' },
      priority: 10,
      ruleSetId: 'rbac-rules',
    });

    expect(createResponse.status).toBe(201);
    const createBody = (await createResponse.json()) as {
      conflicts: [];
      rule: StoredPolicyRule<{ effect: string }>;
    };

    expect(createBody.conflicts).toEqual([]);
    expect(createBody.rule.pattern).toEqual(['1', null]);
    expect(createBody.rule.value).toEqual({ effect: 'allow' });
    expect(createBody.rule.priority).toBe(10);
    expect(createBody.rule.ruleSetId).toBe('rbac-rules');
    expect(createBody.rule.createdAt).toBe(AT.toISOString());
    expect(createBody.rule.updatedAt).toBe(AT.toISOString());

    vi.setSystemTime(LATER);

    const updateResponse = await req(app, 'PUT', `/rules/${createBody.rule.id}`, {
      indexId: 'perm',
      versionId: 'v1',
      pattern: ['1-2', null],
      value: { effect: 'deny' },
      priority: 5,
      ruleSetId: 'rbac-rules',
    });

    expect(updateResponse.status).toBe(200);
    const updateBody = (await updateResponse.json()) as {
      conflicts: [];
      rule: StoredPolicyRule<{ effect: string }>;
    };

    expect(updateBody.conflicts).toEqual([]);
    expect(updateBody.rule.id).toBe(createBody.rule.id);
    expect(updateBody.rule.createdAt).toBe(AT.toISOString());
    expect(updateBody.rule.updatedAt).toBe(LATER.toISOString());
    expect(updateBody.rule.pattern).toEqual(['1-2', null]);
    expect(updateBody.rule.value).toEqual({ effect: 'deny' });

    const detailResponse = await app.request(`/rules/${createBody.rule.id}`);
    expect(detailResponse.status).toBe(200);
    expect(await detailResponse.json()).toEqual(updateBody.rule);

    const listResponse = await app.request('/rules?indexId=perm&versionId=v1');
    expect(listResponse.status).toBe(200);
    expect(await listResponse.json()).toEqual([updateBody.rule]);

    const deleteResponse = await req(app, 'DELETE', `/rules/${createBody.rule.id}`);
    expect(deleteResponse.status).toBe(204);

    const notFoundResponse = await app.request(`/rules/${createBody.rule.id}`);
    expect(notFoundResponse.status).toBe(404);
  });

  it('returns 409 with conflicts when a create request overlaps an incompatible rule', async () => {
    const baseResponse = await req(app, 'POST', '/rules', {
      indexId: 'perm',
      versionId: 'v1',
      pattern: [null, '2'],
      value: 'allow',
    });
    expect(baseResponse.status).toBe(201);

    const conflictResponse = await req(app, 'POST', '/rules', {
      indexId: 'perm',
      versionId: 'v1',
      pattern: ['1', null],
      value: 'deny',
    });

    expect(conflictResponse.status).toBe(409);
    const conflictBody = (await conflictResponse.json()) as {
      conflicts: Array<{
        overlapPattern: Array<string | null>;
        conflictingRules: Array<{ value: string }>;
      }>;
      error: { code: string; message: string };
    };

    expect(conflictBody.error.code).toBe('CONFLICT');
    expect(conflictBody.conflicts).toHaveLength(1);
    expect(conflictBody.conflicts[0]!.overlapPattern).toEqual(['1', '2']);
    expect(conflictBody.conflicts[0]!.conflictingRules.map((rule) => rule.value)).toEqual([
      'allow',
      'deny',
    ]);

    const listResponse = await app.request('/rules?indexId=perm&versionId=v1');
    expect(await listResponse.json()).toHaveLength(1);
  });

  it('persists conflicting creates when force=true and returns warnings', async () => {
    const baseResponse = await req(app, 'POST', '/rules', {
      indexId: 'perm',
      versionId: 'v1',
      pattern: [null, '2'],
      value: { effect: 'allow' },
    });
    expect(baseResponse.status).toBe(201);

    const forcedResponse = await req(app, 'POST', '/rules?force=true', {
      indexId: 'perm',
      versionId: 'v1',
      pattern: ['1', null],
      value: { effect: 'deny' },
      ruleSetId: 'exceptions',
    });

    expect(forcedResponse.status).toBe(201);
    const forcedBody = (await forcedResponse.json()) as {
      conflicts: Array<{ overlapPattern: Array<string | null> }>;
      rule: StoredPolicyRule<{ effect: string }>;
    };

    expect(forcedBody.conflicts).toHaveLength(1);
    expect(forcedBody.conflicts[0]!.overlapPattern).toEqual(['1', '2']);
    expect(forcedBody.rule.ruleSetId).toBe('exceptions');

    const listResponse = await app.request('/rules?indexId=perm&versionId=v1');
    const rules = (await listResponse.json()) as StoredPolicyRule<unknown>[];
    expect(rules).toHaveLength(2);
  });

  it('revalidates conflicts on update', async () => {
    const allowResponse = await req(app, 'POST', '/rules', {
      indexId: 'perm',
      versionId: 'v1',
      pattern: ['1', null],
      value: 'allow',
    });
    const allowRule = (
      (await allowResponse.json()) as {
        rule: StoredPolicyRule<string>;
      }
    ).rule;

    vi.setSystemTime(LATER);

    const denyResponse = await req(app, 'POST', '/rules', {
      indexId: 'perm',
      versionId: 'v1',
      pattern: ['2', null],
      value: 'deny',
    });
    const denyRule = (
      (await denyResponse.json()) as {
        rule: StoredPolicyRule<string>;
      }
    ).rule;

    const updateResponse = await req(app, 'PUT', `/rules/${denyRule.id}`, {
      indexId: 'perm',
      versionId: 'v1',
      pattern: ['1', null],
      value: 'deny',
    });

    expect(updateResponse.status).toBe(409);
    const updateBody = (await updateResponse.json()) as {
      conflicts: Array<{
        conflictingRules: Array<{ id: string }>;
      }>;
    };
    expect(updateBody.conflicts).toHaveLength(1);
    expect(updateBody.conflicts[0]!.conflictingRules.map((rule) => rule.id)).toEqual([
      allowRule.id,
      denyRule.id,
    ]);
  });

  it('returns mapped errors for invalid input, missing shapes, and missing rules', async () => {
    const invalidPayloadResponse = await req(app, 'POST', '/rules', {
      indexId: '',
      versionId: 'v1',
      pattern: [1, null],
      value: 'allow',
    });
    expect(invalidPayloadResponse.status).toBe(400);

    const invalidPatternResponse = await req(app, 'POST', '/rules', {
      indexId: 'perm',
      versionId: 'v1',
      pattern: [1],
      value: 'allow',
    });
    expect(invalidPatternResponse.status).toBe(400);
    const invalidPatternBody = (await invalidPatternResponse.json()) as {
      error: { code: string };
    };
    expect(invalidPatternBody.error.code).toBe('INVALID_INPUT');

    const missingShapeResponse = await req(app, 'POST', '/rules', {
      indexId: 'missing',
      versionId: 'v1',
      pattern: [1],
      value: 'allow',
    });
    expect(missingShapeResponse.status).toBe(404);
    const missingShapeBody = (await missingShapeResponse.json()) as {
      error: { code: string };
    };
    expect(missingShapeBody.error.code).toBe('NOT_FOUND');

    const missingRuleResponse = await app.request('/rules/missing');
    expect(missingRuleResponse.status).toBe(404);
    const missingRuleBody = (await missingRuleResponse.json()) as {
      error: { code: string };
    };
    expect(missingRuleBody.error.code).toBe('NOT_FOUND');
  });

  it('POST /resolve uses the configured default strategy when strategy is omitted', async () => {
    const priorityApp = createApp({
      policyRuleStore,
      prefixRegistry,
      metaRegistry,
      defaultStrategy: 'priority',
    });

    const response = await req(priorityApp, 'POST', '/resolve', {
      coord: [1, 1],
      shape: [2, 2],
      rules: [
        { id: 'broad-high', pattern: [null, null], value: 'allow', priority: 10 },
        { id: 'exact-low', pattern: ['1', '1'], value: 'deny', priority: 1 },
      ],
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      resolvePatternPolicy(
        [1, 1],
        [
          { id: 'broad-high', pattern: [null, null], value: 'allow', priority: 10 },
          { id: 'exact-low', pattern: ['1', '1'], value: 'deny', priority: 1 },
        ],
        [2, 2],
        'priority',
      ),
    );
  });

  it('POST /resolve returns validation errors for malformed requests', async () => {
    const response = await req(app, 'POST', '/resolve', {
      coord: [0, 1],
      shape: [2, 2],
      rules: [],
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_INPUT');
  });

  it('POST /match-ranges returns the same ranges as MetaRegistry', async () => {
    const response = await req(app, 'POST', '/match-ranges', {
      indexId: 'perm',
      versionId: 'v2',
      partial: {
        role: 'admin',
        action: 'read',
        resource: null,
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      metaRegistry.createCodec('perm', 'v2').matchRanges({
        role: 'admin',
        action: 'read',
        resource: null,
      }),
    );
  });

  it('POST /match-ranges applies gateMode using gate-service state', async () => {
    const gateRecord = buildGateRecord(
      'perm',
      'v2',
      [3, 2, 2],
      [{ dimIndex: 0, state: 'inactive', coords: '2' }],
    );
    const gateClient = {
      getStateRanges: vi.fn(async () => gateRecord),
    };
    const gateApp = createApp({
      policyRuleStore,
      prefixRegistry,
      metaRegistry,
      gateClient,
    });

    const response = await req(gateApp, 'POST', '/match-ranges', {
      indexId: 'perm',
      versionId: 'v2',
      partial: {
        role: 'admin',
        action: 'read',
        resource: null,
      },
      gateMode: 'active',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      gateFilterRanges(
        metaRegistry.createCodec('perm', 'v2').matchRanges({
          role: 'admin',
          action: 'read',
          resource: null,
        }),
        gateRecord,
        'active',
      ),
    );
    expect(gateClient.getStateRanges).toHaveBeenCalledWith('perm', 'v2');
  });

  it('POST /match-ranges maps index-meta missing-resource errors', async () => {
    const response = await req(app, 'POST', '/match-ranges', {
      indexId: 'perm',
      versionId: 'missing',
      partial: {
        role: 'admin',
      },
    });

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('POST /match-ranges fails open when gate-service is unavailable', async () => {
    const gateClient = {
      getStateRanges: vi.fn(async () => {
        throw new Error('gate down');
      }),
    };
    const failOpenApp = createApp({
      policyRuleStore,
      prefixRegistry,
      metaRegistry,
      gateClient,
    });

    const response = await req(failOpenApp, 'POST', '/match-ranges', {
      indexId: 'perm',
      versionId: 'v2',
      partial: {
        role: 'admin',
        action: 'read',
        resource: null,
      },
      gateMode: 'active',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      metaRegistry.createCodec('perm', 'v2').matchRanges({
        role: 'admin',
        action: 'read',
        resource: null,
      }),
    );
  });

  it('POST /compose-query returns the same ranges as composeQuery', async () => {
    const response = await req(app, 'POST', '/compose-query', {
      source: { indexId: 'article', versionId: 'v1' },
      through: 'quality_tier',
      targetConstraint: { format: 'html', lang: null },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      composeQuery(
        { indexId: 'article', versionId: 'v1' },
        'quality_tier',
        { format: 'html', lang: null },
        metaRegistry,
      ),
    );
  });

  it('POST /compose-query returns validation errors for invalid through dims', async () => {
    const response = await req(app, 'POST', '/compose-query', {
      source: { indexId: 'article', versionId: 'v1' },
      through: 'missing_dim',
      targetConstraint: { format: 'html' },
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_INPUT');
  });

  it('POST /query-across-versions returns ranges keyed by versionId', async () => {
    const response = await req(app, 'POST', '/query-across-versions', {
      indexId: 'perm',
      versionIds: ['v1', 'v2', 'v3'],
      constraint: {
        role: 'admin',
        action: 'read',
        resource: null,
      },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      Object.fromEntries(
        queryAcrossVersions(
          'perm',
          ['v1', 'v2', 'v3'],
          {
            role: 'admin',
            action: 'read',
            resource: null,
          },
          metaRegistry,
        ),
      ),
    );
  });

  it('POST /query-across-versions validates required versionIds', async () => {
    const response = await req(app, 'POST', '/query-across-versions', {
      indexId: 'perm',
      versionIds: [],
      constraint: {
        role: 'admin',
      },
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INVALID_INPUT');
  });

  it('POST /resolve-relation returns the same result as RelationalEngine', async () => {
    const engine = new RelationalEngine(metaRegistry.toInput());
    const typeRules = [
      {
        id: 'default-deny',
        pattern: [null, null, null],
        effect: 'deny',
      },
      {
        id: 'user-has-role',
        pattern: ['1', '1', '1'],
        effect: 'allow_with_check',
        instanceRules: {
          indexId: 'perm',
          versionId: 'v1',
          rules: [
            { id: 'perm-default', pattern: [null, null, null], value: 'deny' },
            { id: 'admin-all', pattern: ['1', null, null], value: 'allow' },
          ],
        },
      },
    ];

    const response = await req(app, 'POST', '/resolve-relation', {
      relTypeCoord: [1, 1, 1],
      relShape: [2, 2, 2],
      typeRules,
      instanceCoord: [1, 2, 1],
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      engine.resolveRelation(
        [1, 1, 1],
        [2, 2, 2],
        [
          {
            id: 'default-deny',
            pattern: [null, null, null],
            effect: 'deny',
          },
          {
            id: 'user-has-role',
            pattern: ['1', '1', '1'],
            effect: 'allow_with_check',
            instanceRules: {
              indexId: 'perm',
              versionId: 'v1',
              rules: [
                { id: 'perm-default', pattern: [null, null, null], value: 'deny' },
                { id: 'admin-all', pattern: ['1', null, null], value: 'allow' },
              ],
              strategy: 'most-specific',
            },
          },
        ],
        'most-specific',
        [1, 2, 1],
      ),
    );
  });

  it('POST /resolve-relation maps missing instance indexes', async () => {
    const response = await req(app, 'POST', '/resolve-relation', {
      relTypeCoord: [1, 1, 1],
      relShape: [2, 2, 2],
      typeRules: [
        {
          id: 'user-has-role',
          pattern: ['1', '1', '1'],
          effect: 'allow_with_check',
          instanceRules: {
            indexId: 'missing',
            versionId: 'v1',
            rules: [{ id: 'perm-default', pattern: [null, null, null], value: 'deny' }],
          },
        },
      ],
      instanceCoord: [1, 1, 1],
    });

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('POST /resolve returns a GateAwareResult when withGate=true', async () => {
    const gateRecord = buildGateRecord(
      'perm',
      'v2',
      [3, 2, 2],
      [{ dimIndex: 0, state: 'inactive', coords: '2' }],
    );
    const gateClient = {
      getStateRanges: vi.fn(async () => gateRecord),
    };
    const gateApp = createApp({
      policyRuleStore,
      prefixRegistry,
      metaRegistry,
      gateClient,
    });

    const rules = [
      { id: 'allow-admin', pattern: ['2', null, null], value: 'allow' },
      { id: 'deny-editor', pattern: ['1', null, null], value: 'deny' },
    ];

    const response = await req(gateApp, 'POST', '/resolve', {
      indexId: 'perm',
      versionId: 'v2',
      coord: [2, 1, 1],
      shape: [3, 2, 2],
      withGate: true,
      rules,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(
      gateAwareResolve(
        resolvePatternPolicy([2, 1, 1], rules, [3, 2, 2], 'most-specific'),
        metaRegistry.getWeightedIndex('perm', 'v2').encode([2, 1, 1]),
        gateRecord,
      ),
    );
    expect(gateClient.getStateRanges).toHaveBeenCalledWith('perm', 'v2');
  });

  it('POST /resolve returns 503 in fail-closed mode when gate-service is unavailable', async () => {
    const gateClient = {
      getStateRanges: vi.fn(async () => {
        throw new Error('gate down');
      }),
    };
    const failClosedApp = createApp({
      policyRuleStore,
      prefixRegistry,
      metaRegistry,
      gateClient,
      gateFailureMode: 'fail-closed',
    });

    const response = await req(failClosedApp, 'POST', '/resolve', {
      indexId: 'perm',
      versionId: 'v2',
      coord: [2, 1, 1],
      shape: [3, 2, 2],
      withGate: true,
      rules: [{ id: 'allow-admin', pattern: ['2', null, null], value: 'allow' }],
    });

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('POST /rules/migrate returns 503 when migration service is not configured', async () => {
    const noMigrationApp = createApp({
      policyRuleStore,
      prefixRegistry,
    });

    const response = await req(noMigrationApp, 'POST', '/rules/migrate', {
      indexId: 'perm',
      fromVersion: 'v1',
      toVersion: 'v2',
    });

    expect(response.status).toBe(503);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('state store가 없으면 현재 상태 조회는 빈 상태 대신 501을 돌려준다', async () => {
    const stateApp = createApp({ policyRuleStore, prefixRegistry, metaRegistry });
    expect((await stateApp.request('/state/ctx-1/res-1')).status).toBe(501);
    expect((await stateApp.request('/state/ctx-1/res-1/history')).status).toBe(501);
  });

  it('/transitions는 전이 목록만 제공하고 /state 라우트를 중복 마운트하지 않는다', async () => {
    const transitionStore = {
      findByContext: vi.fn(async () => [{ id: 't-1' }]),
      findByContextAndResource: vi.fn(async () => []),
    };
    const stateApp = createApp({
      policyRuleStore,
      prefixRegistry,
      metaRegistry,
      stateRoutes: { transitionStore },
    });

    const list = await stateApp.request('/transitions?context_id=ctx-1');
    expect(list.status).toBe(200);
    expect(await list.json()).toMatchObject({ contextId: 'ctx-1', count: 1 });
    expect((await stateApp.request('/transitions/ctx-1/res-1/history')).status).toBe(404);
    expect((await stateApp.request('/state/ctx-1/res-1/history')).status).toBe(200);
  });

  it('GET /state/:context/:resource/at filters records by explicit ids only', async () => {
    const stateApp = createApp({
      policyRuleStore,
      prefixRegistry,
      metaRegistry,
      stateRoutes: {
        recordStore: {
          async findByTimeRange() {
            const records: StoredRecord[] = [
              {
                logId: 'keep',
                traceId: 't1',
                spanId: 's1',
                timestamp: AT,
                recordKind: 'log',
                eventKey: 'evt',
                eventVersion: 'v1',
                payloadFormat: 'json',
                payloadEncoding: 'raw',
                payloadMaskingApplied: false,
                payloadMaskedFields: [],
                payload: { context_id: 'ctx-1', resource_id: 'res-1' },
                addressContext: { flow_step: 'entry' },
                createdAt: AT,
              },
              {
                logId: 'drop',
                traceId: 't2',
                spanId: 's2',
                timestamp: AT,
                recordKind: 'log',
                eventKey: 'evt',
                eventVersion: 'v1',
                payloadFormat: 'json',
                payloadEncoding: 'raw',
                payloadMaskingApplied: false,
                payloadMaskedFields: [],
                payload: { context_id: 'ctx-1', resource_id: 'other' },
                addressContext: { unrelated: 'res-1', lifecycle_state: 'active' },
                createdAt: AT,
              },
            ];
            return records;
          },
        },
      },
    });

    const response = await stateApp.request('/state/ctx-1/res-1/at?ts=2026-01-01T00:00:00.000Z');
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      mode: string;
      recordCount: number;
      state: Record<string, string>;
    };

    expect(body.mode).toBe('replay');
    expect(body.recordCount).toBe(1);
    expect(body.state).toEqual({ flow_step: 'entry' });
  });

  it('GET /state/:context/:resource/at prefers replayTransition when available', async () => {
    const replayTransition = vi.fn(async () => ({ lifecycle_state: 'active' }));
    const stateApp = createApp({
      policyRuleStore,
      prefixRegistry,
      metaRegistry,
      stateRoutes: {
        recordStore: {
          async findByTimeRange() {
            const records: StoredRecord[] = [
              {
                logId: 'keep',
                traceId: 't1',
                spanId: 's1',
                timestamp: AT,
                recordKind: 'log',
                eventKey: 'evt',
                eventVersion: 'v1',
                payloadFormat: 'json',
                payloadEncoding: 'raw',
                payloadMaskingApplied: false,
                payloadMaskedFields: [],
                payload: { context_id: 'ctx-1', resource_id: 'res-1' },
                addressContext: { flow_step: 'entry' },
                createdAt: AT,
              },
            ];
            return records;
          },
        },
        replayTransition,
      },
    });

    const response = await stateApp.request('/state/ctx-1/res-1/at?ts=2026-01-01T00:00:00.000Z');
    expect(response.status).toBe(200);
    const body = (await response.json()) as { mode: string; state: Record<string, string> };
    expect(body.mode).toBe('engine-replay');
    expect(body.state).toEqual({ lifecycle_state: 'active' });
    expect(replayTransition).toHaveBeenCalledOnce();
  });
});
