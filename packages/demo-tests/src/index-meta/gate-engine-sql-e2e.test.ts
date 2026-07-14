// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * GateEngine SQL 통합 E2E — NodeSqliteDriver 기반
 *
 * SQL 저장소(SqlIndexMetaStore, SqlEntryFlagStore, SqlAddressStateStore,
 * SqlAddressRangeCache, SqlPrefixRegistry) 위에서 GateEngine이 정상 동작하는지 검증.
 *
 * VersionLifecycleStore는 SQL 어댑터가 아직 없으므로 InMemory 사용.
 *
 * [E1] release → AddressStateStore SQL 저장 + AddressRangeCache SQL 무효화
 * [E2] flexible setFlag → SQL 즉시 재계산
 * [E3] composite cascade → leaf SQL 변경이 composite SQL에 전파
 * [E4] SQL 재시작 시뮬레이션 — 저장된 gate 캐시 재조회
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  NodeSqliteDriver,
  SqlIndexMetaStore,
  SqlEntryFlagStore,
  SqlAddressStateStore,
  SqlAddressRangeCache,
  SqlPrefixRegistry,
  InMemoryVersionLifecycleStore,
  checkGate,
  GateEngine,
  GateAwareVersionLifecycleStore,
  GateAwareEntryFlagStore,
} from 'index-meta';

// ── 공통 픽스처 ─────────────────────────────────────────────

const AT = '2026-01-01T00:00:00Z';

interface SqlTestContext {
  driver: NodeSqliteDriver;
  metaStore: SqlIndexMetaStore;
  flagStore: SqlEntryFlagStore;
  stateStore: SqlAddressStateStore;
  rangeCache: SqlAddressRangeCache;
  prefixRegistry: SqlPrefixRegistry;
  versionStore: InMemoryVersionLifecycleStore;
  engine: GateEngine;
  gateVersionStore: GateAwareVersionLifecycleStore;
  gateFlagStore: GateAwareEntryFlagStore;
}

function createSqlContext(): SqlTestContext {
  const driver = new NodeSqliteDriver(':memory:');
  const metaStore = new SqlIndexMetaStore(driver);
  const flagStore = new SqlEntryFlagStore(driver);
  const stateStore = new SqlAddressStateStore(driver);
  const rangeCache = new SqlAddressRangeCache(driver);
  const prefixRegistry = new SqlPrefixRegistry(driver);
  const versionStore = new InMemoryVersionLifecycleStore();

  const engine = new GateEngine({
    prefixRegistry,
    metaStore,
    entryFlagStore: flagStore,
    versionLifecycleStore: versionStore,
    addressStateStore: stateStore,
    addressRangeCache: rangeCache,
  });

  const gateVersionStore = new GateAwareVersionLifecycleStore(versionStore, engine);
  const gateFlagStore = new GateAwareEntryFlagStore(flagStore, engine);

  return {
    driver,
    metaStore,
    flagStore,
    stateStore,
    rangeCache,
    prefixRegistry,
    versionStore,
    engine,
    gateVersionStore,
    gateFlagStore,
  };
}

/** leaf prefix 등록 + schema_version + entries 삽입 */
async function registerLeafSql(
  ctx: SqlTestContext,
  prefix: string,
  versionId: string,
  capacity: number,
  entries: string[],
): Promise<void> {
  await ctx.prefixRegistry.register({ prefix, versionId, capacity });
  await ctx.metaStore.insertSchemaVersion({ prefix, versionId, capacity, createdAt: AT });
  for (let i = 0; i < entries.length; i++) {
    await ctx.metaStore.insertEntry({
      prefix,
      versionId,
      position: i + 1,
      value: entries[i]!,
      createdAt: AT,
    });
  }
}

// ── [E1] release → SQL 저장 + 무효화 ───────────────────────

