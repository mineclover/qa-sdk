// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// __simWaitForCycles factory — Plan E Stage 11 follow-up #24 (c)/(d).
//
// 시나리오는 controller가 N개 cycle을 audit-recorder에 적재할 때까지 대기 후
// cycleId 배열을 반환받는다. controller 측 cycle.write 이벤트 emit은 별도
// 후속 작업이며(roadmap §4 #24 (c)), 본 factory는 audit-recorder query API
// (`/v1/cycles/recent?since=...&limit=...`) polling으로 fallback한다.
//
// polling 주기: 기본 500ms. timeout 도달 시 throw.

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export interface WaitForCyclesFactoryArgs {
  /** audit-recorder query API base URL. */
  controllerUrl: string;
  /** polling interval (기본 500ms). */
  pollIntervalMs?: number;
  /** 외부 호출 timeout (기본 5_000ms). */
  requestTimeoutMs?: number;
  /** 테스트용 fetch 주입. */
  fetchImpl?: FetchLike;
  /** 테스트용 sleep 주입 (기본 globalThis.setTimeout 기반). */
  sleepImpl?: (ms: number) => Promise<void>;
  /** 테스트용 시계 주입 (기본 Date.now). */
  nowImpl?: () => number;
}

/**
 * createWaitForCycles — N 사이클 대기 wrapper.
 *
 * 동작:
 *   1. 호출 시점의 timestamp 기록(since).
 *   2. polling 주기마다 GET /v1/cycles/recent?since=ISO8601&limit=N 호출.
 *   3. 응답 cycleIds.length >= n이면 return.
 *   4. timeout 도달 시 throw.
 *
 * 응답 가정: { cycleIds: string[] } — cycleAt ascending.
 */
export function createWaitForCycles(
  args: WaitForCyclesFactoryArgs,
): (n: number, timeoutMs: number) => Promise<string[]> {
  const fetchImpl: FetchLike =
    args.fetchImpl ??
    ((input, init) =>
      fetch(input, {
        ...(init ?? {}),
        signal: AbortSignal.timeout(args.requestTimeoutMs ?? 5_000),
      }) as unknown as ReturnType<FetchLike>);
  const sleep =
    args.sleepImpl ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = args.nowImpl ?? (() => Date.now());
  const interval = args.pollIntervalMs ?? 500;
  const base = args.controllerUrl.replace(/\/$/, "");

  return async function waitForCycles(
    n: number,
    timeoutMs: number,
  ): Promise<string[]> {
    if (!Number.isInteger(n) || n <= 0) {
      throw new Error(`waitForCycles: n must be positive integer, got ${n}`);
    }
    const since = new Date(now()).toISOString();
    const deadline = now() + timeoutMs;
    let attempts = 0;

    while (now() < deadline) {
      attempts += 1;
      const params = new URLSearchParams();
      params.set("since", since);
      params.set("limit", String(n * 2));
      const url = `${base}/v1/cycles/recent?${params.toString()}`;
      const res = await fetchImpl(url, { method: "GET" });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `waitForCycles GET ${url} failed: status=${res.status} body=${body}`,
        );
      }
      let json: unknown;
      try {
        json = await res.json();
      } catch (e) {
        throw new Error(
          `waitForCycles JSON parse failed: ${(e as Error).message}`,
        );
      }
      const cycleIds = (json as { cycleIds?: unknown }).cycleIds;
      if (!Array.isArray(cycleIds)) {
        throw new Error(
          `waitForCycles invalid response shape: ${JSON.stringify(json)}`,
        );
      }
      if (cycleIds.length >= n) {
        return (cycleIds as string[]).slice(0, n);
      }
      if (now() + interval >= deadline) break;
      await sleep(interval);
    }
    throw new Error(
      `waitForCycles timeout: n=${n} timeoutMs=${timeoutMs} attempts=${attempts}`,
    );
  };
}
