/**
 * MetaRegistry
 *
 * DimDef / DimSnapshot / IndexDef / IndexVersion 을 보관하고
 * 두 가지 핵심 기능을 제공한다.
 *
 * 1. getActiveManifest(indexId, versionId)
 *    → 각 차원의 활성 인덱스 집합(IndexActiveManifest) 반환.
 *      프로그래밍 레이어가 이 manifest를 받아 선택지 필터 / 인코딩 검증에 사용.
 *
 * 2. encode / decode
 *    → entity ID 레코드 ↔ 1D 정수 변환.
 *      WeightedIndex 인스턴스를 내부에서 캐싱해 재사용.
 *
 * ── 설계 원칙 ──────────────────────────────────────────────────────────────────
 * - entries 배열은 불변. 순서 = 1-based index 좌표.
 * - inactive entry로 인코딩된 기존 값도 decode는 항상 가능.
 * - encode도 inactive를 검사하지 않는다. 활성/비활성 강제는 호출자 책임.
 * - EntityId가 행(row) 고유 식별자. decode → re-encode 패턴으로 암묵적 버전 이동 가능.
 *
 * ── DimKind 검증 ───────────────────────────────────────────────────────────────
 * - string_enum : entries가 모두 string인지 생성자에서 검증.
 *                 entryRefs로 선언된 위치는 number 허용.
 * - number_enum : entries가 모두 정수(≥ 0)인지 생성자에서 검증.
 * - index_ref   : entries가 모두 정수(≥ 0)인지 생성자에서 검증.
 *                 indexId로 지정한 IndexDef가 registry에 존재해야 함.
 *                 (forward-reference 허용: indices 루프 완료 후 교차 검증)
 */

import { WeightedIndex } from "weighted-index";
import type {
  MetaRegistryInput,
  DimDef,
  DimKind,
  DimSnapshot,
  DimSnapshotMigration,
  EntryIndexRef,
  IndexDef,
  IndexVersion,
  IndexActiveManifest,
  DimActiveSet,
  VersionedValue,
  EntityId,
  EntryFlag,
} from "./types.js";
import {
  DimNotFoundError,
  SnapshotNotFoundError,
  IndexNotFoundError,
  IndexVersionNotFoundError,
  EntryNotFoundError,
  MigrationNotFoundError,
  ValidationError,
  ParseError,
} from "./errors.js";

// ── 내부 캐시 타입 ────────────────────────────────────────────────────────────

interface SnapshotCache {
  snapshot: DimSnapshot;
  idToIndex: ReadonlyMap<EntityId, number>;
}

// ── MetaRegistry ──────────────────────────────────────────────────────────────

export class MetaRegistry {
  private readonly dims: ReadonlyMap<string, DimDef>;
  /** dimId → snapshotId → SnapshotCache */
  private readonly snapshots: ReadonlyMap<string, ReadonlyMap<string, SnapshotCache>>;
  private readonly indices: ReadonlyMap<string, IndexDef>;
  /** indexId → versionId → IndexVersion */
  private readonly versions: ReadonlyMap<string, ReadonlyMap<string, IndexVersion>>;
  /** dimId → "{from}:{to}" → DimSnapshotMigration */
  private readonly migrations: ReadonlyMap<string, ReadonlyMap<string, DimSnapshotMigration>>;
  /** WeightedIndex 캐시: "{indexId}:{versionId}" → WeightedIndex */
  private readonly wiCache = new Map<string, WeightedIndex>();

