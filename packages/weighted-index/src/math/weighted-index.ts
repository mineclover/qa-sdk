/**
 * WeightedIndex — 닫힌 패턴의 주소 압축기
 *
 * ── 개념 ───────────────────────────────────────────────────────────────────
 *
 * 닫힌 패턴(closed pattern)이란 각 차원의 가능한 값이 미리 열거되어 있고
 * 유한한 상태 공간을 말한다. 예) role × action × resource = 3×3×3 = 27가지 상태.
 *
 * WeightedIndex는 이 닫힌 패턴의 좌표를 하나의 정수(1D 주소)로 압축하고
 * 복원하는 알고리즘이다. 압축 결과는 [0, size-1] 범위의 유일한 정수이며,
 * 같은 좌표는 항상 같은 정수로, 다른 좌표는 반드시 다른 정수로 대응된다(전단사).
 *
 *   (role=2, action=1, resource=3) → encode → 15  (압축)
 *                               15 → decode → (role=2, action=1, resource=3)  (복원)
 *
 * 이 정수가 곧 "주소"다. DB 기본 키, UUID 등 외부 식별자로 직접 사용할 수 있다.
 *
 * ── 구현 ───────────────────────────────────────────────────────────────────
 *
 * 가중진법(weighted positional notation, 혼합 기수법)으로 구현한다.
 *
 * 공식 (d차원, 1-based):
 *   encode: address = Σ (x_i - 1) × Π_{j=i+1}^{d} N_j
 *   decode: x_i     = ⌊address / weight_i⌋ mod N_i + 1
 *
 * shape[i] = i번째 차원의 크기 (가능한 값의 수), 1 이상 정수.
 * 유효한 address 범위: [0, size-1].
 * 유효한 coords 범위: coords[i] ∈ [1, shape[i]].
 *
 * ── 성능 API ───────────────────────────────────────────────────────────────
 * encodeUnsafe / decodeUnsafe  : 경계 검사 생략. 입력이 신뢰된 경우 hot-path 전용.
 * decodeTo(index, out)         : 호출자가 버퍼를 제공. 배열 할당 없음.
 * decodeToUnsafe(index, out)   : 검사 없는 버퍼 기록.
 */

import type { Coord } from "./types.js";
import {
  BufferError,
  CoordError,
  IndexRangeError,
  ShapeError,
} from "./errors.js";
import { assertNonEmptyArray, assertPositiveInt } from "./validators.js";
import { calcWeights } from "./calc.js";

export class WeightedIndex {
  readonly shape: readonly number[];
  readonly labels: readonly string[];
  /** 총 가능한 조합 수 */
  readonly size: number;
  /**
   * 각 차원의 스트라이드(가중치).
   *
   * strides[i] = Π_{j > i} shape[j]  (마지막 차원은 항상 1)
   *
   * ── 용도 ──────────────────────────────────────────────────────────────────
   *
   * 주소 공식에서 i번째 차원의 좌표가 1 증가하면 주소가 strides[i]만큼 변한다.
   * API 서버에서 stride를 직접 참조해 수동 주소 계산을 줄일 수 있다.
   *
   * @example
   * // shape [10, 7, 2] → strides [14, 2, 1]
   * // event dim(stride 14): 서비스 하나가 바뀌면 주소가 14씩 건너뜀
   * const wi = new WeightedIndex([10, 7, 2]);
   * wi.strides // → [14, 2, 1]
   */
  readonly strides: readonly number[];
  /** 내부 연산용 Float64Array (tight-loop 성능) */
  private readonly _weightsBuf: Float64Array;
  /** shape을 Float64Array로 캐시 (tight-loop에서 property 접근 최소화) */
  private readonly shapeBuf: Float64Array;

  constructor(shape: number[], labels?: string[]) {
    assertNonEmptyArray(shape, "shape");
    for (let i = 0; i < shape.length; i++) {
      assertPositiveInt(shape[i], `shape[${i}]`);
    }
    if (labels !== undefined && labels.length !== shape.length) {
      throw new ShapeError(
        `labels length (${labels.length}) must match shape length (${shape.length})`
      );
    }

    this.shape = Object.freeze([...shape]);
    this.labels = Object.freeze(labels ?? shape.map((_, i) => `dim_${i}`));

    // stride 공식의 canonical 구현은 calcWeights() — D-4 단일화
    const stridesArr = calcWeights(shape);
    for (let i = 0; i < stridesArr.length; i++) {
      if (stridesArr[i] > Number.MAX_SAFE_INTEGER) {
        throw new ShapeError(
          `Shape product at dimension ${i} (${stridesArr[i]}) exceeds Number.MAX_SAFE_INTEGER. ` +
          `Reduce shape values or the number of dimensions.`
        );
      }
    }
    this._weightsBuf = new Float64Array(stridesArr);
    this.strides = Object.freeze(stridesArr);
    this.shapeBuf = new Float64Array(shape);

    const size = stridesArr[0] * shape[0];
    if (size > Number.MAX_SAFE_INTEGER) {
      throw new ShapeError(
        `Total combinations (${size}) exceeds Number.MAX_SAFE_INTEGER. Reduce shape values.`
      );
    }
    this.size = size;
  }

