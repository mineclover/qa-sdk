/**
 * WeightedIndexBig — BigInt 기반 주소 압축기
 *
 * WeightedIndex와 동일한 알고리즘이지만 BigInt 연산을 사용하여
 * Number.MAX_SAFE_INTEGER(2^53) 한계를 초과하는 shape product를 지원한다.
 *
 * ── 사용 시점 ──
 * shape product가 2^53을 초과하는 경우에만 사용.
 * 일반적으로는 Number 기반 WeightedIndex가 5~20x 빠르다.
 *
 * ── API 차이 ──
 * encode/decode가 bigint를 받고 반환한다.
 * shape와 coords는 bigint[] 타입이다.
 */

import { CoordError, IndexRangeError, ShapeError } from "./errors.js";

export class WeightedIndexBig {
  readonly shape: readonly bigint[];
  readonly labels: readonly string[];
  readonly size: bigint;
  readonly strides: readonly bigint[];

  constructor(shape: bigint[], labels?: string[]) {
    if (shape.length === 0) {
      throw new ShapeError("shape must not be empty");
    }
    for (let i = 0; i < shape.length; i++) {
      if (shape[i] < 1n) {
        throw new ShapeError(`shape[${i}] must be >= 1, got ${shape[i]}`);
      }
    }
    if (labels !== undefined && labels.length !== shape.length) {
      throw new ShapeError(
        `labels length (${labels.length}) must match shape length (${shape.length})`
      );
    }

    this.shape = Object.freeze([...shape]);
    this.labels = Object.freeze(labels ?? shape.map((_, i) => `dim_${i}`));

    const d = shape.length;
    const weights: bigint[] = new Array(d);
    weights[d - 1] = 1n;
    for (let i = d - 2; i >= 0; i--) {
      weights[i] = weights[i + 1] * shape[i + 1];
    }
    this.strides = Object.freeze(weights);
    this.size = weights[0] * shape[0];
  }

  /** 정변환: 다차원 좌표(1-based) → bigint 인덱스. 경계 검사 포함. */
  encode(coords: bigint[]): bigint {
    this._validateCoords(coords);
    return this._encodeCore(coords);
  }

  /** 역변환: bigint 인덱스 → 다차원 좌표(1-based). 경계 검사 포함. */
  decode(index: bigint): bigint[] {
    this._validateIndex(index);
    return this._decodeCore(index);
  }

  /** 경계 검사 없는 정변환. 호출자가 coords 범위를 보장해야 한다. */
  encodeUnsafe(coords: bigint[]): bigint {
    return this._encodeCore(coords);
  }

  /** 경계 검사 없는 역변환. 호출자가 index 범위를 보장해야 한다. */
  decodeUnsafe(index: bigint): bigint[] {
    return this._decodeCore(index);
  }

  private _encodeCore(coords: bigint[]): bigint {
    let index = 0n;
    for (let i = 0; i < this.strides.length; i++) {
      index += (coords[i] - 1n) * this.strides[i];
    }
    return index;
  }

  private _decodeCore(index: bigint): bigint[] {
    const out: bigint[] = new Array(this.shape.length);
    let rest = index;
    for (let i = this.shape.length - 1; i >= 0; i--) {
      const ni = this.shape[i];
      out[i] = (rest % ni) + 1n;
      rest = rest / ni;
    }
    return out;
  }

  private _validateCoords(coords: bigint[]): void {
    if (coords.length !== this.shape.length) {
      throw new CoordError(
        `coords length (${coords.length}) must match shape length (${this.shape.length})`
      );
    }
    for (let i = 0; i < this.shape.length; i++) {
      const x = coords[i];
      if (x < 1n || x > this.shape[i]) {
        throw new CoordError(
          `coords[${i}] (label: "${this.labels[i]}") must be in [1, ${this.shape[i]}], got ${x}`
        );
      }
    }
  }

  private _validateIndex(index: bigint): void {
    if (index < 0n || index >= this.size) {
      throw new IndexRangeError(
        `index must be in [0, ${this.size - 1n}], got ${index}`
      );
    }
  }
}