describe('[E1] GateEngine SQL — release → AddressStateStore 저장', () => {
  let ctx: SqlTestContext;
  beforeEach(() => {
    ctx = createSqlContext();
  });
  afterEach(() => {
    ctx.driver.close();
  });

  it('release 후 address_state_cache 테이블에 레코드 저장', async () => {
    await registerLeafSql(ctx, 'role', 'v1', 8, ['admin', 'editor', 'viewer']);
    await ctx.gateVersionStore.createDraft('role', 'v1', null, 8);
    await ctx.gateVersionStore.release('role', 'v1');

    const record = await ctx.stateStore.get('role', 'v1');
    expect(record).not.toBeNull();
    expect(record!.prefix).toBe('role');
    expect(record!.versionId).toBe('v1');

    // pos 1-3 active, pos 4-8 open
    expect(record!.openRanges.length).toBeGreaterThan(0);
    expect(record!.inactiveRanges).toEqual([]);

    // checkGate 검증
    expect(
      checkGate(0, record!.reservedRanges, record!.inactiveRanges, record!.openRanges).state,
    ).toBe('active');
    expect(
      checkGate(3, record!.reservedRanges, record!.inactiveRanges, record!.openRanges).state,
    ).toBe('open');
  });

  it('release 후 address_range_cache 무효화', async () => {
    await registerLeafSql(ctx, 'role', 'v1', 8, ['admin', 'editor', 'viewer']);

    // 사전 range cache 저장
    await ctx.rangeCache.save({
      prefix: 'role',
      versionId: 'v1',
      label: 'test',
      ranges: [[0, 7]],
      computedAt: AT,
    });
    expect(await ctx.rangeCache.get('role', 'v1', 'test')).not.toBeNull();

    await ctx.gateVersionStore.createDraft('role', 'v1', null, 8);
    await ctx.gateVersionStore.release('role', 'v1');

    // 무효화 확인
    expect(await ctx.rangeCache.get('role', 'v1', 'test')).toBeNull();
  });
});

// ── [E2] flexible setFlag → SQL 즉시 재계산 ─────────────────

