/**
 * MetaCodec — entries 기반 독립 encode/decode 모듈
 *
 * ── 목적 ───────────────────────────────────────────────────────────────────
 *
 * DecodeMap(shape + entries) 하나만 받으면 MetaRegistry 없이 동작하는 경량 코덱.
 * 특정 index version에 특화되어 entity ID ↔ VersionedValue 변환을 수행한다.
 *
 * ── 내부 구현 ──────────────────────────────────────────────────────────────
 *
 * weighted-index의 LabelRegistry + PrefixRegistry에 위임한다.
 * - LabelRegistry : entity ID ↔ 1-based index 변환
 * - PrefixCodec: 좌표 배열 ↔ 1차원 정수 변환 + entity ID 기반 encode/decode
 *
 * MetaCodec은 이 두 레지스트리를 DecodeMap에서 자동 빌드하고,
 * VersionedIndex ↔ VersionedValue 변환을 처리하는 얇은 어댑터다.
 *
 * ── API ───────────────────────────────────────────────────────────────────
 *
 * encode(entityIds)  : { role: "admin", action: "read" } → VersionedValue
 * decode(vv)         : VersionedValue → { role: "admin", action: "read" }
 * strides            : 각 차원의 스트라이드 (address 공식의 가중치)
 * dimIds             : 차원 ID 배열 (shape과 같은 순서)
 * enumerate(partial) : 부분 조건에 매칭되는 value 목록 (matchRanges + 전개)
 * resolveRef(...)    : index_ref dim의 참조를 target codec으로 해석
 * decodeBatch(values): 다수의 value를 한 번에 decode
 */

import {
  createLabelRegistry,
  PrefixCodec,
  calcWeights,
  calcAddressRanges,
  expandRanges,
  type CoordConstraint,
  type EntityId as WiEntityId,
  type LabelVersionEntry,
  EntityNotFoundError as WiEntityNotFoundError,
  CoordError,
} from "weighted-index";
import type { DecodeMap, EntityId, VersionedValue } from "./types.js";
import { EntryNotFoundError, ValidationError } from "./errors.js";

/**
 * DecodeMap의 유효성을 검증한다.
 *
 * MetaCodec 생성 전에 호출하면 잘못된 DecodeMap으로 인한
 * LabelRegistry/PrefixCodec 내부 에러를 방지할 수 있다.
 *
 * @throws {ValidationError} shape/entries 불일치, 빈 배열, 음수 등
 */
export function validateDecodeMap(map: DecodeMap): void {
  if (!map.indexId || typeof map.indexId !== "string") {
    throw new ValidationError("DecodeMap.indexId must be a non-empty string");
  }
  if (!map.versionId || typeof map.versionId !== "string") {
    throw new ValidationError("DecodeMap.versionId must be a non-empty string");
  }
  if (!Array.isArray(map.dims) || map.dims.length === 0) {
    throw new ValidationError("DecodeMap.dims must be a non-empty array");
  }
  if (!Array.isArray(map.shape) || map.shape.length !== map.dims.length) {
    throw new ValidationError(
      `DecodeMap.shape.length (${map.shape?.length ?? 0}) must equal dims.length (${map.dims.length})`
    );
  }

  const seenDimIds = new Set<string>();
  let expectedSize = 1;

  for (let i = 0; i < map.dims.length; i++) {
    const dim = map.dims[i];

    if (!dim.dimId || typeof dim.dimId !== "string") {
      throw new ValidationError(`DecodeMap.dims[${i}].dimId must be a non-empty string`);
    }
    if (!dim.snapshotId || typeof dim.snapshotId !== "string") {
      throw new ValidationError(`DecodeMap.dims[${i}].snapshotId must be a non-empty string`);
    }

    if (seenDimIds.has(dim.dimId)) {
      throw new ValidationError(`DecodeMap.dims: duplicate dimId "${dim.dimId}"`);
    }
    seenDimIds.add(dim.dimId);

    if (map.shape[i] <= 0) {
      throw new ValidationError(`DecodeMap.shape[${i}] must be > 0, got ${map.shape[i]}`);
    }
    if (map.shape[i] !== dim.entries.length) {
      throw new ValidationError(
        `DecodeMap.shape[${i}] (${map.shape[i]}) must equal dims[${i}].entries.length (${dim.entries.length})`
      );
    }

    expectedSize *= map.shape[i];
  }

  if (map.size !== expectedSize) {
    throw new ValidationError(
      `DecodeMap.size (${map.size}) must equal product of shape (${expectedSize})`
    );
  }
}

