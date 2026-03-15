/**
 * E2E: 테이블 정의 → 데이터 적재 → 전체 1D 엔트리 조회 → 서비스 활용
 *
 * 핵심 흐름:
 *   defineTable (capacity 선언)
 *     → compileSchema (주소 공간 확정)
 *       → IndexMetaStore (schema_version + entry 적재)
 *         → getEntries / getEntriesInRange (1D 배열 조회)
 *           → 서비스 레이어 (normal / reserved / empty 분류 → 활용)
 */

import { describe, it, expect, beforeEach } from "vitest";
import { defineTable } from "./table-def.js";
import { compileSchema } from "./compile-schema.js";
import { InMemoryIndexMetaStore } from "./adapters/memory-store.js";
import type { EntryRecord } from "./index-meta-store.js";

// ── 예약 토큰 상수 ────────────────────────────────────────

const RESERVED = {
  NULL:    "_",    // 값이 없거나 미결정
  OTHER:   "~",    // 정의된 카테고리에 해당하지 않음
  UNKNOWN: "?",    // 존재하지만 식별 불가
  NAN:     "NaN",  // 숫자가 아닌 값 (number_enum 전용이지만 예시로 포함)
} as const;

type ReservedToken = typeof RESERVED[keyof typeof RESERVED];

const RESERVED_TOKENS = new Set<string>(Object.values(RESERVED));

// ── 서비스 레이어 헬퍼 ────────────────────────────────────

/**
 * EntryRecord[] + capacity → 전체 1D 뷰.
 * 빈 position은 null, 예약 마커는 token 그대로, 정규 값은 value.
 *
 * 반환: { position, value: string | null, kind }[]
 *   kind = "normal" | "reserved" | "empty"
 */
function buildFullView(
  capacity: number,
  entries: EntryRecord[]
): { position: number; value: string | null; kind: "normal" | "reserved" | "empty" }[] {
  const entryMap = new Map(entries.map((e) => [e.position, String(e.value)]));

  return Array.from({ length: capacity }, (_, i) => {
    const position = i + 1;
    const value = entryMap.get(position) ?? null;

    if (value === null) return { position, value: null, kind: "empty" as const };
    if (RESERVED_TOKENS.has(value)) return { position, value, kind: "reserved" as const };
    return { position, value, kind: "normal" as const };
  });
}

/**
 * 정규(normal) 항목의 index-label 매핑 반환.
 *
 * position = WeightedIndex 좌표 (1-based).
 * 이 값이 composite index encode 시 이 dim의 좌표로 직접 사용된다.
 *
 * 반환: { index: number, label: string }[]
 *   index = 1D 주소 (WeightedIndex 좌표)
 *   label = 해당 주소에 등록된 값
 */
function indexLabelMap(
  view: ReturnType<typeof buildFullView>
): { index: number; label: string }[] {
  return view
    .filter((e) => e.kind === "normal")
    .map((e) => ({ index: e.position, label: e.value! }));
}

/** label → index (1D 주소) 역방향 조회 */
function labelToIndex(
  map: { index: number; label: string }[],
  label: string
): number | null {
  return map.find((e) => e.label === label)?.index ?? null;
}

// ── 픽스처 ───────────────────────────────────────────────

const GAME_CATEGORY_TABLE_ID = "game_category";
const GAME_CATEGORY_VERSION  = "v1";
const CAPACITY = 1000;

/** 적재할 정규 엔트리 목록 (position, value). 중간에 빈 자리 있음. */
const REGULAR_ENTRIES: [number, string][] = [
  [1, "action"],
  [2, "rpg"],
  [3, "strategy"],
  // position 4 = "_" (null marker)
  [5, "sports"],
  [10, "puzzle"],
  [20, "simulation"],
  [50, "adventure"],
  [60, "fighting"],
  [70, "shooter"],
  // positions 71~139 = 빈 주소
  // position 140 = "NaN" marker
  [200, "racing"],
  [300, "horror"],
  [400, "sandbox"],
  [500, "idle"],
  // positions 501~998 = 빈 주소
  // position 999 = "~" (other marker)
  // position 1000 = 빈 주소
];

