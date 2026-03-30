/**
 * IndexSDK — index-meta 경량 소비 레이어
 *
 * ── 목적 ───────────────────────────────────────────────────────────────────
 *
 * MetaRegistryInput(스키마 정의) 하나로 즉시 사용 가능한 SDK를 생성한다.
 * 개발자는 "click", "home" 같은 entity name만 입력하면,
 * 내부에서 { indexId, versionId, value } (VersionedValue)로 압축해 반환한다.
 *
 * ── 설계 원칙 ──────────────────────────────────────────────────────────────
 *
 * - 버전 고정: client()로 index + version을 한 번 바인딩하면 이후 호출에서 생략.
 * - enum-like 상수: constants()로 dim entries를 객체로 추출해 IDE 자동완성 지원.
 * - 환경 무관: Node.js / 브라우저 / Edge 어디서든 동작 (Node 전용 의존성 없음).
 * - 캐싱: 동일 index+version client는 내부 캐싱으로 재생성 비용 없음.
 *
 * ── 사용 예 ────────────────────────────────────────────────────────────────
 *
 * ```ts
 * import { createIndexSDK } from "index-meta/client";
 *
 * const sdk = createIndexSDK({
 *   dims: {
 *     action: { kind: { type: "string_enum" }, snapshots: { v1: { entries: ["click", "view"] } } },
 *     page:   { kind: { type: "string_enum" }, snapshots: { v1: { entries: ["home", "product"] } } },
 *   },
 *   indices: {
 *     tracking: { dims: ["action", "page"], versions: { v1: { snapshots: { action: "v1", page: "v1" } } } },
 *   },
 * });
 *
 * const tracking = sdk.client("tracking", "v1");
 * const ACTION = tracking.constants("action");  // { click: "click", view: "view" }
 *
 * const vv = tracking.encode({ action: ACTION.click, page: "home" });
 * // → { indexId: "tracking", versionId: "v1", value: 0 }
 *
 * tracking.decode(vv);
 * // → { action: "click", page: "home" }
 * ```
 */

import { MetaRegistry, computeActiveIndices, snapshotCapacity } from "./meta-registry.js";
import { MetaResolver } from "./meta-resolver.js";
import type { MetaRegistryInput, DecodeMap, EntityId, VersionedValue, DimActiveSet } from "./types.js";
import { DimNotFoundError } from "./errors.js";

// ── 예약 토큰 ────────────────────────────────────────────────────────────────

/**
 * 표준 예약 토큰.
 *
 * dim entries 배열의 앞쪽에 배치되는 특수 목적 토큰.
 * constants()는 이 토큰에 해당하는 entry를 자동 제외한다.
 *
 * | 토큰 | 의미 |
 * |------|------|
 * | `"_"` | null — 값이 없거나 미결정 |
 * | `"~"` | other — 정의된 카테고리에 해당하지 않음 |
 * | `"?"` | unknown — 존재하지만 식별 불가 |
 */
export const RESERVED_TOKENS: ReadonlySet<string> = new Set(["_", "~", "?"]);

/**
 * `createIndexSDK` 옵션.
 */
export interface IndexSDKOptions {
  /**
   * constants()에서 제외할 예약 토큰 셋.
   *
   * 테이블마다 사용하는 예약 토큰이 다를 수 있으므로 오버라이드 가능.
   * 생략 시 기본 RESERVED_TOKENS ({"_", "~", "?"})를 사용한다.
   *
   * @example
   * // 기본 토큰 + "NaN" 추가
   * createIndexSDK(input, { reservedTokens: new Set(["_", "~", "?", "NaN"]) })
   *
   * // 예약 토큰 필터링 비활성화
   * createIndexSDK(input, { reservedTokens: new Set() })
   */
  reservedTokens?: ReadonlySet<string>;
}

// ── IndexClient ──────────────────────────────────────────────────────────────

