/**
 * WeightedIndex
 *
 * 가중진법(weighted positional notation) 기반 다차원 인덱스 ↔ 정수 변환기.
 *
 * 공식 (d차원, 1-based):
 *   encode: index = Σ (x_i - 1) * Π_{j=i+1}^{d} N_j
 *   decode: x_i  = floor(index / weight_i) mod N_i + 1
 *
 * shape[i] = i번째 차원의 최댓값(가능한 값 개수), 1 이상 정수.
 * 유효한 index 범위: [0, size-1].
 * 유효한 coords 범위: coords[i] ∈ [1, shape[i]].
 *
 * ── 성능 API ──────────────────────────────────────────────────────────────
 * encodeUnsafe / decodeUnsafe  : 경계 검사 생략. 입력이 신뢰된 경우 hot-path 전용.
 * decodeTo(index, out)         : 호출자가 버퍼를 제공. 배열 할당 없음.
 * decodeToUnsafe(index, out)   : 검사 없는 버퍼 기록.
 */

import {
  BufferError,
  CoordError,
  IndexRangeError,
  ShapeError,
} from "./errors.js";
import { assertNonEmptyArray, assertPositiveInt } from "./validators.js";

export class WeightedIndex {
  readonly shape: readonly number[];
  readonly labels: readonly string[];
  /** 총 가능한 조합 수 */
  readonly size: number;
  /** 각 차원의 가중치 (Float64Array for tight-loop performance) */
  private readonly weights: Float64Array;
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

    const d = shape.length;
    const weights = new Float64Array(d);
    weights[d - 1] = 1;
    for (let i = d - 2; i >= 0; i--) {
      weights[i] = weights[i + 1] * shape[i + 1];
    }
    this.weights = weights;
    this.shapeBuf = new Float64Array(shape);

    const size = weights[0] * shape[0];
    if (size > Number.MAX_SAFE_INTEGER) {
      throw new ShapeError(
        `Total combinations (${size}) exceeds Number.MAX_SAFE_INTEGER. Use BigInt variant.`
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

  /** 정변환 (검사 없음). coords[i] ∈ [1, shape[i]] 를 호출자가 보장. */
  encodeUnsafe(coords: number[]): number {
    return this._encodeCore(coords);
  }

  /** 역변환 (검사 없음). index ∈ [0, size-1] 를 호출자가 보장. */
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

  /** 역변환 결과를 미리 할당된 배열 `out` 에 기록 (검사 없음). */
  decodeToUnsafe(index: number, out: number[]): void {
    this._decodeCore(index, out);
  }

  // ── 내부 ────────────────────────────────────────────────────────────────

  private _encodeCore(coords: number[]): number {
    const w = this.weights;
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
