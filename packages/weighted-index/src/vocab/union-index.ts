// @def.boundary weighted-index-system
// @def.doc wi-disjoint-union-addressing

/**
 * DisjointUnionIndex — sum type 주소 공간.
 *
 * 여러 `WeightedIndex` 인스턴스를 disjoint offset으로 이어 붙여, 각 kind가
 * 독립 shape을 유지하면서 하나의 address 공간에 공존하게 한다.
 *
 * ── 기본 구조 ──────────────────────────────────────────────────────────────
 * total address space = ∑ variants[i].totalSize
 *
 * address allocation:
 *   [0 .. size_0 - 1]              → variants[0]
 *   [size_0 .. size_0+size_1 - 1]  → variants[1]
 *   ...
 *
 * ── encode/decode ───────────────────────────────────────────────────────────
 * encode(kind, coords) = range[kind].lo + sub_wi.encode(coords)
 * decode(address)      = 해당 range를 찾고 sub_wi.decode(address - lo)
 *
 * 참고: product 낭비 예시
 *   resource: N_r = 1000
 *   transaction: N_t = 50
 *   product = 1000 * 50 = 50,000 (대부분 비어있음)
 *   disjoint union = 1000 + 50 = 1050
 */

import { WeightedIndex } from '../math/weighted-index.js';
import { IndexRangeError, WeightedIndexError } from '../math/errors.js';
import { formatList } from '../math/validators.js';
import { calcAddressRanges, type CoordConstraint } from '../math/calc.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface UnionVariant {
  /** kind 식별자 — 문자열 라벨. 중복 금지. */
  kind: string;
  /** 이 kind의 sub-shape — 일반 WeightedIndex shape 규칙. */
  shape: number[];
  /** optional label 이름 (decodeToRecord 용). */
  labels?: readonly string[];
}

interface Range {
  kind: string;
  wi: WeightedIndex;
  offset: number;
  size: number;
}

// ── Error ────────────────────────────────────────────────────────────────────

export class UnionKindError extends WeightedIndexError {
  constructor(kind: string, registered: readonly string[]) {
    super(`Unknown union kind: "${kind}". Registered: [${formatList(registered)}]`);
    this.name = 'UnionKindError';
  }
}

// ── Class ────────────────────────────────────────────────────────────────────

export class DisjointUnionIndex {
  private readonly ranges: ReadonlyMap<string, Range>;
  /** offset 오름차순 — decode의 binary search 대상. */
  private readonly orderedRanges: readonly Range[];

  readonly totalSize: number;
  readonly kinds: readonly string[];

  constructor(variants: readonly UnionVariant[]) {
    if (variants.length === 0) {
      throw new WeightedIndexError('DisjointUnionIndex requires at least one variant');
    }

    const map = new Map<string, Range>();
    const ordered: Range[] = [];
    let offset = 0;

    for (const v of variants) {
      if (map.has(v.kind)) {
        throw new WeightedIndexError(`Duplicate union kind: "${v.kind}"`);
      }
      const wi = new WeightedIndex(v.shape, v.labels ? [...v.labels] : undefined);
      const range: Range = { kind: v.kind, wi, offset, size: wi.size };
      map.set(v.kind, range);
      ordered.push(range);
      offset += wi.size;
    }

    this.ranges = map;
    this.orderedRanges = ordered;
    this.totalSize = offset;
    this.kinds = ordered.map((r) => r.kind);
  }

  /** kind + 좌표 → 전역 address. */
  encode(kind: string, coords: number[]): number {
    const range = this.rangeFor(kind);
    return range.offset + range.wi.encode(coords);
  }

  /** 전역 address → kind + 좌표. */
  decode(address: number): { kind: string; coords: number[] } {
    const range = this.rangeContaining(address);
    return {
      kind: range.kind,
      coords: range.wi.decode(address - range.offset),
    };
  }

  /** 특정 kind의 [lo, hi] 전역 범위. */
  rangeOf(kind: string): [number, number] {
    const r = this.rangeFor(kind);
    return [r.offset, r.offset + r.size - 1];
  }

  /**
   * 특정 kind 내에서의 calcAddressRanges — 결과는 전역 address 범위.
   * pattern은 해당 variant의 sub-shape 기준.
   */
  calcAddressRanges(kind: string, pattern: readonly CoordConstraint[]): Array<[number, number]> {
    const range = this.rangeFor(kind);
    const shape = [...range.wi.shape];
    const localRanges = calcAddressRanges(shape, [...pattern]);
    return localRanges.map(([lo, hi]) => [lo + range.offset, hi + range.offset]);
  }

  /** kind-aware bitmap 생성 (전체 union 공간). */
  createMask(): Uint8Array {
    return new Uint8Array(Math.ceil(this.totalSize / 8));
  }

  /** 특정 kind의 WeightedIndex 인스턴스 접근 (고급 연산용). */
  getIndex(kind: string): WeightedIndex {
    return this.rangeFor(kind).wi;
  }

  // ── 내부 ────────────────────────────────────────────────────────────────

  private rangeFor(kind: string): Range {
    const r = this.ranges.get(kind);
    if (!r) throw new UnionKindError(kind, this.kinds);
    return r;
  }

  private rangeContaining(address: number): Range {
    if (!Number.isInteger(address) || address < 0 || address >= this.totalSize) {
      throw new IndexRangeError(`address ${address} out of union range [0, ${this.totalSize - 1}]`);
    }
    // binary search over orderedRanges by offset
    let lo = 0;
    let hi = this.orderedRanges.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const r = this.orderedRanges[mid];
      if (address < r.offset) {
        hi = mid - 1;
      } else if (address >= r.offset + r.size) {
        lo = mid + 1;
      } else {
        return r;
      }
    }
    // 이 코드 경로는 위의 bounds check로 커버되므로 도달 불가
    throw new IndexRangeError(`address ${address} out of union range (unreachable)`);
  }
}