  // ── 안전한 공개 API ──────────────────────────────────────────────────────

  /** 정변환: 다차원 좌표(1-based) → 정수 인덱스. 경계 검사 포함. */
  encode(coords: number[]): number {
    this._validateCoords(coords);
    return this._encodeCore(coords);
  }

  /** 역변환: 정수 인덱스 → 다차원 좌표(1-based). 경계 검사 포함. */
  decode(index: number): number[] {
    this._validateIndex(index);
    const out = new Array<number>(this.shape.length);
    this._decodeCore(index, out);
    return out;
  }

  /** 정수 인덱스 → { label: value } 객체. */
  decodeToRecord(index: number): Record<string, number> {
    const coords = this.decode(index);
    const rec: Record<string, number> = {};
    for (let i = 0; i < this.labels.length; i++) {
      rec[this.labels[i]] = coords[i];
    }
    return rec;
  }

  /** { label: value } 객체 → 정수 인덱스. */
  encodeFromRecord(record: Record<string, number>): number {
    const coords = new Array<number>(this.labels.length);
    for (let i = 0; i < this.labels.length; i++) {
      const v = record[this.labels[i]];
      if (v === undefined) {
        throw new CoordError(`Missing key "${this.labels[i]}" in record`);
      }
      coords[i] = v;
    }
    return this.encode(coords);
  }

  // ── Hot-path API (경계 검사 생략) ────────────────────────────────────────
  //
  // ⚠️ 계약 위반 시 잘못된 값을 조용히 반환하며 오류가 발생하지 않는다.
  //    범위를 보장할 수 없는 경로에서는 반드시 안전한 encode / decode 를 사용할 것.
  //    내부적으로 검증된 좌표만 다루는 hot-path (예: MetaRegistry 내부)에서만 사용.
  //
  // ⚠️ 외부 입력(URL 파라미터, 사용자 입력, API 요청 등)에 절대 사용 금지.
  //    검증되지 않은 좌표가 전달되면 잘못된 주소가 생성되어 권한 검사, 비트마스크
  //    연산 등 후속 로직에서 예측 불가한 보안 취약점을 유발할 수 있다.

  /**
   * 정변환 (검사 없음). coords[i] ∈ [1, shape[i]] 를 호출자가 보장해야 한다.
   *
   * **주의**: 외부 입력에 직접 사용하지 마세요. 검증되지 않은 좌표는 잘못된
   * 인덱스를 생성하며, NaN이 후속 bitmask 검사로 전파될 수 있습니다.
   * 외부 경계에서는 항상 `encode()`를 사용하세요.
   */
  encodeUnsafe(coords: number[]): number {
    return this._encodeCore(coords);
  }

  /**
   * 역변환 (검사 없음). index ∈ [0, size-1] 를 호출자가 보장해야 한다.
   *
   * **주의**: 외부 입력에 직접 사용하지 마세요. 범위를 벗어난 인덱스는
   * 잘못된 좌표를 반환합니다. 외부 경계에서는 항상 `decode()`를 사용하세요.
   */
  decodeUnsafe(index: number): number[] {
    const out = new Array<number>(this.shape.length);
    this._decodeCore(index, out);
    return out;
  }

  /**
   * 역변환 결과를 미리 할당된 배열 `out` 에 기록.
   * 배열 할당 제로. 경계 검사 포함. out.length >= shape.length 요구.
   */
  decodeTo(index: number, out: number[]): void {
    if (out.length < this.shape.length) {
      throw new BufferError(
        `out buffer length (${out.length}) must be >= shape length (${this.shape.length})`
      );
    }
    this._validateIndex(index);
    this._decodeCore(index, out);
  }

  /** 역변환 결과를 미리 할당된 배열 `out` 에 기록 (검사 없음). 외부 입력 금지. */
  decodeToUnsafe(index: number, out: number[]): void {
    this._decodeCore(index, out);
  }

  // ── Batch API ──────────────────────────────────────────────────────────

