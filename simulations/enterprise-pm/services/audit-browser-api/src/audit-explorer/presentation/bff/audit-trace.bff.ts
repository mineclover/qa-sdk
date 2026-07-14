// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

import type { AuditEntry } from 'permission-engine';
import { AuditRecorderQueryPort } from '../../application/ports/audit-recorder-query.port.js';
import { GraphSnapshotQueryPort } from '../../application/ports/graph-snapshot-query.port.js';
import {
  GraphRetentionInsightQueryPort,
  type GraphRetentionInsightResponse,
} from '../../application/ports/graph-retention-insight.port.js';
import type { AuditExplorerLoggerPort } from '../../application/ports/audit-explorer-logger.port.js';
import type { AuthorizationGraphSnapshotRecord } from 'authorization-ontology';

/** BFF 표면 — 화면 친화적 trace summary. domain entity 미노출. */
export interface AuditTraceSummaryBffModel {
  readonly rootSpanId: string;
  readonly count: number;
  readonly entries: readonly AuditEntry[];
  readonly cacheKey: string;
}

export interface AuditTraceFirstFailureBffModel {
  readonly rootSpanId: string;
  readonly firstFailure: AuditEntry | null;
  readonly cacheKey: string;
}

export interface AuditTraceContextBffModel {
  readonly rootSpanId: string;
  readonly graphId: string;
  readonly trace: {
    readonly count: number;
    readonly entries: readonly AuditEntry[];
  };
  readonly firstFailure: AuditEntry | null;
  readonly graphSnapshot: AuthorizationGraphSnapshotRecord;
  readonly graphRetentionInsight: GraphRetentionInsightResponse | null;
  readonly cacheKey: string;
}

/**
 * Audit Trace BFF.
 *
 * - audit-recorder + authorization graph + ingest insight 의 read 만 합성.
 * - persistence write 절대 금지 (validator 가 repository 쓰기 호출 검사).
 * - domain entity 노출 금지 (외부 컨트랙트는 AuditEntry 가 이미 framework-free).
 *
 * Read source 매핑:
 *   - AuditRecorderQueryPort       → permission-engine + audit-recorder-store 도메인
 *   - GraphSnapshotQueryPort       → graph-explorer 슬라이스
 *   - GraphRetentionInsightQueryPort → ingest 서비스 (HTTP)
 */
export class AuditTraceBff {
  readonly cachePrefix = 'audit-explorer-bff-trace:v1';

  constructor(
    private readonly recorders: AuditRecorderQueryPort,
    private readonly graphs: GraphSnapshotQueryPort,
    private readonly insights: GraphRetentionInsightQueryPort,
    private readonly logger: AuditExplorerLoggerPort,
  ) {}

  async getTrace(input: {
    readonly rootSpanId: string;
    readonly traceId: string;
    readonly correlationId: string;
  }): Promise<AuditTraceSummaryBffModel> {
    const cacheKey = `${this.cachePrefix}:${input.rootSpanId}`;
    const entries = await this.recorders.listByRoot(input.rootSpanId);
    this.logger.info(
      {
        traceId: input.traceId,
        correlationId: input.correlationId,
        domain: 'audit-explorer',
        useCase: 'AuditTraceBff.getTrace',
        aggregateId: input.rootSpanId,
        queryName: 'AuditTraceQuery',
        outcome: 'success',
        cacheKeyPrefix: this.cachePrefix,
        cacheHit: false,
      },
      'audit-trace.bff.success',
    );
    return {
      rootSpanId: input.rootSpanId,
      count: entries.length,
      entries,
      cacheKey,
    };
  }

  async getFirstFailure(input: {
    readonly rootSpanId: string;
    readonly traceId: string;
    readonly correlationId: string;
  }): Promise<AuditTraceFirstFailureBffModel> {
    const cacheKey = `${this.cachePrefix}:first-failure:${input.rootSpanId}`;
    const firstFailure = await this.recorders.firstFailure(input.rootSpanId);
    this.logger.info(
      {
        traceId: input.traceId,
        correlationId: input.correlationId,
        domain: 'audit-explorer',
        useCase: 'AuditTraceBff.getFirstFailure',
        aggregateId: input.rootSpanId,
        queryName: 'AuditFirstFailureQuery',
        outcome: firstFailure ? 'success' : 'failure',
        cacheKeyPrefix: this.cachePrefix,
        cacheHit: false,
      },
      firstFailure ? 'audit-trace.bff.first-failure.found' : 'audit-trace.bff.first-failure.miss',
    );
    return { rootSpanId: input.rootSpanId, firstFailure, cacheKey };
  }

  async getEntry(input: {
    readonly spanId: string;
    readonly traceId: string;
    readonly correlationId: string;
  }): Promise<AuditEntry | null> {
    const entry = await this.recorders.get(input.spanId);
    this.logger.info(
      {
        traceId: input.traceId,
        correlationId: input.correlationId,
        domain: 'audit-explorer',
        useCase: 'AuditTraceBff.getEntry',
        aggregateId: input.spanId,
        queryName: 'AuditEntryQuery',
        outcome: entry ? 'success' : 'failure',
        cacheKeyPrefix: this.cachePrefix,
        cacheHit: false,
      },
      entry ? 'audit-trace.bff.entry.found' : 'audit-trace.bff.entry.miss',
    );
    return entry;
  }

  async getContext(input: {
    readonly rootSpanId: string;
    readonly graphId: string;
    readonly traceId: string;
    readonly correlationId: string;
  }): Promise<AuditTraceContextBffModel | null> {
    const cacheKey = `${this.cachePrefix}:context:${input.rootSpanId}:${input.graphId}`;
    const [entries, firstFailure, graphSnapshot, graphRetentionInsight] = await Promise.all([
      this.recorders.listByRoot(input.rootSpanId),
      this.recorders.firstFailure(input.rootSpanId),
      this.graphs.latest(input.graphId),
      this.insights.getForGraph(input.graphId),
    ]);

    if (!graphSnapshot) {
      this.logger.warn(
        {
          traceId: input.traceId,
          correlationId: input.correlationId,
          domain: 'audit-explorer',
          useCase: 'AuditTraceBff.getContext',
          aggregateId: input.rootSpanId,
          queryName: 'AuditTraceContextQuery',
          outcome: 'failure',
          errorCode: 'GRAPH_NOT_FOUND',
          cacheKeyPrefix: this.cachePrefix,
          cacheHit: false,
        },
        'audit-trace.bff.context.graph-not-found',
      );
      return null;
    }

    this.logger.info(
      {
        traceId: input.traceId,
        correlationId: input.correlationId,
        domain: 'audit-explorer',
        useCase: 'AuditTraceBff.getContext',
        aggregateId: input.rootSpanId,
        queryName: 'AuditTraceContextQuery',
        outcome: 'success',
        cacheKeyPrefix: this.cachePrefix,
        cacheHit: false,
      },
      'audit-trace.bff.context.success',
    );

    return {
      rootSpanId: input.rootSpanId,
      graphId: input.graphId,
      trace: { count: entries.length, entries },
      firstFailure,
      graphSnapshot,
      graphRetentionInsight,
      cacheKey,
    };
  }
}
