// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

import { describe, expect, it, vi } from 'vitest';
import type { AuditEntry } from 'permission-engine';
import { AuditTraceBff } from './audit-trace.bff.js';
import { AuditRecorderQueryPort } from '../../application/ports/audit-recorder-query.port.js';
import { GraphSnapshotQueryPort } from '../../application/ports/graph-snapshot-query.port.js';
import { GraphRetentionInsightQueryPort } from '../../application/ports/graph-retention-insight.port.js';
import type { AuditExplorerLoggerPort } from '../../application/ports/audit-explorer-logger.port.js';

function makeLogger() {
  const logged: Array<{ level: string; ctx: Record<string, unknown>; msg: string }> = [];
  const logger: AuditExplorerLoggerPort = {
    info: (ctx, msg) => {
      logged.push({ level: 'info', ctx: ctx as never, msg });
    },
    warn: (ctx, msg) => {
      logged.push({ level: 'warn', ctx: ctx as never, msg });
    },
    error: (ctx, msg) => {
      logged.push({ level: 'error', ctx: ctx as never, msg });
    },
  };
  return { logger, logged };
}

class FakeRecorders extends AuditRecorderQueryPort {
  constructor(
    private readonly entries: readonly AuditEntry[] = [],
    private readonly failure: AuditEntry | null = null,
    private readonly entry: AuditEntry | null = null,
  ) {
    super();
  }
  async listByRoot(): Promise<readonly AuditEntry[]> {
    return this.entries;
  }
  async firstFailure(): Promise<AuditEntry | null> {
    return this.failure;
  }
  async get(): Promise<AuditEntry | null> {
    return this.entry;
  }
}

class FakeGraphs extends GraphSnapshotQueryPort {
  constructor(private readonly snapshot: unknown = null) {
    super();
  }
  async latest(): Promise<never> {
    return this.snapshot as never;
  }
}

class FakeInsights extends GraphRetentionInsightQueryPort {
  constructor(private readonly response: unknown = null) {
    super();
  }
  async getForGraph(): Promise<never> {
    return this.response as never;
  }
}

const sampleEntry: AuditEntry = {
  kind: 'execution',
  spanId: 'exec-1',
  traceId: 't1',
  parentSpanId: null,
  rootSpanId: 'exec-1',
  depth: 0,
  apiId: 'api',
  actorUserId: 'u',
  actorTenantId: null,
  targetKind: 'resource',
  targetId: 'r1',
  outcome: 'allow',
  startedAt: '2026-04-22T00:00:00Z',
  endedAt: '2026-04-22T00:00:01Z',
  metadata: null,
} as never;

