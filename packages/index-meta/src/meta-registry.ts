/**
 * MetaRegistry — 닫힌 패턴의 주소 게이트웨이
 *
 * ── 목적 ───────────────────────────────────────────────────────────────────
 *
 * 닫힌 패턴의 스키마(DimDef, DimSnapshot, IndexDef, IndexVersion)를 보관하고,
 * 주소 직렬화(VersionedValue ↔ PK 문자열)를 담당하는 게이트웨이.
 *
 * entity ID ↔ VersionedValue 변환(encode/decode)은 MetaCodec이 담당한다.
 * createCodec()으로 특정 version에 특화된 경량 코덱을 생성할 수 있다.
 *
 * ── 주요 API ───────────────────────────────────────────────────────────────
 *
 * createCodec(indexId, versionId)          : 독립 encode/decode 코덱 생성
 * serialize(vv, protocol?) / parse(input)  : VersionedValue ↔ 직렬화 문자열
 * getActiveManifest(indexId, versionId)    : 활성 차원 집합 — 선택지 필터에 사용
 * isEntryActive(dimId, snapshotId, idx)    : 특정 entry의 active 여부
 *
 * ── 설계 원칙 ──────────────────────────────────────────────────────────────
 *
 * - entries 배열은 불변. 순서 = 1-based 좌표.
 * - EntityId가 행(row) 고유 식별자.
 * - encode/decode는 MetaCodec으로 분리.
 *   MetaRegistry는 스키마 관리 + 직렬화만 담당.
 *
 * ── DimKind 검증 ───────────────────────────────────────────────────────────
 *
 * - string_enum : entries가 모두 string인지 생성자에서 검증.
 *                 entryRefs로 선언된 위치는 number 허용.
 * - number_enum : entries가 모두 정수(≥ 0)인지 검증.
 * - index_ref   : entries가 모두 정수(≥ 0)이고, 대상 IndexDef가 존재하며,
 *                 각 값이 대상 index의 최대 버전 크기 이내인지 검증.
 *                 (forward-reference 허용: indices 루프 완료 후 교차 검증)
 */

import {
  WeightedIndex,
  calcWeights,
  createLayoutProtocolBig,
  fromVersionedValueBig,
  toVersionedValueBig,
  type AddressConverter as WiAddressConverter,
  type AddressProtocol,
  type AddressProtocolBig,
} from "weighted-index";
import { AddressProtocolManager } from "./address-protocol-manager.js";
import type {
  MetaRegistryInput,
  AddressConfig,
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
  VersionedValueBig,
  EntityId,
  NumberType,
  SnapshotDiff,
  VersionDiff,
  VersionCapacityInfo,
} from "./types.js";
import { MetaCodec } from "./meta-codec.js";
import { MetaCodecBig } from "./meta-codec-big.js";
import {
  DimNotFoundError,
  SnapshotNotFoundError,
  IndexNotFoundError,
  IndexVersionNotFoundError,
  MigrationNotFoundError,
  ValidationError,
  ParseError,
  CapacityOverflowError,
} from "./errors.js";

// ── 공통 유틸 ─────────────────────────────────────────────────────────────────

/**
 * 스냅샷에서 active 상태인 entry의 1-based index 배열을 반환한다.
 * entryFlags에 명시되지 않은 entry는 active로 간주한다.
 */
export function computeActiveIndices(snapshot: DimSnapshot): number[] {
  const result: number[] = [];
  for (let i = 1; i <= snapshot.entries.length; i++) {
    const flag = snapshot.entryFlags[i];
    if (!flag || flag.status === "active") result.push(i);
  }
  return result;
}

/**
 * 스냅샷의 실효 capacity를 반환한다.
 * capacity가 명시되지 않은 경우 entries.length를 fallback으로 사용한다.
 */
export function snapshotCapacity(snapshot: DimSnapshot): number {
  return snapshot.capacity ?? snapshot.entries.length;
}

// ── Capacity 헬퍼 ────────────────────────────────────────────────────────────

/** shape product를 BigInt로 정확히 계산. */
export function computeShapeProductBig(shape: readonly number[]): bigint {
  let product = 1n;
  for (const s of shape) product *= BigInt(s);
  return product;
}

/** Number.MAX_SAFE_INTEGER 이내인지 판별. */
export function fitsNumber(shape: readonly number[]): boolean {
  return computeShapeProductBig(shape) <= BigInt(Number.MAX_SAFE_INTEGER);
}

// ── 내부 캐시 타입 ────────────────────────────────────────────────────────────