  constructor(input: MetaRegistryInput) {
    const dimsMap = new Map<string, DimDef>();
    const snapshotsMap = new Map<string, Map<string, SnapshotCache>>();
    const migrationsMap = new Map<string, Map<string, DimSnapshotMigration>>();

    for (const [dimId, dimInput] of Object.entries(input.dims)) {
      if (!dimId) throw new ValidationError("Dim id must not be empty");
      if (dimId.includes(":")) throw new ValidationError(`Dim id must not contain ":": "${dimId}"`);

      dimsMap.set(dimId, {
        id: dimId,
        kind: dimInput.kind,
        description: dimInput.description,
        domain: dimInput.domain,
      });

      const snMap = new Map<string, SnapshotCache>();

      for (const [snapshotId, snInput] of Object.entries(dimInput.snapshots)) {
        if (!snapshotId) {
          throw new ValidationError(`Dim "${dimId}": snapshot id must not be empty`);
        }
        if (snapshotId.includes(":")) {
          throw new ValidationError(`Dim "${dimId}": snapshot id must not contain ":": "${snapshotId}"`);
        }
        if (snInput.entries.length === 0) {
          throw new ValidationError(
            `DimSnapshot "${dimId}/${snapshotId}": entries must not be empty`
          );
        }

        this._validateEntriesKind(dimId, snapshotId, snInput.entries, dimInput.kind, snInput.entryRefs);

        const idToIndex = new Map<EntityId, number>();
        const seen = new Set<EntityId>();
        for (let pos = 0; pos < snInput.entries.length; pos++) {
          const raw = snInput.entries[pos];
          const id: EntityId =
            typeof raw === "number" && Object.is(raw, -0) ? 0 : raw;
          if (seen.has(id)) {
            throw new ValidationError(
              `DimSnapshot "${dimId}/${snapshotId}": duplicate entity id "${id}"`
            );
          }
          seen.add(id);
          idToIndex.set(id, pos + 1);
        }

        // entry-level index_ref 검증:
        // entryRefs에 명시된 entry는 반드시 정수(≥ 0)여야 함.
        // indexId + versionId 존재 검증은 indices 루프 이후에 수행 (forward-reference 허용).
        if (snInput.entryRefs) {
          for (const [idxStr, ref] of Object.entries(snInput.entryRefs)) {
            const pos = Number(idxStr); // 1-based
            if (!Number.isInteger(pos) || pos < 1 || pos > snInput.entries.length) {
              throw new ValidationError(
                `DimSnapshot "${dimId}/${snapshotId}" entryRefs: key ${pos} is out of range [1, ${snInput.entries.length}]`
              );
            }
            const val = snInput.entries[pos - 1];
            if (typeof val !== "number" || !Number.isInteger(val) || val < 0) {
              throw new ValidationError(
                `DimSnapshot "${dimId}/${snapshotId}" entryRefs[${pos}]: entry value must be a non-negative integer (got ${JSON.stringify(val)})`
              );
            }
            if (!ref.indexId || !ref.versionId) {
              throw new ValidationError(
                `DimSnapshot "${dimId}/${snapshotId}" entryRefs[${pos}]: indexId and versionId must not be empty`
              );
            }
          }
        }

        const snapshot: DimSnapshot = {
          dimId,
          snapshotId,
          entries: Object.freeze(
            snInput.entries.map((e) => (typeof e === "number" && Object.is(e, -0) ? 0 : e))
          ),
          entryFlags: Object.freeze({ ...(snInput.entryFlags ?? {}) }),
          entryRefs: Object.freeze({ ...(snInput.entryRefs ?? {}) }),
          createdAt: snInput.createdAt,
          changelog: snInput.changelog,
        };

        snMap.set(snapshotId, { snapshot, idToIndex });
      }

      if (snMap.size === 0) {
        throw new ValidationError(`Dim "${dimId}" must have at least one snapshot`);
      }

      snapshotsMap.set(dimId, snMap);

      // migrations 검증 및 저장
      const migMap = new Map<string, DimSnapshotMigration>();
      for (const mig of dimInput.migrations ?? []) {
        const { fromSnapshotId, toSnapshotId, indexMap } = mig;

        if (fromSnapshotId === toSnapshotId) {
          throw new ValidationError(
            `Dim "${dimId}" migration: fromSnapshotId and toSnapshotId must differ ("${fromSnapshotId}")`
          );
        }
        const fromSnap = snMap.get(fromSnapshotId)?.snapshot;
        if (!fromSnap) {
          throw new SnapshotNotFoundError(
            `Dim "${dimId}" migration: unknown fromSnapshotId "${fromSnapshotId}"`
          );
        }
        const toSnap = snMap.get(toSnapshotId)?.snapshot;
        if (!toSnap) {
          throw new SnapshotNotFoundError(
            `Dim "${dimId}" migration: unknown toSnapshotId "${toSnapshotId}"`
          );
        }

        const key = `${fromSnapshotId}:${toSnapshotId}`;
        if (migMap.has(key)) {
          throw new ValidationError(
            `Dim "${dimId}" migration: duplicate migration "${fromSnapshotId}" → "${toSnapshotId}"`
          );
        }

        const toValues = new Set<number>();
        for (const [kStr, v] of Object.entries(indexMap)) {
          const k = Number(kStr);
          if (!Number.isInteger(k) || k < 1 || k > fromSnap.entries.length) {
            throw new ValidationError(
              `Dim "${dimId}" migration "${fromSnapshotId}"→"${toSnapshotId}": key ${k} out of range [1, ${fromSnap.entries.length}]`
            );
          }
          if (!Number.isInteger(v) || v < 1 || v > toSnap.entries.length) {
            throw new ValidationError(
              `Dim "${dimId}" migration "${fromSnapshotId}"→"${toSnapshotId}": value ${v} out of range [1, ${toSnap.entries.length}]`
            );
          }
          if (toValues.has(v)) {
            throw new ValidationError(
              `Dim "${dimId}" migration "${fromSnapshotId}"→"${toSnapshotId}": duplicate target index ${v} (bijection violation)`
            );
          }
          toValues.add(v);
        }

        migMap.set(key, {
          fromSnapshotId,
          toSnapshotId,
          indexMap: Object.freeze({ ...indexMap }),
          createdAt: mig.createdAt,
          changelog: mig.changelog,
        });
      }
      migrationsMap.set(dimId, migMap);
    }

    this.dims = dimsMap;
    this.snapshots = snapshotsMap;
    this.migrations = migrationsMap;

    const indicesMap = new Map<string, IndexDef>();
    const versionsMap = new Map<string, Map<string, IndexVersion>>();

    for (const [indexId, indexInput] of Object.entries(input.indices)) {
      if (!indexId) throw new ValidationError("Index id must not be empty");
      if (indexId.includes(":")) throw new ValidationError(`Index id must not contain ":": "${indexId}"`);
      if (indexInput.dims.length === 0) {
        throw new ValidationError(`Index "${indexId}": dims must not be empty`);
      }

      for (const dimId of indexInput.dims) {
        if (!dimsMap.has(dimId)) {
          throw new DimNotFoundError(
            `Index "${indexId}" references unknown dim "${dimId}"`
          );
        }
      }

      indicesMap.set(indexId, {
        id: indexId,
        dims: Object.freeze([...indexInput.dims]),
        description: indexInput.description,
        domain: indexInput.domain,
      });

      const vMap = new Map<string, IndexVersion>();

      for (const [versionId, vInput] of Object.entries(indexInput.versions)) {
        if (!versionId) {
          throw new ValidationError(`Index "${indexId}": version id must not be empty`);
        }
        if (versionId.includes(":")) {
          throw new ValidationError(`Index "${indexId}": version id must not contain ":": "${versionId}"`);
        }

        for (const dimId of indexInput.dims) {
          const snapshotId = vInput.snapshots[dimId];
          if (!snapshotId) {
            throw new ValidationError(
              `IndexVersion "${indexId}/${versionId}": missing snapshot for dim "${dimId}"`
            );
          }
          if (!snapshotsMap.get(dimId)?.has(snapshotId)) {
            throw new SnapshotNotFoundError(
              `IndexVersion "${indexId}/${versionId}": unknown snapshot "${dimId}/${snapshotId}"`
            );
          }
        }

        vMap.set(versionId, {
          indexId,
          versionId,
          snapshots: Object.freeze({ ...vInput.snapshots }),
          createdAt: vInput.createdAt,
          changelog: vInput.changelog,
        });
      }

      if (vMap.size === 0) {
        throw new ValidationError(`Index "${indexId}" must have at least one version`);
      }

      versionsMap.set(indexId, vMap);
    }

    this.indices = indicesMap;
    this.versions = versionsMap;

    // ── 교차 검증 (indices 루프 완료 후) ──────────────────────────────────────
    // indices와 versions가 모두 확정된 뒤 실행해 forward-reference를 허용한다.

    // 1. dim-level index_ref: indexId(필수) + versionId(선택) 존재 검증
    for (const [dimId, dimDef] of dimsMap) {
      if (dimDef.kind.type !== "index_ref") continue;
      const { indexId } = dimDef.kind;

      if (!indicesMap.has(indexId)) {
        throw new IndexNotFoundError(
          `Dim "${dimId}" (index_ref) references unknown indexId "${indexId}"`
        );
      }
    }

    // 2. entry-level index_ref: entryRefs의 { indexId, versionId }가 유효한지
    for (const snMapEntry of snapshotsMap.values()) {
      for (const { snapshot } of snMapEntry.values()) {
        for (const [idxStr, ref] of Object.entries(snapshot.entryRefs)) {
          const vMap = versionsMap.get(ref.indexId);
          if (!vMap) {
            throw new IndexNotFoundError(
              `DimSnapshot "${snapshot.dimId}/${snapshot.snapshotId}" entryRefs[${idxStr}]: unknown indexId "${ref.indexId}"`
            );
          }
          if (!vMap.has(ref.versionId)) {
            throw new IndexVersionNotFoundError(
              `DimSnapshot "${snapshot.dimId}/${snapshot.snapshotId}" entryRefs[${idxStr}]: unknown versionId "${ref.versionId}" for index "${ref.indexId}"`
            );
          }
        }
      }
    }
  }

