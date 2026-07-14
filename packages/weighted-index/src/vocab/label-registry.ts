// @def.boundary weighted-index-system
// @def.doc weighted-index-system

/**
 * LabelRegistry
 *
 * 각 레이블(차원)을 원천 데이터 ID → 순번 인덱스 매핑으로 관리한다.
 *
 * ── 설계 원칙 ──────────────────────────────────────────────────────────────
 * - 순번 인덱스(1..N)는 외부에서 명시하지 않음 → 배열 위치에서 자동 도출.
 *   ids[0] → index 1, ids[1] → index 2, ..., ids[N-1] → index N
 * - 외부 인터페이스는 entity ID만 다룬다. index는 라이브러리 내부 개념.
 * - max = ids.length (자동 도출, 명시 불필요).
 * - 버전은 append-only. 새 엔티티 추가 시 끝에만 추가 → 기존 인덱스 유지.
 *
 * ── 타입 안전성 ─────────────────────────────────────────────────────────────
 * LabelVersionEntry<TId> 로 레이블별 entity ID 타입을 명시할 수 있다.
 * createLabelRegistry() 팩토리를 사용하면 TypeScript가 schema를 자동 추론한다.
 *
 * @example
 * const labels = createLabelRegistry({
 *   role:   [{ version: "v1", ids: [1, 2, 3] }],          // TId: number
 *   action: [{ version: "v1", ids: ["read", "write"] }],   // TId: string
 * });
 *
 * labels.getIndex("role", "v1", 1);     // ✓ number
 * labels.getIndex("role", "v1", "hi");  // ✗ TypeScript 오류
 */

import {
  EntityNotFoundError,
  LabelNotFoundError,
  ShapeError,
  VersionNotFoundError,
} from '../math/errors.js';
import { assertNoColon, assertNonEmptyArray, formatList } from '../math/validators.js';

// ── 공개 타입 ────────────────────────────────────────────────────────────────

export type EntityId = string | number;

/**
 * 레이블의 한 버전 스냅샷.
 * TId 로 entity ID의 타입을 지정할 수 있다 (기본값: EntityId).
 */
export interface LabelVersionEntry<TId extends EntityId = EntityId> {
  /** 이 레이블 버전의 식별자. ":" 포함 불가. */
  version: string;
  /**
   * 이 버전에 등록된 entity ID 목록.
   * 배열 순서 = 1-based 인덱스: ids[0]→1, ids[1]→2, ...
   * 추가는 끝에만. 기존 순서 변경 시 인덱스가 바뀌므로 주의.
   */
  ids: TId[];
  /** 발행 일시 (ISO 8601). */
  createdAt?: string;
  /** 이전 버전 대비 변경 사항. */
  changelog?: string;
}

/**
 * 레이블 정의 객체에서 schema 타입을 추론하는 헬퍼.
 * createLabelRegistry 의 반환 타입을 결정한다.
 */
export type InferLabelSchema<T extends Record<string, LabelVersionEntry<EntityId>[]>> = {
  [K in keyof T]: T[K][number]['ids'][number];
};

// ── 내부 캐시 ────────────────────────────────────────────────────────────────

interface VersionCache {
  entry: LabelVersionEntry<EntityId>;
  idToIndex: ReadonlyMap<EntityId, number>;
  indexToId: ReadonlyMap<number, EntityId>;
  max: number;
}

// ── LabelRegistry ─────────────────────────────────────────────────────────────

/**
 * TSchema: 레이블 이름 → entity ID 타입의 매핑.
 * createLabelRegistry() 팩토리로 생성하면 자동 추론된다.
 * 직접 생성 시 기본값 Record<string, EntityId> 로 동작한다.
 */
export class LabelRegistry<TSchema extends Record<string, EntityId> = Record<string, EntityId>> {
  private readonly data: ReadonlyMap<string, ReadonlyMap<string, VersionCache>>;
  private readonly versionOrder: ReadonlyMap<string, readonly string[]>;

