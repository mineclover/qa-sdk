/**
 * bridge.ts — WeightedIndex ↔ BitIndex 브릿지
 *
 * 좌표(coords)를 공통 언어로 사용하여 두 인코딩 공간을 상호 변환한다.
 *
 * ── 변환 경로 ─────────────────────────────────────────────────────────────
 *
 *   WeightedIndex (DB 저장)              BitIndex (인메모리 필터)
 *        │                                    │
 *        │  wiIndex ──→ decode ──→ coords     │
 *        │                           │        │
 *        │                    encode ←──      │
 *        │                           │        │
 *        │     coords ──→ encode ──→ biPacked │
 *        │                                    │
 *
 * ── 실사용 시나리오 ───────────────────────────────────────────────────────
 *
 *   1. DB → 인메모리: WI 주소 로드 → BitIndex로 변환 → extractDim 필터링
 *   2. 인메모리 → DB: BitIndex 필터 결과 → WI 주소로 변환 → DB UPDATE
 *   3. 배치 변환: 대량 주소를 한 번에 변환하여 캐시 구축
 */

import { WeightedIndex } from "weighted-index";
import { BitIndex, BitIndexBig } from "./bit-index.js";
import { ShapeError } from "weighted-index";

// ═══════════════════════════════════════════════════════════════════════════
//  IndexBridge
// ═══════════════════════════════════════════════════════════════════════════

/**
 * WeightedIndex ↔ BitIndex 상호 변환기.
 *
 * 같은 shape/labels로 생성된 WI와 BI를 연결한다.
 * 좌표를 중간 표현으로 사용하여 두 인코딩 공간을 오간다.
 *
 * @example
 * const bridge = new IndexBridge([5, 8, 20], ["role", "action", "resource"]);
 *
 * // DB → 인메모리
 * const biPacked = bridge.toBit(42);       // WI index → BI packed
 * bridge.bi.extractDim(biPacked, 0);       // O(1) role 추출
 *
 * // 인메모리 → DB
 * const wiIndex = bridge.toWeighted(biPacked);  // BI packed → WI index
 */
export class IndexBridge {
  readonly wi: WeightedIndex;
  readonly bi: BitIndex;
  readonly shape: readonly number[];
  readonly labels: readonly string[];

  constructor(shape: number[], labels?: string[]) {
    this.wi = new WeightedIndex(shape, labels);
    this.bi = new BitIndex(shape, labels);
    this.shape = this.wi.shape;
    this.labels = this.wi.labels;
  }

  /** WeightedIndex index → BitIndex packed. */
  toBit(wiIndex: number): number {
    return this.bi.encode(this.wi.decode(wiIndex));
  }

  /** BitIndex packed → WeightedIndex index. */
  toWeighted(biPacked: number): number {
    return this.wi.encode(this.bi.decode(biPacked));
  }

  /** WeightedIndex index → BitIndex packed (검사 생략). */
  toBitUnsafe(wiIndex: number): number {
    return this.bi.encodeUnsafe(this.wi.decodeUnsafe(wiIndex));
  }

  /** BitIndex packed → WeightedIndex index (검사 생략). */
  toWeightedUnsafe(biPacked: number): number {
    return this.wi.encodeUnsafe(this.bi.decodeUnsafe(biPacked));
  }

  /** WeightedIndex index 배열 → BitIndex packed 배열 (배치). */
  toBitBatch(wiIndices: number[]): number[] {
    return wiIndices.map(i => this.toBitUnsafe(i));
  }

  /** BitIndex packed 배열 → WeightedIndex index 배열 (배치). */
  toWeightedBatch(biPackeds: number[]): number[] {
    return biPackeds.map(p => this.toWeightedUnsafe(p));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//  IndexBridgeBig
// ═══════════════════════════════════════════════════════════════════════════

/**
 * WeightedIndex ↔ BitIndexBig 변환기 (WI는 Number, BI는 BigInt).
 * totalBits > 53인 shape에서 사용.
 */
export class IndexBridgeBig {
  readonly wi: WeightedIndex;
  readonly bi: BitIndexBig;
  readonly shape: readonly number[];
  readonly labels: readonly string[];

  constructor(shape: number[], labels?: string[]) {
    this.wi = new WeightedIndex(shape, labels);
    this.bi = new BitIndexBig(shape, labels);
    this.shape = this.wi.shape;
    this.labels = this.wi.labels;
  }

  toBit(wiIndex: number): bigint {
    return this.bi.encode(this.wi.decode(wiIndex));
  }

  toWeighted(biPacked: bigint): number {
    return this.wi.encode(this.bi.decode(biPacked));
  }

  toBitUnsafe(wiIndex: number): bigint {
    return this.bi.encodeUnsafe(this.wi.decodeUnsafe(wiIndex));
  }

  toWeightedUnsafe(biPacked: bigint): number {
    return this.wi.encodeUnsafe(this.bi.decodeUnsafe(biPacked));
  }
}