  /** 배치 정변환: 좌표 배열 → Uint32Array. 경계 검사 포함. */
  encodeBatch(coords: readonly Coord[]): Uint32Array {
    if (this.size > 0xFFFF_FFFF) {
      throw new IndexRangeError(
        `size (${this.size}) exceeds Uint32Array range (4294967295)`
      );
    }
    const n = coords.length;
    const out = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      this._validateCoords(coords[i] as number[]);
      out[i] = this._encodeCore(coords[i] as number[]);
    }
    return out;
  }

  /** 배치 역변환: Uint32Array → 좌표 배열. 경계 검사 포함. */
  decodeBatch(addrs: Uint32Array): number[][] {
    const n = addrs.length;
    const out: number[][] = new Array(n);
    for (let i = 0; i < n; i++) {
      this._validateIndex(addrs[i]);
      const row = new Array<number>(this.shape.length);
      this._decodeCore(addrs[i], row);
      out[i] = row;
    }
    return out;
  }

  /** 배치 정변환 (검사 없음). 호출자가 좌표 범위를 보장해야 한다. */
  encodeBatchUnsafe(coords: readonly Coord[]): Uint32Array {
    const n = coords.length;
    const out = new Uint32Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = this._encodeCore(coords[i] as number[]);
    }
    return out;
  }

  /** 배치 역변환 (검사 없음). 호출자가 index 범위를 보장해야 한다. */
  decodeBatchUnsafe(addrs: Uint32Array): number[][] {
    const n = addrs.length;
    const out: number[][] = new Array(n);
    for (let i = 0; i < n; i++) {
      const row = new Array<number>(this.shape.length);
      this._decodeCore(addrs[i], row);
      out[i] = row;
    }
    return out;
  }

  /** Flat 배치 정변환: row-major Float64Array → Float64Array. zero-copy. */
  encodeBatchFlat(coordsBuf: Float64Array, itemCount: number): Float64Array {
    const d = this.shape.length;
    if (coordsBuf.length !== itemCount * d) {
      throw new BufferError(
        `coordsBuf length (${coordsBuf.length}) must equal itemCount * dims (${itemCount} * ${d} = ${itemCount * d})`
      );
    }
    const w = this._weightsBuf;
    const out = new Float64Array(itemCount);
    for (let i = 0; i < itemCount; i++) {
      const base = i * d;
      let index = 0;
      for (let j = 0; j < d; j++) {
        index += (coordsBuf[base + j] - 1) * w[j];
      }
      out[i] = index;
    }
    return out;
  }

  /** Flat 배치 역변환: Float64Array → row-major Float64Array. zero-copy. */
  decodeBatchFlat(addrsBuf: Float64Array, itemCount: number): Float64Array {
    if (addrsBuf.length !== itemCount) {
      throw new BufferError(
        `addrsBuf length (${addrsBuf.length}) must equal itemCount (${itemCount})`
      );
    }
    const d = this.shape.length;
    const out = new Float64Array(itemCount * d);
    for (let i = 0; i < itemCount; i++) {
      this._decodeCoreFlat(addrsBuf[i], out, i * d);
    }
    return out;
  }

  // ── 내부 ────────────────────────────────────────────────────────────────

  private _encodeCore(coords: number[]): number {
    const w = this._weightsBuf;
    let index = 0;
    for (let i = 0; i < w.length; i++) {
      index += (coords[i] - 1) * w[i];
    }
    return index;
  }

  private _decodeCore(index: number, out: number[]): void {
    const s = this.shapeBuf;
    let rest = index;
    for (let i = s.length - 1; i >= 0; i--) {
      const ni = s[i];
      out[i] = (rest % ni) + 1;
      rest = Math.floor(rest / ni);
    }
  }

  private _decodeCoreFlat(index: number, out: Float64Array, offset: number): void {
    const s = this.shapeBuf;
    let rest = index;
    for (let i = s.length - 1; i >= 0; i--) {
      const ni = s[i];
      out[offset + i] = (rest % ni) + 1;
      rest = Math.floor(rest / ni);
    }
  }

  private _validateCoords(coords: number[]): void {
    if (coords.length !== this.shape.length) {
      throw new CoordError(
        `coords length (${coords.length}) must match shape length (${this.shape.length})`
      );
    }
    for (let i = 0; i < this.shape.length; i++) {
      const x = coords[i];
      if (!Number.isInteger(x) || x < 1 || x > this.shape[i]) {
        throw new CoordError(
          `coords[${i}] (label: "${this.labels[i]}") must be in [1, ${this.shape[i]}], got ${x}`
        );
      }
    }
  }

  private _validateIndex(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index >= this.size) {
      throw new IndexRangeError(
        `index must be in [0, ${this.size - 1}], got ${index}`
      );
    }
  }
}
