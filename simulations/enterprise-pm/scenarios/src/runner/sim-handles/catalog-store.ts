// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// __simCatalogStore factory — Plan E Stage 11 follow-up #24.
//
// 시나리오 9, 10은 sim-service-catalog의 v3/v4 상태(stable/retired/undeployed/
// candidate)를 조회한다. controller가 catalog 전이를 audit-recorder에 기록하므로
// 본 factory는 controller 측 catalog read endpoint(`/v1/catalog/states`)를
// HTTP wrapping한다.

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export interface CatalogStoreFactoryArgs {
  /** controller catalog endpoint base URL (예: "http://localhost:7070"). */
  controllerUrl: string;
  /** 외부 호출 timeout (기본 5_000ms). */
  timeoutMs?: number;
  /** 테스트용 fetch 주입. */
  fetchImpl?: FetchLike;
}

export interface CatalogStateView {
  v3: string;
  v4: string;
}

export interface CatalogStoreHandle {
  getStates(): Promise<CatalogStateView>;
}

/**
 * createCatalogStore — sim-service-catalog state read wrapper.
 *
 * 응답 가정: GET /v1/catalog/states → { v3: string, v4: string }.
 */
export function createCatalogStore(
  args: CatalogStoreFactoryArgs,
): CatalogStoreHandle {
  const fetchImpl: FetchLike =
    args.fetchImpl ??
    ((input, init) =>
      fetch(input, {
        ...(init ?? {}),
        signal: AbortSignal.timeout(args.timeoutMs ?? 5_000),
      }) as unknown as ReturnType<FetchLike>);
  const base = args.controllerUrl.replace(/\/$/, "");

  return {
    async getStates() {
      const url = `${base}/v1/catalog/states`;
      const res = await fetchImpl(url, { method: "GET" });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `catalog-store GET ${url} failed: status=${res.status} body=${body}`,
        );
      }
      let json: unknown;
      try {
        json = await res.json();
      } catch (e) {
        throw new Error(
          `catalog-store JSON parse failed: ${(e as Error).message}`,
        );
      }
      const obj = json as { v3?: unknown; v4?: unknown };
      if (typeof obj.v3 !== "string" || typeof obj.v4 !== "string") {
        throw new Error(
          `catalog-store invalid shape: ${JSON.stringify(json)}`,
        );
      }
      return { v3: obj.v3, v4: obj.v4 };
    },
  };
}
