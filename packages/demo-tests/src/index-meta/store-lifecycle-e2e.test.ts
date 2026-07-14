// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * E2E: 저장소 생명주기 — SQL 기반 운영 시나리오
 *
 * NodeSqliteDriver (in-memory) + SqlIndexMetaStore + SqlAddressStateStore 를 조합해
 * 실제 운영에서 발생하는 4가지 시나리오를 검증한다.
 *
 * [S1] Boot           : DB 엔트리 적재 → 게이트 캐시 저장 → 재조회 → 주소 제어 확인
 * [S2] Version upgrade: 새 버전 생성 → migrateEntries → 기존 엔트리 이전 검증
 * [S3] Soft delete    : 엔트리 유지 확인 + 게이트 캐시 inactive 저장 → checkGate
 * [S4] Position reorder: migrateEntries + positionMap → 새 좌표 검증
 *
 * ── 운영 불변 원칙 ───────────────────────────────────────────────────
 *   - entry 테이블은 append-only: 삭제·수정 없음
 *   - 비활성화(deprecated)는 address_state_cache.inactive_json 으로 처리
 *   - position → EntityId 매핑은 영구적: positionMap 없이는 좌표 불변
 *   - capacity 확장만 새 버전을 요구한다
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  NodeSqliteDriver,
  SqlIndexMetaStore,
  SqlAddressStateStore,
  computeStateRanges,
  checkGate,
  activeRanges,
  type DimStateSpec,
} from 'index-meta';

// ── 공통 픽스처 ───────────────────────────────────────────

const AT = '2026-01-01T00:00:00Z';

// ── [S1] Boot: DB 엔트리 적재 + 게이트 캐시 저장/재조회 ───────────────

describe('[S1] Boot — DB 엔트리 적재 후 게이트 캐시를 저장하고 재조회한다', () => {
  let driver: NodeSqliteDriver;
  let metaStore: SqlIndexMetaStore;
  let stateStore: SqlAddressStateStore;

  beforeEach(() => {
    driver = new NodeSqliteDriver(':memory:');
    metaStore = new SqlIndexMetaStore(driver);
    stateStore = new SqlAddressStateStore(driver);
  });

  afterEach(() => {
    driver.close();
  });

  it('schema_version + entry를 적재하면 getEntries로 조회된다', async () => {
    await metaStore.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v1',
      capacity: 8,
      createdAt: AT,
    });
    await metaStore.insertEntry({
      prefix: 'role',
      versionId: 'v1',
      position: 1,
      value: 'admin',
      createdAt: AT,
    });
    await metaStore.insertEntry({
      prefix: 'role',
      versionId: 'v1',
      position: 2,
      value: 'editor',
      createdAt: AT,
    });
    await metaStore.insertEntry({
      prefix: 'role',
      versionId: 'v1',
      position: 3,
      value: 'viewer',
      createdAt: AT,
    });

    const entries = await metaStore.getEntries('role', 'v1');
    expect(entries.map((e) => e.value)).toEqual(['admin', 'editor', 'viewer']);
    expect(await metaStore.getCapacity('role', 'v1')).toBe(8);
  });

  it('게이트 캐시를 저장하면 get()으로 동일한 record가 반환된다', async () => {
    const specs: DimStateSpec[] = [];
    const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges([8], specs);

    const record = {
      prefix: 'role',
      versionId: 'v1',
      specs,
      reservedRanges,
      inactiveRanges,
      openRanges,
      computedAt: AT,
    };

    await stateStore.save(record);
    const loaded = await stateStore.get('role', 'v1');

    expect(loaded).not.toBeNull();
    expect(loaded!.prefix).toBe('role');
    expect(loaded!.versionId).toBe('v1');
    expect(loaded!.reservedRanges).toEqual(reservedRanges);
    expect(loaded!.inactiveRanges).toEqual(inactiveRanges);
    expect(loaded!.openRanges).toEqual(openRanges);
    expect(loaded!.computedAt).toBe(AT);
  });

  it('저장되지 않은 캐시는 get()이 null을 반환한다', async () => {
    expect(await stateStore.get('role', 'v1')).toBeNull();
  });

  it('delete() 후에는 get()이 null을 반환한다', async () => {
    const record = {
      prefix: 'role',
      versionId: 'v1',
      specs: [],
      reservedRanges: [],
      inactiveRanges: [],
      openRanges: [],
      computedAt: AT,
    };

    await stateStore.save(record);
    expect(await stateStore.get('role', 'v1')).not.toBeNull();

    await stateStore.delete('role', 'v1');
    expect(await stateStore.get('role', 'v1')).toBeNull();
  });

  it('save()는 기존 캐시를 덮어쓴다 (upsert)', async () => {
    const base = {
      prefix: 'role',
      versionId: 'v1',
      specs: [],
      reservedRanges: [],
      inactiveRanges: [],
      openRanges: [],
      computedAt: AT,
    };

    await stateStore.save(base);

    const updated = { ...base, computedAt: '2026-06-01T00:00:00Z' };
    await stateStore.save(updated);

    const loaded = await stateStore.get('role', 'v1');
    expect(loaded!.computedAt).toBe('2026-06-01T00:00:00Z');
  });
});

