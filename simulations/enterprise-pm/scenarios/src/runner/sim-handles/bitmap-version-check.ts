// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// __simBitmapVersionCheck factory — Plan E Stage 11 follow-up #24.
//
// 시나리오 16이 bitmap cache가 expectedVersion으로 회복될 때까지 polling 후
// 회복 시간 + 회복 경로(version-check / TTL)를 반환한다.
//
// auth-api admin endpoint (spec 2026-05-02-server-side-admin-endpoints §9 SSOT):
//   GET /admin/bitmap/version?prefix=... → { prefix: string, version: VersionTag }
// 서버는 recoveredVia 필드를 보내지 않으므로 핸들은 always "version-check"로 합성.
// (TTL 회복 분기는 client-side에서 추가 신호로 판정 — 본 단계에서는 미지원.)

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export interface BitmapVersionCheckFactoryArgs {
  /** auth-api admin base URL. */
  authApiUrl: string;
  /** polling 주기 (기본 200ms). */
  pollIntervalMs?: number;
  /** 외부 호출 timeout (기본 5_000ms). */
  requestTimeoutMs?: number;
  /** 테스트용 fetch 주입. */
  fetchImpl?: FetchLike;
  /** 테스트용 sleep 주입. */
  sleepImpl?: (ms: number) => Promise<void>;
  /** 테스트용 시계 주입. */
  nowImpl?: () => number;
}

export interface BitmapVersionCheckResult {
  recoveredAtMs: number;
  recoveredVia: 'version-check' | 'ttl';
}

/**
 * createBitmapVersionCheck — expectedVersion 회복 polling.
 *
 * timeout 이전에 current === expected이면 recoveredAtMs + recoveredVia 반환.
 * recoveredVia가 "stale"이면 polling 계속.
 */
export function createBitmapVersionCheck(
  args: BitmapVersionCheckFactoryArgs,
): (expected: string, timeoutMs: number) => Promise<BitmapVersionCheckResult> {
  const fetchImpl: FetchLike =
    args.fetchImpl ??
    ((input, init) =>
      fetch(input, {
        ...(init ?? {}),
        signal: AbortSignal.timeout(args.requestTimeoutMs ?? 5_000),
      }) as unknown as ReturnType<FetchLike>);
  const sleep =
    args.sleepImpl ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = args.nowImpl ?? (() => Date.now());
  const pollMs = args.pollIntervalMs ?? 200;
  const base = args.authApiUrl.replace(/\/$/, '');

  return async function checkRecovery(
    expected: string,
    timeoutMs: number,
  ): Promise<BitmapVersionCheckResult> {
    const deadline = now() + timeoutMs;
    while (now() < deadline) {
      const url = `${base}/admin/bitmap/version`;
      const res = await fetchImpl(url, { method: 'GET' });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(
          `bitmap-version-check GET ${url} failed: status=${res.status} body=${body}`,
        );
      }
      let json: unknown;
      try {
        json = await res.json();
      } catch (e) {
        throw new Error(`bitmap-version-check JSON parse failed: ${(e as Error).message}`);
      }
      const obj = json as { version?: unknown; recoveredVia?: unknown };
      if (typeof obj.version !== 'string') {
        throw new Error(`bitmap-version-check invalid shape: ${JSON.stringify(json)}`);
      }
      if (obj.version === expected) {
        const via =
          obj.recoveredVia === 'version-check' || obj.recoveredVia === 'ttl'
            ? obj.recoveredVia
            : 'version-check';
        return { recoveredAtMs: now(), recoveredVia: via };
      }
      if (now() + pollMs >= deadline) break;
      await sleep(pollMs);
    }
    throw new Error(`bitmap-version-check timeout: expected=${expected} timeoutMs=${timeoutMs}`);
  };
}
