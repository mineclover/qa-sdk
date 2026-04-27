// @def.boundary sim-audit-browser-api
// @def.doc domain-slice-architecture

/**
 * Cross-domain query port — auth/permission 도메인의 audit recorder read 표면.
 *
 * audit-explorer 는 BFF 슬라이스이므로 자기 aggregate 가 없다. 이 port 는 외부
 * (permission-engine + audit-recorder-store) 도메인의 read API 만 노출하고,
 * BFF 가 화면 합성에 사용한다.
 */
import type { AuditEntry } from "permission-engine";

export abstract class AuditRecorderQueryPort {
  /** rootSpanId 로 trace tree 전체 조회 */
  abstract listByRoot(rootSpanId: string): Promise<readonly AuditEntry[]>;

  /** rootSpanId 기준 첫 deny/error entry */
  abstract firstFailure(rootSpanId: string): Promise<AuditEntry | null>;

  /** spanId 단일 entry 조회 */
  abstract get(spanId: string): Promise<AuditEntry | null>;
}