// ── [S2] Version upgrade: capacity 확장 + migrateEntries ──────────────────────

describe('[S2] Version upgrade — capacity 확장 후 migrateEntries로 엔트리를 이전한다', () => {
  let driver: NodeSqliteDriver;
  let store: SqlIndexMetaStore;

  beforeEach(async () => {
    driver = new NodeSqliteDriver(':memory:');
    store = new SqlIndexMetaStore(driver);

    // v1: capacity=4, 4개 엔트리로 꽉 참
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v1',
      capacity: 4,
      createdAt: AT,
    });
    for (const [pos, val] of [
      [1, 'admin'],
      [2, 'editor'],
      [3, 'viewer'],
      [4, 'guest'],
    ] as const) {
      await store.insertEntry({
        prefix: 'role',
        versionId: 'v1',
        position: pos,
        value: val,
        createdAt: AT,
      });
    }
  });

  afterEach(() => {
    driver.close();
  });

  it('새 버전(capacity 확장)을 만들고 migrateEntries가 모든 엔트리를 이전한다', async () => {
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v2',
      capacity: 8,
      createdAt: AT,
    });
    const result = await store.migrateEntries('role', 'v1', 'v2');

    expect(result.migrated).toBe(4);
    expect(result.skipped).toBe(0);

    const v2Entries = await store.getEntries('role', 'v2');
    expect(v2Entries.map((e) => e.position)).toEqual([1, 2, 3, 4]);
    expect(v2Entries.map((e) => e.value)).toEqual(['admin', 'editor', 'viewer', 'guest']);
  });

  it('v1 엔트리는 migrateEntries 후에도 그대로 남는다 (append-only)', async () => {
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v2',
      capacity: 8,
      createdAt: AT,
    });
    await store.migrateEntries('role', 'v1', 'v2');

    const v1Entries = await store.getEntries('role', 'v1');
    expect(v1Entries).toHaveLength(4);
    expect(v1Entries.map((e) => e.value)).toEqual(['admin', 'editor', 'viewer', 'guest']);
  });

  it('migrateEntries는 멱등적이다 — 두 번 실행하면 두 번째는 모두 skipped', async () => {
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v2',
      capacity: 8,
      createdAt: AT,
    });
    await store.migrateEntries('role', 'v1', 'v2');
    const second = await store.migrateEntries('role', 'v1', 'v2');

    expect(second.migrated).toBe(0);
    expect(second.skipped).toBe(4);
  });

  it('새 버전의 나머지 position은 비어있다', async () => {
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v2',
      capacity: 8,
      createdAt: AT,
    });
    await store.migrateEntries('role', 'v1', 'v2');

    const v2Entries = await store.getEntries('role', 'v2');
    expect(v2Entries).toHaveLength(4); // capacity=8이지만 채워진 것은 4개

    expect(await store.getEntry('role', 'v2', 5)).toBeNull();
    expect(await store.getEntry('role', 'v2', 8)).toBeNull();
  });
});

// ── [S3] Soft delete: 엔트리 유지 + 게이트 캐시 inactive 갱신 ─────────────────

