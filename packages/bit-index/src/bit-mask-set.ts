// @def.boundary persistence-system-root
// @def.doc persistence-system-root

/**
 * bit-mask-set.ts — BitIndex 기반 권한/상태 관리 Set
 *
 * PermissionSet(WeightedIndex + Uint8Array 비트마스크)의 BitIndex 버전.
 * Set<number> 기반이므로 주소 공간의 "구멍"에 메모리를 낭비하지 않는다.
 *
 * ── PermissionSet과의 차이 ────────────────────────────────────────────────
 *
 *   PermissionSet (WI + Uint8Array)          BitMaskSet (BI + Set<number>)
 *   ─────────────────────────────            ──────────────────────────────
 *   Uint8Array — 전체 공간 할당             Set — granted만 저장
 *   hasBit O(1)                             Set.has O(1)
 *   차원 필터 → calcAddressRanges 필요      차원 필터 → extractDim O(1)
 *   DB BETWEEN 질의 적합                    인메모리 필터/캐시 적합
 *   maskAnd/maskOr 비트 연산               Set intersection/union
 *
 * ── 사용 시나리오 ─────────────────────────────────────────────────────────
 *
 *   const perms = new BitMaskSet(idx);
 *   perms.grant([2, 5, 12]);
 *   perms.check([2, 5, 12]);             // true
 *   perms.filterByDim(0, 2);             // role=2인 모든 granted
 *   perms.filterByLabel("action", 5);    // action=5인 모든 granted
 *   perms.toBase64();                     // JWT/DB 저장용
 */

import { BitIndex } from "./bit-index.js";

// ═══════════════════════════════════════════════════════════════════════════
//  Base64 직렬화 (환경 독립 — btoa/atob 불필요)
// ═══════════════════════════════════════════════════════════════════════════

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Uint8Array → Base64 문자열. */
export function uint8ToBase64(arr: Uint8Array): string {
  let out = "";
  for (let i = 0; i < arr.length; i += 3) {
    const b0 = arr[i], b1 = arr[i + 1] ?? 0, b2 = arr[i + 2] ?? 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < arr.length ? B64[((b1 & 0xF) << 2) | (b2 >> 6)] : "=";
    out += i + 2 < arr.length ? B64[b2 & 0x3F] : "=";
  }
  return out;
}

/** Base64 문자열 → Uint8Array. */
export function base64ToUint8(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/, "");
  const bytes = new Uint8Array(Math.floor(clean.length * 3 / 4));
  let j = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = B64.indexOf(clean[i + 2]);
    const d = B64.indexOf(clean[i + 3]);
    bytes[j++] = (a << 2) | (b >> 4);
    if (c >= 0) bytes[j++] = ((b & 0xF) << 4) | (c >> 2);
    if (d >= 0) bytes[j++] = ((c & 3) << 6) | d;
  }
  return bytes.slice(0, j);
}

// ═══════════════════════════════════════════════════════════════════════════
//  BitMaskSet
// ═══════════════════════════════════════════════════════════════════════════

export class BitMaskSet {
  readonly index: BitIndex;
  private readonly _set: Set<number>;

  constructor(index: BitIndex, initial?: Iterable<number>) {
    this.index = index;
    this._set = new Set(initial);
  }

  // ── 기본 정보 ──────────────────────────────────────────────────────────

  /** 현재 부여된 수. */
  get size(): number { return this._set.size; }

  /** 내부 Set (읽기 전용 순회용). */
  get entries(): ReadonlySet<number> { return this._set; }

  // ── 단일 조작 ──────────────────────────────────────────────────────────

  /** 좌표 기반 부여. */
  grant(coords: number[]): void {
    this._set.add(this.index.encode(coords));
  }

  /** 좌표 기반 회수. */
  revoke(coords: number[]): void {
    this._set.delete(this.index.encode(coords));
  }

  /** 좌표 기반 확인. O(1). */
  check(coords: number[]): boolean {
    return this._set.has(this.index.encode(coords));
  }

  /** packed 값 기반 부여. */
  grantPacked(packed: number): void {
    this._set.add(packed);
  }

  /** packed 값 기반 회수. */
  revokePacked(packed: number): void {
    this._set.delete(packed);
  }

  /** packed 값 기반 확인. O(1). */
  checkPacked(packed: number): boolean {
    return this._set.has(packed);
  }

  /** 전체 초기화. */
  clear(): void {
    this._set.clear();
  }

  // ── 차원 필터 (BitIndex 전용 기능) ──────────────────────────────────

