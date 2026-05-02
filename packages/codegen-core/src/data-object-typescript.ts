/**
 * data-object-typescript.ts — DataObjectBinding → Typed SDK 파일 생성.
 *
 * 순수 함수. I/O 없음. 파일 내용 배열을 반환.
 *
 * 생성 파일:
 *   data-objects.ts       — BoundDataObject 타입 인스턴스 (prefix별)
 *   binding-registry.ts   — 바인딩 레지스트리 초기화 코드
 *   lineage-types.ts      — 스키마 간 계보 유효 타입
 */

import { createHash } from "node:crypto";
import type { DataObjectBinding } from "@qa-sdk/core";
import { toPascal, toConstKey } from "./naming.js";

// ── Types ──────────────────────────────────────────────

export type { DataObjectBinding };

export interface DataObjectCodegenFile {
  readonly path: string;
  readonly content: string;
}

export interface DataObjectCodegenResult {
  readonly files: readonly DataObjectCodegenFile[];
  readonly contentHash: string;
}

export interface DataObjectCodegenOptions {
  /** 생성 파일 접두 경로 */
  outDir?: string;
}

// ── Hash ───────────────────────────────────────────────

function computeBindingsHash(bindings: readonly DataObjectBinding[]): string {
  const parts = bindings
    .map(b => `${b.schemaId}:${b.prefixId}:${b.prefixVersion}:${Object.keys(b.columnToAxis).sort().join(",")}`)
    .sort();
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 12);
}

// ── 생성 ───────────────────────────────────────────────

export function generateDataObjectBindings(
  bindings: readonly DataObjectBinding[],
  options?: DataObjectCodegenOptions,
): DataObjectCodegenResult {
  const prefix = options?.outDir ? `${options.outDir}/` : "";
  const sorted = [...bindings].sort((a, b) => a.schemaId.localeCompare(b.schemaId));
  const ts = new Date().toISOString();

  const files: DataObjectCodegenFile[] = [
    { path: `${prefix}data-objects.ts`, content: generateDataObjectsFile(sorted, ts) },
    { path: `${prefix}binding-registry.ts`, content: generateRegistryFile(sorted, ts) },
    { path: `${prefix}lineage-types.ts`, content: generateLineageTypesFile(sorted, ts) },
  ];

  return { files, contentHash: computeBindingsHash(bindings) };
}

// ── data-objects.ts ────────────────────────────────────

function generateDataObjectsFile(bindings: readonly DataObjectBinding[], ts: string): string {
  const lines: string[] = [
    `// 자동 생성 — ${ts}`,
    `// 수동 수정 금지. 바인딩 변경 시 codegen 재실행.`,
    ``,
    `import type { DataObjectBinding } from "@qa-sdk/core";`,
    ``,
  ];

  for (const b of bindings) {
    const constName = toConstKey(b.schemaId) + "_BINDING";
    const typeName = toPascal(b.schemaId) + "Binding";

    lines.push(`/** ${b.schemaId} → ${b.prefixId}:${b.prefixVersion} 바인딩 */`);
    lines.push(`export const ${constName}: DataObjectBinding = {`);
    lines.push(`  schemaId: "${b.schemaId}",`);
    lines.push(`  schemaVersion: "${b.schemaVersion}",`);
    lines.push(`  prefixId: "${b.prefixId}",`);
    lines.push(`  prefixVersion: "${b.prefixVersion}",`);
    lines.push(`  columnToAxis: {`);
    for (const [col, mapping] of Object.entries(b.columnToAxis).sort((a, b) => a[0].localeCompare(b[0]))) {
      const seg = mapping.segmentId ? `, segmentId: "${mapping.segmentId}"` : "";
      lines.push(`    ${col}: { dimLabel: "${mapping.dimLabel}"${seg} },`);
    }
    lines.push(`  },`);
    lines.push(`};`);
    lines.push(`export type ${typeName} = typeof ${constName};`);
    lines.push(``);
  }

  return lines.join("\n");
}

// ── binding-registry.ts ────────────────────────────────

function generateRegistryFile(bindings: readonly DataObjectBinding[], ts: string): string {
  const lines: string[] = [
    `// 자동 생성 — ${ts}`,
    ``,
    `import { BindingRegistry } from "@qa-sdk/core";`,
  ];

  // import 생성된 바인딩 상수
  const imports = bindings.map(b => toConstKey(b.schemaId) + "_BINDING");
  lines.push(`import { ${imports.join(", ")} } from "./data-objects.js";`);
  lines.push(``);
  lines.push(`/** 모든 바인딩이 등록된 레지스트리 */`);
  lines.push(`export function createBindingRegistry(): BindingRegistry {`);
  lines.push(`  const registry = new BindingRegistry();`);
  for (const name of imports) {
    lines.push(`  registry.register(${name});`);
  }
  lines.push(`  return registry;`);
  lines.push(`}`);
  lines.push(``);

  return lines.join("\n");
}

// ── lineage-types.ts ───────────────────────────────────

function generateLineageTypesFile(bindings: readonly DataObjectBinding[], ts: string): string {
  const lines: string[] = [
    `// 자동 생성 — ${ts}`,
    ``,
    `/** 바인딩된 스키마 ID 유니온 */`,
    `export type BoundSchemaId = ${bindings.map(b => `"${b.schemaId}"`).join(" | ") || "never"};`,
    ``,
    `/** 바인딩된 prefix ID 유니온 */`,
    `export type BoundPrefixId = ${[...new Set(bindings.map(b => b.prefixId))].map(p => `"${p}"`).join(" | ") || "never"};`,
    ``,
    `/** 스키마 → prefix 매핑 타입 */`,
    `export interface SchemaBindingMap {`,
  ];

  for (const b of bindings) {
    lines.push(`  "${b.schemaId}": "${b.prefixId}";`);
  }
  lines.push(`}`);
  lines.push(``);

  // 컬럼 매핑 타입
  for (const b of bindings) {
    const typeName = toPascal(b.schemaId) + "Columns";
    lines.push(`/** ${b.schemaId}의 바인딩된 컬럼 */`);
    lines.push(`export type ${typeName} = ${Object.keys(b.columnToAxis).map(c => `"${c}"`).join(" | ") || "never"};`);
    lines.push(``);
  }

  return lines.join("\n");
}
