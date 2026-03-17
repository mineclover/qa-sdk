/**
 * ternary-mask.ts — 3-state 권한 마스크 (-1, 0, 1).
 *
 * 기존 binary mask (0=deny, 1=allow)의 한계:
 *   - "명시적 거부"와 "미설정"을 구분할 수 없음
 *   - 권한 상속 체인에서 override/inherit 표현 불가
 *
 * Ternary mask는 슬롯당 3가지 상태를 표현한다:
 *   DENY  (-1) : 명시적 거부 — 상속된 allow를 override
 *   UNSET ( 0) : 미설정 — 상위에서 상속받거나 기본 정책 적용
 *   ALLOW ( 1) : 명시적 허용
 *
 * 구현: 두 개의 binary mask를 조합 (allow mask + deny mask)
 *   allow=0, deny=0 → UNSET
 *   allow=1, deny=0 → ALLOW
 *   allow=0, deny=1 → DENY
 *   allow=1, deny=1 → 충돌 → deny-wins (안전 기본값)
 *
 * 크기: 슬롯당 2비트 → N 슬롯 = ceil(N/8) × 2 bytes
 *   (40 슬롯 = 5+5 = 10 bytes, binary는 5 bytes)
 *
 * 활용: org → team → user 계층 상속,
 *       기본 allow-all + 특정 deny 패턴
 */

import {
  createMask,
  setBit,
  clearBit,
  hasBit,
  popcount,
  maskAnd,
  maskOr,
} from "weighted-index";

// ── Types ────────────────────────────────────────────────────────────────────

export const DENY  = -1 as const;
export const UNSET =  0 as const;
export const ALLOW =  1 as const;

export type TriState = typeof DENY | typeof UNSET | typeof ALLOW;

/** Resolve 전략: 상속 체인에서 UNSET일 때 어떻게 처리할지. */
export type DefaultPolicy = "deny" | "allow";

// ── TernaryMask ──────────────────────────────────────────────────────────────

export class TernaryMask {
  /** 명시적 허용 비트. */
  readonly allowMask: Uint8Array;
  /** 명시적 거부 비트. */
  readonly denyMask: Uint8Array;
  readonly size: number;

  constructor(size: number, allow?: Uint8Array, deny?: Uint8Array) {
    this.size = size;
    const byteLen = Math.ceil(size / 8);
    this.allowMask = allow ?? createMask(size);
    this.denyMask = deny ?? createMask(size);

    if (this.allowMask.length !== byteLen || this.denyMask.length !== byteLen) {
      throw new RangeError(`Mask length mismatch: expected ${byteLen}`);
    }
  }

  // ── 단일 조작 ──────────────────────────────────────────────────────────

  /** 명시적 허용 설정. */
  allow(id: number): void {
    setBit(this.allowMask, id);
    clearBit(this.denyMask, id);
  }

  /** 명시적 거부 설정. */
  deny(id: number): void {
    clearBit(this.allowMask, id);
    setBit(this.denyMask, id);
  }

  /** 미설정 (상속 대기) 상태로 복원. */
  unset(id: number): void {
    clearBit(this.allowMask, id);
    clearBit(this.denyMask, id);
  }

  /** 현재 상태 조회. */
  get(id: number): TriState {
    const a = hasBit(this.allowMask, id);
    const d = hasBit(this.denyMask, id);
    if (d) return DENY;   // deny-wins
    if (a) return ALLOW;
    return UNSET;
  }

  // ── Resolve (최종 권한 판정) ────────────────────────────────────────────

  /**
   * 최종 권한 판정.
   * ALLOW → true, DENY → false, UNSET → defaultPolicy에 따름.
   */
  check(id: number, defaultPolicy: DefaultPolicy = "deny"): boolean {
    const state = this.get(id);
    if (state === ALLOW) return true;
    if (state === DENY) return false;
    return defaultPolicy === "allow";
  }

  // ── 상속 체인 merge ────────────────────────────────────────────────────

  /**
   * 상속 체인 merge: child가 parent를 상속.
   *
   * 규칙:
   *   child=ALLOW → ALLOW (child 우선)
   *   child=DENY  → DENY  (child 우선)
   *   child=UNSET → parent의 값 상속
   *
   * deny-wins: child/parent 중 하나라도 DENY면 DENY.
   * 이건 denyWins 옵션으로 제어.
   */
  static inherit(
    parent: TernaryMask,
    child: TernaryMask,
    opts: { denyWins?: boolean } = {},
  ): TernaryMask {
    if (parent.size !== child.size) {
      throw new RangeError(`Size mismatch: ${parent.size} vs ${child.size}`);
    }

    const result = new TernaryMask(parent.size);
    const denyWins = opts.denyWins ?? true;

    for (let i = 0; i < parent.size; i++) {
      const cs = child.get(i);
      if (cs !== UNSET) {
        // child가 명시적 → child 우선
        if (cs === ALLOW) result.allow(i);
        else result.deny(i);
      } else {
        // child=UNSET → parent 상속
        const ps = parent.get(i);
        if (ps === ALLOW) result.allow(i);
        else if (ps === DENY) result.deny(i);
        // UNSET → UNSET 유지
      }

      // deny-wins: parent나 child 중 하나라도 deny면 deny
      if (denyWins && (parent.get(i) === DENY || child.get(i) === DENY)) {
        result.deny(i);
      }
    }

    return result;
  }

  // ── 통계 ───────────────────────────────────────────────────────────────

  get allowCount(): number { return popcount(this.allowMask); }
  get denyCount(): number { return popcount(this.denyMask); }
  get unsetCount(): number { return this.size - this.allowCount - this.denyCount; }

  // ── 변환 ───────────────────────────────────────────────────────────────

  /**
   * binary mask로 flatten. UNSET은 defaultPolicy에 따라 결정.
   * 클라이언트 전송 시 ternary → binary 변환용.
   */
  toBinaryMask(defaultPolicy: DefaultPolicy = "deny"): Uint8Array {
    const mask = createMask(this.size);
    for (let i = 0; i < this.size; i++) {
      if (this.check(i, defaultPolicy)) {
        setBit(mask, i);
      }
    }
    return mask;
  }

  clone(): TernaryMask {
    return new TernaryMask(
      this.size,
      new Uint8Array(this.allowMask),
      new Uint8Array(this.denyMask),
    );
  }
}
