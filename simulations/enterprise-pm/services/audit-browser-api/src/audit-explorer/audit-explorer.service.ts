// @def.boundary sim-audit-browser-api
// @def.doc authorization-ontology-nested-audit-tracing

import { Inject, Injectable } from "@nestjs/common";
import type { AuditEntry, AuditRecorder } from "permission-engine";

export const AUDIT_RECORDER = Symbol("AUDIT_RECORDER");

/**
 * AuditExplorerService — read-only view of nested audit entries.
 *
 * PgAuditRecorder(Plan 06b) 또는 InMemoryAuditRecorder에 위임.
 * 본 서비스는 3 핵심 쿼리만 노출: listByRoot / firstFailure / get.
 */
@Injectable()
export class AuditExplorerService {
  constructor(
    @Inject(AUDIT_RECORDER) private readonly recorder: AuditRecorder,
  ) {}

  async listTrace(rootSpanId: string): Promise<AuditEntry[]> {
    return this.recorder.listByRoot(rootSpanId);
  }

  async findFirstFailure(rootSpanId: string): Promise<AuditEntry | null> {
    return this.recorder.firstFailure(rootSpanId);
  }

  async getEntry(spanId: string): Promise<AuditEntry | null> {
    return this.recorder.get(spanId);
  }
}