describe('[S3] Soft delete — deprecated 값은 entry에 남고 게이트 캐시로 제어된다', () => {
  let driver: NodeSqliteDriver;
  let metaStore: SqlIndexMetaStore;
  let stateStore: SqlAddressStateStore;

  beforeEach(async () => {
    driver = new NodeSqliteDriver(':memory:');
    metaStore = new SqlIndexMetaStore(driver);
    stateStore = new SqlAddressStateStore(driver);

    await metaStore.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v1',
      capacity: 4,
      createdAt: AT,
    });
    for (const [pos, val] of [
      [1, 'admin'],
      [2, 'editor'],
      [3, 'viewer'],
      [4, 'guest'],
    ] as const) {
      await metaStore.insertEntry({
        prefix: 'role',
        versionId: 'v1',
        position: pos,
        value: val,
        createdAt: AT,
      });
    }
  });

  afterEach(() => {
    driver.close();
  });

  it('viewer(position 3)를 deprecated 처리해도 entry 레코드는 삭제되지 않는다', async () => {
    // deprecated 처리는 entry 삭제 없이 게이트 캐시로만 제어
    const viewerEntry = await metaStore.getEntry('role', 'v1', 3);
    expect(viewerEntry).not.toBeNull();
    expect(viewerEntry!.value).toBe('viewer');
  });

  it('inactive 상태를 게이트 캐시에 저장하면 checkGate가 encode 차단을 반환한다', async () => {
    // viewer(position 3)를 inactive로 선언
    const specs: DimStateSpec[] = [
      { dimIndex: 0, state: 'inactive', coords: '3', reason: 'deprecated' },
    ];

    const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges([4], specs);

    // inactive 구간이 실제로 계산됐는지 확인
    expect(inactiveRanges.length).toBeGreaterThan(0);

    await stateStore.save({
      prefix: 'role',
      versionId: 'v1',
      specs,
      reservedRanges,
      inactiveRanges,
      openRanges,
      computedAt: AT,
    });

    // DB에서 다시 로드
    const cached = await stateStore.get('role', 'v1');
    expect(cached).not.toBeNull();
    expect(cached!.inactiveRanges.length).toBeGreaterThan(0);

    // inactive 구간에 속한 주소는 decode ✓, encode ✗
    const inactiveAddress = cached!.inactiveRanges[0][0];
    const gate = checkGate(
      inactiveAddress,
      cached!.reservedRanges,
      cached!.inactiveRanges,
      cached!.openRanges,
    );

    expect(gate.state).toBe('inactive');
    expect(gate.encode).toBe(false);
    expect(gate.decode).toBe(true);
  });

  it('상태 갱신 시 캐시를 삭제하고 재계산해 저장한다', async () => {
    // 초기 캐시: 모두 active
    await stateStore.save({
      prefix: 'role',
      versionId: 'v1',
      specs: [],
      reservedRanges: [],
      inactiveRanges: [],
      openRanges: [],
      computedAt: AT,
    });

    // viewer deprecated → 캐시 무효화 후 재계산
    await stateStore.delete('role', 'v1');

    const specs: DimStateSpec[] = [{ dimIndex: 0, state: 'inactive', coords: '3' }];
    const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges([4], specs);

    await stateStore.save({
      prefix: 'role',
      versionId: 'v1',
      specs,
      reservedRanges,
      inactiveRanges,
      openRanges,
      computedAt: '2026-06-01T00:00:00Z',
    });

    const updated = await stateStore.get('role', 'v1');
    expect(updated!.inactiveRanges.length).toBeGreaterThan(0);
    expect(updated!.computedAt).toBe('2026-06-01T00:00:00Z');
  });
});

// ── [S4] Position reorder: migrateEntries + positionMap ───────────────────────

