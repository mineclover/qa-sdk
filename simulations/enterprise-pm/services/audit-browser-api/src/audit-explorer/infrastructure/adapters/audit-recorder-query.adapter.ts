// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

import type { AuditEntry, AuditRecorder } from "permission-engine";
import { AuditRecorderQueryPort } from "../../application/ports/audit-recorder-query.port.js";

/**
 * AuditRecorderQueryPort 의 어댑터.
 *
 * permission-engine 의 AuditRecorder 인스턴스를 그대로 위임한다.
 * BFF 슬라이스이므로 새로운 read store 를 갖지 않고, 외부 도메인의 인터페이스를
 * 슬라이스 의존 표면으로만 노출한다.
 */
export class AuditRecorderQueryAdapter extends AuditRecorderQueryPort {
  constructor(private readonly recorder: AuditRecorder) {
    super();
  }

  async listByRoot(rootSpanId: string): Promise<readonly AuditEntry[]> {
    return this.recorder.listByRoot(rootSpanId);
  }

  async firstFailure(rootSpanId: string): Promise<AuditEntry | null> {
    return this.recorder.firstFailure(rootSpanId);
  }

  async get(spanId: string): Promise<AuditEntry | null> {
    return this.recorder.get(spanId);
  }
}