  // ── Manifest ─────────────────────────────────────────────────────────────────

  /**
   * 버전 단위 활성 인덱스 집합 반환.
   * 프로그래밍 레이어에서 선택지 필터 및 인코딩 검증에 사용.
   */
  getActiveManifest(indexId: string, versionId: string): IndexActiveManifest {
    const iv = this._getIndexVersion(indexId, versionId);
    const def = this._getIndexDef(indexId);

    const dims: DimActiveSet[] = def.dims.map((dimId) => {
      const snapshotId = iv.snapshots[dimId];
      const { snapshot } = this._getSnapshotCache(dimId, snapshotId);
      const total = snapshot.entries.length;
      const activeIndices: number[] = [];
      for (let i = 1; i <= total; i++) {
        const flag: EntryFlag | undefined = snapshot.entryFlags[i];
        if (!flag || flag.status === "active") activeIndices.push(i);
      }
      return { dimId, snapshotId, total, activeIndices };
    });

    return { indexId, versionId, dims };
  }

  // ── Encode / Decode ───────────────────────────────────────────────────────────

  /**
   * { dimId: entityId } 레코드 → VersionedValue.
   * entity ID를 1-based 인덱스로 변환한 뒤 WeightedIndex로 인코딩.
   */
  encode(
    indexId: string,
    versionId: string,
    entityIds: Record<string, EntityId>
  ): VersionedValue {
    const iv = this._getIndexVersion(indexId, versionId);
    const def = this._getIndexDef(indexId);
    const wi = this._getWeightedIndex(indexId, versionId);

    const coords = def.dims.map((dimId) => {
      const snapshotId = iv.snapshots[dimId];
      const { idToIndex } = this._getSnapshotCache(dimId, snapshotId);
      const entityId = entityIds[dimId];
      if (entityId === undefined) {
        throw new ValidationError(
          `encode "${indexId}/${versionId}": missing entity id for dim "${dimId}"`
        );
      }
      const idx = idToIndex.get(entityId);
      if (idx === undefined) {
        throw new EntryNotFoundError(
          `encode "${indexId}/${versionId}": entity id "${entityId}" not found in snapshot "${dimId}/${snapshotId}"`
        );
      }
      return idx;
    });

    return { indexId, versionId, value: wi.encodeUnsafe(coords) };
  }