describe('[S4] Position reorder — positionMap으로 좌표를 재배치한다', () => {
  let driver: NodeSqliteDriver;
  let store: SqlIndexMetaStore;

  beforeEach(async () => {
    driver = new NodeSqliteDriver(':memory:');
    store = new SqlIndexMetaStore(driver);

    // v1: admin=1, editor=2, viewer=3
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v1',
      capacity: 4,
      createdAt: AT,
    });
    await store.insertEntry({
      prefix: 'role',
      versionId: 'v1',
      position: 1,
      value: 'admin',
      createdAt: AT,
    });
    await store.insertEntry({
      prefix: 'role',
      versionId: 'v1',
      position: 2,
      value: 'editor',
      createdAt: AT,
    });
    await store.insertEntry({
      prefix: 'role',
      versionId: 'v1',
      position: 3,
      value: 'viewer',
      createdAt: AT,
    });
  });

  afterEach(() => {
    driver.close();
  });

  it('positionMap으로 editor↔viewer 좌표를 교환해 이전한다', async () => {
    // v2: admin=1, viewer=2, editor=3 (editor:2→3, viewer:3→2)
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v2',
      capacity: 8,
      createdAt: AT,
    });

    const result = await store.migrateEntries('role', 'v1', 'v2', { 2: 3, 3: 2 });
    expect(result.migrated).toBe(3);
    expect(result.skipped).toBe(0);

    const v2Entries = await store.getEntries('role', 'v2');
    const byPos = new Map(v2Entries.map((e) => [e.position, e.value]));

    expect(byPos.get(1)).toBe('admin'); // position 불변
    expect(byPos.get(2)).toBe('viewer'); // viewer: 3→2
    expect(byPos.get(3)).toBe('editor'); // editor: 2→3
  });

  it('positionMap 없이 migrateEntries하면 position이 그대로 유지된다', async () => {
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v2',
      capacity: 8,
      createdAt: AT,
    });
    await store.migrateEntries('role', 'v1', 'v2');

    const v2Entries = await store.getEntries('role', 'v2');
    const byPos = new Map(v2Entries.map((e) => [e.position, e.value]));

    expect(byPos.get(1)).toBe('admin');
    expect(byPos.get(2)).toBe('editor');
    expect(byPos.get(3)).toBe('viewer');
  });

  it('v1 엔트리는 positionMap 적용 후에도 원래 좌표를 유지한다 (append-only)', async () => {
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v2',
      capacity: 8,
      createdAt: AT,
    });
    await store.migrateEntries('role', 'v1', 'v2', { 2: 3, 3: 2 });

    // v1은 변경 없음
    const v1Entries = await store.getEntries('role', 'v1');
    const byPos = new Map(v1Entries.map((e) => [e.position, e.value]));

    expect(byPos.get(1)).toBe('admin');
    expect(byPos.get(2)).toBe('editor'); // v1에서는 2에 editor
    expect(byPos.get(3)).toBe('viewer'); // v1에서는 3에 viewer
  });

  it('positionMap이 capacity 초과 위치를 참조하면 ValidationError', async () => {
    await store.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v2',
      capacity: 2,
      createdAt: AT,
    });

    // admin(pos=1)을 position 3으로 → capacity=2 초과
    await expect(store.migrateEntries('role', 'v1', 'v2', { 1: 3 })).rejects.toThrow();
  });
});

// ── [S5] Open slots (headroom): encode ✓, decode ✗, shouldVerify=true ─────────
//
// 빈 position을 "open"으로 선언하면:
//   - encode(쓰기) 허용 — headroom에 새 값을 채울 수 있다
//   - decode(읽기) 불가 — 아직 값이 없으므로 decode 결과 없음
//   - shouldVerify=true — 캐시가 stale일 수 있으므로 실제 조회 권장

