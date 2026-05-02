// @def.boundary spec-engine-system
// @def.doc spec-engine-system

/**
 * catalog-writer — Catalog 객체 → TypeScript 소스 문자열 변환.
 *
 * 순수 함수. 부수 효과 없음.
 * refEntries는 생략한다 (derive 단계에서 재계산).
 */

import type {
  Catalog,
  VersionedAxis,
  AxisVersionSnapshot,
  PrefixDef,
  PrefixVersionDef,
  DimRef,
  PrefixMeta,
  TableSchema,
  ColumnRef,
} from "@qa-sdk/core";

export interface WriterOptions {
  /** export 변수명 (기본: "CATALOG") */
  readonly exportName?: string;
}

/**
 * Catalog 객체를 유효한 TypeScript 소스 문자열로 직렬화한다.
 *
 * - axes: 각 VersionedAxis의 versions를 직렬화
 * - prefixes: 각 PrefixDef의 dims, versions, meta를 직렬화
 * - tables: 있으면 포함
 * - refEntries: 생략 (derive 단계에서 재계산)
 */
export function serializeCatalogToTs(
  catalog: Catalog,
  options?: WriterOptions,
): string {
  const exportName = options?.exportName ?? "CATALOG";
  const lines: string[] = [];

  lines.push(`/**`);
  lines.push(` * 자동 생성된 카탈로그 파일.`);
  lines.push(` * 이 파일을 직접 수정하지 마세요 — catalog-writer가 재생성합니다.`);
  lines.push(` * Generated: ${new Date().toISOString().split("T")[0]}`);
  lines.push(` */`);
  lines.push(``);
  lines.push(`import type { Catalog } from "@qa-sdk/core";`);
  lines.push(``);
  lines.push(`export const ${exportName}: Catalog = ${serializeCatalog(catalog)};`);

  return lines.join("\n") + "\n";
}

// ── Serialization helpers ──

function serializeCatalog(catalog: Catalog): string {
  const parts: string[] = [];
  parts.push(`{`);
  parts.push(`  id: ${JSON.stringify(catalog.id)},`);
  parts.push(`  name: ${JSON.stringify(catalog.name)},`);

  // axes
  parts.push(`  axes: {`);
  for (const [id, axis] of Object.entries(catalog.axes)) {
    parts.push(`    ${safeKey(id)}: ${serializeAxis(axis, 4)},`);
  }
  parts.push(`  },`);

  // prefixes
  parts.push(`  prefixes: {`);
  for (const [id, prefix] of Object.entries(catalog.prefixes)) {
    parts.push(`    ${safeKey(id)}: ${serializePrefix(prefix, 4)},`);
  }
  parts.push(`  },`);

  // tables (optional)
  if (catalog.tables && Object.keys(catalog.tables).length > 0) {
    parts.push(`  tables: {`);
    for (const [id, table] of Object.entries(catalog.tables)) {
      parts.push(`    ${safeKey(id)}: ${serializeTable(table, 4)},`);
    }
    parts.push(`  },`);
  }

  parts.push(`}`);
  return parts.join("\n");
}

function serializeAxis(axis: VersionedAxis, indent: number): string {
  const pad = " ".repeat(indent);
  const lines: string[] = [];
  lines.push(`{`);
  lines.push(`${pad}  id: ${JSON.stringify(axis.id)},`);
  lines.push(`${pad}  name: ${JSON.stringify(axis.name)},`);
  lines.push(`${pad}  versions: {`);
  for (const [vKey, snapshot] of Object.entries(axis.versions)) {
    lines.push(`${pad}    ${safeKey(vKey)}: ${serializeAxisVersion(snapshot, indent + 4)},`);
  }
  lines.push(`${pad}  },`);
  lines.push(`${pad}}`);
  return lines.join("\n");
}

function serializeAxisVersion(snapshot: AxisVersionSnapshot, indent: number): string {
  const pad = " ".repeat(indent);
  const parts: string[] = [];
  parts.push(`{`);
  parts.push(`${pad}  entries: ${serializeStringArray(snapshot.entries)},`);
  if (snapshot.capacity !== undefined) {
    parts.push(`${pad}  capacity: ${snapshot.capacity},`);
  }
  if (snapshot.ko && Object.keys(snapshot.ko).length > 0) {
    parts.push(`${pad}  ko: ${serializeRecord(snapshot.ko, indent + 2)},`);
  }
  parts.push(`${pad}}`);
  return parts.join("\n");
}

function serializePrefix(prefix: PrefixDef, indent: number): string {
  const pad = " ".repeat(indent);
  const lines: string[] = [];
  lines.push(`{`);
  lines.push(`${pad}  id: ${JSON.stringify(prefix.id)},`);
  lines.push(`${pad}  name: ${JSON.stringify(prefix.name)},`);
  if (prefix.description !== undefined) {
    lines.push(`${pad}  description: ${JSON.stringify(prefix.description)},`);
  }
  lines.push(`${pad}  labels: ${serializeStringArray(prefix.labels)},`);

  // dims
  lines.push(`${pad}  dims: {`);
  for (const [dimLabel, dimRef] of Object.entries(prefix.dims)) {
    lines.push(`${pad}    ${safeKey(dimLabel)}: ${serializeDimRef(dimRef)},`);
  }
  lines.push(`${pad}  },`);

  // versions (refEntries 생략)
  lines.push(`${pad}  versions: [`);
  for (const pv of prefix.versions) {
    lines.push(`${pad}    ${serializePrefixVersion(pv, indent + 4)},`);
  }
  lines.push(`${pad}  ],`);

  // meta (optional)
  if (prefix.meta) {
    lines.push(`${pad}  meta: ${serializePrefixMeta(prefix.meta, indent + 2)},`);
  }

  lines.push(`${pad}}`);
  return lines.join("\n");
}