interface SnapshotCache {
  snapshot: DimSnapshot;
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

  /** 독립 주소 직렬화 게이트웨이. serialize/parse/converter/defaultProtocol 위임. */
  readonly address: AddressProtocolManager;
  /** BigInt layout protocol (lazy 초기화). */
  private _bigLayoutProto?: AddressProtocolBig;
  /** toInput() 복제용 원본 스냅샷. */
  private readonly _input: MetaRegistryInput;
  /** strict: false일 때 수집된 capacity 경고. */
  private readonly _capacityWarnings: string[] = [];

  constructor(input: MetaRegistryInput) {
    this._input = structuredClone(input);
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
          capacity: snInput.capacity,
          createdAt: snInput.createdAt,
          changelog: snInput.changelog,
        };

        snMap.set(snapshotId, { snapshot });
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
        numberType: indexInput.numberType ?? "number", // 임시값, capacity guard에서 확정
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

    // 3. dim-level index_ref: 각 snapshot의 entry 값이 target index의 유효 범위 이내인지 검증
    //    entry 값은 target index의 어떤 version에서든 유효한 압축 좌표여야 한다.
    for (const [dimId, dimDef] of dimsMap) {
      if (dimDef.kind.type !== "index_ref") continue;
      const { indexId: targetIndexId } = dimDef.kind;

      const targetVersionMap = versionsMap.get(targetIndexId)!;
      const targetDef = indicesMap.get(targetIndexId)!;

      // target index의 모든 version size 중 최댓값 — entry 값의 상한
      let maxTargetSize = 0;
      for (const iv of targetVersionMap.values()) {
        let size = 1;
        for (const d of targetDef.dims) {
          size *= snapshotsMap.get(d)!.get(iv.snapshots[d])!.snapshot.entries.length;
        }
        maxTargetSize = Math.max(maxTargetSize, size);
      }

      const snMap = snapshotsMap.get(dimId)!;
      for (const { snapshot } of snMap.values()) {
        for (let pos = 0; pos < snapshot.entries.length; pos++) {
          const val = snapshot.entries[pos] as number;
          if (val >= maxTargetSize) {
            throw new ValidationError(
              `DimSnapshot "${dimId}/${snapshot.snapshotId}" entry at position ${pos + 1}` +
              ` (value ${val}) is out of range for index "${targetIndexId}"` +
              ` (max valid value: ${maxTargetSize - 1} across all versions)`
            );
          }
        }
      }
    }

    // 4. index_ref cycle detection: DFS로 index → dim(index_ref) → target index 경로를 추적
    //    Self-references (A -> A) are allowed (e.g., a "parent" dim referencing the same index).
    //    Only mutual/transitive cycles of length >= 2 are errors (A -> B -> A, etc.).
    {
      // indexId → Set<indexId> (직접 참조 대상, self-references 제외)
      const refGraph = new Map<string, Set<string>>();
      for (const [indexId, indexDef] of indicesMap) {
        const targets = new Set<string>();
        for (const dimId of indexDef.dims) {
          const dimDef = dimsMap.get(dimId)!;
          if (dimDef.kind.type === "index_ref" && dimDef.kind.indexId !== indexId) {
            targets.add(dimDef.kind.indexId);
          }
        }
        if (targets.size > 0) {
          refGraph.set(indexId, targets);
        }
      }

      // DFS cycle detection
      const NOT_VISITED = 0;
      const IN_STACK = 1;
      const DONE = 2;
      const state = new Map<string, number>();
      for (const id of indicesMap.keys()) state.set(id, NOT_VISITED);

      function dfs(nodeId: string, path: string[]): void {
        state.set(nodeId, IN_STACK);
        path.push(nodeId);

        const neighbors = refGraph.get(nodeId);
        if (neighbors) {
          for (const target of neighbors) {
            const targetState = state.get(target);
            if (targetState === IN_STACK) {
              // Cycle found: extract the cycle portion from the path
              const cycleStart = path.indexOf(target);
              const cyclePath = [...path.slice(cycleStart), target];
              throw new ValidationError(
                `index_ref cycle detected: ${cyclePath.join(" -> ")}`
              );
            }
            if (targetState === NOT_VISITED) {
              dfs(target, path);
            }
          }
        }

        path.pop();
        state.set(nodeId, DONE);
      }

      for (const indexId of indicesMap.keys()) {
        if (state.get(indexId) === NOT_VISITED) {
          dfs(indexId, []);
        }
      }
    }

