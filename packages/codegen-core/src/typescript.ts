/** @def.boundary apm-codegen-system */
import type { SchemaSnapshot, Axis, Composite } from "./types.js";
import { toPascal, toTsConstKey } from "./naming.js";

/**
 * SchemaSnapshot → TypeScript 타입/상수 생성.
 *
 * 생성물:
 * 1. 축별 const 객체 + 유니온 타입
 * 2. composite별 Dims 인터페이스
 * 3. ApmRecord 확장 인터페이스
 */
export function generateTypescript(snapshot: SchemaSnapshot): string {
  const lines: string[] = [];
  const axisMap: Map<string, Axis> = new Map(snapshot.axes.map((axis) => [axis.id, axis]));

  lines.push(`// Generated from SchemaSnapshot "${snapshot.id}"`);
  lines.push(`// !! 자동 생성 파일 — 직접 수정 금지 !!`);
  lines.push(``);

  // ── 스키마 메타데이터 ──────────────────────────────
  lines.push(...generateSchemaMeta(snapshot));
  lines.push(``);

  // ── 축별 const + type ──────────────────────────────
  for (const axis of snapshot.axes) {
    lines.push(...generateAxisConstAndType(axis));
    lines.push(``);
  }

  // ── Composite Dims 인터페이스 ──────────────────────
  for (const comp of snapshot.composites) {
    lines.push(...generateCompositeDims(comp, axisMap));
    lines.push(``);
  }

  // ── 코어 타입 ──────────────────────────────────────
  lines.push(...CORE_TYPES);

  return lines.join("\n") + "\n";
}

function generateSchemaMeta(snapshot: SchemaSnapshot): string[] {
  const lines: string[] = [];
  const axisMap: Map<string, Axis> = new Map(snapshot.axes.map((axis) => [axis.id, axis]));

  lines.push(`/** SchemaSnapshot ID — 주소의 v 세그먼트. stride를 확정한 version */`);
  lines.push(`export const GENERATION = "${snapshot.id}" as const;`);
  lines.push(``);

  if (snapshot.composites.length > 0) {
    lines.push(`/** Composite prefix 메타데이터 — id, dims, capacity, stride, snapshotSupply */`);
    lines.push(`export const PREFIXES = {`);
    for (const comp of snapshot.composites) {
      const dimsStr = comp.dims.map((d) => `"${d}"`).join(", ");
      const capacities = resolveCapacities(comp, axisMap);
      const strides = calcStrides(capacities);
      const capStr = capacities.join(", ");
      const strStr = strides.join(", ");
      const supply = comp.snapshotSupply?.type ?? "implicit";
      lines.push(`  ${comp.id}: {`);
      lines.push(`    id: "${comp.id}" as const,`);
      lines.push(`    dims: [${dimsStr}] as const,`);
      lines.push(`    capacity: [${capStr}] as const,`);
      lines.push(`    stride: [${strStr}] as const,`);
      lines.push(`    snapshotSupply: "${supply}" as const,`);
      lines.push(`  },`);
    }
    lines.push(`} as const;`);
  }

  return lines;
}

/** composite의 dims에서 각 축의 capacity를 조회하여 shape 배열 반환 */
function resolveCapacities(comp: Composite, axisMap: Map<string, Axis>): number[] {
  return comp.dims.map((dimId) => {
    const axis = axisMap.get(dimId);
    return axis?.capacity ?? 0;
  });
}

/**
 * shape → stride 배열 계산.
 * weighted-index/src/calc.ts calcWeights()와 동일 공식:
 *   stride[last] = 1, stride[i] = stride[i+1] × shape[i+1]
 */
function calcStrides(shape: number[]): number[] {
  const n = shape.length;
  if (n === 0) return [];
  const strides = new Array<number>(n);
  strides[n - 1] = 1;
  for (let i = n - 2; i >= 0; i--) {
    strides[i] = strides[i + 1] * shape[i + 1];
  }
  return strides;
}