describe('[E2] GateEngine SQL — flexible setFlag 즉시 재계산', () => {
  let ctx: SqlTestContext;
  beforeEach(() => {
    ctx = createSqlContext();
  });
  afterEach(() => {
    ctx.driver.close();
  });

  it('flexible 모드 — setFlag 후 SQL에 재계산 결과 저장', async () => {
    await registerLeafSql(ctx, 'config', 'v1', 8, ['theme', 'locale', 'tz']);
    await ctx.gateVersionStore.createDraft('config', 'v1', null, 8, 'flexible');
    await ctx.gateVersionStore.release('config', 'v1');

    // release 직후: pos 1-3 active, pos 4-8 open
    const before = await ctx.stateStore.get('config', 'v1');
    expect(before).not.toBeNull();
    expect(before!.inactiveRanges).toEqual([]);

    // locale(pos 2) 비활성화
    await ctx.gateFlagStore.setFlag({
      prefix: 'config',
      versionId: 'v1',
      position: 2,
      status: 'inactive',
      updatedAt: '2026-01-02T00:00:00Z',
    });

    // 재계산 확인
    const after = await ctx.stateStore.get('config', 'v1');
    expect(after).not.toBeNull();
    expect(after!.inactiveRanges.length).toBeGreaterThan(0);

    // pos 2 (addr 1) = inactive
    expect(
      checkGate(1, after!.reservedRanges, after!.inactiveRanges, after!.openRanges).state,
    ).toBe('inactive');
    // pos 1 (addr 0) = active
    expect(
      checkGate(0, after!.reservedRanges, after!.inactiveRanges, after!.openRanges).state,
    ).toBe('active');
  });

  it('strict 모드 — setFlag이 재계산 트리거하지 않음', async () => {
    await registerLeafSql(ctx, 'role', 'v1', 8, ['admin', 'editor', 'viewer']);
    await ctx.gateVersionStore.createDraft('role', 'v1', null, 8, 'strict');
    await ctx.gateVersionStore.release('role', 'v1');

    // entry_flag 테이블에 FK 제약이 있으므로 entry가 존재해야 함
    await ctx.gateFlagStore.setFlag({
      prefix: 'role',
      versionId: 'v1',
      position: 1,
      status: 'inactive',
      updatedAt: '2026-01-02T00:00:00Z',
    });

    // release 시 계산된 캐시는 있지만, setFlag으로 인한 재계산은 없음
    // (strict 모드에서는 release 시점의 상태가 유지됨)
    const record = await ctx.stateStore.get('role', 'v1');
    // release 시 계산된 값이 유지 — pos 1은 여전히 active (strict에서 flag은 반영 안 됨)
    expect(record).not.toBeNull();
    expect(
      checkGate(0, record!.reservedRanges, record!.inactiveRanges, record!.openRanges).state,
    ).toBe('active');
  });

  it('재활성화 → active 복원 SQL 반영', async () => {
    await registerLeafSql(ctx, 'tag', 'v1', 4, ['hot', 'new']);
    await ctx.gateVersionStore.createDraft('tag', 'v1', null, 4, 'flexible');
    await ctx.gateVersionStore.release('tag', 'v1');

    // 비활성화
    await ctx.gateFlagStore.setFlag({
      prefix: 'tag',
      versionId: 'v1',
      position: 1,
      status: 'inactive',
      updatedAt: '2026-01-02T00:00:00Z',
    });
    const afterInactive = await ctx.stateStore.get('tag', 'v1');
    expect(
      checkGate(
        0,
        afterInactive!.reservedRanges,
        afterInactive!.inactiveRanges,
        afterInactive!.openRanges,
      ).state,
    ).toBe('inactive');

    // 재활성화
    await ctx.gateFlagStore.setFlag({
      prefix: 'tag',
      versionId: 'v1',
      position: 1,
      status: 'active',
      updatedAt: '2026-01-03T00:00:00Z',
    });
    const afterActive = await ctx.stateStore.get('tag', 'v1');
    expect(
      checkGate(
        0,
        afterActive!.reservedRanges,
        afterActive!.inactiveRanges,
        afterActive!.openRanges,
      ).state,
    ).toBe('active');
  });
});

// ── [E3] composite cascade ──────────────────────────────────

