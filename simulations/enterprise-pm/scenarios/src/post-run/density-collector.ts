// @def.boundary sim-scenarios
// @def.doc event-taxonomy-marginal-density

/**
 * §5 §3.1 응답 schema — sim-reporting-api /density endpoint의 JSON.
 */
export interface DensityResponse {
  catalog: string;
  prefix: string;
  version: string;
  axes: Array<{
    axisName: string;
    shapeCapacity: number;
    observedDistinct: number;
    marginalDensity: number;
    unobservedEntries: string[];
  }>;
  underutilizedAxes: string[];
  saturatedAxes: string[];
}

export interface FetchDensityArgs {
  catalog: string;
  prefix: string;
  version: string;
}

/**
 * sim-reporting-api /density 호출.
 * 서버 시작 시 외부 fetch 규칙 적용 — AbortSignal.timeout(10_000).
 */
export async function fetchDensity(
  reportingApiUrl: string,
  args: FetchDensityArgs,
): Promise<DensityResponse> {
  const url = new URL("/density", reportingApiUrl);
  url.searchParams.set("catalog", args.catalog);
  url.searchParams.set("prefix", args.prefix);
  url.searchParams.set("version", args.version);
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `fetchDensity ${args.prefix}: status=${res.status} body=${body}`,
    );
  }
  const json = await res.json();
  return json as DensityResponse;
}

/**
 * 사람 읽는 multi-line 요약.
 * threshold에 걸린 축은 명시적으로 경고 줄 추가.
 */
export function summarizeDensity(d: DensityResponse): string {
  const lines: string[] = [];
  lines.push(`density: ${d.prefix} (${d.version})`);
  for (const a of d.axes) {
    const pct = (a.marginalDensity * 100).toFixed(1);
    lines.push(
      `  ${a.axisName}: ${a.observedDistinct}/${a.shapeCapacity} (${pct}%)`,
    );
    if (a.unobservedEntries.length > 0 && a.unobservedEntries.length <= 5) {
      lines.push(`    unobserved: ${a.unobservedEntries.join(", ")}`);
    }
  }
  if (d.underutilizedAxes.length > 0) {
    lines.push(`  [!] underutilized: ${d.underutilizedAxes.join(", ")}`);
  }
  if (d.saturatedAxes.length > 0) {
    lines.push(`  [!] saturated: ${d.saturatedAxes.join(", ")}`);
  }
  return lines.join("\n");
}
