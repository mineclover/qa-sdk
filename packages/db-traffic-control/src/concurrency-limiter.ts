// @def.boundary db-traffic-control-spec
// @def.doc db-traffic-control-spec
import type { ConcurrencyStatus } from "./types.js";

interface Slot {
  current: number;
  max: number;
  /** 슬롯 대기 큐 (resolve 호출로 획득 완료) */
  waiters: Array<{ resolve: () => void; timer?: ReturnType<typeof setTimeout> }>;
}

/**
 * Budget별 세마포어 기반 동시성 제한기.
 *
 * - register()로 budget별 최대 동시성 설정
 * - tryAcquire()로 즉시 획득 시도 (대기 없음)
 * - acquire()로 대기 후 획득 (timeout 지원)
 *
 * 전역 동시성 제한도 지원: "__global__" 키 사용.
 */
export class ConcurrencyLimiter {
  private readonly slots = new Map<string, Slot>();

  /** budget별 동시성 상한 등록 */
  register(key: string, maxConcurrency: number): void {
    if (maxConcurrency < 1) throw new Error(`maxConcurrency는 1 이상이어야 한다: ${maxConcurrency}`);
    const existing = this.slots.get(key);
    if (existing) {
      existing.max = maxConcurrency;
      return;
    }
    this.slots.set(key, { current: 0, max: maxConcurrency, waiters: [] });
  }

  /** 등록 해제 — 대기 중인 waiter 모두 reject되지 않고 무시됨 */
  unregister(key: string): void {
    const slot = this.slots.get(key);
    if (!slot) return;
    // 대기 중인 waiter 타이머 정리
    for (const w of slot.waiters) {
      if (w.timer !== undefined) clearTimeout(w.timer);
    }
    this.slots.delete(key);
  }

  /**
   * 슬롯 즉시 획득 시도. 성공 시 release 함수 반환, 실패 시 null.
   */
  tryAcquire(key: string): (() => void) | null {
    const slot = this.slots.get(key);
    if (!slot) return () => {}; // 미등록 budget은 무제한
    if (slot.current >= slot.max) return null;

    slot.current += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.release(key);
    };
  }

  /**
   * 대기 후 슬롯 획득. timeoutMs 초과 시 reject.
   * timeoutMs 미지정 시 무한 대기.
   */
  async acquire(key: string, timeoutMs?: number): Promise<() => void> {
    const immediate = this.tryAcquire(key);
    if (immediate) return immediate;

    const slot = this.slots.get(key);
    if (!slot) return () => {}; // 미등록은 무제한

    return new Promise<() => void>((resolve, reject) => {
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        this.release(key);
      };

      const waiter: Slot["waiters"][number] = {
        resolve: () => resolve(release),
      };

      if (timeoutMs !== undefined && timeoutMs > 0) {
        waiter.timer = setTimeout(() => {
          const idx = slot.waiters.indexOf(waiter);
          if (idx !== -1) slot.waiters.splice(idx, 1);
          reject(new Error(`동시성 슬롯 획득 timeout (${timeoutMs}ms): ${key}`));
        }, timeoutMs);
      }

      slot.waiters.push(waiter);
    });
  }

  /** 현재 동시성 상태 조회 */
  getStatus(key: string): ConcurrencyStatus | undefined {
    const slot = this.slots.get(key);
    if (!slot) return undefined;
    return { current: slot.current, max: slot.max };
  }

  /** 전체 상태 스냅샷 */
  snapshot(): Readonly<Record<string, ConcurrencyStatus>> {
    const result: Record<string, ConcurrencyStatus> = {};
    for (const [key, slot] of this.slots) {
      result[key] = { current: slot.current, max: slot.max };
    }
    return result;
  }

  private release(key: string): void {
    const slot = this.slots.get(key);
    if (!slot) return;

    slot.current = Math.max(0, slot.current - 1);

    // 대기 중인 waiter가 있으면 슬롯 즉시 양도
    if (slot.waiters.length > 0 && slot.current < slot.max) {
      const next = slot.waiters.shift()!;
      if (next.timer !== undefined) globalThis.clearTimeout(next.timer as number);
      slot.current += 1;
      next.resolve();
    }
  }
}

/** 전역 동시성 제한기의 예약 키 */
export const GLOBAL_CONCURRENCY_KEY = "__global__";
