// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-nested-audit-tracing

/**
 * Nested audit trace의 entry 타입.
 *
 * OTEL span_id를 재사용하여 외부 tracing 시스템과 1:1 매핑된다.
 * 본 패키지는 OTEL에 직접 의존하지 않으므로 span_id 문자열만 받는다.
 */

export type AuditKind = "execution" | "check";
export type AuditOutcome = "allow" | "deny" | "error";
export type CheckPass = "bitmap" | "lifecycle" | "cerbos" | "acl";

interface AuditEntryBase {
  /** OTEL span_id 재사용. 트리 내 고유. */
  spanId: string;
  /** OTEL trace_id. */
  traceId: string;
  /** 바로 위 부모의 spanId. root면 null. */
  parentSpanId: string | null;
  /** 전체 트리의 최상위 spanId. root는 자기 자신. */
  rootSpanId: string;
  /** 트리 높이. 0 = root. */
  depth: number;
  /** ISO-8601. */
  startedAt: string;
  /** 종료 시각. finishExecution 전까지는 null. */
  endedAt: string | null;
  /** 자유 메타 (JSON-serializable). PII 금지. */
  metadata?: Record<string, unknown>;
}

export interface ExecutionEntry extends AuditEntryBase {
  kind: "execution";
  /** 호출된 API 식별자 (apiId, transition_id 등). */
  apiId: string;
  /** 실행 주체. */
  actorUserId: string;
  /** 선택. */
  actorTenantId?: string;
  /** DisjointUnionIndex kind — "resource" | "transaction" | ... */
  targetKind: string;
  /** resource_id 또는 transition_id. */
  targetId: string;
  /** finish 전까지는 null. */
  outcome: AuditOutcome | null;
}

export interface CheckEntry extends AuditEntryBase {
  kind: "check";
  /** 판정 단계. */
  pass: CheckPass;
  /** bitmap check일 때 좌표 address. */
  address?: number;
  /** DisjointUnionIndex kind. */
  unionKind?: string;
  /** 결과. */
  outcome: AuditOutcome;
  /** outcome='deny'일 때 사유. */
  denyReason?: string;
}

export type AuditEntry = ExecutionEntry | CheckEntry;

export interface RecordExecutionArgs {
  spanId: string;
  traceId: string;
  parentSpanId: string | null;
  apiId: string;
  actorUserId: string;
  actorTenantId?: string;
  targetKind: string;
  targetId: string;
  now?: string;
  metadata?: Record<string, unknown>;
}

export interface RecordCheckArgs {
  spanId: string;
  traceId: string;
  parentSpanId: string;
  pass: CheckPass;
  outcome: AuditOutcome;
  address?: number;
  unionKind?: string;
  denyReason?: string;
  now?: string;
  metadata?: Record<string, unknown>;
}