  /**
   * VersionedValue → { dimId: entityId } 레코드.
   * inactive entry로 저장된 값도 항상 decode 가능.
   */
  decode(vv: VersionedValue): Record<string, EntityId> {
    const iv = this._getIndexVersion(vv.indexId, vv.versionId);
    const def = this._getIndexDef(vv.indexId);
    const wi = this._getWeightedIndex(vv.indexId, vv.versionId);
    const coords = wi.decode(vv.value);

    const result: Record<string, EntityId> = {};
    for (let i = 0; i < def.dims.length; i++) {
      const dimId = def.dims[i];
      const snapshotId = iv.snapshots[dimId];
      const { snapshot } = this._getSnapshotCache(dimId, snapshotId);
      result[dimId] = snapshot.entries[coords[i] - 1];
    }
    return result;
  }

  // ── 직렬화 ───────────────────────────────────────────────────────────────────

  /** VersionedValue → 단일 문자열. 형식: "{indexId}:{versionId}:{value}" */
  serialize(vv: VersionedValue): string {
    return `${vv.indexId}:${vv.versionId}:${vv.value}`;
  }

  /**
   * 직렬화 문자열 → VersionedValue.
   * indexId와 versionId가 registry에 등록되어 있어야 함.
   */
  parse(serialized: string): VersionedValue {
    const lastColon = serialized.lastIndexOf(":");
    if (lastColon === -1) {
      throw new ParseError(
        `Invalid serialized VersionedValue: "${serialized}". Expected "{indexId}:{versionId}:{value}"`
      );
    }

    const valueStr = serialized.slice(lastColon + 1);
    const rest = serialized.slice(0, lastColon);
    const secondColon = rest.lastIndexOf(":");

    if (secondColon === -1) {
      throw new ParseError(
        `Invalid serialized VersionedValue: "${serialized}". Expected "{indexId}:{versionId}:{value}"`
      );
    }

    const indexId = rest.slice(0, secondColon);
    const versionId = rest.slice(secondColon + 1);

    if (!indexId || !versionId || !valueStr) {
      throw new ParseError(
        `Invalid serialized VersionedValue: "${serialized}". Expected "{indexId}:{versionId}:{value}"`
      );
    }

    const value = Number(valueStr);
    if (!Number.isInteger(value) || value < 0) {
      throw new ParseError(
        `Invalid value "${valueStr}" in serialized VersionedValue: "${serialized}"`
      );
    }

    this._getIndexVersion(indexId, versionId); // 존재 검증
    const wi = this._getWeightedIndex(indexId, versionId);
    if (value >= wi.size) {
      throw new ParseError(
        `Value ${value} out of range [0, ${wi.size - 1}] for "${indexId}/${versionId}"`
      );
    }
    return { indexId, versionId, value };
  }

