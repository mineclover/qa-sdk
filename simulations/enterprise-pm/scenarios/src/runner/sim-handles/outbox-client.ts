// @def.boundary sim-scenarios
// @def.doc canary-scaling-error-and-scenarios
//
// __simOutboxClient factory — Plan E Stage 11 follow-up #24.
//
// 시나리오 15가 outbox 5건 동시 INSERT + dispatcher (replica=3) 처리 결과 추적.
// approval-api가 노출하는 admin endpoint를 통해 INSERT/조회한다:
//
//   POST /admin/outbox/insert           body { count } → { ids: string[], insertedAtMs }
//   GET  /admin/outbox/dispatch?ids=... → { publishedAt: [[id, epochMs], ...],
//                                           dispatcherIds: [[id, dispatcherId], ...] }
//
// dispatcher 처리 완료 polling — 모든 id의 publishedAt이 채워질 때까지 대기.
//
// Stage 4 §4.7 — outbox admin endpoint 응답 shape 는 sim-outbox-view 패키지에서 SSOT 로 import.

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

export interface OutboxClientFactoryArgs {
  /** approval-api admin base URL. */
  approvalApiUrl: string;
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

export interface OutboxClientHandle {
  insertEvents(count: number): Promise<string[]>;
  waitForDispatch(
    eventIds: readonly string[],
    timeoutMs: number,
  ): Promise<{
    publishedAt: Map<string, number>;
    dispatcherIds: Map<string, string>;
    insertedAtMs: number;
  }>;
}

interface InsertResponse {
  ids?: unknown;
  insertedAtMs?: unknown;
}

interface DispatchResponse {
  publishedAt?: unknown;
  dispatcherIds?: unknown;
}

export function createOutboxClient(args: OutboxClientFactoryArgs): OutboxClientHandle {
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
  const base = args.approvalApiUrl.replace(/\/$/, '');

  let lastInsertedAtMs = 0;

  return {
    async insertEvents(count) {
      if (!Number.isInteger(count) || count <= 0) {
        throw new Error(`insertEvents: count must be positive integer, got ${count}`);
      }
      // Stage 4 endpoint 는 events 배열을 받음 — count 만큼 minimal event 생성.
      // grammar #5 EventName 어휘 (approval.budget.submitted) 사용 — sim-event-vocabulary SSOT.
      const occurredAt = now();
      const events = Array.from({ length: count }, (_, i) => ({
        aggregateId: `budget-${occurredAt}-${i}`,
        eventName: 'approval.budget.submitted',
        payload: { i },
        occurredAt: occurredAt + i,
      }));
      const url = `${base}/admin/outbox/insert`;
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ events }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`outbox-client POST ${url} failed: status=${res.status} body=${body}`);
      }
      let json: InsertResponse;
      try {
        json = (await res.json()) as InsertResponse;
      } catch (e) {
        throw new Error(`outbox-client JSON parse failed: ${(e as Error).message}`);
      }
      if (!Array.isArray(json.ids)) {
        throw new Error(`outbox-client invalid insert response: ${JSON.stringify(json)}`);
      }
      if (typeof json.insertedAtMs !== 'number') {
        throw new Error(`outbox-client invalid insertedAtMs: ${JSON.stringify(json)}`);
      }
      lastInsertedAtMs = json.insertedAtMs;
      return json.ids as string[];
    },

    async waitForDispatch(eventIds, timeoutMs) {
      if (eventIds.length === 0) {
        return {
          publishedAt: new Map<string, number>(),
          dispatcherIds: new Map<string, string>(),
          insertedAtMs: lastInsertedAtMs,
        };
      }
      const deadline = now() + timeoutMs;
      while (now() < deadline) {
        const params = new URLSearchParams();
        params.set('ids', eventIds.join(','));
        const url = `${base}/admin/outbox/dispatch?${params.toString()}`;
        const res = await fetchImpl(url, { method: 'GET' });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`outbox-client GET ${url} failed: status=${res.status} body=${body}`);
        }
        let json: DispatchResponse;
        try {
          json = (await res.json()) as DispatchResponse;
        } catch (e) {
          throw new Error(`outbox-client JSON parse failed: ${(e as Error).message}`);
        }
        const publishedEntries = (json.publishedAt ?? []) as unknown;
        const dispatcherEntries = (json.dispatcherIds ?? []) as unknown;
        if (!Array.isArray(publishedEntries) || !Array.isArray(dispatcherEntries)) {
          throw new Error(`outbox-client invalid dispatch shape: ${JSON.stringify(json)}`);
        }
        const publishedAt = new Map<string, number>(publishedEntries as [string, number][]);
        const dispatcherIds = new Map<string, string>(dispatcherEntries as [string, string][]);
        const allDone = eventIds.every((id) => publishedAt.has(id) && dispatcherIds.has(id));
        if (allDone) {
          return { publishedAt, dispatcherIds, insertedAtMs: lastInsertedAtMs };
        }
        if (now() + pollMs >= deadline) break;
        await sleep(pollMs);
      }
      throw new Error(`outbox-client waitForDispatch timeout: timeoutMs=${timeoutMs}`);
    },
  };
}
