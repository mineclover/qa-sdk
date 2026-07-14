// @def.boundary index-meta-system
// @def.doc index-meta-system

/**
 * gate-engine.test.ts — GateEngine 테스트
 *
 * [GE-1] leaf prefix: inactive + open specs 생성
 * [GE-2] composite prefix: 각 dim의 leaf specs 수집
 * [GE-3] CON-006: refEntries 미정의 composite dim → 미사용 position reserved
 * [GE-4] CON-006: refEntries 바운딩된 composite dim → 추가 reserved 없음
 * [GE-5] recompute: specs → AddressStateStore 저장
 * [GE-6] cascadeRecompute: leaf 변경 → composite까지 전파
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GateEngine } from './gate-engine.js';
import { InMemoryPrefixRegistry } from './adapters/memory-prefix-registry.js';
import { InMemoryIndexMetaStore } from './adapters/memory-store.js';
import { InMemoryEntryFlagStore } from './adapters/memory-entry-flag-store.js';
import { InMemoryAddressStateStore } from './adapters/memory-invalid-range-store.js';
import { InMemoryAddressRangeCache } from './adapters/memory-address-range-cache.js';
import type { EntryRecord } from './index-meta-store.js';

// ── 공통 픽스처 ──────────────────────────────────────────

/** SchemaVersion + entries를 한번에 등록하는 헬퍼 */
async function seedEntries(
  metaStore: InMemoryIndexMetaStore,
  prefix: string,
  versionId: string,
  capacity: number,
  count: number,
) {
  await metaStore.insertSchemaVersion({
    prefix,
    versionId,
    capacity,
    shape: [capacity],
    strides: [1],
    dimNames: [prefix],
    createdAt: new Date().toISOString(),
  });
  for (let i = 1; i <= count; i++) {
    await metaStore.insertEntry({ prefix, versionId, position: i, value: `${prefix}_${i}` });
  }
}

function createEngine() {
  const prefixRegistry = new InMemoryPrefixRegistry();
  const metaStore = new InMemoryIndexMetaStore();
  const entryFlagStore = new InMemoryEntryFlagStore();
  const addressStateStore = new InMemoryAddressStateStore();
  const addressRangeCache = new InMemoryAddressRangeCache();

  // versionLifecycleStore — recomputeOnFlagChange에서만 사용, 최소 구현
  const versionLifecycleStore = {
    getVersion: async () => null,
    createDraft: async () => ({
      prefix: '',
      versionId: '',
      status: 'draft' as const,
      capacity: 0,
      baseVersionId: null,
      deactivationMode: 'strict' as const,
    }),
    release: async () => {},
    activate: async () => {},
    deprecate: async () => {},
    getActive: async () => null,
    getVersions: async () => [],
  };

  const engine = new GateEngine({
    prefixRegistry,
    metaStore,
    entryFlagStore,
    versionLifecycleStore,
    addressStateStore,
    addressRangeCache,
  });

  return { engine, prefixRegistry, metaStore, entryFlagStore, addressStateStore };
}

// ── [GE-1] leaf prefix ──────────────────────────────────

describe('leaf prefix specs', () => {
  it('[GE-1] inactive + open position 추출', async () => {
    const { engine, prefixRegistry, metaStore, entryFlagStore } = createEngine();

    // leaf prefix: role, capacity 8, entries 1-5 채움, position 3 inactive
    await prefixRegistry.register({ prefix: 'role', versionId: 'v1', capacity: 8 });
    await seedEntries(metaStore, 'role', 'v1', 8, 5);
    await entryFlagStore.setFlag({
      prefix: 'role',
      versionId: 'v1',
      position: 3,
      status: 'inactive',
      updatedAt: new Date().toISOString(),
    });

    const specs = await engine.buildDimStateSpecs('role', 'v1');

    // inactive: position 3
    const inactive = specs.filter((s) => s.state === 'inactive');
    expect(inactive.length).toBe(1);
    expect(inactive[0].coords).toBe('3');

    // open: position 6,7,8
    const open = specs.filter((s) => s.state === 'open');
    expect(open.length).toBe(1);
    expect(open[0].coords).toBe('6-8');
  });
});

// ── [GE-2] composite prefix ─────────────────────────────

describe('composite prefix specs', () => {
  it('[GE-2] 각 dim의 leaf specs 수집', async () => {
    const { engine, prefixRegistry, metaStore } = createEngine();

    // leaf: role (capacity 4, entries 1-3), service (capacity 8, entries 1-5)
    await prefixRegistry.register({ prefix: 'role', versionId: 'v1', capacity: 4 });
    await prefixRegistry.register({ prefix: 'service', versionId: 'v1', capacity: 8 });
    await seedEntries(metaStore, 'role', 'v1', 4, 3);
    await seedEntries(metaStore, 'service', 'v1', 8, 5);

    // composite: perm = svc_ref(service:v1, cap 5) × role(role:v1, cap 3)
    // svc_ref는 refEntries로 바운딩 (cap 5 < service 전체 cap 8)
    await prefixRegistry.register({
      prefix: 'perm',
      versionId: 'v1',
      capacity: 15,
      refs: [
        { prefix: 'service', versionId: 'v1', capacity: 5 },
        { prefix: 'role', versionId: 'v1', capacity: 3 },
      ],
    });

    const specs = await engine.buildDimStateSpecs('perm', 'v1');

    // dimIndex 0 (service, cap 5): position 1-5 중 모두 채워짐 → open 없음
    // dimIndex 1 (role, cap 3): position 1-3 모두 채워짐 → open 없음
    expect(specs.length).toBe(0);
  });
});

