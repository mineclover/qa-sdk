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

export interface CatalogStateView {
  v3: string;
  v4: string;
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
 * `{v3, v4}` per-version state map 으로 transform.
 *
 * topology 응답 shape: `{ stable: {value: N}, candidate: {value: M} | null, retired: [{value}...] }`
 * 시나리오 기대 shape: `{ v3: "stable"|"candidate"|"retired"|"undeployed", v4: 동일 }`
 *
 * 매핑 규칙 (sim 가정: 버전 정수 = "v" + 정수):
 * - 어떤 vN 의 numeric value 가 topology.stable.value → state="stable"
 * - candidate.value → state="candidate"
 * - retired 배열에 포함 → state="retired"
 * - 그 외 → "undeployed"
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

  function stateFor(version: number, t: TopologyResponse): string {
    if (t.stable.value === version) return "stable";
    if (t.candidate?.value === version) return "candidate";
    if (t.retired.some((r) => r.value === version)) return "retired";
    return "undeployed";
  }

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
      return {
        v3: stateFor(3, t),
        v4: stateFor(4, t),
      };
    },
  };
}