  constructor(defs: { [K in keyof TSchema]: LabelVersionEntry<TSchema[K]>[] }) {
    const rawDefs = defs as Record<string, LabelVersionEntry<EntityId>[]>;
    const dataMap = new Map<string, Map<string, VersionCache>>();
    const orderMap = new Map<string, string[]>();

    for (const [name, versions] of Object.entries(rawDefs)) {
      assertNonEmptyArray(versions, `Label "${name}" versions`);

      const versionMap = new Map<string, VersionCache>();
      const order: string[] = [];

      for (const entry of versions) {
        assertNoColon(entry.version, `Label "${name}" version`);
        if (versionMap.has(entry.version)) {
          throw new ShapeError(`Duplicate version "${entry.version}" in label "${name}"`);
        }
        assertNonEmptyArray(entry.ids, `Label "${name}" version "${entry.version}" ids`);

        const safeCopy: LabelVersionEntry<EntityId> = {
          ...entry,
          ids: [...entry.ids],
        };
        versionMap.set(entry.version, this._buildCache(name, safeCopy));
        order.push(entry.version);
      }

      dataMap.set(name, versionMap);
      orderMap.set(name, order);
    }

    this.data = dataMap;
    this.versionOrder = orderMap;
  }

  // ── max 조회 ─────────────────────────────────────────────────────────────

  getMax<K extends keyof TSchema & string>(label: K, version: string): number {
    return this._getCache(label, version).max;
  }

  getLatestMax<K extends keyof TSchema & string>(label: K): number {
    return this._getLatestCache(label).max;
  }

  // ── ID ↔ index 변환 ──────────────────────────────────────────────────────

  /**
   * entity ID → 1-based 순번 인덱스.
   * TSchema로부터 각 레이블의 entity ID 타입이 컴파일 타임에 검증된다.
   */
  getIndex<K extends keyof TSchema & string>(
    label: K,
    version: string,
    entityId: TSchema[K],
  ): number {
    const cache = this._getCache(label, version);
    const idx = cache.idToIndex.get(entityId as EntityId);
    if (idx === undefined) {
      throw new EntityNotFoundError(
        `Entity id "${entityId}" not found in label "${label}" version "${version}"`,
      );
    }
    return idx;
  }

  /**
   * 1-based 순번 인덱스 → entity ID.
   * 반환 타입이 TSchema[K] 로 좁혀진다.
   */
  getEntityId<K extends keyof TSchema & string>(
    label: K,
    version: string,
    index: number,
  ): TSchema[K] {
    const cache = this._getCache(label, version);
    const id = cache.indexToId.get(index);
    if (id === undefined) {
      throw new EntityNotFoundError(
        `Index ${index} not found in label "${label}" version "${version}" (max: ${cache.max})`,
      );
    }
    return id as TSchema[K];
  }

  // ── 버전 조회 ─────────────────────────────────────────────────────────────

  getLatestVersion<K extends keyof TSchema & string>(label: K): string {
    const order = this._getOrder(label);
    return order[order.length - 1];
  }

  getVersions<K extends keyof TSchema & string>(
    label: K,
  ): readonly LabelVersionEntry<TSchema[K]>[] {
    const order = this._getOrder(label);
    const versionMap = this._getVersionMap(label);
    return order.map(
      // eslint-disable-next-line typescript/no-non-null-assertion -- versionMap은 order와 동일한 키로 구축됨
      (v) => versionMap.get(v)!.entry as LabelVersionEntry<TSchema[K]>,
    );
  }

  // ── 존재 확인 ─────────────────────────────────────────────────────────────

  hasLabel(label: string): boolean {
    return this.data.has(label);
  }

  hasVersion(label: string, version: string): boolean {
    const versionMap = this.data.get(label);
    return versionMap !== undefined && versionMap.has(version);
  }

  get labelNames(): readonly (keyof TSchema & string)[] {
    return [...this.data.keys()] as (keyof TSchema & string)[];
  }

  // ── 패키지 내부용 untyped 접근 ────────────────────────────────────────────

  /** @internal prefix-registry에서 label 이름을 동적으로 넘길 때 사용 */
  _getMaxRaw(label: string, version: string): number {
    return this._getCache(label, version).max;
  }

