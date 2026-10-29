// @def.boundary validation-layer-group
// @def.doc validation-layer-group

/**
 * E2E: 주소 조회 경로 vs 정보 조회 경로 분리
 *
 * 인덱스 시스템에는 두 가지 조회 경로가 있다.
 * 같은 entry store와 gate cache를 공유하지만, 목적과 처리 흐름이 다르다.
 *
 * ── [A] 주소 조회 경로 (address path / encode direction) ─────────────────────
 *
 *   entity label → position 역방향 조회 → gate(encodable?) → composite 주소
 *
 *   - 새 데이터를 기록하거나 쿼리 필터를 만들 때 주소만 필요한 경우.
 *   - entry store에서 label을 스캔해 position을 찾는다.
 *   - gate가 encode를 막으면 해당 entity는 사용 불가.
 *   - 정보(value)를 다시 꺼낼 필요가 없으므로 캐싱 레이어 불필요.
 *   - inactive entity: position은 있지만 encode 불가 → 새 데이터에 사용 금지.
 *   - open slot: encode 가능 → headroom에 새 값을 채울 수 있다.
 *
 * ── [B] 정보 조회 경로 (info path / decode direction) ──────────────────────
 *
 *   composite 주소 → gate(decodable?) → position 추출 → entry 조회 → entity 정보
 *
 *   - 저장된 주소에서 실제 entity 데이터를 복원할 때.
 *   - 반복 조회가 많으므로 캐싱 레이어를 앞에 붙이는 것이 유리하다.
 *   - 게이트 상태별 처리:
 *       active   → 캐시 → miss 시 entry store 조회
 *       inactive → decode 허용 (deprecated 정보), encode는 차단
 *       open     → decode 차단 (값 없음). shouldVerify=true → store 직접 재확인 필요
 *       reserved → decode 차단. 캐시 무효. hard block (shouldVerify=false).
 *
 * ── shouldVerify 핸들링 ──────────────────────────────────────────────────────
 *
 *   open 상태: 게이트 캐시 계산 시점에는 비어있었으나, 이후 값이 채워졌을 수 있다.
 *   shouldVerify=true 이면 캐시가 stale할 수 있으므로 entry store를 직접 확인한다.
 *   (reserved는 의도적 잠금이므로 shouldVerify=false — 재확인 불필요)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  NodeSqliteDriver,
  SqlIndexMetaStore,
  SqlAddressStateStore,
  computeStateRanges,
  checkGate,
  type DimStateSpec,
  type GateResult,
  type EntryRecord,
} from 'index-meta';
import type { EntityId } from 'index-meta';

// ── 픽스처 설명 ────────────────────────────────────────────
//
// 1D 인덱스: role (capacity=4, shape=[4])
//
//   position 1 → admin  (active)
//   position 2 → editor (active)
//   position 3 → viewer (inactive — deprecated)
//   position 4 → <empty>(open — headroom)
//
// 1D composite address = position - 1  (0-indexed)
//   admin  → address 0
//   editor → address 1
//   viewer → address 2 (inactive)
//   open   → address 3 (open)
//
// Gate specs:
//   { dimIndex: 0, state: "inactive", coords: "3" }  ← viewer deprecated
//   { dimIndex: 0, state: "open",     coords: "4" }  ← headroom slot

const TABLE = 'role';
const VERSION = 'v1';
const SHAPE = [4] as const;
const AT = '2026-01-01T00:00:00Z';

// 1D position ↔ composite address 변환
const toAddress = (position: number): number => position - 1;
const toPosition = (address: number): number => address + 1;

// ── 인포 캐시 (애플리케이션 레이어 시뮬레이션) ──────────────
//
// 실제 서비스라면 Redis / in-process LRU 등을 사용한다.
// 여기서는 Map으로 캐시 레이어를 시뮬레이션한다.

/** entry store 값(EntityId)을 그대로 캐시한다 */
type CacheEntry = { value: EntityId; cachedAt: string };

function makeInfoCache() {
  const _map = new Map<number, CacheEntry>();
  let _hitCount = 0;

  return {
    get(address: number): CacheEntry | null {
      const hit = _map.get(address) ?? null;
      if (hit) _hitCount++;
      return hit;
    },
    set(address: number, value: EntityId, cachedAt: string): void {
      _map.set(address, { value, cachedAt });
    },
    delete(address: number): void {
      _map.delete(address);
    },
    hitCount(): number {
      return _hitCount;
    },
    size(): number {
      return _map.size;
    },
  };
}

