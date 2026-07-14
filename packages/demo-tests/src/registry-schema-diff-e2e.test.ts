// @def.boundary validation-layer-group
// @def.doc validation-layer-group

// DEPRECATED: Hono createApp → NestJS 전환으로 비활성화. registry-service 자체 테스트(25파일, 212건)로 대체.

/**
 * Registry Schema Diff E2E — 버전 간 capacity/stride 변경 감지
 *
 * v1 import → v2 capacity 변경 import → GET /schema/diff → stride 변경 감지
 */

import { describe, it, expect } from 'vitest';
import { InMemoryPrefixRegistry, InMemoryVersionLifecycleStore } from 'index-meta';
import type { Hono } from 'hono';
import {
  createApp,
  InMemoryPrefixOwnerStore,
  InMemoryDraftLockStore,
} from '@qa-sdk/registry-service';
import pino from 'pino';

// ── 쇼핑 플랫폼 스키마 (v1) ──────────────────────────────

const SHOPPING_V1 = {
  id: 'shopping-v1',
  axes: [
    { id: 'env', entries: ['dev', 'stage', 'prod'], capacity: 8 },
    { id: 'region', entries: ['asia', 'usa'], capacity: 4 },
    { id: 'svc_name', entries: ['web', 'backend', 'auth'], capacity: 8 },
    { id: 'perm_svc', entries: ['40', '41', '42'], capacity: 16 },
    { id: 'role', entries: ['admin', 'developer', 'operator', 'viewer', 'readonly'], capacity: 8 },
  ],
  composites: [
    { id: 'service', dims: ['env', 'region', 'svc_name'], owner: 'infra' },
    { id: 'permission', dims: ['perm_svc', 'role'], owner: 'auth' },
  ],
};

// v2: role capacity 8→16 (stride 변경), env capacity 8→16 (stride 변경)
const SHOPPING_V2 = {
  id: 'shopping-v2',
  axes: [
    { id: 'env', entries: ['dev', 'stage', 'prod', 'test', 'local'], capacity: 16 },
    { id: 'region', entries: ['asia', 'usa'], capacity: 4 },
    { id: 'svc_name', entries: ['web', 'backend', 'auth', 'payment'], capacity: 8 },
    { id: 'perm_svc', entries: ['40', '41', '42', '43'], capacity: 16 },
    {
      id: 'role',
      entries: ['admin', 'developer', 'operator', 'viewer', 'readonly', 'customer'],
      capacity: 16,
    },
  ],
  composites: [
    { id: 'service', dims: ['env', 'region', 'svc_name'], owner: 'infra' },
    { id: 'permission', dims: ['perm_svc', 'role'], owner: 'auth' },
  ],
};

// ── helpers ─────────────────────────────────────────────────

function buildApp() {
  const prefixRegistry = new InMemoryPrefixRegistry();
  const versionStore = new InMemoryVersionLifecycleStore();
  const ownerStore = new InMemoryPrefixOwnerStore();
  const lockStore = new InMemoryDraftLockStore();
  const logger = pino({ level: 'silent' });
  const app = createApp({ prefixRegistry, versionStore, ownerStore, lockStore, logger });
  return { app };
}

async function json(res: Response) {
  return res.json();
}