/**
 * 특정 index + version에 고정된 경량 클라이언트.
 *
 * MetaCodec을 내부에 보유하며, encode/decode/matchRanges를
 * indexId·versionId 지정 없이 호출할 수 있다.
 */
export interface IndexClient {
  /** entity names → VersionedValue */
  encode(entities: Record<string, EntityId>): VersionedValue;

  /** VersionedValue → entity names (indexId/versionId 검증 포함) */
  decode(vv: VersionedValue): Readonly<Record<string, EntityId>>;

  /** value(정수) → entity names (indexId/versionId 검증 없음) */
  decodeValue(value: number): Readonly<Record<string, EntityId>>;

  /** 부분 매칭 범위 조회 (DB BETWEEN 쿼리용) */
  matchRanges(partial: Record<string, EntityId | null>): [number, number][];

  /** 이 client에 바인딩된 dim의 entries 배열 반환 */
  entries(dimId: string): readonly EntityId[];

  /**
   * dim entries를 enum-like 상수 객체로 반환 (캐싱됨).
   *
   * 이 client가 바인딩된 version의 snapshot에서 entries를 추출한다.
   * 예약 토큰("_", "~", "?")과 inactive 항목은 자동 제외된다.
   *
   * string_enum: { click: "click", view: "view" }
   * number_enum: { "10": 10, "20": 20 }
   */
  constants(dimId: string): Readonly<Record<string, EntityId>>;

  /**
   * dim별 용량 정보 반환.
   *
   * headroom > 0이면 버전 변경 없이 새 entry를 추가할 수 있는 여유 공간이 있다.
   * 추가는 관리 레이어(레지스트리/DB)에서 수행한 뒤 SDK를 재생성해 동기화한다.
   */
  dimCapacity(dimId: string): DimCapacityInfo;

  /**
   * dim의 전체 주소 공간 뷰 (capacity 포함).
   *
   * 백엔드에서 주소를 추론해야 할 때 사용한다.
   * entries() / constants()와 달리 빈 슬롯(headroom)까지 포함한
   * 전체 position [1..capacity]의 상태를 반환한다.
   *
   * position별 kind:
   * - normal: 정규 도메인 값
   * - reserved: 슬롯 마커 ("_", "~", "?" 등)
   * - empty: 아직 값이 없는 빈 슬롯 (headroom)
   */
  dimFullView(dimId: string): DimFullView;

  /** DecodeMap 반환 (다른 서비스로 전달해 독립 decode에 사용) */
  toDecodeMap(): DecodeMap;

  readonly indexId: string;
  readonly versionId: string;
  readonly size: number;
  readonly shape: readonly number[];
}

/**
 * dim의 현재 용량 상태.
 */
export interface DimCapacityInfo {
  /** 현재 등록된 entries 수 */
  total: number;
  /** 할당된 주소 공간 크기 */
  capacity: number;
  /** 추가 가능한 슬롯 수 (capacity - total) */
  headroom: number;
}

// ── DimFullView ─────────────────────────────────────────────────────────────

/**
 * dim 주소 공간의 단일 position 뷰.
 */
export interface DimEntryView {
  /** 1-based position */
  position: number;
  /** 해당 position의 entity 값. empty slot이면 null */
  value: EntityId | null;
  /** normal = 정규 도메인 값, reserved = 슬롯 마커, empty = headroom 빈 슬롯 */
  kind: "normal" | "reserved" | "empty";
}

/**
 * dim의 전체 주소 공간 뷰 (capacity 포함).
 *
 * 백엔드에서 주소를 추론해야 할 때 사용한다.
 * 모든 position(1..capacity)의 상태를 포함하므로
 * 빈 슬롯, 예약 마커, 정규 엔티티를 한눈에 파악할 수 있다.
 */
export interface DimFullView {
  dimId: string;
  snapshotId: string;
  /** 현재 등록된 entries 수 */
  total: number;
  /** 할당된 주소 공간 크기 */
  capacity: number;
  /** 추가 가능한 슬롯 수 (capacity - total) */
  headroom: number;
  /** 모든 position [1..capacity]의 뷰 */
  positions: readonly DimEntryView[];
}