export class MetaCodec {
  private readonly _prefix: PrefixCodec;
  private readonly _map: DecodeMap;

  constructor(map: DecodeMap) {
    this._map = map;

    // DecodeMap → LabelRegistry
    const labelDefs: Record<string, LabelVersionEntry<WiEntityId>[]> = {};
    for (const dim of map.dims) {
      labelDefs[dim.dimId] = [{ version: dim.snapshotId, ids: [...dim.entries] }];
    }
    const labels = createLabelRegistry(labelDefs);

    // DecodeMap → PrefixCodec
    this._prefix = new PrefixCodec(labels, {
      [map.indexId]: {
        labels: map.dims.map((d) => d.dimId),
        versions: [
          {
            version: map.versionId,
            labelVersions: Object.fromEntries(
              map.dims.map((d) => [d.dimId, d.snapshotId])
            ),
          },
        ],
      },
    });
  }

  /**
   * entity ID 레코드 → VersionedValue.
   *
   * @example
   * codec.encode({ role: "admin", action: "read", resource: 10 })
   * // → { indexId: "perm", versionId: "v1", value: 0 }
   */
  encode(entityIds: Record<string, EntityId>): VersionedValue {
    try {
      const vi = this._prefix.encodeFromIds(
        this._map.indexId,
        entityIds,
        this._map.versionId
      );
      return { indexId: vi.prefix, versionId: vi.v, value: vi.id };
    } catch (e) {
      if (e instanceof WiEntityNotFoundError) {
        throw new EntryNotFoundError(
          `encode "${this._map.indexId}/${this._map.versionId}": ${e.message}`
        );
      }
      if (e instanceof CoordError) {
        throw new ValidationError(
          `encode "${this._map.indexId}/${this._map.versionId}": ${e.message}`
        );
      }
      throw e;
    }
  }

  /**
   * VersionedValue → entity ID 레코드.
   *
   * indexId/versionId가 이 코덱과 일치하는지 검증한다.
   * inactive entry도 항상 decode 가능하다.
   *
   * @example
   * codec.decode({ indexId: "perm", versionId: "v1", value: 0 })
   * // → { role: "admin", action: "read", resource: 10 }
   */
  decode(vv: VersionedValue): Readonly<Record<string, EntityId>> {
    if (vv.indexId !== this._map.indexId || vv.versionId !== this._map.versionId) {
      throw new ValidationError(
        `decode: expected "${this._map.indexId}/${this._map.versionId}", ` +
        `got "${vv.indexId}/${vv.versionId}"`
      );
    }
    return this.decodeValue(vv.value);
  }

  /**
   * value(정수) → entity ID 레코드.
   *
   * indexId/versionId 검증 없이 value만으로 decode.
   * 이미 indexId/versionId를 알고 있는 경우 사용.
   */
  decodeValue(value: number): Readonly<Record<string, EntityId>> {
    const ids = this._prefix.decodeToIds({
      prefix: this._map.indexId,
      v: this._map.versionId,
      id: value,
    });
    return Object.freeze(ids);
  }

  get indexId(): string {
    return this._map.indexId;
  }

  get versionId(): string {
    return this._map.versionId;
  }

  get size(): number {
    return this._map.size;
  }

  get shape(): readonly number[] {
    return this._map.shape;
  }

  /**
   * 각 차원의 스트라이드(가중치).
   *
   * strides[i] = Π_{j > i} shape[j]  (마지막 차원은 항상 1)
   *
   * ── 용도 ──────────────────────────────────────────────────────────────────
   *
   * API 서버에서 수동 stride 계산을 제거한다.
   * 기존에 `const EVT_SVC_STRIDE_V1 = 7 * 2;` 같은 상수를 유지하던 패턴을
   * `codec.strides[0]`로 대체할 수 있다.
   *
   * @example
   * // event index: shape [10, 7, 2] (svc × event × initiator)
   * const evtCodec = reg.createCodec("event", "v1");
   * evtCodec.strides  // → [14, 2, 1]
   * // 서비스 하나가 바뀌면 주소가 14씩 건너뜀
   */
  get strides(): readonly number[] {
    return calcWeights([...this._map.shape]);
  }