// ── [GE-3] CON-006: refEntries 미정의 → reserved ────────

describe('CON-006: refEntries 미정의 reserved', () => {
  it('[GE-3] ref.capacity === refRecord.capacity → 미사용 position reserved', async () => {
    const { engine, prefixRegistry, metaStore } = createEngine();

    // leaf: service (capacity 8, entries 1-3만 채움 → position 4-8 비어있음)
    await prefixRegistry.register({ prefix: 'service', versionId: 'v1', capacity: 8 });
    await seedEntries(metaStore, 'service', 'v1', 8, 3);

    // leaf: action (capacity 4, entries 1-4 전부 채움)
    await prefixRegistry.register({ prefix: 'action', versionId: 'v1', capacity: 4 });
    await seedEntries(metaStore, 'action', 'v1', 4, 4);

    // composite: unbound = svc_ref(service:v1, cap 8 = 전체) × action(action:v1, cap 4)
    // svc_ref의 ref.capacity === refRecord.capacity → refEntries 미정의
    await prefixRegistry.register({
      prefix: 'unbound',
      versionId: 'v1',
      capacity: 32,
      refs: [
        { prefix: 'service', versionId: 'v1', capacity: 8 }, // == service 전체 capacity
        { prefix: 'action', versionId: 'v1', capacity: 4 },
      ],
    });

    const specs = await engine.buildDimStateSpecs('unbound', 'v1');

    // dimIndex 0 (service, cap 8):
    //   - open: position 4-8 (leaf의 빈 slot)
    //   - reserved: position 4-8 (CON-006: refEntries 미정의로 인한 reserved)
    // reserved가 open을 override하므로, reserved spec이 있어야 함
    const reserved = specs.filter((s) => s.state === 'reserved');
    expect(reserved.length).toBeGreaterThan(0);
    expect(reserved[0].dimIndex).toBe(0);
    expect(reserved[0].reason).toContain('CON-006');

    // position 4-8이 reserved로 표기됨
    const coords = reserved[0].coords!;
    expect(coords).toBe('4-8');
  });

  it('[GE-4] ref.capacity < refRecord.capacity → refEntries 바운딩, 추가 reserved 없음', async () => {
    const { engine, prefixRegistry, metaStore } = createEngine();

    // leaf: service (capacity 8, entries 1-5)
    await prefixRegistry.register({ prefix: 'service', versionId: 'v1', capacity: 8 });
    await seedEntries(metaStore, 'service', 'v1', 8, 5);

    // composite: bounded = svc_ref(service:v1, cap 3 < 8) × ...
    // ref.capacity(3) < refRecord.capacity(8) → refEntries로 바운딩됨
    await prefixRegistry.register({ prefix: 'action', versionId: 'v1', capacity: 4 });
    await seedEntries(metaStore, 'action', 'v1', 4, 4);

    await prefixRegistry.register({
      prefix: 'bounded',
      versionId: 'v1',
      capacity: 12,
      refs: [
        { prefix: 'service', versionId: 'v1', capacity: 3 }, // < 8 → 바운딩됨
        { prefix: 'action', versionId: 'v1', capacity: 4 },
      ],
    });

    const specs = await engine.buildDimStateSpecs('bounded', 'v1');

    // CON-006 reserved는 발생하지 않아야 함
    const reserved = specs.filter((s) => s.state === 'reserved' && s.reason?.includes('CON-006'));
    expect(reserved.length).toBe(0);
  });
});

// ── [GE-5] recompute ─────────────────────────────────────

describe('recompute', () => {
  it('[GE-5] specs → AddressStateStore 저장', async () => {
    const { engine, prefixRegistry, metaStore, addressStateStore } = createEngine();

    await prefixRegistry.register({ prefix: 'test', versionId: 'v1', capacity: 4 });
    await seedEntries(metaStore, 'test', 'v1', 4, 2);

    await engine.recompute('test', 'v1');

    const record = await addressStateStore.get('test', 'v1');
    expect(record).not.toBeNull();
    expect(record!.openRanges.length).toBeGreaterThan(0);
  });
});

// ── [GE-6] cascadeRecompute ──────────────────────────────

describe('cascadeRecompute', () => {
  it('[GE-6] leaf 변경 → composite까지 전파', async () => {
    const { engine, prefixRegistry, metaStore, addressStateStore } = createEngine();

    // leaf
    await prefixRegistry.register({ prefix: 'leaf', versionId: 'v1', capacity: 4 });
    await seedEntries(metaStore, 'leaf', 'v1', 4, 4);

    // composite referencing leaf
    await prefixRegistry.register({
      prefix: 'comp',
      versionId: 'v1',
      capacity: 4,
      refs: [{ prefix: 'leaf', versionId: 'v1', capacity: 4 }],
    });

    await engine.cascadeRecompute('leaf', 'v1');

    // 둘 다 저장됨
    expect(await addressStateStore.get('leaf', 'v1')).not.toBeNull();
    expect(await addressStateStore.get('comp', 'v1')).not.toBeNull();
  });
});
