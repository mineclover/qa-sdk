// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// __simBffRead factory — Plan E Stage 11 follow-up #24.
//
// 시나리오 14가 BFF read DataSource를 한 번 호출하여 primary fallback 발생을
// 검증한다(replica lag → stale 회피).
//
// 응답 헤더 `x-data-source: primary|replica`를 신뢰. BFF 측에서 이 헤더를
// 반환하도록 했다(Plan A 단계 4 read replica + Plan D BFF read 라우팅).

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  headers: { get(name: string): string | null };
}>;

export interface BffReadFactoryArgs {
  /** BFF read endpoint URL (예: audit-browser-api `/v1/audit/trace` 등). */
  bffReadUrl: string;
  /** 외부 호출 timeout (기본 5_000ms). */
  timeoutMs?: number;
  /** 테스트용 fetch 주입. */
  fetchImpl?: FetchLike;
}

export interface BffReadResult {
  source: "replica" | "primary";
}

/**
 * createBffRead — BFF read 한 번 수행 후 source 헤더 반환.
 *
 * 응답 헤더: `x-data-source: primary | replica`.
 * 헤더 누락 시 throw — fallback 금지.
 */
export function createBffRead(
  args: BffReadFactoryArgs,
): () => Promise<BffReadResult> {
  const fetchImpl: FetchLike =
    args.fetchImpl ??
    ((input, init) =>
      fetch(input, {
        ...(init ?? {}),
        signal: AbortSignal.timeout(args.timeoutMs ?? 5_000),
      }) as unknown as ReturnType<FetchLike>);

  return async function bffRead(): Promise<BffReadResult> {
    const res = await fetchImpl(args.bffReadUrl, { method: "GET" });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `bff-read GET ${args.bffReadUrl} failed: status=${res.status} body=${body}`,
      );
    }
    const source = res.headers.get("x-data-source");
    if (source !== "replica" && source !== "primary") {
      throw new Error(
        `bff-read invalid x-data-source header: ${JSON.stringify(source)}`,
      );
    }
    return { source };
  };
}
