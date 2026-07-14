// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * SqliteAuditRecorder — permission-engine의 AuditRecorder
 * 인터페이스를 SQLite + Drizzle로 영속 구현.
 *
 * Plan 06a에서 sqlite/ 디렉토리로 이동 + 클래스 rename.
 * 비즈니스 로직 변경 없음 — 트리 구축/parent 조회/정렬 invariant 그대로.
 * I/O만 담당하며 트리 invariant는 호출 시 parent 조회 후 검증한다.
 */

import { asc, eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import {
  EntryNotFoundError,
  ParentNotFoundError,
  type AuditEntry,
  type AuditOutcome,
  type AuditRecorder,
  type CheckEntry,
  type ExecutionEntry,
  type RecordCheckArgs,
  type RecordExecutionArgs,
} from 'permission-engine';

import { auditEntries } from './schema.js';

type Row = typeof auditEntries.$inferSelect;
type Insert = typeof auditEntries.$inferInsert;

function toEntry(row: Row): AuditEntry {
  const base = {
    spanId: row.spanId,
    traceId: row.traceId,
    parentSpanId: row.parentSpanId,
    rootSpanId: row.rootSpanId,
    depth: row.depth,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
  };

  if (row.kind === 'execution') {
    return {
      ...base,
      kind: 'execution',
      apiId: row.apiId ?? '',
      actorUserId: row.actorUserId ?? '',
      actorTenantId: row.actorTenantId ?? undefined,
      targetKind: row.targetKind ?? '',
      targetId: row.targetId ?? '',
      outcome: row.outcome,
    };
  }

  return {
    ...base,
    kind: 'check',
    pass: row.pass!,
    outcome: (row.outcome ?? 'allow') as AuditOutcome,
    address: row.address ?? undefined,
    unionKind: row.unionKind ?? undefined,
    denyReason: row.denyReason ?? undefined,
  };
}

function executionToRow(e: ExecutionEntry): Insert {
  return {
    spanId: e.spanId,
    traceId: e.traceId,
    parentSpanId: e.parentSpanId,
    rootSpanId: e.rootSpanId,
    depth: e.depth,
    kind: 'execution',
    apiId: e.apiId,
    actorUserId: e.actorUserId,
    actorTenantId: e.actorTenantId ?? null,
    targetKind: e.targetKind,
    targetId: e.targetId,
    outcome: e.outcome,
    pass: null,
    address: null,
    unionKind: null,
    denyReason: null,
    startedAt: e.startedAt,
    endedAt: e.endedAt,
    metadata: e.metadata ? JSON.stringify(e.metadata) : null,
  };
}

function checkToRow(c: CheckEntry): Insert {
  return {
    spanId: c.spanId,
    traceId: c.traceId,
    parentSpanId: c.parentSpanId,
    rootSpanId: c.rootSpanId,
    depth: c.depth,
    kind: 'check',
    apiId: null,
    actorUserId: null,
    actorTenantId: null,
    targetKind: null,
    targetId: null,
    outcome: c.outcome,
    pass: c.pass,
    address: c.address ?? null,
    unionKind: c.unionKind ?? null,
    denyReason: c.denyReason ?? null,
    startedAt: c.startedAt,
    endedAt: c.endedAt,
    metadata: c.metadata ? JSON.stringify(c.metadata) : null,
  };
}

export class SqliteAuditRecorder implements AuditRecorder {
  constructor(private readonly db: BetterSQLite3Database) {}

  async startExecution(args: RecordExecutionArgs): Promise<ExecutionEntry> {
    let rootSpanId: string;
    let depth: number;

    if (args.parentSpanId === null) {
      rootSpanId = args.spanId;
      depth = 0;
    } else {
      const parent = await this.get(args.parentSpanId);
      if (!parent) throw new ParentNotFoundError(args.parentSpanId);
      rootSpanId = parent.rootSpanId;
      depth = parent.depth + 1;
    }

    const now = args.now ?? new Date().toISOString();
    const entry: ExecutionEntry = {
      kind: 'execution',
      spanId: args.spanId,
      traceId: args.traceId,
      parentSpanId: args.parentSpanId,
      rootSpanId,
      depth,
      apiId: args.apiId,
      actorUserId: args.actorUserId,
      actorTenantId: args.actorTenantId,
      targetKind: args.targetKind,
      targetId: args.targetId,
      outcome: null,
      startedAt: now,
      endedAt: null,
      metadata: args.metadata,
    };

    this.db.insert(auditEntries).values(executionToRow(entry)).run();
    return entry;
  }

  async finishExecution(
    spanId: string,
    outcome: AuditOutcome,
    now?: string,
  ): Promise<ExecutionEntry> {
    const cur = await this.get(spanId);
    if (!cur) throw new EntryNotFoundError(spanId);
    if (cur.kind !== 'execution') {
      throw new Error(`finishExecution called on non-execution entry: ${spanId}`);
    }
    const endedAt = now ?? new Date().toISOString();
    this.db
      .update(auditEntries)
      .set({ outcome, endedAt })
      .where(eq(auditEntries.spanId, spanId))
      .run();
    return { ...cur, outcome, endedAt };
  }

  async recordCheck(args: RecordCheckArgs): Promise<CheckEntry> {
    const parent = await this.get(args.parentSpanId);
    if (!parent) throw new ParentNotFoundError(args.parentSpanId);

    const now = args.now ?? new Date().toISOString();
    const entry: CheckEntry = {
      kind: 'check',
      spanId: args.spanId,
      traceId: args.traceId,
      parentSpanId: args.parentSpanId,
      rootSpanId: parent.rootSpanId,
      depth: parent.depth + 1,
      pass: args.pass,
      outcome: args.outcome,
      address: args.address,
      unionKind: args.unionKind,
      denyReason: args.denyReason,
      startedAt: now,
      endedAt: now,
      metadata: args.metadata,
    };
    this.db.insert(auditEntries).values(checkToRow(entry)).run();
    return entry;
  }

  async get(spanId: string): Promise<AuditEntry | null> {
    const rows = this.db
      .select()
      .from(auditEntries)
      .where(eq(auditEntries.spanId, spanId))
      .limit(1)
      .all();
    return rows.length === 0 ? null : toEntry(rows[0]);
  }

  async listByRoot(rootSpanId: string): Promise<AuditEntry[]> {
    return this.db
      .select()
      .from(auditEntries)
      .where(eq(auditEntries.rootSpanId, rootSpanId))
      .orderBy(asc(auditEntries.depth), asc(auditEntries.startedAt))
      .all()
      .map(toEntry);
  }

  async firstFailure(rootSpanId: string): Promise<AuditEntry | null> {
    const all = await this.listByRoot(rootSpanId);
    for (const e of all) {
      if (e.outcome === 'deny' || e.outcome === 'error') return e;
    }
    return null;
  }
}
