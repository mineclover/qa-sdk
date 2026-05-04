// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// __simFaultInjector factory — Plan E Stage 11 follow-up #24.
//
// 시나리오 10/11/13/14/16/17이 사용하는 fault toggle 표면.
// controller `POST /admin/fault/:kind` body { enabled: boolean, params? } 호출.
//
// 시나리오에서 사용되는 fault:
//   - schemaBreak.on()                  → kind="schema-break"
//   - auditAnomaly.on()                 → kind="audit-anomaly"
//   - dbPool.tighten(pool)              → kind="db-pool-pressure", params={pool}
//   - replicationLag.inject(ms)         → kind="replication-lag", params={lagMs}
//   - perfWarn.on()                     → kind="perf-warn"           (※ plan defect, 후속)
//   - pubsubInvalidate.drop()           → kind="pubsub-invalidate-drop" (※ plan defect, 후속)
//   - healthyMetrics.on()               → kind="healthy-metrics" (sim happy-path 진입)
//
// 모든 toggle은 `{ off: () => Promise<void> }` 핸들을 반환한다.

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export interface FaultInjectorFactoryArgs {
  /** controller fault admin base URL. */
  controllerUrl: string;
  /** 외부 호출 timeout (기본 5_000ms). */
  timeoutMs?: number;
  /** 테스트용 fetch 주입. */
  fetchImpl?: FetchLike;
}

export interface FaultHandle {
  off(): Promise<void>;
}

export interface FaultInjectorView {
  schemaBreak: { on(): Promise<FaultHandle> };
  auditAnomaly: { on(): Promise<FaultHandle> };
  dbPool: { tighten(pool: number): Promise<FaultHandle> };
  replicationLag: { inject(lagMs: number): Promise<FaultHandle> };
  perfWarn: { on(): Promise<FaultHandle> };
  pubsubInvalidate: { drop(): Promise<FaultHandle> };
  /**
   * sim 전용 happy-path 진입 — controller scrape 결과를 PASS 합성으로 wrap.
   * 시뮬 환경의 외부 metrics endpoint 미연결/오류 응답으로 인한 영구 hold 회피용.
   * 시나리오 9 (canary-happy-promote) 가 자연스러운 promote 시퀀스에 도달하는 최소
   * 의존성. 실 prod 운영에서는 사용 금지 (fault 의도 = 의도적 입력 변경).
   */
  healthyMetrics: { on(): Promise<FaultHandle> };
}

/**
 * createFaultInjector — controller `POST /admin/fault/:kind` wrapper.
 *
 * enable: body { enabled: true, params }
 * disable: body { enabled: false }
 */
export function createFaultInjector(
  args: FaultInjectorFactoryArgs,
): FaultInjectorView {
  const fetchImpl: FetchLike =
    args.fetchImpl ??
    ((input, init) =>
      fetch(input, {
        ...(init ?? {}),
        signal: AbortSignal.timeout(args.timeoutMs ?? 5_000),
      }) as unknown as ReturnType<FetchLike>);
  const base = args.controllerUrl.replace(/\/$/, "");

  async function toggle(
    kind: string,
    body: { enabled: boolean; params?: Record<string, unknown> },
  ): Promise<void> {
    const url = `${base}/admin/fault/${kind}`;
    const res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `fault-injector POST ${url} failed: status=${res.status} body=${body}`,
      );
    }
  }

  function makeHandle(kind: string): FaultHandle {
    return {
      async off() {
        await toggle(kind, { enabled: false });
      },
    };
  }

  async function on(kind: string, params?: Record<string, unknown>): Promise<FaultHandle> {
    await toggle(kind, { enabled: true, params });
    return makeHandle(kind);
  }

  return {
    schemaBreak: { on: () => on("schema-break") },
    auditAnomaly: { on: () => on("audit-anomaly") },
    dbPool: { tighten: (pool) => on("db-pool-pressure", { pool }) },
    replicationLag: { inject: (lagMs) => on("replication-lag", { lagMs }) },
    perfWarn: { on: () => on("perf-warn") },
    pubsubInvalidate: { drop: () => on("pubsub-invalidate-drop") },
    healthyMetrics: { on: () => on("healthy-metrics") },
  };
}
