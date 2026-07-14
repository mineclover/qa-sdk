// @def.boundary persistence-system-root
// @def.doc persistence-system-root

/**
 * bit-index.ts — 차원별 비트 패킹 인덱스
 *
 * mixed-radix(WeightedIndex)가 모든 차원을 하나의 1D 정수로 압축하는 반면,
 * BitIndex는 각 차원을 독립 비트 필드에 배치한다.
 *
 * ── 비교 ────────────────────────────────────────────────────────────────
 *
 *   mixed-radix:  coords → Σ(x_i-1)×stride_i → 1D 정수 (공간 최적)
 *   bit-index:    coords → [dim0:4b][dim1:6b][dim2:3b][dim3:5b] (O(1) 추출)
 *
 *   공간:    mixed-radix ⌈log₂(Π shape)⌉  vs  bit-index Σ⌈log₂(shape[i])⌉
 *   추출:    mixed-radix O(d) mod/div     vs  bit-index O(1) shift+mask
 *
 * ── 핵심 장점 ───────────────────────────────────────────────────────────
 *
 *   // region만 추출 — shift 한 번
 *   const region = idx.extractDim(packed, 0);
 *
 *   // region+page+action만 추출 — shift 3번 (full decode 불필요)
 *   const subset = idx.extractDims(packed, [0, 1, 2]);
 *
 * ── 주의 ────────────────────────────────────────────────────────────────
 *
 *   packed 값 공간에 "구멍"이 있다:
 *     shape[i]가 2의 거듭제곱이 아니면, 할당된 비트로 표현 가능하지만
 *     shape[i]를 초과하는 값이 존재한다. 이 값들은 유효하지 않은 packed 값이다.
 *     decode 시 검증하여 거부한다.
 *
 *   calcAddressRanges와 호환 불가:
 *     mixed-radix 주소 공간 전용. bit-index 공간에서는 extractDim으로 필터링.
 */

import {
  createBitFieldLayout,
  bitUnpack,
  bitPackToBytes,
  bitPackToHex,
  bitsForMax,
  ShapeError,
  CoordError,
  IndexRangeError,
  type BitFieldLayout,
  type BitFieldSpec,
} from 'weighted-index';

// ═══════════════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════════════

/** 차원별 사전 계산된 추출 상수 */
export interface BitSlot {
  readonly label: string;
  readonly bits: number;
  readonly shift: bigint;
  readonly mask: bigint;
}

// ═══════════════════════════════════════════════════════════════════════════
//  BitIndexBig — BigInt packed 표현 (모든 크기 지원)
// ═══════════════════════════════════════════════════════════════════════════

export class BitIndexBig {
  readonly shape: readonly number[];
  readonly labels: readonly string[];
  readonly totalBits: number;
  readonly totalBytes: number;
  readonly layout: BitFieldLayout;

  private readonly _slots: readonly BitSlot[];
  private readonly _labelMap: ReadonlyMap<string, number>;

  constructor(shape: number[], labels?: string[]) {
    if (shape.length === 0) {
      throw new ShapeError('shape must not be empty');
    }
    for (let i = 0; i < shape.length; i++) {
      if (!Number.isInteger(shape[i]) || shape[i] < 1) {
        throw new ShapeError(`shape[${i}] must be a positive integer, got ${shape[i]}`);
      }
    }
    const resolvedLabels = labels ?? shape.map((_, i) => `dim_${i}`);
    if (resolvedLabels.length !== shape.length) {
      throw new ShapeError(
        `labels length (${resolvedLabels.length}) must match shape length (${shape.length})`,
      );
    }

    this.shape = Object.freeze([...shape]);
    this.labels = Object.freeze([...resolvedLabels]);

    const specs: BitFieldSpec[] = shape.map((s, i) => ({
      name: resolvedLabels[i],
      maxValue: s - 1,
    }));
    this.layout = createBitFieldLayout(specs);
    this.totalBits = this.layout.totalBits;
    this.totalBytes = this.layout.totalBytes;

    const slots: BitSlot[] = this.layout.fields.map((f) => ({
      label: f.name,
      bits: f.bits,
      shift: BigInt(this.totalBits - f.offset - f.bits),
      mask: f.maxValue,
    }));
    this._slots = Object.freeze(slots);

    const labelMap = new Map<string, number>();
    for (let i = 0; i < resolvedLabels.length; i++) {
      labelMap.set(resolvedLabels[i], i);
    }
    this._labelMap = labelMap;
  }

