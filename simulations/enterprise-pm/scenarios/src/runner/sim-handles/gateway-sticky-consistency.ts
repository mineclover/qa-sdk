// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// __simGatewayStickyConsistency factory — Plan E Stage 11 follow-up #24.
//
// 시나리오 9가 sticky-by-user 라우팅 일관성을 검증한다.
// gateway는 routing log를 admin endpoint로 노출:
//   GET /admin/routing/sticky-consistency
//     → { consistent: number, total: number }
//
// 비율 = consistent / total. total === 0이면 1.0(NaN 회피).

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export interface GatewayStickyConsistencyFactoryArgs {
  /** gateway admin base URL. */
  gatewayUrl: string;
  /** 외부 호출 timeout (기본 5_000ms). */
  timeoutMs?: number;
  /** 테스트용 fetch 주입. */
  fetchImpl?: FetchLike;
}

/**
 * createGatewayStickyConsistency — sticky 라우팅 일관성 ratio 조회.
 */
export function createGatewayStickyConsistency(
  args: GatewayStickyConsistencyFactoryArgs,
): () => Promise<number> {
  const fetchImpl: FetchLike =
    args.fetchImpl ??
    ((input, init) =>
      fetch(input, {
        ...(init ?? {}),
        signal: AbortSignal.timeout(args.timeoutMs ?? 5_000),
      }) as unknown as ReturnType<FetchLike>);
  const base = args.gatewayUrl.replace(/\/$/, "");

  return async function getStickyRatio(): Promise<number> {
    const url = `${base}/admin/routing/sticky-consistency`;
    const res = await fetchImpl(url, { method: "GET" });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `gateway-sticky-consistency GET ${url} failed: status=${res.status} body=${body}`,
      );
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error(
        `gateway-sticky-consistency JSON parse failed: ${(e as Error).message}`,
      );
    }
    const obj = json as { consistent?: unknown; total?: unknown };
    if (typeof obj.consistent !== "number" || typeof obj.total !== "number") {
      throw new Error(
        `gateway-sticky-consistency invalid shape: ${JSON.stringify(json)}`,
      );
    }
    if (obj.total === 0) return 1.0;
    return obj.consistent / obj.total;
  };
}