// ── IndexSDK ─────────────────────────────────────────────────────────────────

/**
 * MetaRegistryInput에서 생성된 SDK 인스턴스.
 *
 * client()로 version-pinned 클라이언트를 생성하고,
 * constants()로 dim entries를 enum-like 객체로 추출한다.
 */
export interface IndexSDK {
  /** index + version에 고정된 클라이언트 생성 (캐싱됨) */
  client(indexId: string, versionId: string): IndexClient;

  /**
   * dim entries를 enum-like 상수 객체로 반환 (캐싱됨).
   *
   * 특정 index에 바인딩되지 않은 dim-level 상수 추출에 사용.
   * 예약 토큰("_", "~", "?")과 inactive 항목은 자동 제외된다.
   * index에 바인딩된 상수는 client.constants()를 사용한다.
   */
  constants(dimId: string, snapshotId: string): Readonly<Record<string, EntityId>>;

  /** 내부 MetaRegistry 접근 (직렬화, 고급 조회 등) */
  readonly registry: MetaRegistry;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createIndexSDK(input: MetaRegistryInput, options?: IndexSDKOptions): IndexSDK {
  const registry = new MetaRegistry(input);
  const resolver = new MetaResolver(registry);
  const reservedTokens = options?.reservedTokens ?? RESERVED_TOKENS;
  const clientCache = new Map<string, IndexClient>();
  const sdkConstantsCache = new Map<string, Readonly<Record<string, EntityId>>>();

  return {
    client(indexId: string, versionId: string): IndexClient {
      const key = `${indexId}:${versionId}`;
      const cached = clientCache.get(key);
      if (cached) return cached;

      const codec = registry.createCodec(indexId, versionId);
      const decodeMap = resolver.getDecodeMap(indexId, versionId);
      const manifest = registry.getActiveManifest(indexId, versionId);
      const iv = registry.getIndexVersion(indexId, versionId);

      // dim entries + capacity를 미리 인덱싱
      const dimEntriesMap = new Map<string, readonly EntityId[]>();
      const dimActiveSetMap = new Map<string, DimActiveSet>();
      const dimCapacityMap = new Map<string, DimCapacityInfo>();
      const dimSnapshotIdMap = new Map<string, string>();
      for (const dim of decodeMap.dims) {
        dimEntriesMap.set(dim.dimId, Object.freeze([...dim.entries]));
        const snapshotId = iv.snapshots[dim.dimId];
        dimSnapshotIdMap.set(dim.dimId, snapshotId);
        const snapshot = registry.getDimSnapshot(dim.dimId, snapshotId);
        const cap = snapshotCapacity(snapshot);
        dimCapacityMap.set(dim.dimId, {
          total: snapshot.entries.length,
          capacity: cap,
          headroom: cap - snapshot.entries.length,
        });
      }
      for (const dimSet of manifest.dims) {
        dimActiveSetMap.set(dimSet.dimId, dimSet);
      }

      // constants 캐시 (client 수준)
      const constantsCache = new Map<string, Readonly<Record<string, EntityId>>>();

      const client: IndexClient = {
        encode: (entities) => codec.encode(entities),
        decode: (vv) => codec.decode(vv),
        decodeValue: (v) => codec.decodeValue(v),
        matchRanges: (p) => codec.matchRanges(p),

        entries(dimId: string): readonly EntityId[] {
          const e = dimEntriesMap.get(dimId);
          if (!e) {
            throw new DimNotFoundError(
              `Dim "${dimId}" not found in index "${indexId}/${versionId}"`
            );
          }
          return e;
        },

        constants(dimId: string): Readonly<Record<string, EntityId>> {
          const c = constantsCache.get(dimId);
          if (c) return c;

          const e = dimEntriesMap.get(dimId);
          if (!e) {
            throw new DimNotFoundError(
              `Dim "${dimId}" not found in index "${indexId}/${versionId}"`
            );
          }

          const activeSet = dimActiveSetMap.get(dimId);
          const built = buildConstants(e, activeSet, reservedTokens);
          constantsCache.set(dimId, built);
          return built;
        },

        dimCapacity(dimId: string): DimCapacityInfo {
          const info = dimCapacityMap.get(dimId);
          if (!info) {
            throw new DimNotFoundError(
              `Dim "${dimId}" not found in index "${indexId}/${versionId}"`
            );
          }
          return info;
        },

        dimFullView(dimId: string): DimFullView {
          const entries = dimEntriesMap.get(dimId);
          if (!entries) {
            throw new DimNotFoundError(
              `Dim "${dimId}" not found in index "${indexId}/${versionId}"`
            );
          }
          // eslint-disable-next-line typescript/no-non-null-assertion -- dimEntriesMap 존재 확인 후 접근, 동일 루프에서 함께 구축됨
          const capInfo = dimCapacityMap.get(dimId)!;
          // eslint-disable-next-line typescript/no-non-null-assertion -- dimEntriesMap 존재 확인 후 접근, 동일 루프에서 함께 구축됨
          const snapshotId = dimSnapshotIdMap.get(dimId)!;

          const positions: DimEntryView[] = [];
          for (let pos = 1; pos <= capInfo.capacity; pos++) {
            if (pos <= entries.length) {
              const entry = entries[pos - 1];
              const isReserved = typeof entry === "string" && reservedTokens.has(entry);
              positions.push({
                position: pos,
                value: entry,
                kind: isReserved ? "reserved" : "normal",
              });
            } else {
              positions.push({
                position: pos,
                value: null,
                kind: "empty",
              });
            }
          }

          return Object.freeze({
            dimId,
            snapshotId,
            total: capInfo.total,
            capacity: capInfo.capacity,
            headroom: capInfo.headroom,
            positions: Object.freeze(positions),
          });
        },

        toDecodeMap: () => structuredClone(decodeMap),

        indexId: codec.indexId,
        versionId: codec.versionId,
        size: codec.size,
        shape: codec.shape,
      };

      clientCache.set(key, client);
      return client;
    },

    constants(dimId: string, snapshotId: string): Readonly<Record<string, EntityId>> {
      const cacheKey = `${dimId}:${snapshotId}`;
      const c = sdkConstantsCache.get(cacheKey);
      if (c) return c;

      const snapshot = registry.getDimSnapshot(dimId, snapshotId);
      const activeIndices = computeActiveIndices(snapshot);
      const activeSet: DimActiveSet = {
        dimId,
        snapshotId,
        total: snapshot.entries.length,
        activeIndices,
      };
      const built = buildConstants(snapshot.entries, activeSet, reservedTokens);
      sdkConstantsCache.set(cacheKey, built);
      return built;
    },

    get registry() {
      return registry;
    },
  };
}

// ── Internal ─────────────────────────────────────────────────────────────────

/**
 * entries → enum-like 상수 객체.
 *
 * 예약 토큰과 inactive 항목을 제외한다.
 * 코드젠 시 정규 도메인 값만 포함된 상수를 생성할 수 있도록 한다.
 */
function buildConstants(
  entries: readonly EntityId[],
  activeSet: DimActiveSet | undefined,
  tokens: ReadonlySet<string>,
): Readonly<Record<string, EntityId>> {
  const activeIndices = activeSet
    ? new Set(activeSet.activeIndices)
    : null;

  const result: Record<string, EntityId> = {};
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const oneBasedIndex = i + 1;

    // 예약 토큰 제외
    if (typeof entry === "string" && tokens.has(entry)) continue;

    // inactive 항목 제외
    if (activeIndices && !activeIndices.has(oneBasedIndex)) continue;

    result[String(entry)] = entry;
  }
  return Object.freeze(result);
}