  /** @internal */
  _getIndexRaw(label: string, version: string, entityId: EntityId): number {
    const cache = this._getCache(label, version);
    const idx = cache.idToIndex.get(entityId);
    if (idx === undefined) {
      throw new EntityNotFoundError(
        `Entity id "${entityId}" not found in label "${label}" version "${version}"`,
      );
    }
    return idx;
  }

  /** @internal */
  _getEntityIdRaw(label: string, version: string, index: number): EntityId {
    const cache = this._getCache(label, version);
    const id = cache.indexToId.get(index);
    if (id === undefined) {
      throw new EntityNotFoundError(
        `Index ${index} not found in label "${label}" version "${version}" (max: ${cache.max})`,
      );
    }
    return id;
  }

  // ── 내부 ────────────────────────────────────────────────────────────────

  private _buildCache(labelName: string, entry: LabelVersionEntry<EntityId>): VersionCache {
    const idToIndex = new Map<EntityId, number>();
    const indexToId = new Map<number, EntityId>();
    const seenIds = new Set<EntityId>();

    for (let pos = 0; pos < entry.ids.length; pos++) {
      // -0 과 0 은 JavaScript Map/Set에서 동일하게 취급되므로 0 으로 정규화.
      // 정규화하지 않으면 ids: [-0, 0] 이 중복 감지를 통과해 bijection 이 깨진다.
      const raw = entry.ids[pos];
      const id: EntityId = typeof raw === 'number' && Object.is(raw, -0) ? 0 : raw;
      if (seenIds.has(id)) {
        throw new ShapeError(
          `Duplicate entity id "${id}" in label "${labelName}" version "${entry.version}"`,
        );
      }
      seenIds.add(id);
      const index = pos + 1;
      idToIndex.set(id, index);
      indexToId.set(index, id);
    }

    return { entry, idToIndex, indexToId, max: entry.ids.length };
  }

  private _getVersionMap(label: string): ReadonlyMap<string, VersionCache> {
    const versionMap = this.data.get(label);
    if (!versionMap) {
      throw new LabelNotFoundError(
        `Unknown label: "${label}". Registered: [${formatList(this.data.keys())}]`,
      );
    }
    return versionMap;
  }

  private _getOrder(label: string): readonly string[] {
    const order = this.versionOrder.get(label);
    if (!order) {
      throw new LabelNotFoundError(`Unknown label: "${label}"`);
    }
    return order;
  }

  private _getCache(label: string, version: string): VersionCache {
    const versionMap = this._getVersionMap(label);
    const cache = versionMap.get(version);
    if (!cache) {
      throw new VersionNotFoundError(
        `Unknown version "${version}" for label "${label}". Available: [${formatList(versionMap.keys())}]`,
      );
    }
    return cache;
  }

  private _getLatestCache(label: string): VersionCache {
    const order = this._getOrder(label);
    const versionMap = this._getVersionMap(label);
    // eslint-disable-next-line typescript/no-non-null-assertion -- order는 최소 1개 이상이고 versionMap에 동일 키 존재
    return versionMap.get(order[order.length - 1])!;
  }
}

// ── 팩토리 ───────────────────────────────────────────────────────────────────

/**
 * LabelRegistry 팩토리 함수.
 * 입력 defs에서 레이블별 entity ID 타입을 자동 추론한다.
 *
 * @example
 * const labels = createLabelRegistry({
 *   role:   [{ version: "v1", ids: [1, 2, 3] }],
 *   action: [{ version: "v1", ids: ["read", "write"] }],
 * });
 * // labels: LabelRegistry<{ role: number; action: string }>
 *
 * labels.getIndex("role", "v1", 1);     // ✓
 * labels.getIndex("role", "v1", "hi");  // ✗ 컴파일 오류
 */
export function createLabelRegistry<T extends Record<string, LabelVersionEntry<EntityId>[]>>(
  defs: T,
): LabelRegistry<InferLabelSchema<T>> {
  return new LabelRegistry(
    defs as unknown as {
      [K in keyof InferLabelSchema<T>]: LabelVersionEntry<InferLabelSchema<T>[K]>[];
    },
  );
}
