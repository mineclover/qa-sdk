// @def.boundary system-support
import type { RateStatus } from "./types.js";

/** 윈도우 세그먼트 — 100ms 단위 카운트 */
interface Segment {
  /** 세그먼트 시작 시각 (ms, 100ms 단위로 반올림) */
  readonly startMs: number;
  count: number;
}

interface Window {
  maxQps: number;
  /** 10개 세그먼트 (100ms × 10 = 1초) */
  segments: Segment[];
}

const SEGMENT_DURATION_MS = 100;
const SEGMENTS_PER_WINDOW = 10;

/**
 * Budget별 Sliding Window 속도 제한기.
 *
 * 1초 윈도우를 100ms 세그먼트 10개로 분할하여 QPS를 측정한다.
 * 고정 윈도우 대비 boundary spike 문제를 완화한다.
 */
export class RateLimiter {
  private readonly windows = new Map<string, Window>();

  /** budget별 QPS 상한 등록 */
  register(key: string, maxQps: number): void {
    if (maxQps < 1) throw new Error(`maxQps는 1 이상이어야 한다: ${maxQps}`);
    const existing = this.windows.get(key);
    if (existing) {
      existing.maxQps = maxQps;
      return;
    }
    this.windows.set(key, { maxQps, segments: [] });
  }

  /** 등록 해제 */
  unregister(key: string): void {
    this.windows.delete(key);
  }

  /**
   * 요청 허용 여부 판단. 허용 시 카운트 증가 + true 반환.
   * 미등록 budget은 항상 허용.
   */
  tryConsume(key: string, now?: number): boolean {
    const window = this.windows.get(key);
    if (!window) return true;

    const currentMs = now ?? Date.now();
    this.pruneExpired(window, currentMs);

    const currentQps = this.sumCounts(window);
    if (currentQps >= window.maxQps) return false;

    this.incrementSegment(window, currentMs);
    return true;
  }

  /** 현재 QPS 조회 (소비하지 않음) */
  getCurrentQps(key: string, now?: number): number {
    const window = this.windows.get(key);
    if (!window) return 0;

    const currentMs = now ?? Date.now();
    this.pruneExpired(window, currentMs);
    return this.sumCounts(window);
  }

  /** 현재 상태 조회 */
  getStatus(key: string, now?: number): RateStatus | undefined {
    const window = this.windows.get(key);
    if (!window) return undefined;

    const currentMs = now ?? Date.now();
    this.pruneExpired(window, currentMs);
    return { currentQps: this.sumCounts(window), maxQps: window.maxQps };
  }

  /** 전체 상태 스냅샷 */
  snapshot(now?: number): Readonly<Record<string, RateStatus>> {
    const currentMs = now ?? Date.now();
    const result: Record<string, RateStatus> = {};
    for (const [key, window] of this.windows) {
      this.pruneExpired(window, currentMs);
      result[key] = { currentQps: this.sumCounts(window), maxQps: window.maxQps };
    }
    return result;
  }

  /** 1초보다 오래된 세그먼트 제거 */
  private pruneExpired(window: Window, currentMs: number): void {
    const cutoff = currentMs - SEGMENT_DURATION_MS * SEGMENTS_PER_WINDOW;
    window.segments = window.segments.filter((s) => s.startMs >= cutoff);
  }

  /** 현재 시각의 세그먼트에 카운트 추가 */
  private incrementSegment(window: Window, currentMs: number): void {
    const segmentStart = Math.floor(currentMs / SEGMENT_DURATION_MS) * SEGMENT_DURATION_MS;
    const last = window.segments.at(-1);
    if (last && last.startMs === segmentStart) {
      last.count += 1;
    } else {
      window.segments.push({ startMs: segmentStart, count: 1 });
    }
  }

  /** 윈도우 내 전체 카운트 합산 */
  private sumCounts(window: Window): number {
    let total = 0;
    for (const s of window.segments) total += s.count;
    return total;
  }
}
