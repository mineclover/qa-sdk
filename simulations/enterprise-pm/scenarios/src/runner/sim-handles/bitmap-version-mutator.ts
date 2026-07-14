// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// __simBitmapVersionMutator factory — Plan E Stage 11 follow-up #24.
//
// 시나리오 16이 권한 정의 변경(role 추가)을 통해 bitmap version을 v1→v2로
// 진화시킨다. auth-api admin endpoint `POST /admin/bitmap/bump-version`을 호출.
//
// 응답: { newVersion: string }.

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

export interface BitmapVersionMutatorFactoryArgs {
  /** auth-api admin base URL. */
  authApiUrl: string;
  /** 외부 호출 timeout (기본 5_000ms). */
  timeoutMs?: number;
  /** 테스트용 fetch 주입. */
  fetchImpl?: FetchLike;
}

/**
 * createBitmapVersionMutator — bitmap version bump 트리거 wrapper.
 */
export function createBitmapVersionMutator(
  args: BitmapVersionMutatorFactoryArgs,
): () => Promise<{ newVersion: string }> {
  const fetchImpl: FetchLike =
    args.fetchImpl ??
    ((input, init) =>
      fetch(input, {
        ...(init ?? {}),
        signal: AbortSignal.timeout(args.timeoutMs ?? 5_000),
      }) as unknown as ReturnType<FetchLike>);
  const base = args.authApiUrl.replace(/\/$/, '');

  return async function bumpVersion(): Promise<{ newVersion: string }> {
    const url = `${base}/admin/bitmap/bump-version`;
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `bitmap-version-mutator POST ${url} failed: status=${res.status} body=${body}`,
      );
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error(`bitmap-version-mutator JSON parse failed: ${(e as Error).message}`);
    }
    const v = (json as { newVersion?: unknown }).newVersion;
    if (typeof v !== 'string' || v.length === 0) {
      throw new Error(`bitmap-version-mutator invalid newVersion: ${JSON.stringify(json)}`);
    }
    return { newVersion: v };
  };
}