function generateAxisConstAndType(axis: Axis): string[] {
  const pascalName = toPascal(axis.id);
  const constName = axis.id.toUpperCase();
  const lines: string[] = [];

  lines.push(`/** ${axis.id} axis entries (capacity: ${axis.capacity}) */`);
  lines.push(`export const ${constName} = {`);
  for (const entry of axis.entries) {
    lines.push(`  ${toTsConstKey(entry)}: "${entry}",`);
  }
  lines.push(`} as const;`);

  if (axis.entries.length > 0) {
    // entries가 있으면 string literal union
    lines.push(`export type ${pascalName} = typeof ${constName}[keyof typeof ${constName}];`);
  } else {
    // entries가 비어있으면 string 폴백 (never 방지)
    lines.push(`export type ${pascalName} = string;`);
  }

  return lines;
}

function generateCompositeDims(
  comp: Composite,
  axisMap: Map<string, Axis>,
): string[] {
  const pascalName = toPascal(comp.id);
  const lines: string[] = [];

  lines.push(`/** ${comp.id} composite dimensions */`);
  lines.push(`export interface ${pascalName}Dims {`);

  for (const dimId of comp.dims) {
    const axis = axisMap.get(dimId);
    if (axis && axis.entries.length > 0) {
      // entries가 있으면 축 타입 참조
      lines.push(`  ${dimId}: ${toPascal(dimId)};`);
    } else {
      // entries가 없거나 composite ref면 string
      lines.push(`  ${dimId}: string;`);
    }
  }

  lines.push(`}`);
  return lines;
}

const CORE_TYPES: string[] = [
  `// ── Core APM Types ────────────────────────────────`,
  ``,
  `export type RecordKind = "log" | "span" | "metric";`,
  `export type MetricType = "counter" | "gauge" | "histogram" | "summary";`,
  ``,
  `export interface MetricPayload {`,
  `  type: MetricType;`,
  `  name: string;`,
  `  value: number;`,
  `  unit?: string;`,
  `  labels?: Record<string, string>;`,
  `  buckets?: number[];`,
  `  quantiles?: number[];`,
  `}`,
  ``,
  `export interface AddressContext {`,
  `  [prefixId: string]: string;`,
  `}`,
  ``,
  `export interface ApmRecord {`,
  `  log_id: string;`,
  `  trace_id: string;`,
  `  span_id: string;`,
  `  timestamp: string;`,
  `  event_key: string;`,
  `  record_kind: RecordKind;`,
  ``,
  `  // Span`,
  `  span_name?: string;`,
  `  start_time?: string;`,
  `  end_time?: string;`,
  `  status_code?: "ok" | "error" | "unset";`,
  ``,
  `  // Address context`,
  `  address_context?: AddressContext;`,
  ``,
  `  // Metric`,
  `  metric_type?: MetricType;`,
  `  metric_name?: string;`,
  `  metric_value?: number;`,
  `  metric_unit?: string;`,
  `  metric_labels?: Record<string, string>;`,
  `  metric_buckets?: number[];`,
  `  metric_quantiles?: number[];`,
  ``,
  `  // Payload`,
  `  payload_format: string;`,
  `  payload_encoding: string;`,
  `  payload_masking_applied: boolean;`,
  `  payload_masked_fields: string[];`,
  `  payload: unknown;`,
  ``,
  `  // Actor`,
  `  actor_id?: string;`,
  `  user_id?: string;`,
  `  user_attributes?: Record<string, string>;`,
  `}`,
  ``,
  `export interface ApmEnvelope {`,
  `  transmission_id: string;`,
  `  sent_at: string;`,
  `  owner: { owner_type: string; owner_id: string };`,
  `  source: { service_name: string; sdk_name: string; sdk_version: string };`,
  `  runtime: { platform: string; device_ref?: string };`,
  `  build: { env: string; build_ref?: string; release_version?: string };`,
  `  infra_context?: AddressContext;`,
  `  entry_snapshot?: string;`,
  `  records: ApmRecord[];`,
  `}`,
  ``,
];
