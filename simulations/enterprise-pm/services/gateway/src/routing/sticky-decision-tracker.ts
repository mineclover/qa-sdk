// @def.boundary sim-gateway / @def.doc gateway-sticky-consistency
// spec 2026-05-02 §9 Stage 2 — sticky decision ring buffer (메모리 only).
//
// gateway routing decision을 user_id × version × at 튜플로 기록하는 메모리 ring
// buffer. 외부 의존(KV/DB) 없음 — restart 시 손실은 spec §9 의도된 동작이다.

/** 단일 routing decision record — user_id × version × 시각. */
export interface StickyDecision {
  userId: string;
  version: string;
  at: Date;
}

/** 시간 윈도우 — 양쪽 모두 inclusive. 미지정 시 전체 buffer 대상. */
export interface Window {
  from?: Date;
  to?: Date;
}

/** getRatio 결과 shape — spec §9 endpoint 응답 shape의 1:1 매핑. */
export interface RatioResult {
  /** 0~1, 1 = 모든 user가 단일 version으로만 라우팅됨. */
  ratio: number;
  /** 측정 사용한 decision 수 (윈도우 적용 후). */
  sample: number;
  /** 두 개 이상 version을 본 user 수. */
  inconsistentUsers: number;
  /** 측정 시간 윈도우 (ISO 8601). */
  window: { from: string; to: string };
}

/**
 * StickyDecisionTracker — gateway routing decision 메모리 ring buffer.
 *
 * spec §9 Stage 2 응답 shape에 직접 매핑되는 ratio/sample/inconsistentUsers를
 * 산출한다. window?: Window 옵션으로 분석 시점의 부분집합을 추출 가능.
 */
export class StickyDecisionTracker {
  private readonly buffer: StickyDecision[] = [];
  private readonly maxSize: number;

  constructor(opts: { maxSize: number }) {
    if (!Number.isInteger(opts.maxSize) || opts.maxSize <= 0) {
      throw new Error(
        `StickyDecisionTracker: maxSize must be positive integer, got ${opts.maxSize}`,
      );
    }
    this.maxSize = opts.maxSize;
  }

  /** decision 기록. userId/version 빈 문자열은 silent skip (anonymous defense). */
  record(userId: string, version: string, at: Date): void {
    if (!userId || !version) return;
    this.buffer.push({ userId, version, at });
    if (this.buffer.length > this.maxSize) this.buffer.shift();
  }

  private filter(w?: Window): StickyDecision[] {
    if (!w || (!w.from && !w.to)) return [...this.buffer];
    return this.buffer.filter((d) => (!w.from || d.at >= w.from) && (!w.to || d.at <= w.to));
  }

  private groupBy(sample: StickyDecision[]): Map<string, Set<string>> {
    const seen = new Map<string, Set<string>>();
    for (const d of sample) {
      let s = seen.get(d.userId);
      if (!s) {
        s = new Set();
        seen.set(d.userId, s);
      }
      s.add(d.version);
    }
    return seen;
  }

  /** 분석용 read-only copy. 내부 buffer는 캡슐화. */
  dump(w?: Window): StickyDecision[] {
    return this.filter(w).map((d) => ({ ...d }));
  }

  /** 두 개 이상 version을 본 user_id 정렬 list. */
  getInconsistentUsers(w?: Window): string[] {
    return [...this.groupBy(this.filter(w))]
      .filter(([, v]) => v.size > 1)
      .map(([k]) => k)
      .sort();
  }

  /** spec §9 endpoint 응답 shape를 그대로 산출. */
  getRatio(w?: Window): RatioResult {
    const sample = this.filter(w);
    const seen = this.groupBy(sample);
    const total = seen.size;
    const inconsistent = [...seen.values()].filter((v) => v.size > 1).length;
    const ratio = total === 0 ? 1 : 1 - inconsistent / total;
    const from = w?.from?.toISOString() ?? sample[0]?.at.toISOString() ?? new Date(0).toISOString();
    const to =
      w?.to?.toISOString() ??
      sample[sample.length - 1]?.at.toISOString() ??
      new Date(0).toISOString();
    return {
      ratio,
      sample: sample.length,
      inconsistentUsers: inconsistent,
      window: { from, to },
    };
  }
}