  /**
   * 차원 ID 배열 (shape, strides와 같은 순서).
   *
   * ── 용도 ──────────────────────────────────────────────────────────────────
   *
   * shape/strides가 숫자 배열이므로 "몇 번째가 어떤 차원인지" 확인할 때 사용.
   * `dimIds[i]`와 `strides[i]`를 조합하면 차원별 stride를 label과 함께 참조 가능.
   *
   * @example
   * codec.dimIds   // → ["perm_svc", "role"]
   * codec.strides  // → [5, 1]
   * // perm_svc의 stride = 5, role의 stride = 1
   */
  get dimIds(): readonly string[] {
    return this._map.dims.map((d) => d.dimId);
  }

  /** 내부 DecodeMap의 복사본 반환. */
  toDecodeMap(): DecodeMap {
    return structuredClone(this._map);
  }

  /**
   * 부분 좌표 패턴에 매칭되는 value 범위 목록을 반환한다.
   *
   * ── 목적 ────────────────────────────────────────────────────────────────────
   *
   * DB에 VersionedValue.value가 저장되어 있을 때, 특정 dim만 고정하고 나머지를
   * 와일드카드로 두어 해당 패턴에 해당하는 value 범위를 계산한다.
   * 반환된 [from, to] 구간을 DB BETWEEN 쿼리에 그대로 사용할 수 있다.
   *
   * ── 입력 ────────────────────────────────────────────────────────────────────
   *
   *   partial의 각 dim:
   *     - EntityId 지정 → 해당 값만 매칭
   *     - null 또는 키 생략 → 와일드카드 (해당 dim의 모든 값 매칭)
   *
   * ── 반환값 ───────────────────────────────────────────────────────────────────
   *
   *   정렬·병합된 [from, to][] (from 기준 오름차순, 인접·겹치는 구간은 병합됨).
   *   모든 dim이 와일드카드이면 [[0, size-1]] 하나.
   *
   * @throws {EntryNotFoundError} partial에 지정된 entity ID가 해당 dim에 없을 때
   *
   * @example
   * // role × action × resource (3×3×3, size=27)
   * codec.matchRanges({ role: "editor", action: null })
   * // → [[9, 17]]  (role=editor인 모든 주소)
   *
   * codec.matchRanges({ role: "viewer", action: null, resource: 30 })
   * // → [[20,20],[23,23],[26,26]]  (action이 달라 비연속 구간)
   *
   * codec.matchRanges({})
   * // → [[0, 26]]  (전체 범위)
   */
  matchRanges(partial: Record<string, EntityId | null>): [number, number][] {
    const constraints: CoordConstraint[] = this._map.dims.map((dim) => {
      const val = partial[dim.dimId];
      if (val === undefined || val === null) return null;
      const idx = dim.entries.indexOf(val);
      if (idx === -1) {
        throw new EntryNotFoundError(
          `matchRanges "${this._map.indexId}/${this._map.versionId}": entity "${val}" not found in dim "${dim.dimId}"`
        );
      }
      return String(idx + 1); // 1-based CoordConstraint
    });
    return calcAddressRanges(this._map.shape, constraints);
  }

  /**
   * 부분 조건에 매칭되는 개별 value 목록을 반환한다.
   *
   * ── 용도 ──────────────────────────────────────────────────────────────────
   *
   * matchRanges()가 [from, to] 구간을 반환하는 반면, enumerate()는
   * 개별 정수로 전개한다. UI 그리드의 셀 하이라이트, 접근 가능 주소 목록 등
   * 개별 값이 필요한 경우에 사용한다.
   *
   * ── 주의 ──────────────────────────────────────────────────────────────────
   *
   * 결과 배열 크기가 매칭 주소 수와 같으므로, 넓은 와일드카드 패턴에서는
   * matchRanges()를 직접 사용하는 것이 메모리 효율적이다.
   *
   * @example
   * // role × action × resource (3×3×3)
   * codec.enumerate({ role: "editor" })
   * // → [9, 10, 11, 12, 13, 14, 15, 16, 17]
   *
   * codec.enumerate({ role: "admin", action: "read" })
   * // → [0, 1, 2]
   */
  enumerate(partial: Record<string, EntityId | null>): number[] {
    return expandRanges(this.matchRanges(partial));
  }

