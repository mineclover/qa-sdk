// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * PgAuditRecorder — AuditRecorder의 PostgreSQL 영속 구현.
 *
 * SqliteAuditRecorder와 동일 비즈니스 invariant:
 *   - parent=null → rootSpanId=self, depth=0
 *   - parent 있으면 rootSpanId/depth는 parent에서 상속
 *   - parent 없으면 ParentNotFoundError
 *   - finishExecution은 execution kind에만 — 그 외는 throw
 *   - listByRoot는 (depth asc, startedAt asc) 정렬
 *
 * dialect 차이:
 *   - driver type (PostgresJsDatabase)
 *   - metadata는 jsonb 직접 저장 (SQLite는 text JSON-string)
 *
 * 트리 구축 로직은 SqliteAuditRecorder와 동일 코드 — 순수 함수 추출은
 * Plan 06c factory 정착 후 별도 후속 plan에서 (현재는 양쪽 maintain 비용 < 추출 비용 판단).
 */

import { asc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

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
} from "permission-engine";

import { auditEntries } from "./schema.js";

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
    // PG jsonb는 driver가 이미 객체로 반환 — 추가 parse 불필요
    metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
  };

  if (row.kind === "execution") {
    return {
      ...base,
      kind: "execution",
      apiId: row.apiId ?? "",
      actorUserId: row.actorUserId ?? "",
      actorTenantId: row.actorTenantId ?? undefined,
      targetKind: row.targetKind ?? "",
      targetId: row.targetId ?? "",
      outcome: row.outcome as ExecutionEntry["outcome"],
    };
  }

  return {
    ...base,
    kind: "check",
    pass: row.pass as CheckEntry["pass"],
    outcome: ((row.outcome ?? "allow") as AuditOutcome),
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
    kind: "execution",
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
    metadata: e.metadata ?? null, // jsonb — 객체 직접 저장
  };
}

function checkToRow(c: CheckEntry): Insert {
  return {
    spanId: c.spanId,
    traceId: c.traceId,
    parentSpanId: c.parentSpanId,
    rootSpanId: c.rootSpanId,
    depth: c.depth,
    kind: "check",
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
    metadata: c.metadata ?? null,
  };
}

export class PgAuditRecorder implements AuditRecorder {
  constructor(private readonly db: PostgresJsDatabase) {}

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
      kind: "execution",
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

    await this.db.insert(auditEntries).values(executionToRow(entry));
    return entry;
  }

  async finishExecution(
    spanId: string,
    outcome: AuditOutcome,
    now?: string,
  ): Promise<ExecutionEntry> {
    const cur = await this.get(spanId);
    if (!cur) throw new EntryNotFoundError(spanId);
    if (cur.kind !== "execution") {
      throw new Error(`finishExecution called on non-execution entry: ${spanId}`);
    }
    const endedAt = now ?? new Date().toISOString();
    await this.db
      .update(auditEntries)
      .set({ outcome, endedAt })
      .where(eq(auditEntries.spanId, spanId));
    return { ...cur, outcome, endedAt };
  }

  async recordCheck(args: RecordCheckArgs): Promise<CheckEntry> {
    const parent = await this.get(args.parentSpanId);
    if (!parent) throw new ParentNotFoundError(args.parentSpanId);

    const now = args.now ?? new Date().toISOString();
    const entry: CheckEntry = {
      kind: "check",
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
    await this.db.insert(auditEntries).values(checkToRow(entry));
    return entry;
  }

  async get(spanId: string): Promise<AuditEntry | null> {
    const rows = await this.db
      .select()
      .from(auditEntries)
      .where(eq(auditEntries.spanId, spanId))
      .limit(1);
    return rows.length === 0 ? null : toEntry(rows[0]);
  }

  async listByRoot(rootSpanId: string): Promise<AuditEntry[]> {
    const rows = await this.db
      .select()
      .from(auditEntries)
      .where(eq(auditEntries.rootSpanId, rootSpanId))
      .orderBy(asc(auditEntries.depth), asc(auditEntries.startedAt));
    return rows.map(toEntry);
  }

  async firstFailure(rootSpanId: string): Promise<AuditEntry | null> {
    const all = await this.listByRoot(rootSpanId);
    for (const e of all) {
      if (e.outcome === "deny" || e.outcome === "error") return e;
    }
    return null;
  }
}