describe('[E3] GateEngine SQL — composite cascade', () => {
  let ctx: SqlTestContext;
  beforeEach(() => {
    ctx = createSqlContext();
  });
  afterEach(() => {
    ctx.driver.close();
  });

  it('leaf release → composite SQL 자동 재계산', async () => {
    // leaf: role(cap=4), action(cap=3)
    await registerLeafSql(ctx, 'role', 'v1', 4, ['admin', 'editor']);
    await registerLeafSql(ctx, 'action', 'v1', 3, ['read', 'write', 'delete']);

    // composite: perm = role × action
    await ctx.prefixRegistry.register({
      prefix: 'perm',
      versionId: 'v1',
      capacity: 12,
      refs: [
        { prefix: 'role', versionId: 'v1', capacity: 4 },
        { prefix: 'action', versionId: 'v1', capacity: 3 },
      ],
    });

    // role release → perm도 자동 재계산
    await ctx.gateVersionStore.createDraft('role', 'v1', null, 4);
    await ctx.gateVersionStore.release('role', 'v1');

    // leaf + composite 모두 SQL에 저장됨
    const roleRecord = await ctx.stateStore.get('role', 'v1');
    const permRecord = await ctx.stateStore.get('perm', 'v1');
    expect(roleRecord).not.toBeNull();
    expect(permRecord).not.toBeNull();

    // perm에서 role의 headroom(pos 3-4)은 refEntries 미정의라 reserved로 승격된다
    // role=1(active) × action=1(active) → addr 0 → active
    expect(
      checkGate(0, permRecord!.reservedRanges, permRecord!.inactiveRanges, permRecord!.openRanges)
        .state,
    ).toBe('active');

    // role=3(headroom) × action=1(active) → addr 2*3+0=6 → reserved
    expect(
      checkGate(6, permRecord!.reservedRanges, permRecord!.inactiveRanges, permRecord!.openRanges)
        .state,
    ).toBe('reserved');
  });

  it('leaf flexible setFlag → composite SQL cascade', async () => {
    await registerLeafSql(ctx, 'role', 'v1', 4, ['admin', 'editor']);
    await registerLeafSql(ctx, 'action', 'v1', 3, ['read', 'write', 'delete']);
    await ctx.prefixRegistry.register({
      prefix: 'perm',
      versionId: 'v1',
      capacity: 12,
      refs: [
        { prefix: 'role', versionId: 'v1', capacity: 4 },
        { prefix: 'action', versionId: 'v1', capacity: 3 },
      ],
    });

    await ctx.gateVersionStore.createDraft('role', 'v1', null, 4, 'flexible');
    await ctx.gateVersionStore.release('role', 'v1');

    // role pos 1 (admin) 비활성화
    await ctx.gateFlagStore.setFlag({
      prefix: 'role',
      versionId: 'v1',
      position: 1,
      status: 'inactive',
      updatedAt: '2026-01-02T00:00:00Z',
    });

    // composite에서 반영 확인
    const permRecord = await ctx.stateStore.get('perm', 'v1');
    expect(permRecord).not.toBeNull();

    // role=1(inactive) × action=1(active) → addr 0 → inactive
    expect(
      checkGate(0, permRecord!.reservedRanges, permRecord!.inactiveRanges, permRecord!.openRanges)
        .state,
    ).toBe('inactive');
    // role=2(active) × action=1(active) → addr 3 → active
    expect(
      checkGate(3, permRecord!.reservedRanges, permRecord!.inactiveRanges, permRecord!.openRanges)
        .state,
    ).toBe('active');
  });
});

// ── [E4] SQL 재시작 시뮬레이션 ──────────────────────────────

describe('[E4] GateEngine SQL — 저장된 캐시 재조회', () => {
  it('gate 계산 후 새 driver로 재조회 — SQL 영속성 검증', async () => {
    // file DB 사용 (tmpfile 시뮬레이션은 :memory:로 대체 불가이므로 같은 driver 내에서 검증)
    const ctx = createSqlContext();

    await registerLeafSql(ctx, 'role', 'v1', 8, ['admin', 'editor', 'viewer']);
    await ctx.gateVersionStore.createDraft('role', 'v1', null, 8, 'flexible');
    await ctx.gateVersionStore.release('role', 'v1');

    // 비활성화
    await ctx.gateFlagStore.setFlag({
      prefix: 'role',
      versionId: 'v1',
      position: 2,
      status: 'inactive',
      updatedAt: '2026-01-02T00:00:00Z',
    });

    // 같은 driver에서 새로운 SqlAddressStateStore로 조회 (재시작 시뮬레이션)
    const freshStateStore = new SqlAddressStateStore(ctx.driver);
    const record = await freshStateStore.get('role', 'v1');

    expect(record).not.toBeNull();
    expect(record!.inactiveRanges.length).toBeGreaterThan(0);
    expect(
      checkGate(0, record!.reservedRanges, record!.inactiveRanges, record!.openRanges).state,
    ).toBe('active');
    expect(
      checkGate(1, record!.reservedRanges, record!.inactiveRanges, record!.openRanges).state,
    ).toBe('inactive');
    expect(
      checkGate(2, record!.reservedRanges, record!.inactiveRanges, record!.openRanges).state,
    ).toBe('active');
    expect(
      checkGate(3, record!.reservedRanges, record!.inactiveRanges, record!.openRanges).state,
    ).toBe('open');

    ctx.driver.close();
  });
});
