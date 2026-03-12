import type {
  PayloadFormat,
  PayloadEncoding,
} from "./payload.js";

// ── Record Kind ─────────────────────────────────────────

export type RecordKind = "log" | "span";

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
}