describe('AuditTraceBff', () => {
  it('getTrace — recorders + cacheKey 합성', async () => {
    const { logger, logged } = makeLogger();
    const bff = new AuditTraceBff(
      new FakeRecorders([sampleEntry]),
      new FakeGraphs(),
      new FakeInsights(),
      logger,
    );

    const result = await bff.getTrace({
      rootSpanId: 'exec-1',
      traceId: 'trc_a',
      correlationId: 'cor_a',
    });

    expect(result.count).toBe(1);
    expect(result.rootSpanId).toBe('exec-1');
    expect(result.cacheKey).toBe('audit-explorer-bff-trace:v1:exec-1');
    const log = logged.find((l) => l.msg === 'audit-trace.bff.success')!;
    expect(log.ctx).toMatchObject({
      domain: 'audit-explorer',
      useCase: 'AuditTraceBff.getTrace',
      queryName: 'AuditTraceQuery',
      cacheKeyPrefix: 'audit-explorer-bff-trace:v1',
      cacheHit: false,
      outcome: 'success',
    });
  });

  it('getFirstFailure — failure 없을 때 outcome=failure', async () => {
    const { logger, logged } = makeLogger();
    const bff = new AuditTraceBff(
      new FakeRecorders(),
      new FakeGraphs(),
      new FakeInsights(),
      logger,
    );
    const result = await bff.getFirstFailure({
      rootSpanId: 'x',
      traceId: 't',
      correlationId: 'c',
    });
    expect(result.firstFailure).toBeNull();
    const miss = logged.find((l) => l.msg === 'audit-trace.bff.first-failure.miss')!;
    expect(miss.ctx.outcome).toBe('failure');
  });

  it('getEntry — 미존재 시 null + outcome=failure', async () => {
    const { logger, logged } = makeLogger();
    const bff = new AuditTraceBff(
      new FakeRecorders([], null, null),
      new FakeGraphs(),
      new FakeInsights(),
      logger,
    );
    const result = await bff.getEntry({
      spanId: 'missing',
      traceId: 't',
      correlationId: 'c',
    });
    expect(result).toBeNull();
    const miss = logged.find((l) => l.msg === 'audit-trace.bff.entry.miss')!;
    expect(miss.ctx.outcome).toBe('failure');
  });

  it('getContext — 4 read 합성 (trace + firstFailure + graphSnapshot + insight)', async () => {
    const { logger, logged } = makeLogger();
    const snapshot = {
      graphId: 'graph-1',
      snapshotId: 'graph-1:001',
      createdAt: '2026-04-24T00:00:00.000Z',
      graph: { realms: [], nodes: [], relations: [] },
    };
    const insight = {
      total: 2,
      summary: { 'sim.graph_retention.graph_pruned': 2 },
      byTrigger: { api: 2 },
      byGraphId: { 'graph-1': 2 },
      items: [],
    };
    const bff = new AuditTraceBff(
      new FakeRecorders([sampleEntry]),
      new FakeGraphs(snapshot),
      new FakeInsights(insight),
      logger,
    );
    const result = await bff.getContext({
      rootSpanId: 'exec-1',
      graphId: 'graph-1',
      traceId: 't',
      correlationId: 'c',
    });
    expect(result).not.toBeNull();
    expect(result!.trace.count).toBe(1);
    expect(result!.graphSnapshot.snapshotId).toBe('graph-1:001');
    expect(result!.graphRetentionInsight?.total).toBe(2);
    expect(result!.cacheKey).toBe('audit-explorer-bff-trace:v1:context:exec-1:graph-1');
    const log = logged.find((l) => l.msg === 'audit-trace.bff.context.success')!;
    expect(log.ctx.outcome).toBe('success');
  });

  it('getContext — graph 미존재 시 null + warn 로그', async () => {
    const { logger, logged } = makeLogger();
    const bff = new AuditTraceBff(
      new FakeRecorders([sampleEntry]),
      new FakeGraphs(null),
      new FakeInsights(null),
      logger,
    );
    const result = await bff.getContext({
      rootSpanId: 'exec-1',
      graphId: 'missing',
      traceId: 't',
      correlationId: 'c',
    });
    expect(result).toBeNull();
    const warn = logged.find((l) => l.msg === 'audit-trace.bff.context.graph-not-found')!;
    expect(warn.ctx.errorCode).toBe('GRAPH_NOT_FOUND');
    expect(warn.ctx.outcome).toBe('failure');
  });

  it('cachePrefix 가 OM seed 와 일치한다', () => {
    const { logger } = makeLogger();
    const bff = new AuditTraceBff(
      new FakeRecorders(),
      new FakeGraphs(),
      new FakeInsights(),
      logger,
    );
    expect(bff.cachePrefix).toBe('audit-explorer-bff-trace:v1');
  });

  it('read source 합성에 Promise.all 사용 (parallel fetch)', async () => {
    const recorders = new FakeRecorders([sampleEntry]);
    const listSpy = vi.spyOn(recorders, 'listByRoot');
    const failureSpy = vi.spyOn(recorders, 'firstFailure');
    const graphs = new FakeGraphs({
      graphId: 'g',
      snapshotId: 'g:1',
      createdAt: 'x',
      graph: { realms: [], nodes: [], relations: [] },
    });
    const latestSpy = vi.spyOn(graphs, 'latest');
    const insights = new FakeInsights(null);
    const insightsSpy = vi.spyOn(insights, 'getForGraph');
    const { logger } = makeLogger();
    const bff = new AuditTraceBff(recorders, graphs, insights, logger);
    await bff.getContext({
      rootSpanId: 'r',
      graphId: 'g',
      traceId: 't',
      correlationId: 'c',
    });
    expect(listSpy).toHaveBeenCalledTimes(1);
    expect(failureSpy).toHaveBeenCalledTimes(1);
    expect(latestSpy).toHaveBeenCalledTimes(1);
    expect(insightsSpy).toHaveBeenCalledTimes(1);
  });
});