  /**
   * index_ref dim의 참조값을 target codec으로 해석한다.
   *
   * ── 용도 ──────────────────────────────────────────────────────────────────
   *
   * permission index에 service index를 참조하는 perm_svc dim이 있을 때,
   * permission 주소에서 service의 구성 차원(env, region, svc_name, ns)을
   * 한 번에 추출한다.
   *
   * 기존에 API에서 수동으로 수행하던 패턴:
   *   const svcIdx = Math.floor(permValue / roleStride);
   *   const svcValue = PERM_SVC_VALUES[svcIdx];
   *   const decoded = decodeSvcValue(svcValue);
   *
   * 이를 한 줄로 대체:
   *   const svcEntities = permCodec.resolveRef(permValue, "perm_svc", svcCodec);
   *
   * ── deepDecode와의 차이 ──────────────────────────────────────────────────
   *
   * deepDecode: 모든 index_ref를 재귀적으로 탐색. MetaRegistry 필요.
   * resolveRef: 특정 dim 하나만, 한 단계만 해석. MetaCodec 단독 동작.
   *
   * @param value       이 코덱의 주소 공간에서의 value
   * @param dimId       해석할 index_ref dim의 ID
   * @param targetCodec 참조 대상 index의 코덱
   *
   * @throws {ValidationError} dimId가 이 코덱에 없거나 index_ref가 아닐 때
   * @throws {ValidationError} 참조값이 targetCodec의 범위를 벗어날 때
   *
   * @example
   * const permCodec = reg.createCodec("permission", "v1");
   * const svcCodec  = reg.createCodec("service", "v1");
   *
   * permCodec.resolveRef(42, "perm_svc", svcCodec)
   * // → { env: "prod", region: "asia", svc_name: "shopping", namespace: "web" }
   */
  resolveRef(
    value: number,
    dimId: string,
    targetCodec: MetaCodec,
  ): Readonly<Record<string, EntityId>> {
    const dim = this._map.dims.find((d) => d.dimId === dimId);
    if (!dim) {
      throw new ValidationError(
        `resolveRef "${this._map.indexId}/${this._map.versionId}": unknown dim "${dimId}"`
      );
    }
    if (dim.kind.type !== "index_ref") {
      throw new ValidationError(
        `resolveRef "${this._map.indexId}/${this._map.versionId}": dim "${dimId}" is "${dim.kind.type}", expected "index_ref"`
      );
    }

    const decoded = this.decodeValue(value);
    const refValue = decoded[dimId];
    if (typeof refValue !== "number") {
      throw new ValidationError(
        `resolveRef "${this._map.indexId}/${this._map.versionId}": dim "${dimId}" entry is not a number`
      );
    }

    return targetCodec.decodeValue(refValue);
  }

  /**
   * 다수의 value를 한 번에 decode한다.
   *
   * ── 용도 ──────────────────────────────────────────────────────────────────
   *
   * 구조화 로그에 저장된 주소 배열을 일괄 디코딩할 때 사용한다.
   * 내부적으로 동일한 PrefixCodec 인스턴스를 재사용하므로
   * 반복 decode보다 오버헤드가 적다.
   *
   * @example
   * // 로그 테이블에서 조회한 svc_addr 목록
   * const addresses = [40, 41, 42, 60, 61];
   * const decoded = svcCodec.decodeBatch(addresses);
   * // → [
   * //   { env: "prod", region: "asia", svc_name: "shopping", namespace: "web" },
   * //   { env: "prod", region: "asia", svc_name: "shopping", namespace: "api" },
   * //   ...
   * // ]
   */
  decodeBatch(values: readonly number[]): Readonly<Record<string, EntityId>>[] {
    return values.map((v) => this.decodeValue(v));
  }
}
