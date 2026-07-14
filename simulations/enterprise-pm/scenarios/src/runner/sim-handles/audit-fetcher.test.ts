// @def.boundary sim-scenarios

import { describe, expect, it, vi } from 'vitest';
import { createAuditFetcher, type FetchLike } from './audit-fetcher.js';

interface MockResponse {
  ok: boolean;
  status: number;
  body: unknown;
  text?: string;
}

function mockFetch(
  responses: ReadonlyArray<{
    urlMatch: (url: string) => boolean;
    response: MockResponse;
  }>,
): { fetch: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (input) => {
    calls.push(input);
    const matched = responses.find((r) => r.urlMatch(input));
    if (!matched) throw new Error(`unmocked URL: ${input}`);
    const r = matched.response;
    return {
      ok: r.ok,
      status: r.status,
      async text() {
        return r.text ?? JSON.stringify(r.body);
      },
      async json() {
        return r.body;
      },
    };
  };
  return { fetch: fetchImpl, calls };
}

describe('audit-fetcher handle', () => {
  it('queryDecisions가 cycleIds를 쿼리스트링으로 보내고 결과를 파싱한다', async () => {
    const decisions = [
      {
        decisionId: 'safety-decision-x',
        cycleId: 'cyc-1',
        cycleAt: '2026-01-01T00:00:00.000Z',
        pass: 'safety',
        verdict: 'promote',
        categoryVerdicts: {},
        triggerSignals: [],
        evidence: [],
        confidence: 0.9,
      },
    ];
    const { fetch, calls } = mockFetch([
      {
        urlMatch: (u) => u.includes('/v1/decisions'),
        response: { ok: true, status: 200, body: { items: decisions } },
      },
    ]);
    const f = createAuditFetcher({
      controllerUrl: 'http://test/',
      fetchImpl: fetch,
    });
    const result = await f.queryDecisions({ cycleIds: ['cyc-1', 'cyc-2'] });
    expect(result).toEqual(decisions);
    expect(calls[0]).toContain('cycleIds=cyc-1%2Ccyc-2');
  });

  it('queryDecisions가 빈 cycleIds에 대해 [] 반환 (네트워크 호출 없음)', async () => {
    const fetchImpl = vi.fn();
    const f = createAuditFetcher({
      controllerUrl: 'http://test',
      fetchImpl: fetchImpl as unknown as FetchLike,
    });
    const result = await f.queryDecisions({ cycleIds: [] });
    expect(result).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('queryFirstDecision이 pass로 필터하고 cycleAt ascending 첫 결과 반환', async () => {
    const decisions = [
      {
        decisionId: 'safety-decision-late',
        cycleId: 'cyc-2',
        cycleAt: '2026-01-01T00:00:02.000Z',
        pass: 'safety',
        verdict: 'hold',
        categoryVerdicts: {},
        triggerSignals: [],
        evidence: [],
        confidence: 0.5,
      },
      {
        decisionId: 'safety-decision-early',
        cycleId: 'cyc-1',
        cycleAt: '2026-01-01T00:00:01.000Z',
        pass: 'safety',
        verdict: 'rollback',
        categoryVerdicts: {},
        triggerSignals: [],
        evidence: [],
        confidence: 0.9,
      },
      {
        decisionId: 'resource-decision-a',
        cycleId: 'cyc-1',
        cycleAt: '2026-01-01T00:00:01.000Z',
        pass: 'resource',
        verdict: 'scale-up',
        categoryVerdicts: {},
        triggerSignals: [],
        evidence: [],
        confidence: 0.8,
      },
    ];
    const { fetch } = mockFetch([
      {
        urlMatch: () => true,
        response: { ok: true, status: 200, body: { items: decisions } },
      },
    ]);
    const f = createAuditFetcher({ controllerUrl: 'http://x', fetchImpl: fetch });
    const first = await f.queryFirstDecision({
      pass: 'safety',
      cycleIds: ['cyc-1', 'cyc-2'],
    });
    expect(first).not.toBeNull();
    expect(first?.decisionId).toBe('safety-decision-early');
  });

  it('countAlerts가 count 필드를 number로 반환한다', async () => {
    const { fetch, calls } = mockFetch([
      {
        urlMatch: (u) => u.includes('/v1/alerts/count'),
        response: { ok: true, status: 200, body: { count: 3 } },
      },
    ]);
    const f = createAuditFetcher({ controllerUrl: 'http://x', fetchImpl: fetch });
    const n = await f.countAlerts({
      cycleIds: ['cyc-1'],
      kind: 'audit-critical-anomaly',
    });
    expect(n).toBe(3);
    expect(calls[0]).toContain('kind=audit-critical-anomaly');
  });

  it('non-2xx 응답에 대해 throw', async () => {
    const { fetch } = mockFetch([
      {
        urlMatch: () => true,
        response: { ok: false, status: 500, body: {}, text: 'boom' },
      },
    ]);
    const f = createAuditFetcher({ controllerUrl: 'http://x', fetchImpl: fetch });
    await expect(f.queryDecisions({ cycleIds: ['c'] })).rejects.toThrow(/status=500/);
  });

  it('invalid response shape에 대해 throw', async () => {
    const { fetch } = mockFetch([
      {
        urlMatch: () => true,
        response: { ok: true, status: 200, body: { wrong: true } },
      },
    ]);
    const f = createAuditFetcher({ controllerUrl: 'http://x', fetchImpl: fetch });
    await expect(f.queryDecisions({ cycleIds: ['c'] })).rejects.toThrow(/invalid response shape/);
  });
});