  /** dimIndex 차원이 value인 모든 granted packed 값. */
  filterByDim(dimIndex: number, value: number): number[] {
    const result: number[] = [];
    for (const packed of this._set) {
      if (this.index.extractDim(packed, dimIndex) === value) {
        result.push(packed);
      }
    }
    return result;
  }

  /** 라벨 기반 차원 필터. */
  filterByLabel(label: string, value: number): number[] {
    const result: number[] = [];
    for (const packed of this._set) {
      if (this.index.extractDimByLabel(packed, label) === value) {
        result.push(packed);
      }
    }
    return result;
  }

  /** 복수 차원 조건 필터. { label: value } 모두 일치하는 granted만. */
  filterByLabels(conditions: Record<string, number>): number[] {
    const entries = Object.entries(conditions);
    const result: number[] = [];
    for (const packed of this._set) {
      let match = true;
      for (const [label, value] of entries) {
        if (this.index.extractDimByLabel(packed, label) !== value) {
          match = false;
          break;
        }
      }
      if (match) result.push(packed);
    }
    return result;
  }

  /** dimIndex 차원의 고유 값 목록 (granted 범위 내). */
  distinctDim(dimIndex: number): number[] {
    const seen = new Set<number>();
    for (const packed of this._set) {
      seen.add(this.index.extractDim(packed, dimIndex));
    }
    return [...seen].toSorted((a, b) => a - b);
  }

  /** 라벨 기반 고유 값 목록. */
  distinctByLabel(label: string): number[] {
    const seen = new Set<number>();
    for (const packed of this._set) {
      seen.add(this.index.extractDimByLabel(packed, label));
    }
    return [...seen].toSorted((a, b) => a - b);
  }

  // ── Set 대수 ──────────────────────────────────────────────────────────

  /** 교집합: 두 Set 모두에 있는 것. */
  intersect(other: BitMaskSet): BitMaskSet {
    const result = new BitMaskSet(this.index);
    for (const packed of this._set) {
      if (other._set.has(packed)) result._set.add(packed);
    }
    return result;
  }

  /** 합집합: 둘 중 하나라도 있는 것. */
  union(other: BitMaskSet): BitMaskSet {
    const result = new BitMaskSet(this.index, this._set);
    for (const packed of other._set) {
      result._set.add(packed);
    }
    return result;
  }

  /** 차집합: this에는 있지만 other에는 없는 것. */
  subtract(other: BitMaskSet): BitMaskSet {
    const result = new BitMaskSet(this.index);
    for (const packed of this._set) {
      if (!other._set.has(packed)) result._set.add(packed);
    }
    return result;
  }

  // ── 직렬화 ──────────────────────────────────────────────────────────

  /** packed 값 배열로 직렬화. */
  toArray(): number[] {
    return [...this._set].toSorted((a, b) => a - b);
  }

  /** packed 값 배열에서 복원. */
  static fromArray(index: BitIndex, arr: number[]): BitMaskSet {
    return new BitMaskSet(index, arr);
  }

  /** Uint8Array 직렬화 (정렬된 packed → varint-like 연속 저장). */
  toBytes(): Uint8Array {
    const sorted = this.toArray();
    // 단순 방식: 4 bytes per packed (uint32)
    const buf = new Uint8Array(sorted.length * 4);
    for (let i = 0; i < sorted.length; i++) {
      const v = sorted[i];
      buf[i * 4]     = (v >>> 24) & 0xFF;
      buf[i * 4 + 1] = (v >>> 16) & 0xFF;
      buf[i * 4 + 2] = (v >>> 8) & 0xFF;
      buf[i * 4 + 3] = v & 0xFF;
    }
    return buf;
  }

  /** Uint8Array에서 복원. */
  static fromBytes(index: BitIndex, bytes: Uint8Array): BitMaskSet {
    const count = bytes.length / 4;
    const packed: number[] = [];
    for (let i = 0; i < count; i++) {
      packed.push(
        (bytes[i * 4] << 24) |
        (bytes[i * 4 + 1] << 16) |
        (bytes[i * 4 + 2] << 8) |
        bytes[i * 4 + 3]
      );
    }
    return new BitMaskSet(index, packed);
  }

  /** Base64 문자열로 직렬화. */
  toBase64(): string {
    return uint8ToBase64(this.toBytes());
  }

  /** Base64에서 복원. */
  static fromBase64(index: BitIndex, b64: string): BitMaskSet {
    return BitMaskSet.fromBytes(index, base64ToUint8(b64));
  }

  /** 복제. */
  clone(): BitMaskSet {
    return new BitMaskSet(this.index, this._set);
  }
}
