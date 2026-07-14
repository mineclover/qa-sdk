// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// __simBitmapMetrics factory — Plan E Stage 11 follow-up #24.
//
// 시나리오 16이 bitmap cache 관련 메트릭을 조회한다:
//   - denyRate(): bitmap deny / total ratio. baseline 비교용.
//   - bitmapTtlMs(): 현재 bitmap cache TTL 설정값.
//
// auth-api Prometheus `/metrics` endpoint를 scrape해 `bitmap_cache_lookup_total`,
// `bitmap_cache_deny_total`, `bitmap_cache_ttl_ms` gauge를 추출한다.

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export interface BitmapMetricsFactoryArgs {
  /** auth-api metrics endpoint base URL (예: "http://localhost:4001"). */
  authApiUrl: string;
  /** 외부 호출 timeout (기본 5_000ms). */
  timeoutMs?: number;
  /** 테스트용 fetch 주입. */
  fetchImpl?: FetchLike;
}

export interface BitmapMetricsHandle {
  denyRate(): Promise<number>;
  bitmapTtlMs(): Promise<number>;
}

const LOOKUP_NAME = 'bitmap_cache_lookup_total';
const DENY_NAME = 'bitmap_cache_deny_total';
const TTL_NAME = 'bitmap_cache_ttl_ms';

/**
 * parsePrometheusMetric — 단순 Prometheus exposition 파서.
 *
 * 같은 metric name이 여러 label로 나오면 모두 sum.
 * `# HELP`, `# TYPE`, 빈 줄은 skip.
 */
export function parsePrometheusMetric(text: string, metricName: string): number {
  const lines = text.split('\n');
  let sum = 0;
  let found = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // 형식: name{labels} value [timestamp]
    const spaceIdx = trimmed.lastIndexOf(' ');
    if (spaceIdx < 0) continue;
    const head = trimmed.slice(0, spaceIdx);
    const valStr = trimmed.slice(spaceIdx + 1).trim();
    const nameEnd = head.indexOf('{');
    const name = nameEnd < 0 ? head : head.slice(0, nameEnd);
    if (name !== metricName) continue;
    const v = Number(valStr);
    if (!Number.isFinite(v)) continue;
    sum += v;
    found = true;
  }
  if (!found) {
    throw new Error(`metric ${metricName} not found in /metrics output`);
  }
  return sum;
}

export function createBitmapMetrics(args: BitmapMetricsFactoryArgs): BitmapMetricsHandle {
  const fetchImpl: FetchLike =
    args.fetchImpl ??
    ((input, init) =>
      fetch(input, {
        ...(init ?? {}),
        signal: AbortSignal.timeout(args.timeoutMs ?? 5_000),
      }) as unknown as ReturnType<FetchLike>);
  const base = args.authApiUrl.replace(/\/$/, '');

  async function scrape(): Promise<string> {
    const url = `${base}/metrics`;
    const res = await fetchImpl(url, { method: 'GET' });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`bitmap-metrics GET ${url} failed: status=${res.status} body=${body}`);
    }
    return res.text();
  }

  return {
    async denyRate() {
      const text = await scrape();
      const lookup = parsePrometheusMetric(text, LOOKUP_NAME);
      const deny = parsePrometheusMetric(text, DENY_NAME);
      if (lookup <= 0) return 0;
      return deny / lookup;
    },
    async bitmapTtlMs() {
      const text = await scrape();
      return parsePrometheusMetric(text, TTL_NAME);
    },
  };
}
