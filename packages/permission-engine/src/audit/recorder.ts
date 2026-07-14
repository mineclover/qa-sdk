// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * AuditRecorder — nested audit entry 기록 인터페이스 + 인메모리 구현.
 *
 * 실제 DB 저장은 소비 서비스가 별도 어댑터로 구현.
 * 본 모듈은 트리 구조 유지와 lookup 로직에 집중.
 */

import type {
  AuditEntry,
  AuditOutcome,
  CheckEntry,
  ExecutionEntry,
  RecordCheckArgs,
  RecordExecutionArgs,
} from './types.js';

// ── Interface ────────────────────────────────────────────────────────────────

export interface AuditRecorder {
  /** execution entry 시작. rootSpanId/depth는 parent에서 자동 도출. */
  startExecution(args: RecordExecutionArgs): Promise<ExecutionEntry>;

  /** execution 종료 — outcome·endedAt 확정. */
  finishExecution(spanId: string, outcome: AuditOutcome, now?: string): Promise<ExecutionEntry>;

  /** check entry 기록 (시작·종료가 같은 시점). */
  recordCheck(args: RecordCheckArgs): Promise<CheckEntry>;

  /** spanId로 단일 조회. */
  get(spanId: string): Promise<AuditEntry | null>;

  /** rootSpanId 기준 전체 트리 조회 — depth asc, startedAt asc. */
  listByRoot(rootSpanId: string): Promise<AuditEntry[]>;

  /** 첫 deny/error entry — replay용. */
  firstFailure(rootSpanId: string): Promise<AuditEntry | null>;
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class ParentNotFoundError extends Error {
  constructor(public readonly parentSpanId: string) {
    super(`Parent audit entry not found: ${parentSpanId}`);
    this.name = 'ParentNotFoundError';
  }
}

export class EntryNotFoundError extends Error {
  constructor(public readonly spanId: string) {
    super(`Audit entry not found: ${spanId}`);
    this.name = 'EntryNotFoundError';
  }
}

// ── InMemory impl ────────────────────────────────────────────────────────────

export class InMemoryAuditRecorder implements AuditRecorder {
  private readonly store = new Map<string, AuditEntry>();

  async startExecution(args: RecordExecutionArgs): Promise<ExecutionEntry> {
    let rootSpanId: string;
    let depth: number;

    if (args.parentSpanId === null) {
      rootSpanId = args.spanId;
      depth = 0;
    } else {
      const parent = this.store.get(args.parentSpanId);
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
    this.store.set(args.spanId, entry);
    return entry;
  }

  async finishExecution(
    spanId: string,
    outcome: AuditOutcome,
    now?: string,
  ): Promise<ExecutionEntry> {
    const entry = this.store.get(spanId);
    if (!entry) throw new EntryNotFoundError(spanId);
    if (entry.kind !== 'execution') {
      throw new Error(`finishExecution called on non-execution entry: ${spanId}`);
    }
    const updated: ExecutionEntry = {
      ...entry,
      outcome,
      endedAt: now ?? new Date().toISOString(),
    };
    this.store.set(spanId, updated);
    return updated;
  }

  async recordCheck(args: RecordCheckArgs): Promise<CheckEntry> {
    const parent = this.store.get(args.parentSpanId);
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
    this.store.set(args.spanId, entry);
    return entry;
  }

  async get(spanId: string): Promise<AuditEntry | null> {
    return this.store.get(spanId) ?? null;
  }

  async listByRoot(rootSpanId: string): Promise<AuditEntry[]> {
    const entries: AuditEntry[] = [];
    for (const e of this.store.values()) {
      if (e.rootSpanId === rootSpanId) entries.push(e);
    }
    entries.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return a.startedAt.localeCompare(b.startedAt);
    });
    return entries;
  }

  async firstFailure(rootSpanId: string): Promise<AuditEntry | null> {
    const all = await this.listByRoot(rootSpanId);
    for (const e of all) {
      const outcome = e.kind === 'execution' ? e.outcome : e.outcome;
      if (outcome === 'deny' || outcome === 'error') return e;
    }
    return null;
  }
}