describe('[S5] Open slots — headroom 구간은 encode 허용, decode 차단된다', () => {
  let driver: NodeSqliteDriver;
  let stateStore: SqlAddressStateStore;

  beforeEach(() => {
    driver = new NodeSqliteDriver(':memory:');
    stateStore = new SqlAddressStateStore(driver);
  });

  afterEach(() => {
    driver.close();
  });

  it('open 구간의 주소는 encode ✓, decode ✗, shouldVerify=true', async () => {
    // capacity=8, positions 1-3 채워짐, positions 4-8 headroom(open)
    const specs: DimStateSpec[] = [{ dimIndex: 0, state: 'open', coords: '4-8' }];
    const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges([8], specs);

    expect(openRanges.length).toBeGreaterThan(0);

    await stateStore.save({
      prefix: 'role',
      versionId: 'v1',
      specs,
      reservedRanges,
      inactiveRanges,
      openRanges,
      computedAt: AT,
    });
    const cached = await stateStore.get('role', 'v1');

    const openAddress = cached!.openRanges[0][0];
    const gate = checkGate(
      openAddress,
      cached!.reservedRanges,
      cached!.inactiveRanges,
      cached!.openRanges,
    );

    expect(gate.state).toBe('open');
    expect(gate.encode).toBe(true);
    expect(gate.decode).toBe(false);
    expect(gate.shouldVerify).toBe(true);
  });

  it('open 선언 외 구간(positions 1-3)은 active 상태를 유지한다', async () => {
    const specs: DimStateSpec[] = [{ dimIndex: 0, state: 'open', coords: '4-8' }];
    const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges([8], specs);

    // positions 1-3에 해당하는 active 주소 목록
    const active = activeRanges(8, reservedRanges, inactiveRanges, openRanges);
    expect(active.length).toBeGreaterThan(0);

    const activeAddress = active[0][0];
    const gate = checkGate(activeAddress, reservedRanges, inactiveRanges, openRanges);

    expect(gate.state).toBe('active');
    expect(gate.encode).toBe(true);
    expect(gate.decode).toBe(true);
    expect(gate.shouldVerify).toBe(false);
  });

  it('DB 저장 후 재조회해도 open/active 게이트 판단이 동일하다', async () => {
    const specs: DimStateSpec[] = [{ dimIndex: 0, state: 'open', coords: '4-8' }];
    const computed = computeStateRanges([8], specs);

    await stateStore.save({ prefix: 'role', versionId: 'v1', specs, ...computed, computedAt: AT });
    const cached = await stateStore.get('role', 'v1');

    // open 구간 첫 주소
    const openGate = checkGate(
      cached!.openRanges[0][0],
      cached!.reservedRanges,
      cached!.inactiveRanges,
      cached!.openRanges,
    );
    expect(openGate.state).toBe('open');

    // active 구간 첫 주소
    const active = activeRanges(
      8,
      cached!.reservedRanges,
      cached!.inactiveRanges,
      cached!.openRanges,
    );
    const activeGate = checkGate(
      active[0][0],
      cached!.reservedRanges,
      cached!.inactiveRanges,
      cached!.openRanges,
    );
    expect(activeGate.state).toBe('active');
  });
});

// ── [S6] inactive ∩ open → reserved 자동 승격 ────────────────────────────────
//
// 2D shape [4, 4]: role(dim0) × action(dim1)
//
//   dim0 position 3 = inactive (viewer deprecated)
//   dim1 position 3 = open     (headroom)
//
// composite 주소 공간에서 두 구간이 겹치는 곳:
//   encode ✗(inactive) AND decode ✗(open) → reserved 로 자동 승격
//
// 결과:
//   - inactive-only 구간: encode ✗, decode ✓
//   - open-only 구간   : encode ✓, decode ✗
//   - reserved(교차)   : encode ✗, decode ✗, shouldVerify=false (hard block)

