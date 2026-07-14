// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// __simComposeHandle factory — Plan E Stage 11 follow-up #24.
//
// 시나리오 12/13이 docker compose v1/v2 replica count를 조회한다(부수효과 보강 단언).
// 본 factory는 두 가지 백엔드를 지원한다:
//
// 1. HTTP — controller compose admin endpoint (`/admin/compose/replicas`)가
//    있으면 호출. 응답: { v1: number, v2: number }.
// 2. CLI — 백업 경로. `docker compose ps --format json` 출력을 파싱해서
//    v1/v2 service replica 수를 집계.
//
// CLI 경로는 testability를 위해 execImpl 의존성 주입.

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export type ExecLike = (
  cmd: string,
  args: readonly string[],
) => Promise<{ stdout: string; stderr: string; exitCode: number }>;

export interface ComposeHandleFactoryArgs {
  /** controller admin endpoint base URL. 미지정 시 CLI 경로 사용. */
  controllerUrl?: string;
  /** docker-compose v1/v2 service 이름. */
  serviceNames?: { v1: string; v2: string };
  /** 외부 호출 timeout (기본 5_000ms). */
  timeoutMs?: number;
  /** 테스트용 fetch 주입. */
  fetchImpl?: FetchLike;
  /** 테스트용 exec 주입 (CLI 경로). */
  execImpl?: ExecLike;
}

export interface ComposeHandle {
  getReplicas(): Promise<{ v1: number; v2: number }>;
}

interface ComposePsItem {
  Service?: string;
  Name?: string;
  State?: string;
}

/**
 * createComposeHandle — docker compose replica count read wrapper.
 *
 * controllerUrl이 있으면 HTTP 우선. 없으면 CLI fallback.
 */
export function createComposeHandle(args: ComposeHandleFactoryArgs): ComposeHandle {
  const v1Name = args.serviceNames?.v1 ?? 'approval-api-v1';
  const v2Name = args.serviceNames?.v2 ?? 'approval-api-v2';
  const fetchImpl: FetchLike =
    args.fetchImpl ??
    ((input, init) =>
      fetch(input, {
        ...(init ?? {}),
        signal: AbortSignal.timeout(args.timeoutMs ?? 5_000),
      }) as unknown as ReturnType<FetchLike>);

  async function getViaHttp(base: string): Promise<{ v1: number; v2: number }> {
    const url = `${base.replace(/\/$/, '')}/admin/compose/replicas`;
    const res = await fetchImpl(url, { method: 'GET' });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`compose-handle GET ${url} failed: status=${res.status} body=${body}`);
    }
    let json: unknown;
    try {
      json = await res.json();
    } catch (e) {
      throw new Error(`compose-handle JSON parse failed: ${(e as Error).message}`);
    }
    const obj = json as { v1?: unknown; v2?: unknown };
    if (typeof obj.v1 !== 'number' || typeof obj.v2 !== 'number') {
      throw new Error(`compose-handle invalid shape: ${JSON.stringify(json)}`);
    }
    return { v1: obj.v1, v2: obj.v2 };
  }

  async function getViaCli(): Promise<{ v1: number; v2: number }> {
    if (!args.execImpl) {
      throw new Error('compose-handle: execImpl required when controllerUrl missing');
    }
    const r = await args.execImpl('docker', ['compose', 'ps', '--format', 'json']);
    if (r.exitCode !== 0) {
      throw new Error(`compose-handle docker ps failed: exitCode=${r.exitCode} stderr=${r.stderr}`);
    }
    // docker compose v2: NDJSON (line-per-service) or JSON array, depending on version.
    const lines = r.stdout.trim().split('\n').filter(Boolean);
    let items: ComposePsItem[];
    if (lines.length > 0 && lines[0].startsWith('[')) {
      try {
        items = JSON.parse(r.stdout) as ComposePsItem[];
      } catch (e) {
        throw new Error(`compose-handle JSON.parse failed: ${(e as Error).message}`);
      }
    } else {
      items = lines.map((l) => {
        try {
          return JSON.parse(l) as ComposePsItem;
        } catch (e) {
          throw new Error(`compose-handle line JSON.parse failed: ${(e as Error).message}`);
        }
      });
    }
    let v1 = 0;
    let v2 = 0;
    for (const it of items) {
      const svc = it.Service ?? '';
      const state = (it.State ?? '').toLowerCase();
      if (state !== 'running') continue;
      if (svc === v1Name) v1 += 1;
      else if (svc === v2Name) v2 += 1;
    }
    return { v1, v2 };
  }

  return {
    async getReplicas() {
      if (args.controllerUrl) return getViaHttp(args.controllerUrl);
      return getViaCli();
    },
  };
}
