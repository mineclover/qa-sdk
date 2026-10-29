// @def.boundary gate-system
// @def.doc gate-system

/**
 * OpenAPI 계약 ↔ 실제 라우트 대조.
 *
 * 문서(gate-openapi.ts)는 핸들러가 없으므로, 문서에 적힌 모든 경로를 실제 앱(createApp)에 보내
 * 응답 status가 문서에 있는지, 본문이 그 status의 스키마를 통과하는지 확인한다.
 */
import { describe, expect, it } from 'vitest';
import type { z } from '@hono/zod-openapi';
import {
  GateEngine,
  InMemoryAddressRangeCache,
  InMemoryAddressStateStore,
  InMemoryEntryFlagStore,
  InMemoryIndexMetaStore,
  InMemoryPrefixRegistry,
  InMemoryVersionLifecycleStore,
} from 'index-meta';
import { createApp } from '../app.js';
import { GATE_OPENAPI_ROUTES, buildGateOpenAPIDocument } from './gate-openapi.js';

const AT = '2026-01-01T00:00:00Z';

/** role@v1: capacity 4, entry 2개, position 2 inactive → 상태가 계산된 prefix */
async function servedApp(withEngine: boolean) {
  const prefixRegistry = new InMemoryPrefixRegistry();
  const metaStore = new InMemoryIndexMetaStore();
  const entryFlagStore = new InMemoryEntryFlagStore();
  const addressStateStore = new InMemoryAddressStateStore();
  const engine = new GateEngine({
    prefixRegistry,
    metaStore,
    entryFlagStore,
    versionLifecycleStore: new InMemoryVersionLifecycleStore(),
    addressStateStore,
    addressRangeCache: new InMemoryAddressRangeCache(),
  });
  await prefixRegistry.register({ prefix: 'role', versionId: 'v1', capacity: 4 });
  await metaStore.insertSchemaVersion({
    prefix: 'role',
    versionId: 'v1',
    capacity: 4,
    createdAt: AT,
  });
  for (const [i, value] of ['admin', 'editor'].entries()) {
    await metaStore.insertEntry({
      prefix: 'role',
      versionId: 'v1',
      position: i + 1,
      value,
      createdAt: AT,
    });
  }
  await entryFlagStore.setFlag({
    prefix: 'role',
    versionId: 'v1',
    position: 2,
    status: 'inactive',
    updatedAt: AT,
  });
  await engine.recompute('role', 'v1');
  return createApp({ addressStateStore, gateEngine: withEngine ? engine : null });
}

/** 문서 경로별 요청 예시 (fixture) */
const SAMPLE_REQUESTS: Record<string, { path: string; body?: unknown }> = {
  '/gate/check': { path: '/gate/check', body: { prefix: 'role', versionId: 'v1', address: 1 } },
  '/gate/classify': {
    path: '/gate/classify',
    body: { prefix: 'role', versionId: 'v1', address: 1 },
  },
  '/gate/recompute': { path: '/gate/recompute', body: { prefix: 'role', versionId: 'v1' } },
  '/gate/cascade-recompute': {
    path: '/gate/cascade-recompute',
    body: { prefix: 'role', versionId: 'v1' },
  },
  '/gate/filter-ranges': {
    path: '/gate/filter-ranges',
    body: { prefix: 'role', versionId: 'v1', ranges: [[0, 3]], mode: 'encodable' },
  },
  '/gate/state/{prefix}/{version}': { path: '/gate/state/role/v1' },
  '/health': { path: '/health' },
};

type DocumentedResponse = { content?: Record<string, { schema: z.ZodTypeAny }> };

async function assertMatchesContract(app: ReturnType<typeof createApp>) {
  for (const route of GATE_OPENAPI_ROUTES) {
    const sample = SAMPLE_REQUESTS[route.path];
    expect(sample, `${route.path}: 요청 예시 없음`).toBeDefined();
    const res = await app.request(sample.path, {
      method: route.method.toUpperCase(),
      headers: { 'Content-Type': 'application/json' },
      ...(sample.body === undefined ? {} : { body: JSON.stringify(sample.body) }),
    });

    const responses = route.responses as Record<string, DocumentedResponse>;
    const documented = responses[String(res.status)];
    expect(
      documented,
      `${route.method} ${route.path}: 문서에 없는 status ${res.status}`,
    ).toBeDefined();
    const schema = documented.content?.['application/json']?.schema;
    if (!schema) continue; // 본문 없는 응답 (204)
    const parsed = schema.safeParse(await res.json());
    expect(
      parsed.success,
      `${route.method} ${route.path} ${res.status}: ${parsed.error?.message}`,
    ).toBe(true);
  }
}

describe('Gate OpenAPI 계약', () => {
  it('OpenAPI 3.1 문서에 모든 계약 경로가 있다', () => {
    const spec = buildGateOpenAPIDocument();
    expect(spec.openapi).toBe('3.1.0');
    const paths = Object.keys(spec.paths ?? {}).toSorted();
    expect(paths).toEqual([...new Set(GATE_OPENAPI_ROUTES.map((r) => r.path))].toSorted());
  });

  it('엔진이 있는 실제 앱의 응답이 문서와 일치한다', async () => {
    await assertMatchesContract(await servedApp(true));
  });

  it('엔진이 없는 실제 앱의 응답(501 포함)도 문서와 일치한다', async () => {
    await assertMatchesContract(await servedApp(false));
  });
});
