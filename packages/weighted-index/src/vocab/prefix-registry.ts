// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * PrefixCodec
 *
 * 레이블 조합(prefix)과 그 버전을 관리한다.
 *
 * ── 핵심 개념 ──────────────────────────────────────────────────────────────
 * - Prefix        : 레이블들의 순서 있는 조합.
 *                   예) "api_perm" = ["role", "action", "api", "tenant"]
 * - PrefixVersion : 각 레이블별로 어느 LabelVersion을 사용할지의 스냅샷.
 *                   예) api_perm@pv2 = { role:"v2", action:"v1", ... }
 * - shape         : PrefixVersion에서 각 레이블의 max를 모은 배열.
 *                   LabelRegistry에서 동적으로 도출.
 *
 * ── DB 저장 형식 ────────────────────────────────────────────────────────────
 * VersionedIndex = { prefix: "api_perm", v: "pv2", id: 42 }
 * 단일 컬럼 직렬화: "api_perm:pv2:42"
 * (prefix와 v에는 ":" 사용 불가)
 */

import { WeightedIndex } from '../math/weighted-index.js';
import { type EntityId, type LabelRegistry } from './label-registry.js';
import {
  CoordError,
  MigrateError,
  PrefixNotFoundError,
  SerializeError,
  ShapeError,
  VersionNotFoundError,
} from '../math/errors.js';
import { assertNoColon, assertNonEmptyArray, formatList } from '../math/validators.js';

// ── 공개 타입 ────────────────────────────────────────────────────────────────

/** prefix의 한 버전: 각 레이블에 어느 LabelVersion을 사용할지 명시 */
export interface PrefixVersionEntry {
  /** ":" 포함 불가. */
  version: string;
  /** label 이름 → LabelRegistry 버전 식별자 */
  labelVersions: Record<string, string>;
  createdAt?: string;
  changelog?: string;
}

/** prefix 정의: 레이블 순서 + 버전 히스토리 */
export interface PrefixDefinition {
  /** 이 prefix를 구성하는 레이블 이름 목록 (순서 고정). */
  labels: string[];
  /** prefix 버전 목록 (등록 순 = 이력 순). */
  versions: PrefixVersionEntry[];
}

/** DB에 저장되는 단위 */
export interface VersionedIndex {
  /** 어떤 도메인의 권한인지 (= 조회 key) */
  prefix: string;
  /** 어느 스냅샷으로 역변환할지 (= decode 메타데이터) */
  v: string;
  /** 가중진법 인코딩 결과 정수 */
  id: number;
}

/** 두 prefix 버전 사이의 변경 내역 */
export interface PrefixVersionDiff {
  prefix: string;
  from: string;
  to: string;
  changedLabels: Array<{
    label: string;
    fromLabelVersion: string;
    fromMax: number;
    toLabelVersion: string;
    toMax: number;
  }>;
}

/** 마이그레이션 좌표 변환 함수 */
export type CoordMigrator = (
  oldCoords: number[],
  oldLabels: readonly string[],
  newLabels: readonly string[],
) => number[];

// ── PrefixCodec ────────────────────────────────────────────────────────────

