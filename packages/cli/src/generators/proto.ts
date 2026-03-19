import type { SchemaSnapshot, Axis } from "../lib/types.js";
import { toPascal, toEnumValue } from "../lib/naming.js";

export interface ProtoGenOptions {
  /** protobuf package 이름 (기본: qa.apm.v1) */
  packageName?: string;
}

/**
 * SchemaSnapshot → .proto 파일 내용 생성.
 *
 * 생성물:
 * 1. 축별 enum (entries → enum values, 0 = UNSPECIFIED)
 * 2. ApmRecord / ApmEnvelope / MetricPayload 코어 메시지
 */
export function generateProto(
  snapshot: SchemaSnapshot,
  options: ProtoGenOptions = {},
): string {
  const pkg = options.packageName ?? "qa.apm.v1";
  const lines: string[] = [];

  lines.push(`// Generated from SchemaSnapshot "${snapshot.id}"`);
  lines.push(`// !! 자동 생성 파일 — 직접 수정 금지 !!`);
  lines.push(``);
  lines.push(`syntax = "proto3";`);
  lines.push(`package ${pkg};`);
  lines.push(``);

  // ── 축별 Enum ──────────────────────────────────────
  for (const axis of snapshot.axes) {
    lines.push(...generateAxisEnum(axis));
    lines.push(``);
  }

  // ── 코어 Enum (RecordKind, MetricType) ─────────────
  lines.push(...CORE_ENUMS);
  lines.push(``);

  // ── 코어 메시지 ────────────────────────────────────
  lines.push(...CORE_MESSAGES);

  return lines.join("\n") + "\n";
}

function generateAxisEnum(axis: Axis): string[] {
  const enumName = toPascal(axis.id);
  const lines: string[] = [];

  lines.push(`// ${axis.id} (capacity: ${axis.capacity})`);
  lines.push(`enum ${enumName} {`);
  lines.push(`  ${toEnumValue(axis.id, "UNSPECIFIED")} = 0;`);

  for (let i = 0; i < axis.entries.length; i++) {
    lines.push(`  ${toEnumValue(axis.id, axis.entries[i])} = ${i + 1};`);
  }

  lines.push(`}`);
  return lines;
}

const CORE_ENUMS: string[] = [
  `enum RecordKind {`,
  `  RECORD_KIND_UNSPECIFIED = 0;`,
  `  RECORD_KIND_LOG = 1;`,
  `  RECORD_KIND_SPAN = 2;`,
  `  RECORD_KIND_METRIC = 3;`,
  `}`,
  ``,
  `enum MetricType {`,
  `  METRIC_TYPE_UNSPECIFIED = 0;`,
  `  METRIC_TYPE_COUNTER = 1;`,
  `  METRIC_TYPE_GAUGE = 2;`,
  `  METRIC_TYPE_HISTOGRAM = 3;`,
  `  METRIC_TYPE_SUMMARY = 4;`,
  `}`,
];

const CORE_MESSAGES: string[] = [
  `message MetricPayload {`,
  `  MetricType type = 1;`,
  `  string name = 2;`,
  `  double value = 3;`,
  `  string unit = 4;`,
  `  map<string, string> labels = 5;`,
  `  repeated double buckets = 6;`,
  `  repeated double quantiles = 7;`,
  `}`,
  ``,
  `message ApmRecord {`,
  `  string log_id = 1;`,
  `  string trace_id = 2;`,
  `  string span_id = 3;`,
  `  string timestamp = 4;`,
  `  string event_key = 5;`,
  `  RecordKind record_kind = 6;`,
  ``,
  `  // Span`,
  `  string span_name = 7;`,
  `  string start_time = 8;`,
  `  string end_time = 9;`,
  ``,
  `  // Address context`,
  `  map<string, string> address_context = 10;`,
  ``,
  `  // Metric`,
  `  MetricPayload metric = 11;`,
  ``,
  `  // Payload`,
  `  bytes payload = 20;`,
  `  string payload_format = 21;`,
  `  string payload_encoding = 22;`,
  ``,
  `  // Actor`,
  `  string actor_id = 30;`,
  `  string user_id = 31;`,
  `  map<string, string> user_attributes = 32;`,
  `}`,
  ``,
  `message ApmEnvelope {`,
  `  string transmission_id = 1;`,
  `  string sent_at = 2;`,
  ``,
  `  // Owner`,
  `  string owner_type = 3;`,
  `  string owner_id = 4;`,
  ``,
  `  // Source`,
  `  string service_name = 5;`,
  `  string sdk_name = 6;`,
  `  string sdk_version = 7;`,
  ``,
  `  // Build`,
  `  string env = 8;`,
  `  string build_ref = 9;`,
  ``,
  `  // Infra context`,
  `  map<string, string> infra_context = 10;`,
  ``,
  `  // Snapshot supply (envelope 전략)`,
  `  string entry_snapshot = 11;`,
  ``,
  `  // Records`,
  `  repeated ApmRecord records = 20;`,
  `}`,
];