  // ── encode / decode ─────────────────────────────────────────────────

  encode(coords: number[]): bigint {
    this._validateCoords(coords);
    return this._encodeCore(coords);
  }

  decode(packed: bigint): number[] {
    this._validatePacked(packed);
    return this._decodeCore(packed);
  }

  encodeUnsafe(coords: number[]): bigint {
    return this._encodeCore(coords);
  }

  decodeUnsafe(packed: bigint): number[] {
    return this._decodeCoreUnchecked(packed);
  }

  encodeFromRecord(record: Record<string, number>): bigint {
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

  decodeToRecord(packed: bigint): Record<string, number> {
    const coords = this.decode(packed);
    const rec: Record<string, number> = {};
    for (let i = 0; i < this.labels.length; i++) {
      rec[this.labels[i]] = coords[i];
    }
    return rec;
  }

  // ── O(1) 차원 추출 ─────────────────────────────────────────────────

  extractDim(packed: bigint, dimIndex: number): number {
    const slot = this._slots[dimIndex];
    return Number((packed >> slot.shift) & slot.mask) + 1;
  }

  extractDimByLabel(packed: bigint, label: string): number {
    const idx = this._labelMap.get(label);
    if (idx === undefined) throw new CoordError(`Unknown label: "${label}"`);
    return this.extractDim(packed, idx);
  }

  extractDims(packed: bigint, dimIndices: number[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const i of dimIndices) {
      result[this._slots[i].label] = this.extractDim(packed, i);
    }
    return result;
  }

  extractDimsByLabel(packed: bigint, labels: string[]): Record<string, number> {
    const result: Record<string, number> = {};
    for (const label of labels) {
      result[label] = this.extractDimByLabel(packed, label);
    }
    return result;
  }

  // ── 직렬화 ──────────────────────────────────────────────────────────

  toBytes(coords: number[]): Uint8Array {
    return bitPackToBytes(this.layout, this._toValues(coords));
  }

  fromBytes(bytes: Uint8Array): number[] {
    const raw = bitUnpack(
      this.layout,
      bytes.reduce((acc, b) => (acc << 8n) | BigInt(b), 0n),
    );
    return this._fromValues(raw);
  }

  toHex(coords: number[]): string {
    return bitPackToHex(this.layout, this._toValues(coords));
  }

  fromHex(hex: string): number[] {
    const clean = hex.replace(/[-\s]/g, '').toLowerCase();
    const packed = BigInt('0x' + (clean || '0'));
    return this.decode(packed);
  }

  // ── 내부 ──────────────────────────────────────────────────────────

  private _encodeCore(coords: number[]): bigint {
    let result = 0n;
    for (let i = 0; i < coords.length; i++) {
      const slot = this._slots[i];
      result |= BigInt(coords[i] - 1) << slot.shift;
    }
    return result;
  }

  private _decodeCore(packed: bigint): number[] {
    const out = new Array<number>(this.shape.length);
    for (let i = 0; i < this.shape.length; i++) {
      const slot = this._slots[i];
      const val = Number((packed >> slot.shift) & slot.mask);
      if (val >= this.shape[i]) {
        throw new IndexRangeError(
          `Dimension "${slot.label}" value ${val + 1} exceeds shape ${this.shape[i]} at packed ${packed}`,
        );
      }
      out[i] = val + 1;
    }
    return out;
  }

  private _decodeCoreUnchecked(packed: bigint): number[] {
    const out = new Array<number>(this.shape.length);
    for (let i = 0; i < this.shape.length; i++) {
      const slot = this._slots[i];
      out[i] = Number((packed >> slot.shift) & slot.mask) + 1;
    }
    return out;
  }

  private _validateCoords(coords: number[]): void {
    if (coords.length !== this.shape.length) {
      throw new CoordError(
        `coords length (${coords.length}) must match shape length (${this.shape.length})`,
      );
    }
    for (let i = 0; i < this.shape.length; i++) {
      const x = coords[i];
      if (!Number.isInteger(x) || x < 1 || x > this.shape[i]) {
        throw new CoordError(
          `coords[${i}] (label: "${this.labels[i]}") must be in [1, ${this.shape[i]}], got ${x}`,
        );
      }
    }
  }

  private _validatePacked(packed: bigint): void {
    if (packed < 0n || packed >= 1n << BigInt(this.totalBits)) {
      throw new IndexRangeError(
        `packed value must be in [0, 2^${this.totalBits}-1], got ${packed}`,
      );
    }
  }

  private _toValues(coords: number[]): Record<string, number> {
    const values: Record<string, number> = {};
    for (let i = 0; i < coords.length; i++) {
      values[this.labels[i]] = coords[i] - 1;
    }
    return values;
  }

  private _fromValues(raw: Record<string, bigint>): number[] {
    const out = new Array<number>(this.shape.length);
    for (let i = 0; i < this.shape.length; i++) {
      out[i] = Number(raw[this.labels[i]]) + 1;
    }
    return out;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  BitIndex — Number packed 표현 (totalBits ≤ 53)
// ═══════════════════════════════════════════════════════════════════════════

export class BitIndex {
  readonly shape: readonly number[];
  readonly labels: readonly string[];
  readonly totalBits: number;
  readonly totalBytes: number;
  readonly layout: BitFieldLayout;

  private readonly _big: BitIndexBig;

  constructor(shape: number[], labels?: string[]) {
    this._big = new BitIndexBig(shape, labels);
    const totalBits = this._big.totalBits;
    if (totalBits > 53) {
      throw new ShapeError(
        `BitIndex requires totalBits ≤ 53, got ${totalBits}. Use BitIndexBig instead.`,
      );
    }
    this.shape = this._big.shape;
    this.labels = this._big.labels;
    this.totalBits = totalBits;
    this.totalBytes = this._big.totalBytes;
    this.layout = this._big.layout;
  }

  encode(coords: number[]): number {
    return Number(this._big.encode(coords));
  }
  decode(packed: number): number[] {
    return this._big.decode(BigInt(packed));
  }
  encodeUnsafe(coords: number[]): number {
    return Number(this._big.encodeUnsafe(coords));
  }
  decodeUnsafe(packed: number): number[] {
    return this._big.decodeUnsafe(BigInt(packed));
  }
  encodeFromRecord(record: Record<string, number>): number {
    return Number(this._big.encodeFromRecord(record));
  }
  decodeToRecord(packed: number): Record<string, number> {
    return this._big.decodeToRecord(BigInt(packed));
  }

  extractDim(packed: number, dimIndex: number): number {
    return this._big.extractDim(BigInt(packed), dimIndex);
  }
  extractDimByLabel(packed: number, label: string): number {
    return this._big.extractDimByLabel(BigInt(packed), label);
  }
  extractDims(packed: number, dimIndices: number[]): Record<string, number> {
    return this._big.extractDims(BigInt(packed), dimIndices);
  }
  extractDimsByLabel(packed: number, labels: string[]): Record<string, number> {
    return this._big.extractDimsByLabel(BigInt(packed), labels);
  }

  toBytes(coords: number[]): Uint8Array {
    return this._big.toBytes(coords);
  }
  fromBytes(bytes: Uint8Array): number[] {
    return this._big.fromBytes(bytes);
  }
  toHex(coords: number[]): string {
    return this._big.toHex(coords);
  }
  fromHex(hex: string): number[] {
    return this._big.fromHex(hex);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  Factory
// ═══════════════════════════════════════════════════════════════════════════

export function createBitIndex(shape: number[], labels?: string[]): BitIndex | BitIndexBig {
  const totalBits = shape.reduce((s, n) => s + bitsForMax(n - 1), 0);
  if (totalBits <= 53) {
    return new BitIndex(shape, labels);
  }
  return new BitIndexBig(shape, labels);
}