/**
 * LabelRegistry의 TSchema는 외부에서 다양하게 정의되므로,
 * PrefixCodec는 스키마 타입을 알 필요 없이 _Raw 내부 메서드만 사용한다.
 * 이 alias는 해당 의도를 명시한다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyLabelRegistry = LabelRegistry<any>;

export class PrefixCodec {
  private readonly labelReg: AnyLabelRegistry;
  private readonly prefixes: ReadonlyMap<string, PrefixDefinition>;
  /** WeightedIndex 캐시: "{prefix}:{version}" → WeightedIndex */
  private readonly indexCache = new Map<string, WeightedIndex>();

  constructor(labels: AnyLabelRegistry, prefixes: Record<string, PrefixDefinition>) {
    this.labelReg = labels;

    const map = new Map<string, PrefixDefinition>();
    for (const [name, def] of Object.entries(prefixes)) {
      this._validatePrefixDef(name, def);
      map.set(name, def);
    }
    this.prefixes = map;
  }

  // ── 메타 ────────────────────────────────────────────────────────────────

  get prefixNames(): readonly string[] {
    return [...this.prefixes.keys()];
  }

  getLabels(prefix: string): readonly string[] {
    return this._getPrefixDef(prefix).labels;
  }

  getCurrentVersion(prefix: string): string {
    const def = this._getPrefixDef(prefix);
    return def.versions[def.versions.length - 1].version;
  }

  getPrefixVersions(prefix: string): readonly PrefixVersionEntry[] {
    return this._getPrefixDef(prefix).versions;
  }

  /** LabelRegistry 기반으로 shape을 동적 도출. */
  getShape(prefix: string, version?: string): number[] {
    return [...this._getWeightedIndex(prefix, version ?? this.getCurrentVersion(prefix)).shape];
  }

  /** 캐시된 WeightedIndex 인스턴스 반환. */
  getIndex(prefix: string, version?: string): WeightedIndex {
    return this._getWeightedIndex(prefix, version ?? this.getCurrentVersion(prefix));
  }

  // ── 인코딩 ──────────────────────────────────────────────────────────────

  /** 좌표 배열(raw 1-based index) → VersionedIndex. */
  encode(prefix: string, coords: number[], version?: string): VersionedIndex {
    const v = version ?? this.getCurrentVersion(prefix);
    const id = this._getWeightedIndex(prefix, v).encode(coords);
    return { prefix, v, id };
  }

  /** { label: raw_index } 레코드 → VersionedIndex. */
  encodeFromRecord(
    prefix: string,
    record: Record<string, number>,
    version?: string,
  ): VersionedIndex {
    const v = version ?? this.getCurrentVersion(prefix);
    const id = this._getWeightedIndex(prefix, v).encodeFromRecord(record);
    return { prefix, v, id };
  }

  /**
   * 원천 데이터 ID 레코드 → VersionedIndex.
   * LabelRegistry를 통해 각 entity ID를 1-based 인덱스로 변환 후 encode.
   *
   * @example
   * registry.encodeFromIds("api_perm", {
   *   role: 2, action: "write", api: "/posts", tenant: 100,
   * })
   */
  encodeFromIds(prefix: string, ids: Record<string, EntityId>, version?: string): VersionedIndex {
    const v = version ?? this.getCurrentVersion(prefix);
    const def = this._getPrefixDef(prefix);
    const pv = this._getPrefixVersion(prefix, v);

    const coords = def.labels.map((label) => {
      const entityId = ids[label];
      if (entityId === undefined) {
        throw new CoordError(`Missing entity id for label "${label}" in encodeFromIds`);
      }
      return this.labelReg._getIndexRaw(label, pv.labelVersions[label], entityId);
    });

    const id = this._getWeightedIndex(prefix, v).encodeUnsafe(coords);
    return { prefix, v, id };
  }

  // ── 디코딩 ──────────────────────────────────────────────────────────────

  /** VersionedIndex → 좌표 배열(raw 1-based index). */
  decode(vi: VersionedIndex): number[] {
    return this._getWeightedIndex(vi.prefix, vi.v).decode(vi.id);
  }

  /** VersionedIndex → { label: raw_index }. */
  decodeToRecord(vi: VersionedIndex): Record<string, number> {
    return this._getWeightedIndex(vi.prefix, vi.v).decodeToRecord(vi.id);
  }

  /**
   * VersionedIndex → { label: entityId }.
   * 각 인덱스를 LabelRegistry를 통해 원천 데이터 ID로 역변환.
   *
   * @example
   * registry.decodeToIds({ prefix: "api_perm", v: "pv2", id: 42 })
   * // → { role: 2, action: "write", api: "/posts", tenant: 100 }
   */
  decodeToIds(vi: VersionedIndex): Record<string, EntityId> {
    const def = this._getPrefixDef(vi.prefix);
    const pv = this._getPrefixVersion(vi.prefix, vi.v);
    const coords = this._getWeightedIndex(vi.prefix, vi.v).decode(vi.id);
    const result: Record<string, EntityId> = {};
    for (let i = 0; i < def.labels.length; i++) {
      const label = def.labels[i];
      result[label] = this.labelReg._getEntityIdRaw(label, pv.labelVersions[label], coords[i]);
    }
    return result;
  }

  // ── 직렬화 ──────────────────────────────────────────────────────────────

  /**
   * VersionedIndex → 단일 문자열 (DB 단일 컬럼 저장용).
   * 형식: "{prefix}:{v}:{id}"
   */
  serialize(vi: VersionedIndex): string {
    return `${vi.prefix}:${vi.v}:${vi.id}`;
  }

  /**
   * 직렬화 문자열 → VersionedIndex.
   * prefix와 version이 registry에 등록되어 있어야 함.
   */
  parse(serialized: string): VersionedIndex {
    const lastColon = serialized.lastIndexOf(':');
    if (lastColon === -1) {
      throw new SerializeError(
        `Invalid serialized VersionedIndex: "${serialized}". Expected "{prefix}:{version}:{id}"`,
      );
    }
    const idStr = serialized.slice(lastColon + 1);
    const rest = serialized.slice(0, lastColon);

    const secondColon = rest.lastIndexOf(':');
    if (secondColon === -1) {
      throw new SerializeError(
        `Invalid serialized VersionedIndex: "${serialized}". Expected "{prefix}:{version}:{id}"`,
      );
    }
    const prefix = rest.slice(0, secondColon);
    const v = rest.slice(secondColon + 1);

    if (!prefix || !v || !idStr) {
      throw new SerializeError(
        `Invalid serialized VersionedIndex: "${serialized}". Expected "{prefix}:{version}:{id}"`,
      );
    }

    if (!/^\d+$/.test(idStr)) {
      throw new SerializeError(
        `Invalid id "${idStr}" in serialized VersionedIndex: "${serialized}"`,
      );
    }
    const id = Number(idStr);

    this._getPrefixVersion(prefix, v); // 존재 검증
    return { prefix, v, id };
  }

  // ── 마이그레이션 ────────────────────────────────────────────────────────

  /**
   * 구버전 VersionedIndex를 다른 버전으로 변환.
   * migrator: 구버전 좌표 → 신버전 좌표 변환 함수 (호출자가 직접 제공).
   */
  migrate(vi: VersionedIndex, toVersion: string, migrator: CoordMigrator): VersionedIndex {
    const fromWi = this._getWeightedIndex(vi.prefix, vi.v);
    const toWi = this._getWeightedIndex(vi.prefix, toVersion);
    const oldCoords = fromWi.decode(vi.id);
    const newCoords = migrator(oldCoords, fromWi.labels, toWi.labels);
    if (newCoords.length !== toWi.shape.length) {
      throw new MigrateError(
        `migrator returned ${newCoords.length} coordinates but target prefix "${vi.prefix}@${toVersion}" expects ${toWi.shape.length}`,
      );
    }
    // encode() 대신 직접 좌표 범위를 검증해 MigrateError 를 던진다.
    // encode() 에 위임하면 CoordError 가 되어 호출자가 원인을 파악하기 어렵다.
    for (let i = 0; i < newCoords.length; i++) {
      const x = newCoords[i];
      const n = toWi.shape[i];
      if (!Number.isInteger(x) || x < 1 || x > n) {
        throw new MigrateError(
          `migrator returned invalid coordinate at index ${i} (label: "${toWi.labels[i]}"): got ${x}, expected integer in [1, ${n}]`,
        );
      }
    }
    return { prefix: vi.prefix, v: toVersion, id: toWi.encodeUnsafe(newCoords) };
  }

  /** 주어진 VersionedIndex가 해당 prefix의 currentVersion인지 확인. */
  isCurrent(vi: VersionedIndex): boolean {
    return vi.v === this.getCurrentVersion(vi.prefix);
  }

  // ── Diff ────────────────────────────────────────────────────────────────

  /**
   * 두 prefix 버전 사이에서 변경된 레이블과 max 변화량을 반환.
   *
   * @example
   * registry.diff("api_perm", "pv1", "pv2")
   * // → { changedLabels: [{ label: "role", fromMax: 3, toMax: 4, ... }] }
   */
  diff(prefix: string, fromVersion: string, toVersion: string): PrefixVersionDiff {
    const fromPv = this._getPrefixVersion(prefix, fromVersion);
    const toPv = this._getPrefixVersion(prefix, toVersion);
    const labels = this._getPrefixDef(prefix).labels;

    const changedLabels = labels
      .filter((label) => fromPv.labelVersions[label] !== toPv.labelVersions[label])
      .map((label) => ({
        label,
        fromLabelVersion: fromPv.labelVersions[label],
        fromMax: this.labelReg._getMaxRaw(label, fromPv.labelVersions[label]),
        toLabelVersion: toPv.labelVersions[label],
        toMax: this.labelReg._getMaxRaw(label, toPv.labelVersions[label]),
      }));

    return { prefix, from: fromVersion, to: toVersion, changedLabels };
  }

  // ── 내부 ────────────────────────────────────────────────────────────────

  private _getWeightedIndex(prefix: string, version: string): WeightedIndex {
    const cacheKey = `${prefix}:${version}`;
    let wi = this.indexCache.get(cacheKey);
    if (!wi) {
      const def = this._getPrefixDef(prefix);
      const pv = this._getPrefixVersion(prefix, version);
      const shape = def.labels.map((label) =>
        this.labelReg._getMaxRaw(label, pv.labelVersions[label]),
      );
      wi = new WeightedIndex(shape, def.labels);
      this.indexCache.set(cacheKey, wi);
    }
    return wi;
  }

  private _getPrefixDef(prefix: string): PrefixDefinition {
    const def = this.prefixes.get(prefix);
    if (!def) {
      throw new PrefixNotFoundError(
        `Unknown prefix: "${prefix}". Registered: [${formatList(this.prefixes.keys())}]`,
      );
    }
    return def;
  }

  private _getPrefixVersion(prefix: string, version: string): PrefixVersionEntry {
    const def = this._getPrefixDef(prefix);
    const pv = def.versions.find((v) => v.version === version);
    if (!pv) {
      throw new VersionNotFoundError(
        `Unknown version "${version}" for prefix "${prefix}". Available: [${formatList(def.versions.map((v) => v.version))}]`,
      );
    }
    return pv;
  }

  private _validatePrefixDef(name: string, def: PrefixDefinition): void {
    assertNoColon(name, `Prefix "${name}"`);
    assertNonEmptyArray(def.labels, `Prefix "${name}" labels`);
    assertNonEmptyArray(def.versions, `Prefix "${name}" versions`);

    const versionSet = new Set<string>();
    for (const pv of def.versions) {
      assertNoColon(pv.version, `Prefix "${name}" version`);
      if (versionSet.has(pv.version)) {
        throw new ShapeError(`Duplicate version "${pv.version}" in prefix "${name}"`);
      }
      versionSet.add(pv.version);

      for (const label of def.labels) {
        const labelVer = pv.labelVersions[label];
        if (!labelVer) {
          throw new ShapeError(
            `Prefix "${name}" version "${pv.version}" is missing labelVersion for label "${label}"`,
          );
        }
        this.labelReg._getMaxRaw(label, labelVer); // label+version 존재 검증
      }
    }
  }
}