describe('[S6] inactive ∩ open → reserved 자동 승격', () => {
  let driver: NodeSqliteDriver;
  let stateStore: SqlAddressStateStore;

  beforeEach(() => {
    driver = new NodeSqliteDriver(':memory:');
    stateStore = new SqlAddressStateStore(driver);
  });

  afterEach(() => {
    driver.close();
  });

  it('두 상태가 겹치는 구간은 reserved로 승격된다', () => {
    const specs: DimStateSpec[] = [
      { dimIndex: 0, state: 'inactive', coords: '3' }, // role=viewer deprecated
      { dimIndex: 1, state: 'open', coords: '3' }, // action 3 = headroom
    ];
    const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges([4, 4], specs);

    // 세 구간 모두 존재해야 함
    expect(reservedRanges.length).toBeGreaterThan(0);
    expect(inactiveRanges.length).toBeGreaterThan(0);
    expect(openRanges.length).toBeGreaterThan(0);
  });

  it('reserved 구간은 encode ✗, decode ✗, shouldVerify=false (hard block)', () => {
    const specs: DimStateSpec[] = [
      { dimIndex: 0, state: 'inactive', coords: '3' },
      { dimIndex: 1, state: 'open', coords: '3' },
    ];
    const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges([4, 4], specs);

    const gate = checkGate(reservedRanges[0][0], reservedRanges, inactiveRanges, openRanges);

    expect(gate.state).toBe('reserved');
    expect(gate.encode).toBe(false);
    expect(gate.decode).toBe(false);
    expect(gate.shouldVerify).toBe(false);
  });

  it('inactive-only 구간(교차 제외)은 decode ✓, encode ✗', () => {
    const specs: DimStateSpec[] = [
      { dimIndex: 0, state: 'inactive', coords: '3' },
      { dimIndex: 1, state: 'open', coords: '3' },
    ];
    const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges([4, 4], specs);

    // inactiveRanges는 이미 reserved 구간이 제거된 상태
    const gate = checkGate(inactiveRanges[0][0], reservedRanges, inactiveRanges, openRanges);

    expect(gate.state).toBe('inactive');
    expect(gate.encode).toBe(false);
    expect(gate.decode).toBe(true);
  });

  it('open-only 구간(교차 제외)은 encode ✓, decode ✗', () => {
    const specs: DimStateSpec[] = [
      { dimIndex: 0, state: 'inactive', coords: '3' },
      { dimIndex: 1, state: 'open', coords: '3' },
    ];
    const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges([4, 4], specs);

    // openRanges도 reserved 구간이 제거된 상태
    const gate = checkGate(openRanges[0][0], reservedRanges, inactiveRanges, openRanges);

    expect(gate.state).toBe('open');
    expect(gate.encode).toBe(true);
    expect(gate.decode).toBe(false);
  });

  it('승격된 구간이 DB에 저장되고 재조회 후에도 동일하게 판단된다', async () => {
    const specs: DimStateSpec[] = [
      { dimIndex: 0, state: 'inactive', coords: '3' },
      { dimIndex: 1, state: 'open', coords: '3' },
    ];
    const computed = computeStateRanges([4, 4], specs);

    await stateStore.save({
      prefix: 'role_action',
      versionId: 'v1',
      specs,
      ...computed,
      computedAt: AT,
    });
    const cached = await stateStore.get('role_action', 'v1');

    const gate = checkGate(
      cached!.reservedRanges[0][0],
      cached!.reservedRanges,
      cached!.inactiveRanges,
      cached!.openRanges,
    );
    expect(gate.state).toBe('reserved');
    expect(gate.shouldVerify).toBe(false);
  });
});

// ── [S7] 멀티 prefix 격리 — 같은 DB, 서로 다른 prefix ────────────────────────
//
// IndexMetaStore와 AddressStateStore는 prefix 단위로 격리된다.
// 같은 NodeSqliteDriver를 공유해도 prefix가 다르면 데이터가 섞이지 않는다.