// ── 공통 셋업 ──────────────────────────────────────────────

let driver: NodeSqliteDriver;
let metaStore: SqlIndexMetaStore;
let stateStore: SqlAddressStateStore;

// gate 캐시 로드 헬퍼 (null이면 전체 active로 처리)
async function loadGate() {
  return await stateStore.get(TABLE, VERSION);
}

function gate(address: number, cache: Awaited<ReturnType<typeof loadGate>>): GateResult {
  if (!cache) {
    return { encode: true, decode: true, state: 'active', shouldVerify: false };
  }
  return checkGate(address, cache.reservedRanges, cache.inactiveRanges, cache.openRanges);
}

// ── [A] 주소 조회 경로 ─────────────────────────────────────

describe('[A] 주소 조회 경로 — label → position → gate → 주소', () => {
  beforeEach(async () => {
    driver = new NodeSqliteDriver(':memory:');
    metaStore = new SqlIndexMetaStore(driver);
    stateStore = new SqlAddressStateStore(driver);

    await metaStore.insertSchemaVersion({
      prefix: TABLE,
      versionId: VERSION,
      capacity: 4,
      createdAt: AT,
    });
    await metaStore.insertEntry({
      prefix: TABLE,
      versionId: VERSION,
      position: 1,
      value: 'admin',
      createdAt: AT,
    });
    await metaStore.insertEntry({
      prefix: TABLE,
      versionId: VERSION,
      position: 2,
      value: 'editor',
      createdAt: AT,
    });
    await metaStore.insertEntry({
      prefix: TABLE,
      versionId: VERSION,
      position: 3,
      value: 'viewer',
      createdAt: AT,
    });
    // position 4: 비워둠 (open headroom)

    const specs: DimStateSpec[] = [
      { dimIndex: 0, state: 'inactive', coords: '3' },
      { dimIndex: 0, state: 'open', coords: '4' },
    ];
    const computed = computeStateRanges(SHAPE, specs);
    await stateStore.save({
      prefix: TABLE,
      versionId: VERSION,
      specs,
      ...computed,
      computedAt: AT,
    });
  });

  afterEach(() => {
    driver.close();
  });

  it('active entity: label로 position을 찾고 encode gate를 통과한다', async () => {
    // 주소 경로: label → position (entry 스캔) → gate check
    const entries = await metaStore.getEntries(TABLE, VERSION);
    const adminEntry = entries.find((e) => e.value === 'admin')!;

    expect(adminEntry).toBeDefined();
    expect(adminEntry.position).toBe(1);

    const address = toAddress(adminEntry.position); // 0
    const g = gate(address, await loadGate());

    expect(g.encode).toBe(true);
    // 주소 경로 완료 — entity 값을 다시 읽지 않았음
  });

  it('inactive entity(viewer): position을 찾지만 encode gate가 차단된다', async () => {
    const entries = await metaStore.getEntries(TABLE, VERSION);
    const viewerEntry = entries.find((e) => e.value === 'viewer')!;

    expect(viewerEntry.position).toBe(3);

    const address = toAddress(viewerEntry.position); // 2
    const g = gate(address, await loadGate());

    expect(g.encode).toBe(false);
    expect(g.state).toBe('inactive');
    // deprecated entity는 새 데이터에 사용 불가 — 주소 경로가 여기서 막힘
  });

  it('open slot: position을 찾을 수 없지만 해당 주소는 encode 가능하다', async () => {
    // position 4에는 아직 entry가 없음 (headroom)
    const entries = await metaStore.getEntries(TABLE, VERSION);
    const openEntry = entries.find((e) => e.position === 4);
    expect(openEntry).toBeUndefined(); // 아직 채워지지 않음

    const openAddress = toAddress(4); // 3
    const g = gate(openAddress, await loadGate());

    // headroom 슬롯: encode 허용 → 여기에 새 값을 채울 수 있다
    expect(g.encode).toBe(true);
    expect(g.state).toBe('open');
    expect(g.shouldVerify).toBe(true); // 캐시 계산 후 이미 채워졌을 수 있음
  });

  it('주소 경로는 position만 사용하고 실제 value 재조회가 필요 없다', async () => {
    // 이 테스트는 주소 경로가 "얼마나 적은" 정보를 접근하는지를 보여준다.
    // position → address 변환과 gate check만 있으면 충분.
    const entries = await metaStore.getEntries(TABLE, VERSION);
    const cache = await loadGate();

    // 각 entry에 대해 address와 encodability만 파악
    const addressMap = entries.map((e) => ({
      position: e.position,
      address: toAddress(e.position),
      encodable: gate(toAddress(e.position), cache).encode,
      // value는 이 경로에서 불필요
    }));

    expect(addressMap.find((a) => a.position === 1)?.encodable).toBe(true); // admin
    expect(addressMap.find((a) => a.position === 2)?.encodable).toBe(true); // editor
    expect(addressMap.find((a) => a.position === 3)?.encodable).toBe(false); // viewer (inactive)
  });
});

