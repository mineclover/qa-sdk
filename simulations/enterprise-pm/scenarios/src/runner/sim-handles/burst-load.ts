// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// __simBurstLoad factory — Plan E Stage 11 follow-up #24.
//
// 시나리오 12/13/17이 RPS burst를 발생시킨다(Pass 2 loadPressure FAIL 트리거).
//
// 본 factory는 fixed-rate 워커를 spawn해 controller 또는 gateway에 GET 요청을
// 일정 RPS로 보낸다. stop()은 워커 interval clear + in-flight 요청 abort.
//
// SIM_LOAD_RPS_THRESHOLD(=100) 초과로 RPS 200 burst가 일반 패턴 (시나리오 12).

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  },
) => Promise<{ ok: boolean; status: number }>;

export interface BurstLoadFactoryArgs {
  /** burst 대상 URL (예: gateway "/healthz" 또는 read endpoint). */
  targetUrl: string;
  /** 테스트용 fetch 주입. */
  fetchImpl?: FetchLike;
  /** 테스트용 setInterval 주입. */
  setIntervalImpl?: (cb: () => void, ms: number) => unknown;
  /** 테스트용 clearInterval 주입. */
  clearIntervalImpl?: (handle: unknown) => void;
}

export interface BurstHandle {
  stop(): Promise<void>;
}

/**
 * createBurstLoad — RPS burst generator factory.
 *
 * 호출 시그니처: `burst(rps: number) => Promise<{ stop }>`.
 *
 * 동작:
 *   - rps tick 마다 1 요청을 fire-and-forget로 발사.
 *   - rps > 1000 시 setInterval interval을 1ms로 clamp + 매 tick에 batch 발사.
 *   - stop() 시 interval clear + AbortController abort + 남은 in-flight settle 대기.
 */
export function createBurstLoad(args: BurstLoadFactoryArgs): (
  rps: number,
) => Promise<BurstHandle> {
  const fetchImpl: FetchLike =
    args.fetchImpl ??
    ((input, init) =>
      fetch(input, init) as unknown as ReturnType<FetchLike>);
  const setIntervalI =
    args.setIntervalImpl ??
    ((cb, ms) =>
      setInterval(cb, ms) as unknown as ReturnType<typeof setInterval>);
  const clearIntervalI =
    args.clearIntervalImpl ??
    ((h) => clearInterval(h as ReturnType<typeof setInterval>));

  return async function burstLoad(rps: number): Promise<BurstHandle> {
    if (!Number.isFinite(rps) || rps <= 0) {
      throw new Error(`burstLoad: rps must be positive number, got ${rps}`);
    }
    const intervalMs = Math.max(1, Math.floor(1000 / rps));
    const batchPerTick = Math.max(1, Math.ceil(rps / (1000 / intervalMs)));
    const abort = new AbortController();
    const inflight = new Set<Promise<void>>();

    const handle = setIntervalI(() => {
      for (let i = 0; i < batchPerTick; i += 1) {
        if (abort.signal.aborted) break;
        const p = (async () => {
          try {
            await fetchImpl(args.targetUrl, {
              method: "GET",
              signal: abort.signal,
            });
          } catch {
            // 부하 발생 자체가 목적 — 응답 status는 무시.
          }
        })();
        inflight.add(p);
        p.finally(() => inflight.delete(p));
      }
    }, intervalMs);

    return {
      async stop() {
        clearIntervalI(handle);
        abort.abort();
        // in-flight 요청 settle 대기.
        await Promise.allSettled(Array.from(inflight));
      },
    };
  };
}