async function post(app: Hono, path: string, body?: object) {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// ══════════════════════════════════════════════════════════════

describe.skip('Schema Diff E2E', () => {
  it('v1 → v2 diff: capacity 변경 + stride 변경 감지', async () => {
    const { app } = buildApp();

    // 1. v1 import
    const r1 = await post(app, '/schema/import', {
      snapshot: SHOPPING_V1,
      versionId: 'v1',
    });
    expect(r1.status).toBe(201);

    // 2. v2 import (prefix는 이미 존재 → 새 draft version만 생성)
    const r2 = await post(app, '/schema/import', {
      snapshot: SHOPPING_V2,
      versionId: 'v2',
    });
    expect(r2.status).toBe(201);

    // 3. Diff
    const diffRes = await app.request('/schema/diff?from=v1&to=v2');
    expect(diffRes.status).toBe(200);
    const diff = await json(diffRes);

    expect(diff.from).toBe('v1');
    expect(diff.to).toBe('v2');
    expect(diff.diffs.length).toBeGreaterThan(0);

    // env capacity 변경: 8→16
    const envDiff = diff.diffs.find((d: any) => d.prefix === 'env');
    expect(envDiff).toBeDefined();
    expect(envDiff.from.capacity).toBe(8);
    expect(envDiff.to.capacity).toBe(16);
    expect(envDiff.capacityChanged).toBe(true);

    // role capacity 변경: 8→16
    const roleDiff = diff.diffs.find((d: any) => d.prefix === 'role');
    expect(roleDiff).toBeDefined();
    expect(roleDiff.from.capacity).toBe(8);
    expect(roleDiff.to.capacity).toBe(16);
    expect(roleDiff.capacityChanged).toBe(true);

    // service composite: env(첫 번째 축) 변경 → stride 불변
    // v1: shape=[8,4,8] stride=[32,8,1] → v2: shape=[16,4,8] stride=[32,8,1]
    const serviceDiff = diff.diffs.find((d: any) => d.prefix === 'service');
    expect(serviceDiff).toBeDefined();
    expect(serviceDiff.kind).toBe('composite');
    expect(serviceDiff.strideChanged).toBe(false);

    // permission composite: role(마지막 축) 8→16
    // v1: [16,8] stride=[8,1] → v2: [16,16] stride=[16,1] — stride 변경!
    const permDiff = diff.diffs.find((d: any) => d.prefix === 'permission');
    expect(permDiff).toBeDefined();
    expect(permDiff.kind).toBe('composite');
    expect(permDiff.strideChanged).toBe(true);
    expect(permDiff.migrationRequired).toBe(true);

    // overall (permission에서 stride 변경이 있으므로)
    expect(diff.migrationRequired).toBe(true);
  });

  it('v1 → v2 diff: stride 불변인 경우 migrationRequired=false', async () => {
    const { app } = buildApp();

    // v1 import
    await post(app, '/schema/import', {
      snapshot: {
        id: 'stable-v1',
        axes: [
          { id: 'x', entries: ['a', 'b'], capacity: 10 },
          { id: 'y', entries: ['c', 'd'], capacity: 5 },
        ],
        composites: [{ id: 'xy', dims: ['x', 'y'], owner: 'test' }],
      },
      versionId: 'v1',
    });

    // v2: x capacity만 증가 (첫 번째 축 → stride 불변)
    await post(app, '/schema/import', {
      snapshot: {
        id: 'stable-v2',
        axes: [
          { id: 'x', entries: ['a', 'b', 'c'], capacity: 20 },
          { id: 'y', entries: ['c', 'd'], capacity: 5 },
        ],
        composites: [{ id: 'xy', dims: ['x', 'y'], owner: 'test' }],
      },
      versionId: 'v2',
    });

    const diffRes = await app.request('/schema/diff?from=v1&to=v2');
    const diff = await json(diffRes);

    // x capacity changed
    const xDiff = diff.diffs.find((d: any) => d.prefix === 'x');
    expect(xDiff.capacityChanged).toBe(true);

    // xy composite: stride 불변 ([5,1] → [5,1])
    const xyDiff = diff.diffs.find((d: any) => d.prefix === 'xy');
    expect(xyDiff.strideChanged).toBe(false);
    expect(xyDiff.migrationRequired).toBe(false);

    // overall
    expect(diff.migrationRequired).toBe(false);
  });

  it('diff: 한쪽에만 존재하는 prefix → added/removed 상태', async () => {
    const { app } = buildApp();

    // v1: x, y 만
    await post(app, '/schema/import', {
      snapshot: {
        id: 'v1',
        axes: [
          { id: 'x', entries: ['a'], capacity: 10 },
          { id: 'y', entries: ['b'], capacity: 5 },
        ],
        composites: [],
      },
      versionId: 'v1',
    });

    // v2: x, y, z (z 추가)
    await post(app, '/schema/import', {
      snapshot: {
        id: 'v2',
        axes: [
          { id: 'x', entries: ['a'], capacity: 10 },
          { id: 'y', entries: ['b'], capacity: 5 },
          { id: 'z', entries: ['c'], capacity: 8 },
        ],
        composites: [],
      },
      versionId: 'v2',
    });

    const diff = await json(await app.request('/schema/diff?from=v1&to=v2'));

    // z는 v1에 없으므로 added
    const zDiff = diff.diffs.find((d: any) => d.prefix === 'z');
    expect(zDiff).toBeDefined();
    expect(zDiff.status).toBe('added');
    expect(zDiff.from).toBeNull();
    expect(zDiff.to.capacity).toBe(8);
  });
});