function serializePrefixVersion(pv: PrefixVersionDef, indent: number): string {
  const pad = " ".repeat(indent);
  const parts: string[] = [];
  parts.push(`{`);
  parts.push(`${pad}  version: ${JSON.stringify(pv.version)},`);
  parts.push(`${pad}  axisVersions: ${serializeRecord(pv.axisVersions, indent + 2)},`);
  // refEntries 생략 — derive 단계에서 재계산
  parts.push(`${pad}}`);
  return parts.join("\n");
}

function serializeDimRef(ref: DimRef): string {
  switch (ref.kind) {
    case "axis":
      return `{ kind: "axis", axisId: ${JSON.stringify(ref.axisId)} }`;
    case "prefix_ref":
      return `{ kind: "prefix_ref", prefixId: ${JSON.stringify(ref.prefixId)} }`;
    case "table_ref":
      return `{ kind: "table_ref", table: ${JSON.stringify(ref.table)} }`;
  }
}

function serializePrefixMeta(meta: PrefixMeta, indent: number): string {
  const pad = " ".repeat(indent);
  const parts: string[] = [];
  parts.push(`{`);
  if (meta.category !== undefined) {
    parts.push(`${pad}  category: ${JSON.stringify(meta.category)},`);
  }
  if (meta.layer !== undefined) {
    parts.push(`${pad}  layer: ${meta.layer},`);
  }
  if (meta.visualShape !== undefined) {
    parts.push(`${pad}  visualShape: ${JSON.stringify(meta.visualShape)},`);
  }
  if (meta.heightRatio !== undefined) {
    parts.push(`${pad}  heightRatio: ${meta.heightRatio},`);
  }
  if (meta.detailKind !== undefined) {
    parts.push(`${pad}  detailKind: ${JSON.stringify(meta.detailKind)},`);
  }
  if (meta.source) {
    const srcParts: string[] = [];
    if (meta.source.module !== undefined) srcParts.push(`module: ${JSON.stringify(meta.source.module)}`);
    if (meta.source.file !== undefined) srcParts.push(`file: ${JSON.stringify(meta.source.file)}`);
    parts.push(`${pad}  source: { ${srcParts.join(", ")} },`);
  }
  parts.push(`${pad}}`);
  return parts.join("\n");
}

function serializeTable(table: TableSchema, indent: number): string {
  const pad = " ".repeat(indent);
  const lines: string[] = [];
  lines.push(`{`);
  lines.push(`${pad}  table: ${JSON.stringify(table.table)},`);
  lines.push(`${pad}  columns: {`);
  for (const [col, ref] of Object.entries(table.columns)) {
    lines.push(`${pad}    ${safeKey(col)}: ${serializeColumnRef(ref)},`);
  }
  lines.push(`${pad}  },`);
  lines.push(`${pad}}`);
  return lines.join("\n");
}

function serializeColumnRef(ref: ColumnRef): string {
  switch (ref.kind) {
    case "scalar":
      return `{ kind: "scalar", type: ${JSON.stringify(ref.type)} }`;
    case "prefix_ref":
      return `{ kind: "prefix_ref", prefixId: ${JSON.stringify(ref.prefixId)} }`;
    case "table_ref":
      return `{ kind: "table_ref", table: ${JSON.stringify(ref.table)} }`;
    case "axis_ref":
      return `{ kind: "axis_ref", axisId: ${JSON.stringify(ref.axisId)} }`;
  }
}

function serializeStringArray(arr: readonly string[]): string {
  if (arr.length === 0) return `[]`;
  // 짧은 배열은 한 줄로
  const joined = arr.map((s) => JSON.stringify(s)).join(", ");
  if (joined.length < 80) return `[${joined}]`;
  // 긴 배열은 여러 줄로
  return `[\n    ${arr.map((s) => JSON.stringify(s)).join(",\n    ")},\n  ]`;
}

function serializeRecord(rec: Record<string, string>, indent: number): string {
  const pad = " ".repeat(indent);
  const entries = Object.entries(rec);
  if (entries.length === 0) return `{}`;
  // 짧은 레코드는 한 줄
  const oneLine = `{ ${entries.map(([k, v]) => `${safeKey(k)}: ${JSON.stringify(v)}`).join(", ")} }`;
  if (oneLine.length < 80) return oneLine;
  // 긴 레코드는 여러 줄
  const lines: string[] = [];
  lines.push(`{`);
  for (const [k, v] of entries) {
    lines.push(`${pad}  ${safeKey(k)}: ${JSON.stringify(v)},`);
  }
  lines.push(`${pad}}`);
  return lines.join("\n");
}

/** 식별자로 사용 가능한 키면 그대로, 아니면 문자열 리터럴로. */
function safeKey(key: string): string {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}
