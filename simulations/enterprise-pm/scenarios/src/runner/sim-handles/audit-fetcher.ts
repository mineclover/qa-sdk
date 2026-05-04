// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// __simAuditFetcher factory — Plan E Stage 11 follow-up #24 (a)/(b)/(d).
//
// 시나리오 9~17이 audit-recorder가 적재한 SafetyDecisionRecord/ResourceDecisionRecord
// 객체를 cycleId 키로 조회한다. 본 factory는 audit-recorder query API
// (`/v1/decisions?cycleIds=...&pass=...`, `/v1/alerts/count?cycleIds=...&kind=...`)를
// HTTP로 wrapping한다. e2e 환경은 사용자 sops 설정 필요.
//
// SSOT: lib/audit-fetcher.ts AuditFetcher interface + SafetyDecisionRecordView/
// ResourceDecisionRecordView 타입. controller decision-builder.service.ts와 정합.

import type {
  AnyDecision,
  AuditFetcher,
  ResourceDecisionRecordView,
  SafetyDecisionRecordView,
} from "../../lib/audit-fetcher.js";

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export interface AuditFetcherFactoryArgs {
  /** audit-recorder query API base URL (예: "http://localhost:5100"). */
  controllerUrl: string;
  /** 외부 호출 timeout (기본 5_000ms — 서버 시작 시 외부 fetch convention). */
  timeoutMs?: number;
  /** 테스트용 fetch 주입. 미지정 시 globalThis.fetch. */
  fetchImpl?: FetchLike;
}

/**
 * createAuditFetcher — AuditFetcher 인터페이스를 HTTP 호출로 구현한다.
 *
 * 응답 형태(가정):
 *   GET /v1/decisions?cycleIds=a,b,c[&pass=safety|resource]
 *     → { decisions: AnyDecision[] }
 *   GET /v1/alerts/count?cycleIds=a,b,c&kind=foo
 *     → { count: number }
 */
export function createAuditFetcher(
  args: AuditFetcherFactoryArgs,
): AuditFetcher {
  const fetchImpl: FetchLike =
    args.fetchImpl ??
    ((input, init) =>
      fetch(input, {
        ...(init ?? {}),
        signal: AbortSignal.timeout(args.timeoutMs ?? 5_000),
      }) as unknown as ReturnType<FetchLike>);
  const base = args.controllerUrl.replace(/\/$/, "");

  async function getDecisions(
    cycleIds: readonly string[],
    pass?: "safety" | "resource",
  ): Promise<AnyDecision[]> {
    if (cycleIds.length === 0) return [];
    const params = new URLSearchParams();
    params.set("cycleIds", cycleIds.join(","));
    if (pass) params.set("pass", pass);
    const url = `${base}/v1/decisions?${params.toString()}`;
    const res = await fetchImpl(url, { method: "GET" });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `audit-fetcher GET ${url} failed: status=${res.status} body=${body}`,
      );
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error(`audit-fetcher JSON parse failed: ${(e as Error).message}`);
    }
    const decisions = (json as { items?: unknown }).items;
    if (!Array.isArray(decisions)) {
      throw new Error(
        `audit-fetcher invalid response shape: ${JSON.stringify(json)}`,
      );
    }
    return decisions as AnyDecision[];
  }

  return {
    async queryDecisions(filter) {
      return getDecisions(filter.cycleIds);
    },

    async queryFirstDecision(filter) {
      const cycleIds = filter.cycleIds ?? [];
      const decisions = await getDecisions(cycleIds, filter.pass);
      const filtered = decisions.filter((d) => d.pass === filter.pass);
      if (filtered.length === 0) return null;
      // cycleAt ascending — 첫 결정.
      const sorted = [...filtered].sort((a, b) =>
        a.cycleAt.localeCompare(b.cycleAt),
      ) as (SafetyDecisionRecordView | ResourceDecisionRecordView)[];
      return sorted[0];
    },

    async countAlerts(filter) {
      if (filter.cycleIds.length === 0) return 0;
      const params = new URLSearchParams();
      params.set("cycleIds", filter.cycleIds.join(","));
      params.set("kind", filter.kind);
      const url = `${base}/v1/alerts/count?${params.toString()}`;
      const res = await fetchImpl(url, { method: "GET" });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `audit-fetcher GET ${url} failed: status=${res.status} body=${body}`,
        );
      }
      let json: unknown;
      try {
        json = await res.json();
      } catch (e) {
        throw new Error(
          `audit-fetcher JSON parse failed: ${(e as Error).message}`,
        );
      }
      const count = (json as { count?: unknown }).count;
      if (typeof count !== "number" || !Number.isFinite(count)) {
        throw new Error(
          `audit-fetcher invalid count shape: ${JSON.stringify(json)}`,
        );
      }
      return count;
    },
  };
}
