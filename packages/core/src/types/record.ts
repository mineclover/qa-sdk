import type {
  PayloadFormat,
  PayloadEncoding,
} from "./payload.js";

// ── Record Kind ─────────────────────────────────────────

export type RecordKind = "log" | "span" | "metric";

// ── Metric Type ──────────────────────────────────────

export type MetricType = "counter" | "gauge" | "histogram" | "summary";

// ── Status Code (for spans) ─────────────────────────────

export type SpanStatusCode = "ok" | "error" | "unset";

// ── Event Record ────────────────────────────────────────

export interface EventRecord {
  /** Unique record identifier */
  log_id: string;

  /** ISO-8601 timestamp */
  timestamp: string;

  /** log or span */
  record_kind: RecordKind;

  // ── Trace context ──────────────────────────────────

  trace_id: string;
  span_id: string;
  parent_span_id?: string;

  // ── Event identity ─────────────────────────────────

  event_key: string;
  event_version: string;

  // ── Span fields (when record_kind === "span") ──────

  span_name?: string;
  start_time?: string;
  end_time?: string;
  status_code?: SpanStatusCode;

  // ── Payload ────────────────────────────────────────

  payload_format: PayloadFormat;
  payload_encoding: PayloadEncoding;
  payload_masking_applied: boolean;
  payload_masked_fields: string[];
  payload: unknown;

  // ── QA Session ─────────────────────────────────────

  qa_session_id?: string;
  _registry_warning?: string;

  // ── Address Context ────────────────────────────────────

  /** n차원 주소 컨텍스트. key=prefix_id, value="prefix:v:address" */
  address_context?: Record<string, string>;

  // ── Metric (when record_kind === "metric") ────────────

  metric_type?: MetricType;
  metric_name?: string;
  metric_value?: number;
  metric_unit?: string;
  metric_labels?: Record<string, string>;
  metric_buckets?: number[];
  metric_quantiles?: number[];

  // ── Actor ──────────────────────────────────────────────

  /** 행위 주체 식별자 (사람, 봇, 에이전트) */
  actor_id?: string;
  /** 실제 서비스 유저 식별자 (PII 포함 가능, 선택) */
  user_id?: string;
  /** 익명화된 분류 속성 e.g. { age_group: "30s", tier: "premium" } */
  user_attributes?: Record<string, string>;
}