describe('[S7] 멀티 prefix — 같은 DB에서 prefix별 캐시가 독립적이다', () => {
  let driver: NodeSqliteDriver;
  let metaStore: SqlIndexMetaStore;
  let stateStore: SqlAddressStateStore;

  beforeEach(async () => {
    driver = new NodeSqliteDriver(':memory:');
    metaStore = new SqlIndexMetaStore(driver);
    stateStore = new SqlAddressStateStore(driver);

    // role과 action을 동일 DB에 공존
    for (const prefix of ['role', 'action'] as const) {
      await metaStore.insertSchemaVersion({ prefix, versionId: 'v1', capacity: 4, createdAt: AT });
      await metaStore.insertEntry({
        prefix,
        versionId: 'v1',
        position: 1,
        value: 'a',
        createdAt: AT,
      });
      await metaStore.insertEntry({
        prefix,
        versionId: 'v1',
        position: 2,
        value: 'b',
        createdAt: AT,
      });
    }
  });

  afterEach(() => {
    driver.close();
  });

  it('다른 prefix의 entry가 섞이지 않는다', async () => {
    const roleEntries = await metaStore.getEntries('role', 'v1');
    const actionEntries = await metaStore.getEntries('action', 'v1');

    expect(roleEntries.every((e) => e.prefix === 'role')).toBe(true);
    expect(actionEntries.every((e) => e.prefix === 'action')).toBe(true);
    expect(roleEntries).toHaveLength(2);
    expect(actionEntries).toHaveLength(2);
  });

  it('다른 prefix의 게이트 캐시가 독립적으로 저장된다', async () => {
    const roleSpecs: DimStateSpec[] = [
      { dimIndex: 0, state: 'inactive', coords: '2', reason: 'role.b deprecated' },
    ];
    const actionSpecs: DimStateSpec[] = []; // action은 모두 active

    const roleComputed = computeStateRanges([4], roleSpecs);
    const actionComputed = computeStateRanges([4], actionSpecs);

    await stateStore.save({
      prefix: 'role',
      versionId: 'v1',
      specs: roleSpecs,
      ...roleComputed,
      computedAt: AT,
    });
    await stateStore.save({
      prefix: 'action',
      versionId: 'v1',
      specs: actionSpecs,
      ...actionComputed,
      computedAt: AT,
    });

    const roleCached = await stateStore.get('role', 'v1');
    const actionCached = await stateStore.get('action', 'v1');

    // role은 inactive 구간이 있음
    expect(roleCached!.inactiveRanges.length).toBeGreaterThan(0);
    // action은 모두 active — inactive 없음
    expect(actionCached!.inactiveRanges).toHaveLength(0);
  });

  it('한 prefix의 캐시를 삭제해도 다른 prefix는 영향받지 않는다', async () => {
    const emptyState = {
      specs: [],
      reservedRanges: [],
      inactiveRanges: [],
      openRanges: [],
      computedAt: AT,
    };
    await stateStore.save({ prefix: 'role', versionId: 'v1', ...emptyState });
    await stateStore.save({ prefix: 'action', versionId: 'v1', ...emptyState });

    await stateStore.delete('role', 'v1');

    expect(await stateStore.get('role', 'v1')).toBeNull();
    expect(await stateStore.get('action', 'v1')).not.toBeNull();
  });
});

// ── [S8] 완전한 운영 사이클: 부트 → deprecated → 버전 업그레이드 ──────────────
//
// 단일 테스트로 운영 전체 흐름을 검증한다.
//
//   1. 부트   : DB에 엔트리 적재 → headroom open 선언 → 캐시 저장 → 게이트 확인
//   2. Deprecate: viewer soft-delete → 캐시 무효화 → 재계산 → inactive 게이트 확인
//   3. Upgrade : capacity 부족 → v2 생성 → migrateEntries → v2 캐시 신규 저장
//   4. 정리   : v1 캐시 삭제 → v1 entry 보존 확인 → v2 캐시 활성 확인