// ── [B] 정보 조회 경로 ─────────────────────────────────────

describe('[B] 정보 조회 경로 — 주소 → gate → entry store → entity 정보', () => {
  beforeEach(async () => {
    driver = new NodeSqliteDriver(':memory:');
    metaStore = new SqlIndexMetaStore(driver);
    stateStore = new SqlAddressStateStore(driver);

    await metaStore.insertSchemaVersion({
      prefix: TABLE,
      versionId: VERSION,
      capacity: 4,
      createdAt: AT,
    });
    await metaStore.insertEntry({
      prefix: TABLE,
      versionId: VERSION,
      position: 1,
      value: 'admin',
      createdAt: AT,
    });
    await metaStore.insertEntry({
      prefix: TABLE,
      versionId: VERSION,
      position: 2,
      value: 'editor',
      createdAt: AT,
    });
    await metaStore.insertEntry({
      prefix: TABLE,
      versionId: VERSION,
      position: 3,
      value: 'viewer',
      createdAt: AT,
    });
    // position 4: 비워둠 (open headroom)

    const specs: DimStateSpec[] = [
      { dimIndex: 0, state: 'inactive', coords: '3' },
      { dimIndex: 0, state: 'open', coords: '4' },
    ];
    const computed = computeStateRanges(SHAPE, specs);
    await stateStore.save({
      prefix: TABLE,
      versionId: VERSION,
      specs,
      ...computed,
      computedAt: AT,
    });
  });

  afterEach(() => {
    driver.close();
  });

  it('active 주소: decode gate 통과 → entry store에서 값 조회', async () => {
    const address = toAddress(1); // admin
    const cache = await loadGate();
    const g = gate(address, cache);

    expect(g.decode).toBe(true);
    expect(g.state).toBe('active');

    // 인포 조회: position으로 entry 읽기
    const entry = await metaStore.getEntry(TABLE, VERSION, toPosition(address));
    expect(entry?.value).toBe('admin');
  });

  it('inactive 주소(viewer): decode는 허용 — deprecated 정보를 여전히 읽을 수 있다', async () => {
    const address = toAddress(3); // viewer
    const cache = await loadGate();
    const g = gate(address, cache);

    // inactive: decode ✓ (기존 데이터 조회 허용), encode ✗ (새 기록 불가)
    expect(g.decode).toBe(true);
    expect(g.encode).toBe(false);
    expect(g.state).toBe('inactive');

    // 실제 정보는 여전히 entry store에 존재 (append-only — 삭제 없음)
    const entry = await metaStore.getEntry(TABLE, VERSION, toPosition(address));
    expect(entry?.value).toBe('viewer');
    // 호출자는 state === "inactive" 를 보고 deprecated임을 인지한다
  });

  it('open 주소(headroom): decode 차단 — entry store 접근 없음', async () => {
    const address = toAddress(4); // headroom
    const cache = await loadGate();
    const g = gate(address, cache);

    // open: decode ✗ → 정보 조회 경로가 여기서 막힘
    expect(g.decode).toBe(false);
    expect(g.state).toBe('open');

    // entry store 접근 필요 없음 (값 없음)
    // shouldVerify=true: 캐시 stale 가능성 → 별도 처리 필요 (아래 테스트 참조)
  });

  it('reserved 주소: decode 차단 + shouldVerify=false — hard block, 재확인 불필요', async () => {
    // reserved 주소를 만들기 위해 inactive + open 겹침 생성 (2D)
    // 여기서는 직접 reserved 캐시를 주입해 테스트
    const reservedSpecs: DimStateSpec[] = [{ dimIndex: 0, state: 'reserved', coords: '4' }];
    const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges(SHAPE, reservedSpecs);
    await stateStore.save({
      prefix: TABLE,
      versionId: VERSION,
      specs: reservedSpecs,
      reservedRanges,
      inactiveRanges,
      openRanges,
      computedAt: AT,
    });

    const address = toAddress(4); // reserved slot
    const cache = await loadGate();
    const g = gate(address, cache);

    expect(g.decode).toBe(false);
    expect(g.state).toBe('reserved');
    expect(g.shouldVerify).toBe(false); // 의도적 잠금 — 재확인 의미 없음
  });

  // ── 캐싱 레이어 적용 ─────────────────────────────────────

  it('캐시 hit: entry store를 다시 조회하지 않는다', async () => {
    const cache = await loadGate();
    const infoCache = makeInfoCache();

    // 캐시에 미리 채워두기
    infoCache.set(toAddress(1), 'admin', AT);

    // 정보 조회: 캐시 hit → entry store 불필요
    const address = toAddress(1);
    const g = gate(address, cache);

    if (g.decode) {
      const cached = infoCache.get(address);
      if (cached && !g.shouldVerify) {
        // 캐시 hit, entry store 접근 없음
        expect(cached.value).toBe('admin');
        expect(infoCache.hitCount()).toBe(1);
        return;
      }
    }

    // 여기에 오면 테스트 실패 (캐시 hit이어야 함)
    expect.fail('cache should have hit');
  });

  it('캐시 miss: entry store를 조회하고 결과를 캐시에 저장한다', async () => {
    const cache = await loadGate();
    const infoCache = makeInfoCache();

    const address = toAddress(2); // editor
    const g = gate(address, cache);

    expect(g.decode).toBe(true);

    // 캐시 miss → entry store 조회
    const cached = infoCache.get(address);
    expect(cached).toBeNull();

    const entry = await metaStore.getEntry(TABLE, VERSION, toPosition(address));
    expect(entry?.value).toBe('editor');

    // 결과를 캐시에 저장
    infoCache.set(address, entry!.value, new Date().toISOString());
    expect(infoCache.size()).toBe(1);

    // 다음 조회: 캐시 hit
    const second = infoCache.get(address);
    expect(second?.value).toBe('editor');
    expect(infoCache.hitCount()).toBe(1);
  });
});