  // ── 조회 ─────────────────────────────────────────────────────────────────────

  getDimDef(dimId: string): DimDef {
    const def = this.dims.get(dimId);
    if (!def) throw new DimNotFoundError(`Unknown dim: "${dimId}"`);
    return def;
  }

  getDimSnapshot(dimId: string, snapshotId: string): DimSnapshot {
    return this._getSnapshotCache(dimId, snapshotId).snapshot;
  }

  /**
   * 두 스냅샷 간 직접 등록된 migration을 반환.
   * 직접 연결이 없으면 MigrationNotFoundError.
   */
  getMigration(dimId: string, fromSnapshotId: string, toSnapshotId: string): DimSnapshotMigration {
    if (!this.dims.has(dimId)) throw new DimNotFoundError(`Unknown dim: "${dimId}"`);
    const migMap = this.migrations.get(dimId);
    const mig = migMap?.get(`${fromSnapshotId}:${toSnapshotId}`);
    if (!mig) {
      throw new MigrationNotFoundError(
        `No direct migration for dim "${dimId}": "${fromSnapshotId}" → "${toSnapshotId}"`
      );
    }
    return mig;
  }

  /**
   * fromSnapshotId → toSnapshotId 경로로 index를 추적한다.
   * 등록된 migration edge를 BFS로 탐색해 경로를 찾고, 각 구간 indexMap을 순서대로 적용.
   * 경로가 없으면 MigrationNotFoundError.
   * indexMap에 명시되지 않은 위치는 identity (동일 index 유지).
   */
  traceMigration(
    dimId: string,
    fromSnapshotId: string,
    toSnapshotId: string,
    index: number
  ): number {
    if (!this.dims.has(dimId)) throw new DimNotFoundError(`Unknown dim: "${dimId}"`);
    if (fromSnapshotId === toSnapshotId) return index;

    const path = this._findMigrationPath(dimId, fromSnapshotId, toSnapshotId);
    if (!path) {
      throw new MigrationNotFoundError(
        `No migration path for dim "${dimId}": "${fromSnapshotId}" → "${toSnapshotId}"`
      );
    }

    let current = index;
    for (let i = 0; i < path.length - 1; i++) {
      const mig = this.migrations.get(dimId)?.get(`${path[i]}:${path[i + 1]}`);
      current = mig?.indexMap[current] ?? current; // indexMap에 없는 위치는 identity
    }
    return current;
  }

  getIndexDef(indexId: string): IndexDef {
    return this._getIndexDef(indexId);
  }

  getIndexVersion(indexId: string, versionId: string): IndexVersion {
    return this._getIndexVersion(indexId, versionId);
  }

  /** 캐싱된 WeightedIndex 인스턴스 반환. */
  getWeightedIndex(indexId: string, versionId: string): WeightedIndex {
    return this._getWeightedIndex(indexId, versionId);
  }

  get dimIds(): readonly string[] {
    return [...this.dims.keys()];
  }

  get indexIds(): readonly string[] {
    return [...this.indices.keys()];
  }

  getVersionIds(indexId: string): readonly string[] {
    const vMap = this.versions.get(indexId);
    if (!vMap) throw new IndexNotFoundError(`Unknown index: "${indexId}"`);
    return [...vMap.keys()];
  }

