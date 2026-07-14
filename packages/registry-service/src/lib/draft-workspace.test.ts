// @def.boundary registry-system
// @def.doc registry-system

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryPrefixRegistry, InMemoryVersionLifecycleStore } from 'index-meta';
import type { PrefixRegistry, VersionLifecycleStore } from 'index-meta';
import { InMemoryPrefixOwnerStore } from '../stores/in-memory-prefix-owner-store.js';
import type { PrefixOwnerStore } from '../stores/prefix-owner-store.js';
import { simulate, analyze } from './draft-workspace.js';

let registry: PrefixRegistry;
let versionStore: VersionLifecycleStore;
let ownerStore: PrefixOwnerStore;

function noLock() {
  return false;
}

async function registerLeaf(prefix: string, owner: string, capacity: number, versionId = 'v1') {
  await ownerStore.register({
    prefix,
    owner,
    kind: 'leaf',
    numberType: 'number',
    createdAt: new Date().toISOString(),
  });
  await versionStore.createDraft(prefix, versionId, null, capacity);
  await registry.register({ prefix, versionId, capacity });
}

async function registerComposite(
  prefix: string,
  owner: string,
  refs: { prefix: string; versionId: string; capacity: number }[],
  versionId = 'v1',
) {
  const capacity = refs.reduce((a, r) => a * r.capacity, 1);
  await ownerStore.register({
    prefix,
    owner,
    kind: 'composite',
    numberType: 'number',
    createdAt: new Date().toISOString(),
  });
  await versionStore.createDraft(prefix, versionId, null, capacity);
  await registry.register({ prefix, versionId, capacity, refs });
}

beforeEach(() => {
  registry = new InMemoryPrefixRegistry();
  versionStore = new InMemoryVersionLifecycleStore();
  ownerStore = new InMemoryPrefixOwnerStore();
});

describe('simulate', () => {
  it('returns impact for affected composites', async () => {
    await registerLeaf('role', 'service-a', 100);
    await registerLeaf('action', 'service-a', 15);
    await registerComposite('perm', 'service-c', [
      { prefix: 'role', versionId: 'v1', capacity: 100 },
      { prefix: 'action', versionId: 'v1', capacity: 15 },
    ]);

    const result = await simulate(registry, ownerStore, versionStore, {
      role: { capacity: 200 },
    });

    expect(result.impact).toHaveLength(1);
    expect(result.impact[0].prefix).toBe('perm');
    expect(result.impact[0].newShape).toEqual([200, 15]);
    expect(result.impact[0].newProduct).toBe(3000);
    expect(result.impact[0].strideChanged).toBe(false);
    expect(result.ready).toBe(true);
  });

  it('detects stride change when non-last dim changes', async () => {
    await registerLeaf('role', 'service-a', 100);
    await registerLeaf('action', 'service-a', 15);
    await registerComposite('perm', 'service-c', [
      { prefix: 'role', versionId: 'v1', capacity: 100 },
      { prefix: 'action', versionId: 'v1', capacity: 15 },
    ]);

    const result = await simulate(registry, ownerStore, versionStore, {
      action: { capacity: 20 },
    });

    expect(result.impact[0].strideChanged).toBe(true);
    expect(result.impact[0].currentStride).toEqual([15, 1]);
    expect(result.impact[0].newStride).toEqual([20, 1]);
    expect(result.impact[0].migrationRequired).toBe(true);
  });

  it('finds impact even when leaf has only active version (no draft)', async () => {
    // active 버전만 있고 draft가 없는 경우에도 simulate가 동작해야 함
    await registerLeaf('role', 'svc-a', 100);
    await registerLeaf('action', 'svc-a', 15);
    await registerComposite('perm', 'svc-c', [
      { prefix: 'role', versionId: 'v1', capacity: 100 },
      { prefix: 'action', versionId: 'v1', capacity: 15 },
    ]);

    // role을 active 상태로 전환 (draft → released → active)
    await versionStore.release('role', 'v1');
    await versionStore.activate('role', 'v1');

    // role에 draft가 없는 상태에서 simulate
    const result = await simulate(registry, ownerStore, versionStore, {
      role: { capacity: 200 },
    });

    expect(result.impact).toHaveLength(1);
    expect(result.impact[0].prefix).toBe('perm');
    expect(result.impact[0].newShape).toEqual([200, 15]);
  });

  it('returns empty impact for leaf-only changes', async () => {
    await registerLeaf('role', 'service-a', 100);

    const result = await simulate(registry, ownerStore, versionStore, {
      role: { capacity: 200 },
    });

    expect(result.impact).toHaveLength(0);
    expect(result.ready).toBe(true);
  });

  it('detects Number overflow as error', async () => {
    await registerLeaf('big_a', 'svc', 10_000_000);
    await registerLeaf('big_b', 'svc', 10_000_000);
    await registerComposite('mega', 'svc', [
      { prefix: 'big_a', versionId: 'v1', capacity: 10_000_000 },
      { prefix: 'big_b', versionId: 'v1', capacity: 10_000_000 },
    ]);

    // 1e9 * 1e7 = 1e16 > MAX_SAFE (~9e15) → overflow error
    const result = await simulate(registry, ownerStore, versionStore, {
      big_a: { capacity: 1_000_000_000 },
    });

    const hasError = result.diagnostics.some(
      (d) => d.level === 'error' && d.message.includes('Number 한계'),
    );
    expect(hasError).toBe(true);
    expect(result.ready).toBe(false);
  });

  it('detects BigInt threshold warning', async () => {
    await registerLeaf('mid_a', 'svc', 1_000_000);
    await registerLeaf('mid_b', 'svc', 100);
    await registerComposite('mid_comp', 'svc', [
      { prefix: 'mid_a', versionId: 'v1', capacity: 1_000_000 },
      { prefix: 'mid_b', versionId: 'v1', capacity: 100 },
    ]);

    // 1e8 * 100 = 1e10, not a warning
    // But 1e12 * 100 = 1e14 > MAX_SAFE * 0.01 (~9e13) → warn
    const result = await simulate(registry, ownerStore, versionStore, {
      mid_a: { capacity: 1_000_000_000_000 },
    });

    const hasWarn = result.diagnostics.some(
      (d) => d.level === 'warn' && d.message.includes('BigInt'),
    );
    expect(hasWarn).toBe(true);
    expect(result.ready).toBe(true); // warn only, not error
  });

  it('propagates through multi-level composites', async () => {
    await registerLeaf('role', 'svc-a', 10);
    await registerLeaf('action', 'svc-a', 5);
    await registerComposite('perm', 'svc-b', [
      { prefix: 'role', versionId: 'v1', capacity: 10 },
      { prefix: 'action', versionId: 'v1', capacity: 5 },
    ]);

    await registerLeaf('resource', 'svc-c', 50);
    await registerComposite('access_log', 'svc-c', [
      { prefix: 'perm', versionId: 'v1', capacity: 50 },
      { prefix: 'resource', versionId: 'v1', capacity: 50 },
    ]);

    const result = await simulate(registry, ownerStore, versionStore, {
      role: { capacity: 20 },
    });

    const prefixes = result.impact.map((i) => i.prefix);
    expect(prefixes).toContain('perm');
    expect(prefixes).toContain('access_log');
  });
});