// ── [C] shouldVerify — 캐시 stale 감지 및 재확인 ─────────────────────────────
//
// open 상태에서 shouldVerify=true 이면:
//   - 게이트 캐시가 계산된 후 해당 position에 값이 채워졌을 수 있다.
//   - entry store를 직접 확인해 실제 상태를 파악해야 한다.
//
// 시나리오:
//   1. position 4가 비어있을 때 게이트 캐시 계산 (open)
//   2. 이후 position 4에 새 값("guest") 삽입 — 캐시는 아직 갱신 안 됨
//   3. 정보 조회: gate → open → shouldVerify=true → store 직접 확인
//   4. 실제 entry 발견 → 캐시 stale 확인 → 캐시 갱신

describe('[C] shouldVerify — 캐시 stale 감지 및 재확인', () => {
  beforeEach(async () => {
    driver = new NodeSqliteDriver(':memory:');
    metaStore = new SqlIndexMetaStore(driver);
    stateStore = new SqlAddressStateStore(driver);

    await metaStore.insertSchemaVersion({
      prefix: TABLE,
      versionId: VERSION,
      capacity: 4,
      createdAt: AT,
    });
    await metaStore.insertEntry({
      prefix: TABLE,
      versionId: VERSION,
      position: 1,
      value: 'admin',
      createdAt: AT,
    });
    await metaStore.insertEntry({
      prefix: TABLE,
      versionId: VERSION,
      position: 2,
      value: 'editor',
      createdAt: AT,
    });
    await metaStore.insertEntry({
      prefix: TABLE,
      versionId: VERSION,
      position: 3,
      value: 'viewer',
      createdAt: AT,
    });

    // 게이트 캐시: position 4 = open (이 시점에 비어있음)
    const specs: DimStateSpec[] = [{ dimIndex: 0, state: 'open', coords: '4' }];
    const computed = computeStateRanges(SHAPE, specs);
    await stateStore.save({
      prefix: TABLE,
      versionId: VERSION,
      specs,
      ...computed,
      computedAt: 'T1',
    });
  });

  afterEach(() => {
    driver.close();
  });

  it('shouldVerify=true: 캐시가 open이라도 entry store를 직접 확인한다', async () => {
    // 캐시 계산 후 position 4에 값이 채워짐 (캐시는 stale)
    await metaStore.insertEntry({
      prefix: TABLE,
      versionId: VERSION,
      position: 4,
      value: 'guest',
      createdAt: 'T2',
    });

    const address = toAddress(4); // open slot
    const cache = await loadGate();
    const g = gate(address, cache);

    // 게이트 캐시는 여전히 "open"
    expect(g.state).toBe('open');
    expect(g.shouldVerify).toBe(true);

    // shouldVerify=true → entry store 직접 확인
    const actualEntry = await metaStore.getEntry(TABLE, VERSION, toPosition(address));

    // 실제로는 값이 채워져 있음 — 캐시가 stale했음을 확인
    expect(actualEntry).not.toBeNull();
    expect(actualEntry?.value).toBe('guest');
  });

  it('shouldVerify=true + 아직 비어있음: entry store 확인 결과 null — 캐시 정확', async () => {
    // position 4에 아무도 값을 채우지 않은 경우
    const address = toAddress(4);
    const cache = await loadGate();
    const g = gate(address, cache);

    expect(g.shouldVerify).toBe(true);

    const actualEntry = await metaStore.getEntry(TABLE, VERSION, toPosition(address));

    // entry store도 비어있음 → 캐시가 정확 (stale 아님)
    expect(actualEntry).toBeNull();
  });

  it('shouldVerify=false(reserved/inactive/active): entry store 재확인 불필요', async () => {
    // active, inactive, reserved 상태에서는 shouldVerify=false
    const cache = await loadGate();

    // active (position 1)
    expect(gate(toAddress(1), cache).shouldVerify).toBe(false);

    // inactive → reservedSpecs로 교체해 확인
    const inactiveSpecs: DimStateSpec[] = [{ dimIndex: 0, state: 'inactive', coords: '2' }];
    const { reservedRanges, inactiveRanges, openRanges } = computeStateRanges(SHAPE, inactiveSpecs);
    const inactiveGate = checkGate(toAddress(2), reservedRanges, inactiveRanges, openRanges);
    expect(inactiveGate.shouldVerify).toBe(false);

    // reserved
    const reservedSpecs: DimStateSpec[] = [{ dimIndex: 0, state: 'reserved', coords: '4' }];
    const res = computeStateRanges(SHAPE, reservedSpecs);
    const reservedGate = checkGate(
      toAddress(4),
      res.reservedRanges,
      res.inactiveRanges,
      res.openRanges,
    );
    expect(reservedGate.shouldVerify).toBe(false);
  });

  it('캐시 갱신 사이클: open → 값 채움 → 게이트 캐시 재계산 → active', async () => {
    // 1. position 4에 guest 삽입
    await metaStore.insertEntry({
      prefix: TABLE,
      versionId: VERSION,
      position: 4,
      value: 'guest',
      createdAt: 'T2',
    });

    // 2. open spec 제거하고 캐시 재계산 (position 4가 이제 active)
    await stateStore.delete(TABLE, VERSION);

    const newSpecs: DimStateSpec[] = []; // position 4도 active
    const newComputed = computeStateRanges(SHAPE, newSpecs);
    await stateStore.save({
      prefix: TABLE,
      versionId: VERSION,
      specs: newSpecs,
      ...newComputed,
      computedAt: 'T3',
    });

    // 3. 재계산된 캐시에서 position 4는 이제 active
    const address = toAddress(4);
    const cache = await loadGate();
    const g = gate(address, cache);

    expect(g.state).toBe('active');
    expect(g.decode).toBe(true);
    expect(g.encode).toBe(true);
    expect(g.shouldVerify).toBe(false);

    // 4. entry store에서도 정상 조회
    const entry = await metaStore.getEntry(TABLE, VERSION, toPosition(address));
    expect(entry?.value).toBe('guest');
  });
});