  getSnapshotIds(dimId: string): readonly string[] {
    const snMap = this.snapshots.get(dimId);
    if (!snMap) throw new DimNotFoundError(`Unknown dim: "${dimId}"`);
    return [...snMap.keys()];
  }

  // ── 내부 ─────────────────────────────────────────────────────────────────────

  private _getSnapshotCache(dimId: string, snapshotId: string): SnapshotCache {
    const snMap = this.snapshots.get(dimId);
    if (!snMap) throw new DimNotFoundError(`Unknown dim: "${dimId}"`);
    const cache = snMap.get(snapshotId);
    if (!cache) {
      throw new SnapshotNotFoundError(`Unknown snapshot: "${dimId}/${snapshotId}"`);
    }
    return cache;
  }

  private _getIndexDef(indexId: string): IndexDef {
    const def = this.indices.get(indexId);
    if (!def) throw new IndexNotFoundError(`Unknown index: "${indexId}"`);
    return def;
  }

  private _getIndexVersion(indexId: string, versionId: string): IndexVersion {
    const vMap = this.versions.get(indexId);
    if (!vMap) throw new IndexNotFoundError(`Unknown index: "${indexId}"`);
    const iv = vMap.get(versionId);
    if (!iv) {
      throw new IndexVersionNotFoundError(
        `Unknown version: "${indexId}/${versionId}"`
      );
    }
    return iv;
  }

  private _getWeightedIndex(indexId: string, versionId: string): WeightedIndex {
    const key = `${indexId}:${versionId}`;
    let wi = this.wiCache.get(key);
    if (!wi) {
      const iv = this._getIndexVersion(indexId, versionId);
      const def = this._getIndexDef(indexId);
      const shape = def.dims.map((dimId) => {
        const snapshotId = iv.snapshots[dimId];
        return this._getSnapshotCache(dimId, snapshotId).snapshot.entries.length;
      });
      wi = new WeightedIndex(shape, [...def.dims]);
      this.wiCache.set(key, wi);
    }
    return wi;
  }

  /**
   * entries의 값 타입이 DimKind와 일치하는지 검증.
   *
   * string_enum : 모든 entry가 string이어야 함.
   *               entryRefs로 선언된 위치는 number 허용.
   * number_enum : 모든 entry가 정수(≥ 0)여야 함.
   * index_ref   : 모든 entry가 정수(≥ 0)여야 함.
   *               (값은 다른 WeightedIndex의 VersionedValue.value)
   */
  private _validateEntriesKind(
    dimId: string,
    snapshotId: string,
    entries: EntityId[],
    kind: DimKind,
    entryRefs?: Record<number, EntryIndexRef>
  ): void {
    if (kind.type === "string_enum") {
      for (let i = 0; i < entries.length; i++) {
        const pos = i + 1; // 1-based
        // entry-level index_ref로 선언된 위치는 number를 허용
        if (entryRefs?.[pos] !== undefined) continue;
        if (typeof entries[i] !== "string") {
          throw new ValidationError(
            `DimSnapshot "${dimId}/${snapshotId}" (string_enum): entry at position ${pos} must be string, got ${typeof entries[i]}`
          );
        }
      }
    } else {
      // number_enum / index_ref: 모든 entry가 정수(≥ 0)여야 함
      const kindLabel = kind.type;
      for (let i = 0; i < entries.length; i++) {
        const v = entries[i];
        if (typeof v !== "number" || !Number.isInteger(v) || v < 0) {
          throw new ValidationError(
            `DimSnapshot "${dimId}/${snapshotId}" (${kindLabel}): entry at position ${i + 1} must be a non-negative integer, got ${JSON.stringify(v)}`
          );
        }
      }
    }
  }

  /**
   * BFS로 fromSnapshotId → toSnapshotId 경로를 찾는다.
   * 등록된 migration edge를 순방향으로 탐색.
   * 경로가 없으면 null 반환.
   */
  private _findMigrationPath(
    dimId: string,
    from: string,
    to: string
  ): string[] | null {
    const migMap = this.migrations.get(dimId);
    if (!migMap) return null;

    const queue: string[][] = [[from]];
    const visited = new Set<string>([from]);

    while (queue.length > 0) {
      const path = queue.shift()!;
      const current = path[path.length - 1];
      if (current === to) return path;

      for (const mig of migMap.values()) {
        if (mig.fromSnapshotId === current && !visited.has(mig.toSnapshotId)) {
          visited.add(mig.toSnapshotId);
          queue.push([...path, mig.toSnapshotId]);
        }
      }
    }
    return null;
  }
}