    // ── Capacity Guard (NumberType 확정) ─────────────────────────────────────
    {
      const strict = input.strict !== false;
      for (const [indexId, indexInput] of Object.entries(input.indices)) {
        const def = indicesMap.get(indexId)!;
        const vMap = versionsMap.get(indexId)!;
        let indexRequiresBigInt = false;

        for (const [versionId, iv] of vMap) {
          const shape: number[] = [];
          for (const dimId of def.dims) {
            const snapshotId = iv.snapshots[dimId];
            shape.push(snapshotsMap.get(dimId)!.get(snapshotId)!.snapshot.entries.length);
          }
          const productBig = computeShapeProductBig(shape);
          const fits = productBig <= BigInt(Number.MAX_SAFE_INTEGER);

          if (!fits) {
            indexRequiresBigInt = true;
            if (indexInput.numberType === "number") {
              const msg = `Index "${indexId}/${versionId}": shape product (${productBig}) exceeds Number.MAX_SAFE_INTEGER. Declare numberType: "bigint" or reduce dim sizes.`;
              if (strict) {
                throw new CapacityOverflowError(indexId, versionId, productBig,
                  'Declare numberType: "bigint" or reduce dim sizes.');
              }
              this._capacityWarnings.push(msg);
            }
          }
        }

        // numberType 확정
        const declaredType = indexInput.numberType;
        let effectiveType: NumberType;
        if (declaredType) {
          effectiveType = indexRequiresBigInt ? "bigint" : declaredType;
        } else {
          effectiveType = indexRequiresBigInt ? "bigint" : "number";
        }

        // IndexDef의 numberType 갱신 (freeze 전이므로 변경 가능)
        (def as { numberType: NumberType }).numberType = effectiveType;
      }
    }