/** 예약 슬롯 (마커) */
const RESERVED_ENTRIES: [number, string][] = [
  [4,   RESERVED.NULL],    // 미분류
  [140, RESERVED.NAN],     // 숫자 아닌 값 유입
  [999, RESERVED.OTHER],   // 기타
];

// ── 테스트 ───────────────────────────────────────────────

describe("E2E: 게임 카테고리 테이블 1D 주소 공간 구축 + 조회", () => {
  let store: InMemoryIndexMetaStore;

  beforeEach(async () => {
    // ── 1. 스키마 선언 ────────────────────────────────────
    const gameCategoryTable = defineTable(GAME_CATEGORY_TABLE_ID, {
      source: { kind: { type: "string_enum" as const } },
      versions: {
        [GAME_CATEGORY_VERSION]: { capacity: CAPACITY },
      },
    });

    const schema = compileSchema([gameCategoryTable]);
    const spec = schema.getTable(GAME_CATEGORY_TABLE_ID)!;

    // ── 2. schema_version 등록 ────────────────────────────
    store = new InMemoryIndexMetaStore();
    await store.insertSchemaVersion({
      prefix:   GAME_CATEGORY_TABLE_ID,
      versionId: GAME_CATEGORY_VERSION,
      capacity:  spec.versions.get(GAME_CATEGORY_VERSION)!.capacity,
      createdAt: "2026-01-01T00:00:00Z",
    });

    // ── 3. 예약 슬롯 적재 ─────────────────────────────────
    for (const [position, token] of RESERVED_ENTRIES) {
      await store.insertEntry({
        prefix:   GAME_CATEGORY_TABLE_ID,
        versionId: GAME_CATEGORY_VERSION,
        position,
        value:     token,
        createdAt: "2026-01-01T00:00:00Z",
      });
    }

    // ── 4. 정규 엔트리 적재 (중간에 빈 자리 있음) ──────────
    for (const [position, value] of REGULAR_ENTRIES) {
      await store.insertEntry({
        prefix:   GAME_CATEGORY_TABLE_ID,
        versionId: GAME_CATEGORY_VERSION,
        position,
        value,
        createdAt: "2026-01-01T00:00:00Z",
      });
    }
  });

  // ── getCapacity ─────────────────────────────────────────

  it("capacity를 빠르게 조회할 수 있다", async () => {
    const capacity = await store.getCapacity(GAME_CATEGORY_TABLE_ID, GAME_CATEGORY_VERSION);
    expect(capacity).toBe(CAPACITY);
  });

  // ── 전체 엔트리 조회 + 분류 ──────────────────────────────

  it("getEntries는 채워진 position만 반환한다 (sparse)", async () => {
    const entries = await store.getEntries(GAME_CATEGORY_TABLE_ID, GAME_CATEGORY_VERSION);
    const expectedCount = REGULAR_ENTRIES.length + RESERVED_ENTRIES.length;
    expect(entries).toHaveLength(expectedCount);
  });

  it("전체 1D 뷰를 구성하면 capacity 크기의 배열이 된다", async () => {
    const entries = await store.getEntries(GAME_CATEGORY_TABLE_ID, GAME_CATEGORY_VERSION);
    const view = buildFullView(CAPACITY, entries);
    expect(view).toHaveLength(CAPACITY);
  });

  it("전체 뷰에서 normal / reserved / empty 를 분류할 수 있다", async () => {
    const entries = await store.getEntries(GAME_CATEGORY_TABLE_ID, GAME_CATEGORY_VERSION);
    const view = buildFullView(CAPACITY, entries);

    const normals   = view.filter((e) => e.kind === "normal");
    const reserveds = view.filter((e) => e.kind === "reserved");
    const empties   = view.filter((e) => e.kind === "empty");

    expect(normals).toHaveLength(REGULAR_ENTRIES.length);
    expect(reserveds).toHaveLength(RESERVED_ENTRIES.length);
    expect(empties).toHaveLength(CAPACITY - REGULAR_ENTRIES.length - RESERVED_ENTRIES.length);
  });

  it("예약 슬롯의 token과 position이 정확하다", async () => {
    const entries = await store.getEntries(GAME_CATEGORY_TABLE_ID, GAME_CATEGORY_VERSION);
    const view = buildFullView(CAPACITY, entries);

    expect(view[3].value).toBe(RESERVED.NULL);    // position 4 = "_"
    expect(view[139].value).toBe(RESERVED.NAN);   // position 140 = "NaN"
    expect(view[998].value).toBe(RESERVED.OTHER); // position 999 = "~"
  });

  it("빈 position은 empty kind를 가진다", async () => {
    const entries = await store.getEntries(GAME_CATEGORY_TABLE_ID, GAME_CATEGORY_VERSION);
    const view = buildFullView(CAPACITY, entries);

    // position 6~9 는 비어있어야 함
    expect(view[5].kind).toBe("empty");   // position 6
    expect(view[6].kind).toBe("empty");   // position 7
    expect(view[999].kind).toBe("empty"); // position 1000
  });

  // ── 서비스 활용: index ↔ label 매핑 ─────────────────────
  //
  // position = WeightedIndex 좌표.
  // 서비스는 이 매핑을 기반으로 "label이 X인 항목의 1D 주소"를 알고,
  // 그 주소를 composite index encode의 dim 좌표로 직접 활용한다.

  it("정규 엔트리의 index-label 매핑이 정확하다", async () => {
    const entries = await store.getEntries(GAME_CATEGORY_TABLE_ID, GAME_CATEGORY_VERSION);
    const view = buildFullView(CAPACITY, entries);
    const map = indexLabelMap(view);

    // 각 label의 1D index (WeightedIndex 좌표) 확인
    expect(map).toContainEqual({ index: 1,   label: "action"     });
    expect(map).toContainEqual({ index: 2,   label: "rpg"        });
    expect(map).toContainEqual({ index: 3,   label: "strategy"   });
    expect(map).toContainEqual({ index: 5,   label: "sports"     });
    expect(map).toContainEqual({ index: 10,  label: "puzzle"     });
    expect(map).toContainEqual({ index: 500, label: "idle"       });

    // 예약 마커와 빈 주소는 포함되지 않음
    expect(map.map((e) => e.label)).not.toContain(RESERVED.NULL);
    expect(map.map((e) => e.label)).not.toContain(RESERVED.OTHER);
    expect(map.map((e) => e.label)).not.toContain(RESERVED.NAN);
  });

  it("index-label 매핑의 총 수는 정규 엔트리 수와 동일하다", async () => {
    const entries = await store.getEntries(GAME_CATEGORY_TABLE_ID, GAME_CATEGORY_VERSION);
    const view = buildFullView(CAPACITY, entries);
    const map = indexLabelMap(view);

    expect(map).toHaveLength(REGULAR_ENTRIES.length);
  });

  it("label → index 역방향 조회: 서비스가 label로 1D 주소를 얻는다", async () => {
    const entries = await store.getEntries(GAME_CATEGORY_TABLE_ID, GAME_CATEGORY_VERSION);
    const view = buildFullView(CAPACITY, entries);
    const map = indexLabelMap(view);

    // label → WeightedIndex 좌표
    expect(labelToIndex(map, "action")).toBe(1);
    expect(labelToIndex(map, "rpg")).toBe(2);
    expect(labelToIndex(map, "idle")).toBe(500);
    expect(labelToIndex(map, "nonexistent")).toBeNull();

    // 예약 마커는 map에 없으므로 역조회 불가
    expect(labelToIndex(map, RESERVED.NULL)).toBeNull();
  });

  it("index → label 순방향 조회: 1D 주소로 label을 확인한다", async () => {
    const entries = await store.getEntries(GAME_CATEGORY_TABLE_ID, GAME_CATEGORY_VERSION);
    const view = buildFullView(CAPACITY, entries);
    const map = indexLabelMap(view);

    // index → label (position이 WeightedIndex 좌표임을 명시)
    const byIndex = new Map(map.map((e) => [e.index, e.label]));
    expect(byIndex.get(1)).toBe("action");
    expect(byIndex.get(2)).toBe("rpg");
    expect(byIndex.get(500)).toBe("idle");
    expect(byIndex.get(4)).toBeUndefined();   // 예약 슬롯 — map에 없음
    expect(byIndex.get(6)).toBeUndefined();   // 빈 주소 — map에 없음
  });

  // ── 범위 조회 (WeightedIndex 주소 범위 계산 결과 활용) ────

  it("getEntriesInRange로 특정 주소 범위만 조회할 수 있다", async () => {
    const rangeEntries = await store.getEntriesInRange(
      GAME_CATEGORY_TABLE_ID,
      GAME_CATEGORY_VERSION,
      1, 10
    );

    const values = rangeEntries.map((e) => e.value);
    expect(values).toContain("action");  // position 1
    expect(values).toContain("rpg");     // position 2
    expect(values).toContain("puzzle");  // position 10
    expect(values).toContain(RESERVED.NULL); // position 4
    // position 5, 6~9 중 채워진 것만
    expect(rangeEntries.every((e) => e.position >= 1 && e.position <= 10)).toBe(true);
  });

  it("범위 조회로 예약 마커만 있는 구간을 확인할 수 있다", async () => {
    // position 71~139 사이에는 일반 엔트리가 없고 140에 NaN만 있음
    const rangeEntries = await store.getEntriesInRange(
      GAME_CATEGORY_TABLE_ID,
      GAME_CATEGORY_VERSION,
      71, 140
    );

    expect(rangeEntries).toHaveLength(1);
    expect(rangeEntries[0].position).toBe(140);
    expect(rangeEntries[0].value).toBe(RESERVED.NAN);
  });

  // ── 나중에 entry 추가 (버전 변화 없음) ───────────────────

  it("나중에 빈 position에 entry를 추가해도 버전 변화 없이 조회에 반영된다", async () => {
    const newPosition = 71;
    const newValue = "card_game";

    // 나중에 추가
    await store.insertEntry({
      prefix:   GAME_CATEGORY_TABLE_ID,
      versionId: GAME_CATEGORY_VERSION,
      position:  newPosition,
      value:     newValue,
      createdAt: "2026-06-01T00:00:00Z",
    });

    const entries = await store.getEntries(GAME_CATEGORY_TABLE_ID, GAME_CATEGORY_VERSION);
    const view = buildFullView(CAPACITY, entries);

    expect(view[newPosition - 1].value).toBe(newValue);
    expect(view[newPosition - 1].kind).toBe("normal");

    // capacity 그대로 — 버전 불변
    expect(await store.getCapacity(GAME_CATEGORY_TABLE_ID, GAME_CATEGORY_VERSION)).toBe(CAPACITY);
  });

  // ── capacity 확장 = 새 버전 ───────────────────────────────

  it("capacity를 늘릴 때만 새 버전을 만든다", async () => {
    const NEW_VERSION = "v2";
    const NEW_CAPACITY = 2000;

    await store.insertSchemaVersion({
      prefix:   GAME_CATEGORY_TABLE_ID,
      versionId: NEW_VERSION,
      capacity:  NEW_CAPACITY,
      createdAt: "2026-06-01T00:00:00Z",
    });

    expect(await store.getCapacity(GAME_CATEGORY_TABLE_ID, "v1")).toBe(CAPACITY);
    expect(await store.getCapacity(GAME_CATEGORY_TABLE_ID, NEW_VERSION)).toBe(NEW_CAPACITY);

    const versions = await store.getSchemaVersions(GAME_CATEGORY_TABLE_ID);
    expect(versions.map((v) => v.versionId)).toEqual(["v1", "v2"]);
  });
});