describe('analyze', () => {
  it('collects all drafts and computes release order', async () => {
    await registerLeaf('role', 'svc-a', 100);
    await registerLeaf('action', 'svc-a', 15);
    await registerComposite('perm', 'svc-c', [
      { prefix: 'role', versionId: 'v1', capacity: 100 },
      { prefix: 'action', versionId: 'v1', capacity: 15 },
    ]);

    const result = await analyze(registry, versionStore, ownerStore, noLock);

    expect(result.drafts).toHaveLength(3);
    expect(result.releaseOrder.indexOf('role')).toBeLessThan(result.releaseOrder.indexOf('perm'));
    expect(result.releaseOrder.indexOf('action')).toBeLessThan(result.releaseOrder.indexOf('perm'));
  });

  it('returns ready: true when no issues', async () => {
    await registerLeaf('role', 'svc-a', 100);
    const result = await analyze(registry, versionStore, ownerStore, noLock);
    expect(result.ready).toBe(true);
    expect(result.diagnostics.filter((d) => d.level === 'error')).toHaveLength(0);
  });

  it('reports locked drafts', async () => {
    await registerLeaf('role', 'svc-a', 100);
    const lockFn = (p: string, v: string) => p === 'role' && v === 'v1';
    const result = await analyze(registry, versionStore, ownerStore, lockFn);
    expect(result.drafts[0].status).toBe('locked');
  });

  it('reports migration summary', async () => {
    await registerLeaf('role', 'svc-a', 100);
    await registerLeaf('action', 'svc-a', 15);
    await registerComposite('perm', 'svc-c', [
      { prefix: 'role', versionId: 'v1', capacity: 100 },
      { prefix: 'action', versionId: 'v1', capacity: 15 },
    ]);

    const result = await analyze(registry, versionStore, ownerStore, noLock);
    expect(result.migrationSummary).toBeDefined();
    expect(result.migrationSummary.strideChanges).toBe(0); // no active version to compare
  });
});