    // ── Address 프로토콜 바인딩 ──────────────────────────────────────────────
    if (input.address) {
      this._validateAddressConfig(input.address, indicesMap, versionsMap);
    }
    this.address = new AddressProtocolManager(input.address);
  }

  // ── Capacity Guard ──────────────────────────────────────────────────────────

  /** strict: false일 때 수집된 capacity 경고 목록. */
  get capacityWarnings(): readonly string[] {
    return this._capacityWarnings;
  }

  /**
   * 특정 index version의 capacity 분석 결과를 반환한다.
   */
  getCapacityInfo(indexId: string, versionId: string): VersionCapacityInfo {
    const def = this._getIndexDef(indexId);
    const iv = this._getIndexVersion(indexId, versionId);
    const shape = def.dims.map((dimId) => {
      const snapshotId = iv.snapshots[dimId];
      return this._getSnapshotCache(dimId, snapshotId).snapshot.entries.length;
    });
    const sizeBigInt = computeShapeProductBig(shape);
    const fits = sizeBigInt <= BigInt(Number.MAX_SAFE_INTEGER);
    return {
      indexId,
      versionId,
      shape,
      sizeNumber: fits ? Number(sizeBigInt) : Number.MAX_SAFE_INTEGER,
      sizeBigInt,
      fitsNumber: fits,
      numberType: def.numberType,
    };
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
      return {
        dimId,
        snapshotId,
        total: snapshot.entries.length,
        activeIndices: computeActiveIndices(snapshot),
      };
    });

    return { indexId, versionId, dims };
  }

  // ── Codec ────────────────────────────────────────────────────────────────────

  /**
   * 특정 index version에 특화된 독립 코덱을 생성한다.
   *
   * 반환된 MetaCodec은 MetaRegistry 없이 단독으로 encode/decode를 수행할 수 있다.
   * DecodeMap(shape + entries)을 내부적으로 빌드해 코덱에 전달한다.
   *
   * @example
   * const codec = reg.createCodec("perm", "v1");
   * const vv = codec.encode({ role: "admin", action: "read", resource: 10 });
   * const ids = codec.decode(vv);
   */
  createCodec(indexId: string, versionId: string): MetaCodec {
    const def = this._getIndexDef(indexId);
    const iv = this._getIndexVersion(indexId, versionId);
    const wi = this._getWeightedIndex(indexId, versionId);

    const dims = def.dims.map((dimId) => {
      const snapshotId = iv.snapshots[dimId];
      const { snapshot } = this._getSnapshotCache(dimId, snapshotId);
      const dimDef = this.dims.get(dimId)!;
      return {
        dimId,
        snapshotId,
        kind: dimDef.kind,
        entries: [...snapshot.entries] as EntityId[],
      };
    });

    return new MetaCodec({
      indexId,
      versionId,
      shape: [...wi.shape],
      size: wi.size,
      dims,
      numberType: def.numberType,
    });
  }

  /**
   * BigInt 기반 코덱 생성.
   *
   * numberType과 무관하게 생성 가능. BigInt 연산이므로
   * Number 기반보다 5~20x 느리지만 주소 공간 제한이 없다.
   *
   * @example
   * const codec = reg.createCodecBig("huge", "v1");
   * const vvb = codec.encode({ d1: 0, d2: 1, d3: 2 });
   * const ids = codec.decode(vvb);
   */
  createCodecBig(indexId: string, versionId: string): MetaCodecBig {
    const def = this._getIndexDef(indexId);
    const iv = this._getIndexVersion(indexId, versionId);

    const dims = def.dims.map((dimId) => {
      const snapshotId = iv.snapshots[dimId];
      const { snapshot } = this._getSnapshotCache(dimId, snapshotId);
      const dimDef = this.dims.get(dimId)!;
      return {
        dimId,
        snapshotId,
        kind: dimDef.kind,
        entries: [...snapshot.entries] as EntityId[],
      };
    });

    const shape = dims.map((d) => d.entries.length);
    const productBig = computeShapeProductBig(shape);

    return new MetaCodecBig({
      indexId,
      versionId,
      shape,
      size: productBig <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(productBig) : Number.MAX_SAFE_INTEGER,
      dims,
      numberType: def.numberType,
    });
  }

  // ── 직렬화 ───────────────────────────────────────────────────────────────────

  /**
   * 내부 AddressConverter 반환.
   * text 프로토콜(colon, uri, compact)은 항상 사용 가능.
   * address 설정 시 layout 프로토콜도 등록되어 있다.
   */
  get converter(): WiAddressConverter {
    return this.address.converter;
  }

  /**
   * 현재 기본 프로토콜 이름.
   * address 미설정: "colon", address 설정: "layout:{formatName}"
   */
  get defaultProtocol(): string {
    return this.address.defaultProtocol;
  }

  /**
   * VersionedValue → 프로토콜 형식 문자열.
   *
   * AddressProtocolManager에 위임한다.
   * protocol 생략 시 기본 프로토콜 사용 (address 설정 시 layout, 아니면 colon).
   *
   * @example
   * reg.serialize(vv)                    // 기본 프로토콜
   * reg.serialize(vv, "colon")           // → "perm:v1:42"
   * reg.serialize(vv, "uri")             // → "wi://perm/v1/42"
   * reg.serialize(vv, "layout:uuid")     // → "00010001-0000-...-002a"
   */
  serialize(vv: VersionedValue, protocol?: AddressProtocol | string): string {
    // Capacity Guard: bigint-typed index는 Number 기반 직렬화 불가
    const def = this.indices.get(vv.indexId);
    if (def?.numberType === "bigint") {
      const iv = this._getIndexVersion(vv.indexId, vv.versionId);
      const shape = def.dims.map((dimId) =>
        this._getSnapshotCache(dimId, iv.snapshots[dimId]).snapshot.entries.length
      );
      throw new CapacityOverflowError(vv.indexId, vv.versionId, computeShapeProductBig(shape),
        'Number-based serialize is not available for BigInt-typed index.');
    }
    return this.address.serialize(vv, protocol);
  }

  /**
   * 프로토콜 형식의 문자열 → VersionedValue.
   *
   * AddressProtocolManager의 loose parse에 registry 고유 검증을 추가한다:
   * - indexId/versionId 존재 여부
   * - value 범위 (0 ≤ value < WeightedIndex.size)
   *
   * protocol 생략 시 자동 감지 (layout → uri → colon → compact 순).
   *
   * @example
   * reg.parse("perm:iv1:0")
   * reg.parse("wi://perm/iv1/0")
   * reg.parse("00010001-0000-0000-0000-000000000000")
   * reg.parse("perm:iv1:0", "colon")     // 명시적 프로토콜
   */
  parse(input: string, protocol?: AddressProtocol | string): VersionedValue {
    const vv = this.address.parse(input, protocol);
    this._getIndexVersion(vv.indexId, vv.versionId);
    const wi = this._getWeightedIndex(vv.indexId, vv.versionId);
    if (vv.value < 0 || vv.value >= wi.size) {
      throw new ParseError(
        `Value ${vv.value} out of range [0, ${wi.size - 1}] for "${vv.indexId}/${vv.versionId}"`
      );
    }
    return vv;
  }

  /**
   * BigInt VersionedValue → layout 프로토콜 문자열.
   *
   * address config 필수. BigInt layout protocol로 직렬화한다.
   * indexChars > 13인 경우에도 정밀도 손실 없이 직렬화 가능.
   *
   * @example
   * reg.serializeBig({ indexId: "huge", versionId: "v1", value: 123456789012345678n })
   * // → "00010001-0000-0000-0000-01b69b4bacd68e"
   */
  serializeBig(vvb: VersionedValueBig): string {
    const proto = this._getBigLayoutProto();
    return proto.serialize(fromVersionedValueBig(vvb));
  }

  /**
   * layout 프로토콜 문자열 → BigInt VersionedValue.
   *
   * address config 필수. BigInt layout protocol로 파싱한다.
   *
   * @example
   * reg.parseBig("00010001-0000-0000-0000-01b69b4bacd68e")
   * // → { indexId: "huge", versionId: "v1", value: 123456789012345678n }
   */
  parseBig(input: string): VersionedValueBig {
    const proto = this._getBigLayoutProto();
    const addr = proto.parse(input);
    const vvb = toVersionedValueBig(addr);
    // 존재 검증
    this._getIndexVersion(vvb.indexId, vvb.versionId);
    // 범위 검증
    const def = this._getIndexDef(vvb.indexId);
    const iv = this._getIndexVersion(vvb.indexId, vvb.versionId);
    const shape = def.dims.map((dimId) =>
      this._getSnapshotCache(dimId, iv.snapshots[dimId]).snapshot.entries.length
    );
    const sizeBig = computeShapeProductBig(shape);
    if (vvb.value < 0n || vvb.value >= sizeBig) {
      throw new ParseError(
        `Value ${vvb.value} out of range [0, ${sizeBig - 1n}] for "${vvb.indexId}/${vvb.versionId}"`
      );
    }
    return vvb;
  }

  /** BigInt layout protocol lazy 초기화. */
  private _getBigLayoutProto(): AddressProtocolBig {
    if (!this._bigLayoutProto) {
      const input = this._input;
      if (!input.address) {
        throw new ValidationError(
          'serializeBig/parseBig requires address config (layout protocol). ' +
          'Use text protocols (colon/uri) via serialize/parse instead.'
        );
      }
      this._bigLayoutProto = createLayoutProtocolBig({
        format: input.address.format,
        schemaChars: input.address.schemaChars,
        versionChars: input.address.versionChars,
        sharding: input.address.sharding,
        schemas: input.address.schemas,
        versions: input.address.versions,
      });
    }
    return this._bigLayoutProto;
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
   * fromSnapshotId → toSnapshotId 경로로 1-based index를 추적한다.
   *
   * 등록된 migration edge를 BFS로 탐색해 경로를 찾고, 각 구간 indexMap을 순서대로 적용.
   * 경로가 없으면 MigrationNotFoundError.
   *
   * ── sparse migration (identity fallback) ──────────────────────────────────
   *
   * indexMap에 명시되지 않은 위치는 identity로 처리된다 (동일 index 유지).
   * 이는 의도적인 설계로, entry가 두 스냅샷에서 같은 위치에 있으면 명시할 필요가 없다.
   *
   * WARNING: ALL positions that changed between snapshots MUST be explicitly
   * mapped in indexMap. Unmapped positions silently fall through with identity
   * (the same index is returned), which will cause silent data inconsistency
   * if the entry at that position actually moved. The caller is responsible
   * for ensuring the indexMap is complete for all changed positions.
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

  /**
   * migration의 indexMap이 완전한지 검증한다.
   *
   * fromSnapshot과 toSnapshot의 entries를 비교해,
   * 같은 position에 다른 entity가 들어간 경우 indexMap에 해당 position이 명시되어 있는지 확인.
   * 누락된 position이 있으면 ValidationError를 던진다.
   *
   * traceMigration()은 성능상 이 검증을 수행하지 않으므로,
   * migration 등록 시 또는 테스트에서 이 메서드로 완전성을 확인할 수 있다.
   */
  validateMigration(dimId: string, fromSnapshotId: string, toSnapshotId: string): void {
    if (!this.dims.has(dimId)) throw new DimNotFoundError(`Unknown dim: "${dimId}"`);

    const mig = this.getMigration(dimId, fromSnapshotId, toSnapshotId);
    const fromSnap = this._getSnapshotCache(dimId, fromSnapshotId).snapshot;
    const toSnap = this._getSnapshotCache(dimId, toSnapshotId).snapshot;

    // Build a lookup: entity → 1-based position in toSnapshot
    const toEntityPos = new Map<EntityId, number>();
    for (let i = 0; i < toSnap.entries.length; i++) {
      toEntityPos.set(toSnap.entries[i], i + 1);
    }

    const unmapped: number[] = [];

    for (let pos = 1; pos <= fromSnap.entries.length; pos++) {
      const entity = fromSnap.entries[pos - 1];
      const toPos = toEntityPos.get(entity);

      if (toPos === undefined) {
        // Entity removed in toSnapshot — no mapping needed
        continue;
      }

      if (toPos === pos) {
        // Same position in both snapshots — identity is correct
        continue;
      }

      // Entity moved to a different position — must be in indexMap
      const mapped = mig.indexMap[pos];
      if (mapped === undefined) {
        unmapped.push(pos);
      } else if (mapped !== toPos) {
        throw new ValidationError(
          `Dim "${dimId}" migration "${fromSnapshotId}"→"${toSnapshotId}": ` +
          `position ${pos} maps to ${mapped}, but entity "${entity}" is at position ${toPos} in toSnapshot`
        );
      }
    }

    if (unmapped.length > 0) {
      throw new ValidationError(
        `Dim "${dimId}" migration "${fromSnapshotId}"→"${toSnapshotId}": ` +
        `unmapped positions with changed entities: [${unmapped.join(", ")}]`
      );
    }
  }

  // ── Diff 유틸리티 ──────────────────────────────────────────────────────────

  /**
   * 두 스냅샷 간 diff를 반환한다.
   *
   * entries.length 변화 (= MetaRegistry 수준 shape 변화)와
   * 추가/이동된 entry 목록을 포함한다.
   */
  snapshotDiff(dimId: string, fromSnapshotId: string, toSnapshotId: string): SnapshotDiff {
    const fromSnap = this._getSnapshotCache(dimId, fromSnapshotId).snapshot;
    const toSnap = this._getSnapshotCache(dimId, toSnapshotId).snapshot;

    // addedEntries: entries in `to` that are not in `from`
    const fromSet = new Set<EntityId>(fromSnap.entries);
    const addedEntries: EntityId[] = [];
    for (const entry of toSnap.entries) {
      if (!fromSet.has(entry)) {
        addedEntries.push(entry);
      }
    }

    // movedPositions: extract from migration indexMap if it exists
    const movedPositions: { position: number; from: number; to: number; entity: EntityId }[] = [];
    const migMap = this.migrations.get(dimId);
    const mig = migMap?.get(`${fromSnapshotId}:${toSnapshotId}`);
    if (mig) {
      for (const [kStr, v] of Object.entries(mig.indexMap)) {
        const k = Number(kStr);
        if (k !== v) {
          movedPositions.push({ position: k, from: k, to: v, entity: fromSnap.entries[k - 1] });
        }
      }
      movedPositions.sort((a, b) => a.position - b.position);
    }

    const fromCapa = snapshotCapacity(fromSnap);
    const toCapa   = snapshotCapacity(toSnap);

    return {
      dimId,
      from: {
        snapshotId: fromSnapshotId,
        entriesCount: fromSnap.entries.length,
        capacity: fromCapa,
        headroom: fromCapa - fromSnap.entries.length,
        entries: fromSnap.entries,
      },
      to: {
        snapshotId: toSnapshotId,
        entriesCount: toSnap.entries.length,
        capacity: toCapa,
        headroom: toCapa - toSnap.entries.length,
        entries: toSnap.entries,
      },
      capacityChanged: fromCapa !== toCapa,
      addedEntries,
      movedPositions,
    };
  }

  /**
   * 두 index version 간 shape/weight 영향을 분석한다.
   *
   * capacity 변화가 weight에 영향을 미치는지 판단하고,
   * ID 보존 여부를 반환한다. 마이그레이션 계획의 핵심 입력.
   */
  versionDiff(indexId: string, fromVersionId: string, toVersionId: string): VersionDiff {
    const def = this._getIndexDef(indexId);
    const fromIv = this._getIndexVersion(indexId, fromVersionId);
    const toIv = this._getIndexVersion(indexId, toVersionId);

    const fromWi = this._getWeightedIndex(indexId, fromVersionId);
    const toWi = this._getWeightedIndex(indexId, toVersionId);

    const fromWeights = calcWeights([...fromWi.shape]);
    const toWeights = calcWeights([...toWi.shape]);

    // Compare weights arrays
    let weightsChanged = fromWeights.length !== toWeights.length;
    if (!weightsChanged) {
      for (let i = 0; i < fromWeights.length; i++) {
        if (fromWeights[i] !== toWeights[i]) {
          weightsChanged = true;
          break;
        }
      }
    }

    const idPreserved = !weightsChanged && toWi.size >= fromWi.size;

    // changedDims: dims where snapshotId differs between versions
    const changedDims: VersionDiff["changedDims"] = [];
    for (const dimId of def.dims) {
      const fromSnapshotId = fromIv.snapshots[dimId];
      const toSnapshotId = toIv.snapshots[dimId];
      if (fromSnapshotId !== toSnapshotId) {
        const fromSnap = this._getSnapshotCache(dimId, fromSnapshotId).snapshot;
        const toSnap = this._getSnapshotCache(dimId, toSnapshotId).snapshot;
        const fromCapa = snapshotCapacity(fromSnap);
        const toCapa   = snapshotCapacity(toSnap);
        changedDims.push({
          dimId,
          fromSnapshot: fromSnapshotId,
          toSnapshot: toSnapshotId,
          fromEntriesCount: fromSnap.entries.length,
          toEntriesCount: toSnap.entries.length,
          fromCapacity: fromCapa,
          toCapacity: toCapa,
          fromHeadroom: fromCapa - fromSnap.entries.length,
          toHeadroom: toCapa - toSnap.entries.length,
          fromEntries: fromSnap.entries,
          toEntries: toSnap.entries,
        });
      }
    }

    return {
      indexId,
      from: {
        versionId: fromVersionId,
        shape: fromWi.shape,
        weights: Object.freeze(fromWeights),
        size: fromWi.size,
      },
      to: {
        versionId: toVersionId,
        shape: toWi.shape,
        weights: Object.freeze(toWeights),
        size: toWi.size,
      },
      weightsChanged,
      idPreserved,
      changedDims,
    };
  }

  /** 캐싱된 WeightedIndex 인스턴스 반환. */
  getWeightedIndex(indexId: string, versionId: string): WeightedIndex {
    return this._getWeightedIndex(indexId, versionId);
  }

  /**
   * 특정 entry의 active 상태를 반환.
   *
   * encode() 자체는 inactive entry도 허용하므로, 인코딩 전에 active 여부를
   * 확인해야 하는 경우 이 메서드를 사용한다.
   *
   * @param dimId - 차원 ID
   * @param snapshotId - 스냅샷 ID
   * @param oneBasedIndex - 1-based 인덱스 (DimSnapshot.entries 기준)
   */
  isEntryActive(dimId: string, snapshotId: string, oneBasedIndex: number): boolean {
    const { snapshot } = this._getSnapshotCache(dimId, snapshotId);
    if (oneBasedIndex < 1 || oneBasedIndex > snapshot.entries.length) {
      throw new ValidationError(
        `isEntryActive "${dimId}/${snapshotId}": index ${oneBasedIndex} out of range [1, ${snapshot.entries.length}]`
      );
    }
    const flag = snapshot.entryFlags[oneBasedIndex];
    return !flag || flag.status === "active";
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

  /**
   * index가 등록되어 있는지 확인한다.
   *
   * ── 용도 ──────────────────────────────────────────────────────────────────
   *
   * API 핸들러에서 요청 파라미터의 indexId를 검증할 때 사용.
   * getIndexDef()와 달리 throw 없이 boolean을 반환한다.
   *
   * @example
   * if (!reg.hasIndex(req.params.indexId)) return c.json({ error: "unknown index" }, 400);
   */
  hasIndex(indexId: string): boolean {
    return this.indices.has(indexId);
  }

  /**
   * 특정 index의 version이 유효한지 확인한다.
   *
   * ── 용도 ──────────────────────────────────────────────────────────────────
   *
   * API 핸들러에서 요청 파라미터의 versionId를 검증할 때 사용.
   * getIndexVersion()와 달리 throw 없이 boolean을 반환한다.
   * indexId 자체가 없으면 false.
   *
   * @example
   * // 기존: ad-hoc 검증
   * function parseVer(raw: string | undefined): Ver {
   *   return raw === "v1" ? "v1" : "v2";
   * }
   *
   * // 개선: registry 기반 검증
   * if (!reg.isValidVersion("permission", req.query.ver)) {
   *   return c.json({ error: "unknown version" }, 400);
   * }
   */
  isValidVersion(indexId: string, versionId: string): boolean {
    return this.versions.get(indexId)?.has(versionId) ?? false;
  }

  /**
   * 생성자에 전달한 입력의 deep clone을 반환한다.
   *
   * `new MetaRegistry(reg.toInput())`으로 동일한 동작의 인스턴스를 복제하거나,
   * spread로 일부를 교체해 fork 패턴에 사용할 수 있다.
   */
  toInput(): MetaRegistryInput {
    return structuredClone(this._input);
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
    const def = this._getIndexDef(indexId);
    if (def.numberType === "bigint") {
      const iv = this._getIndexVersion(indexId, versionId);
      const shape = def.dims.map((dimId) =>
        this._getSnapshotCache(dimId, iv.snapshots[dimId]).snapshot.entries.length
      );
      const productBig = computeShapeProductBig(shape);
      throw new CapacityOverflowError(indexId, versionId, productBig,
        'Number-based encode/decode is not available for BigInt-typed index.');
    }

    const key = `${indexId}:${versionId}`;
    let wi = this.wiCache.get(key);
    if (!wi) {
      const iv = this._getIndexVersion(indexId, versionId);
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

  /**
   * AddressConfig 유효성 검증.
   *
   * 1. 등록된 모든 indexId가 schemas에 매핑되어 있어야 한다.
   * 2. 등록된 모든 versionId가 versions에 매핑되어 있어야 한다.
   * 3. schemas/versions 매핑 값은 non-negative integer여야 한다.
   * 4. schemas 매핑 값은 unique해야 한다 (역매핑 충돌 방지).
   * 5. versions 매핑 값은 unique해야 한다.
   * 6. sharding이 있으면 chars/numShards 유효성을 검증한다.
   */
  private _validateAddressConfig(
    config: AddressConfig,
    indicesMap: ReadonlyMap<string, IndexDef>,
    versionsMap: ReadonlyMap<string, ReadonlyMap<string, IndexVersion>>
  ): void {
    // 1. 모든 indexId가 schemas에 포함되어야 한다
    for (const indexId of indicesMap.keys()) {
      if (config.schemas[indexId] === undefined) {
        throw new ValidationError(
          `Address config: indexId "${indexId}" not mapped in schemas`
        );
      }
    }

    // 2. 모든 versionId가 versions에 포함되어야 한다
    for (const [indexId, vMap] of versionsMap) {
      for (const versionId of vMap.keys()) {
        if (config.versions[versionId] === undefined) {
          throw new ValidationError(
            `Address config: versionId "${versionId}" (index "${indexId}") not mapped in versions`
          );
        }
      }
    }

    // 3. 매핑 값 유효성 검증
    for (const [name, num] of Object.entries(config.schemas)) {
      if (typeof num !== "number" || !Number.isInteger(num) || num < 0) {
        throw new ValidationError(
          `Address config schemas["${name}"]: must be a non-negative integer, got ${JSON.stringify(num)}`
        );
      }
    }
    for (const [name, num] of Object.entries(config.versions)) {
      if (typeof num !== "number" || !Number.isInteger(num) || num < 0) {
        throw new ValidationError(
          `Address config versions["${name}"]: must be a non-negative integer, got ${JSON.stringify(num)}`
        );
      }
    }

    // 4. schemas 값 uniqueness
    const schemaNums = new Map<number, string>();
    for (const [name, num] of Object.entries(config.schemas)) {
      const existing = schemaNums.get(num);
      if (existing !== undefined) {
        throw new ValidationError(
          `Address config: duplicate schema number ${num} for "${name}" and "${existing}"`
        );
      }
      schemaNums.set(num, name);
    }

    // 5. versions 값 uniqueness
    const versionNums = new Map<number, string>();
    for (const [name, num] of Object.entries(config.versions)) {
      const existing = versionNums.get(num);
      if (existing !== undefined) {
        throw new ValidationError(
          `Address config: duplicate version number ${num} for "${name}" and "${existing}"`
        );
      }
      versionNums.set(num, name);
    }

    // 6. sharding 유효성
    if (config.sharding !== undefined) {
      const { chars, numShards } = config.sharding;
      if (!Number.isInteger(chars) || chars <= 0) {
        throw new ValidationError(
          `Address config sharding.chars: must be a positive integer, got ${JSON.stringify(chars)}`
        );
      }
      if (!Number.isInteger(numShards) || numShards < 1) {
        throw new ValidationError(
          `Address config sharding.numShards: must be a positive integer, got ${JSON.stringify(numShards)}`
        );
      }
      const shardCapacity = 16 ** chars;
      if (numShards > shardCapacity) {
        throw new ValidationError(
          `Address config sharding.numShards(${numShards}) exceeds chars(${chars}) capacity (max ${shardCapacity})`
        );
      }
    }
  }
}
