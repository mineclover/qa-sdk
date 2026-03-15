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

import { MetaRegistry } from "./meta-registry.js";
import { MetaCodec } from "./meta-codec.js";
import { MetaResolver } from "./meta-resolver.js";
import type { MetaRegistryInput, DecodeMap, EntityId, VersionedValue } from "./types.js";
import { DimNotFoundError } from "./errors.js";

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
   * dim entries를 enum-like 상수 객체로 반환.
   *
   * 이 client가 바인딩된 version의 snapshot에서 entries를 추출한다.
   * string_enum: { click: "click", view: "view" }
   * number_enum: { "0": 0, "1": 1, "2": 2 }
   */
  constants(dimId: string): Readonly<Record<string, EntityId>>;

  /** DecodeMap 반환 (다른 서비스로 전달해 독립 decode에 사용) */
  toDecodeMap(): DecodeMap;

  readonly indexId: string;
  readonly versionId: string;
  readonly size: number;
  readonly shape: readonly number[];
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
   * dim entries를 enum-like 상수 객체로 반환.
   *
   * 특정 index에 바인딩되지 않은 dim-level 상수 추출에 사용.
   * index에 바인딩된 상수는 client.constants()를 사용한다.
   */
  constants(dimId: string, snapshotId: string): Readonly<Record<string, EntityId>>;

  /** 내부 MetaRegistry 접근 (직렬화, 고급 조회 등) */
  readonly registry: MetaRegistry;
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function createIndexSDK(input: MetaRegistryInput): IndexSDK {
  const registry = new MetaRegistry(input);
  const resolver = new MetaResolver(registry);
  const clientCache = new Map<string, IndexClient>();

  return {
    client(indexId: string, versionId: string): IndexClient {
      const key = `${indexId}:${versionId}`;
      const cached = clientCache.get(key);
      if (cached) return cached;

      const codec = registry.createCodec(indexId, versionId);
      const decodeMap = resolver.getDecodeMap(indexId, versionId);

      // dim entries를 미리 인덱싱
      const dimEntriesMap = new Map<string, readonly EntityId[]>();
      for (const dim of decodeMap.dims) {
        dimEntriesMap.set(dim.dimId, Object.freeze([...dim.entries]));
      }

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
          const e = dimEntriesMap.get(dimId);
          if (!e) {
            throw new DimNotFoundError(
              `Dim "${dimId}" not found in index "${indexId}/${versionId}"`
            );
          }
          return buildConstants(e);
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
      const snapshot = registry.getDimSnapshot(dimId, snapshotId);
      return buildConstants(snapshot.entries);
    },

    get registry() {
      return registry;
    },
  };
}

// ── Internal ─────────────────────────────────────────────────────────────────

function buildConstants(entries: readonly EntityId[]): Readonly<Record<string, EntityId>> {
  const result: Record<string, EntityId> = {};
  for (const entry of entries) {
    result[String(entry)] = entry;
  }
  return Object.freeze(result);
}