describe('[S8] 완전한 운영 사이클 — 부트 → deprecated → 버전 업그레이드', () => {
  let driver: NodeSqliteDriver;
  let metaStore: SqlIndexMetaStore;
  let stateStore: SqlAddressStateStore;

  beforeEach(() => {
    driver = new NodeSqliteDriver(':memory:');
    metaStore = new SqlIndexMetaStore(driver);
    stateStore = new SqlAddressStateStore(driver);
  });

  afterEach(() => {
    driver.close();
  });

  it('부트 → soft delete → 버전 업그레이드 완전 사이클', async () => {
    // ── Phase 1: 부트 ────────────────────────────────────────────────────────
    // DB에 role/v1 적재: admin=1, editor=2, viewer=3 / positions 4-8 = headroom

    await metaStore.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v1',
      capacity: 8,
      createdAt: AT,
    });
    for (const [pos, val] of [
      [1, 'admin'],
      [2, 'editor'],
      [3, 'viewer'],
    ] as const) {
      await metaStore.insertEntry({
        prefix: 'role',
        versionId: 'v1',
        position: pos,
        value: val,
        createdAt: AT,
      });
    }

    const bootSpecs: DimStateSpec[] = [{ dimIndex: 0, state: 'open', coords: '4-8' }];
    const bootComputed = computeStateRanges([8], bootSpecs);
    await stateStore.save({
      prefix: 'role',
      versionId: 'v1',
      specs: bootSpecs,
      ...bootComputed,
      computedAt: 'T1',
    });

    // positions 1-3 → active, positions 4-8 → open
    const bootCache = await stateStore.get('role', 'v1');
    const bootActive = activeRanges(
      8,
      bootCache!.reservedRanges,
      bootCache!.inactiveRanges,
      bootCache!.openRanges,
    );
    expect(activeRanges.length).toBeGreaterThan(0);
    expect(
      checkGate(
        bootActive[0][0],
        ...([bootCache!.reservedRanges, bootCache!.inactiveRanges, bootCache!.openRanges] as const),
      ).state,
    ).toBe('active');
    expect(
      checkGate(
        bootCache!.openRanges[0][0],
        ...([bootCache!.reservedRanges, bootCache!.inactiveRanges, bootCache!.openRanges] as const),
      ).state,
    ).toBe('open');

    // ── Phase 2: viewer soft delete (deprecated) ─────────────────────────────
    // viewer entry는 DB에 그대로 — 게이트 캐시만 갱신

    await stateStore.delete('role', 'v1');

    const deprecatedSpecs: DimStateSpec[] = [
      { dimIndex: 0, state: 'open', coords: '4-8' },
      { dimIndex: 0, state: 'inactive', coords: '3', reason: 'viewer deprecated' },
    ];
    const deprecatedComputed = computeStateRanges([8], deprecatedSpecs);
    await stateStore.save({
      prefix: 'role',
      versionId: 'v1',
      specs: deprecatedSpecs,
      ...deprecatedComputed,
      computedAt: 'T2',
    });

    // viewer entry는 여전히 DB에 존재 (append-only)
    expect(await metaStore.getEntry('role', 'v1', 3)).not.toBeNull();

    // viewer 주소는 inactive: decode ✓, encode ✗
    const deprecatedCache = await stateStore.get('role', 'v1');
    expect(deprecatedCache!.inactiveRanges.length).toBeGreaterThan(0);
    const inactiveGate = checkGate(
      deprecatedCache!.inactiveRanges[0][0],
      deprecatedCache!.reservedRanges,
      deprecatedCache!.inactiveRanges,
      deprecatedCache!.openRanges,
    );
    expect(inactiveGate.state).toBe('inactive');
    expect(inactiveGate.encode).toBe(false);
    expect(inactiveGate.decode).toBe(true);

    // ── Phase 3: 버전 업그레이드 (v2 capacity=16) ────────────────────────────

    await metaStore.insertSchemaVersion({
      prefix: 'role',
      versionId: 'v2',
      capacity: 16,
      createdAt: 'T3',
    });
    const { migrated } = await metaStore.migrateEntries('role', 'v1', 'v2');
    expect(migrated).toBe(3); // admin, editor, viewer 이전 (viewer도 entry는 보존됨)

    // v2 게이트 캐시: positions 4-16 open (viewer는 v2에서 재활성 여부를 별도 판단)
    const v2Specs: DimStateSpec[] = [{ dimIndex: 0, state: 'open', coords: '4-16' }];
    const v2Computed = computeStateRanges([16], v2Specs);
    await stateStore.save({
      prefix: 'role',
      versionId: 'v2',
      specs: v2Specs,
      ...v2Computed,
      computedAt: 'T3',
    });

    // ── Phase 4: 정리 ────────────────────────────────────────────────────────
    // v1 캐시 삭제 (버전 전환 완료), v1 entry는 보존

    await stateStore.delete('role', 'v1');

    expect(await stateStore.get('role', 'v1')).toBeNull();
    expect(await stateStore.get('role', 'v2')).not.toBeNull();

    // v1 entry는 삭제되지 않음 (append-only)
    expect(await metaStore.getEntries('role', 'v1')).toHaveLength(3);

    // v2 entry도 정상
    const v2Entries = await metaStore.getEntries('role', 'v2');
    expect(v2Entries).toHaveLength(3);
    expect(v2Entries.map((e) => e.value)).toEqual(['admin', 'editor', 'viewer']);
  });
});
