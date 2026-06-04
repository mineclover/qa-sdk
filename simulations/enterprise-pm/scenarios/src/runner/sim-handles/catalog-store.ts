// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios

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
  controllerUrl: string;
  /** controller catalog 조회 시 prefix (예: "sim.svc.approval"). spec §6 endpoint 가 prefix 필수. */
  prefix?: string;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
}

export interface CatalogStateView extends Record<string, string> {
  // v3, v4 등 특정 버전 키를 가질 수 있음.
}

export interface CatalogStoreHandle {
  getStates(): Promise<CatalogStateView>;
}

interface TopologyResponse {
  stable: { value: number };
  candidate: { value: number } | null;
  retired: { value: number }[];
}

/**
 * createCatalogStore — controller `/v1/catalog/states` topology 응답을 시나리오용
 * per-version state map 으로 transform.
 *
 * topology 응답 shape: `{ stable: {value: N}, candidate: {value: M} | null, retired: [{value}...] }`
 * 시나리오 기대 shape: `{ v1: "retired", v3: "stable", ... }`
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
  const prefix = args.prefix ?? "sim.svc.approval";

  return {
    async getStates() {
      const url = `${base}/v1/catalog/states?prefix=${encodeURIComponent(prefix)}`;
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
      const t = json as TopologyResponse;
      if (
        typeof t?.stable?.value !== "number" ||
        !Array.isArray(t.retired)
      ) {
        throw new Error(
          `catalog-store invalid topology shape: ${JSON.stringify(json)}`,
        );
      }

      const states: CatalogStateView = {
        v3: "undeployed",
        v4: "undeployed",
      };
      
      // 1. Stable
      states[`v${t.stable.value}`] = "stable";
      
      // 2. Candidate
      if (t.candidate) {
        states[`v${t.candidate.value}`] = "candidate";
      }
      
      // 3. Retired
      for (const r of t.retired) {
        states[`v${r.value}`] = "retired";
      }

      return states;
    },
  };
}
