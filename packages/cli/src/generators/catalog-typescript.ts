/**
 * catalog-typescript.ts — Catalog + DkgConfig → Typed SDK 파일 생성.
 *
 * 순수 함수. I/O 없음. 파일 내용 배열을 반환.
 *
 * 생성 파일:
 *   prefix-ids.ts      — PrefixId, AxisId, TableId 리터럴 유니온
 *   axes.ts            — 축별 const + union type
 *   dims.ts            — prefix별 dimension interface + PrefixDimsMap
 *   dsl.ts             — DSL bundle const (DkgConfig 제공 시)
 *   sdk-factory.ts     — createIndexSDK() 사전 구성
 *   context-types.ts   — QaContext<PrefixId> 타입 alias
 *   index.ts           — barrel export
 */

import { createHash } from "node:crypto";
import type { Catalog, DkgConfig } from "@qa-sdk/core";
import { latestPrefixVersion, encodePrefix, decodePrefix } from "@qa-sdk/core";
import { toPascal, toTsConstKey } from "../lib/naming.js";

// ── Types ──────────────────────────────────────────────

export interface CatalogCodegenFile {
  readonly path: string;
  readonly content: string;
}

export interface CatalogCodegenResult {
  readonly files: readonly CatalogCodegenFile[];
  /** Catalog content hash (SHA-256 hex prefix 12자) */
  readonly contentHash: string;
}

export interface CatalogCodegenOptions {
  /** 특정 prefix version으로 고정. 미지정 시 latest. */
  lockVersion?: string;
}

// ── Hash ───────────────────────────────────────────────

/** Catalog의 구조적 content hash (SHA-256 hex prefix 12자) */
function computeCatalogHash(catalog: Catalog): string {
  // axes entries + capacity, prefix labels + dims 구조를 해시
  const parts: string[] = [catalog.id];
  for (const [id, axis] of Object.entries(catalog.axes).sort((a, b) => a[0].localeCompare(b[0]))) {
    const vkeys = Object.keys(axis.versions).sort();
    for (const vk of vkeys) {
      const snap = axis.versions[vk];
      parts.push(`${id}:${vk}:[${snap.entries.join(",")}]:${snap.capacity ?? snap.entries.length}`);
    }
  }
  for (const [id, prefix] of Object.entries(catalog.prefixes).sort((a, b) => a[0].localeCompare(b[0]))) {
    parts.push(`${id}:${prefix.labels.join(",")}:${prefix.versions.map(v => v.version).join(",")}`);
  }
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 12);
}

/** prefix별 version 맵 구성 */
function buildPrefixVersionMap(catalog: Catalog, lockVersion?: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const prefixId of Object.keys(catalog.prefixes)) {
    map[prefixId] = lockVersion ?? latestPrefixVersion(catalog, prefixId);
  }
  return map;
}

// ── Header ─────────────────────────────────────────────

function header(catalogId: string, contentHash: string): string {
  return [
    `// Generated from Catalog "${catalogId}" (hash: ${contentHash}) at ${new Date().toISOString().slice(0, 19)}`,
    `// !! 자동 생성 파일 — 직접 수정 금지 !!`,
    ``,
  ].join("\n");
}

// ── Main ───────────────────────────────────────────────

export function generateCatalogTypes(
  catalog: Catalog,
  dkgConfig?: DkgConfig,
  options?: CatalogCodegenOptions,
): CatalogCodegenResult {
  const contentHash = computeCatalogHash(catalog);
  const prefixVersions = buildPrefixVersionMap(catalog, options?.lockVersion);
  const files: CatalogCodegenFile[] = [];

  files.push({ path: "prefix-ids.ts", content: genPrefixIds(catalog, contentHash, prefixVersions) });
  files.push({ path: "axes.ts", content: genAxes(catalog, contentHash) });
  files.push({ path: "dims.ts", content: genDims(catalog, contentHash) });
  files.push({ path: "sdk-factory.ts", content: genSdkFactory(catalog, contentHash) });
  files.push({ path: "context-types.ts", content: genContextTypes(catalog, contentHash) });

  if (dkgConfig) {
    files.push({ path: "dsl.ts", content: genDsl(catalog, dkgConfig, contentHash) });
  }

  files.push({ path: "index.ts", content: genBarrel(catalog, !!dkgConfig, contentHash) });

  return { files, contentHash };
}

// ── prefix-ids.ts ──────────────────────────────────────

function genPrefixIds(catalog: Catalog, contentHash: string, prefixVersions: Record<string, string>): string {
  const prefixIds = Object.keys(catalog.prefixes).sort();
  const axisIds = Object.keys(catalog.axes).sort();
  const tableIds = Object.keys(catalog.tables ?? {}).sort();

  const lines = [header(catalog.id, contentHash)];

  // PrefixId
  lines.push(`/** Catalog prefix 이름 리터럴 유니온 (${prefixIds.length}개) */`);
  lines.push(`export type PrefixId =`);
  for (let i = 0; i < prefixIds.length; i++) {
    const sep = i < prefixIds.length - 1 ? "" : ";";
    lines.push(`  | "${prefixIds[i]}"${sep}`);
  }
  lines.push(``);
  lines.push(`export const PREFIX_IDS = [${prefixIds.map(id => `"${id}"`).join(", ")}] as const;`);
  lines.push(``);

  // AxisId
  lines.push(`/** Catalog axis 이름 리터럴 유니온 (${axisIds.length}개) */`);
  lines.push(`export type AxisId =`);
  for (let i = 0; i < axisIds.length; i++) {
    const sep = i < axisIds.length - 1 ? "" : ";";
    lines.push(`  | "${axisIds[i]}"${sep}`);
  }
  lines.push(``);
  lines.push(`export const AXIS_IDS = [${axisIds.map(id => `"${id}"`).join(", ")}] as const;`);

  // TableId (있으면)
  if (tableIds.length > 0) {
    lines.push(``);
    lines.push(`/** Catalog table 이름 리터럴 유니온 (${tableIds.length}개) */`);
    lines.push(`export type TableId =`);
    for (let i = 0; i < tableIds.length; i++) {
      const sep = i < tableIds.length - 1 ? "" : ";";
      lines.push(`  | "${tableIds[i]}"${sep}`);
    }
    lines.push(``);
    lines.push(`export const TABLE_IDS = [${tableIds.map(id => `"${id}"`).join(", ")}] as const;`);
  }

  // VERSION_META — 빌드 시점 version 정보
  lines.push(``);
  lines.push(`/** 빌드 시점 version 메타데이터 */`);
  lines.push(`export const VERSION_META = {`);
  lines.push(`  /** Catalog ID */`);
  lines.push(`  catalogId: "${catalog.id}" as const,`);
  lines.push(`  /** Catalog 구조 content hash (SHA-256 prefix 12자) */`);
  lines.push(`  contentHash: "${contentHash}" as const,`);
  lines.push(`  /** 생성 시각 (ISO 8601) */`);
  lines.push(`  generatedAt: "${new Date().toISOString()}" as const,`);
  lines.push(`  /** prefix별 version (생성 시점 기준) */`);
  lines.push(`  prefixVersions: {`);
  for (const [prefixId, version] of Object.entries(prefixVersions).sort((a, b) => a[0].localeCompare(b[0]))) {
    lines.push(`    "${prefixId}": "${version}",`);
  }
  lines.push(`  } as const,`);
  lines.push(`} as const;`);
  lines.push(``);
  lines.push(`/** GENERATION — 빌드 시점 version 식별자. SDK 부트 시 전달. */`);
  lines.push(`export const GENERATION = "${catalog.id}:${contentHash}" as const;`);

  lines.push(``);
  return lines.join("\n");
}

// ── axes.ts ────────────────────────────────────────────

function genAxes(catalog: Catalog, contentHash: string): string {
  const lines = [header(catalog.id, contentHash)];

  for (const [axisId, axis] of Object.entries(catalog.axes).sort((a, b) => a[0].localeCompare(b[0]))) {
    const versionKeys = Object.keys(axis.versions);
    const latestKey = versionKeys[versionKeys.length - 1];
    const latest = axis.versions[latestKey];
    if (!latest) continue;

    const constName = axisId.toUpperCase();
    const pascalName = toPascal(axisId);
    const entries = latest.entries ?? [];
    const capacity = latest.capacity ?? entries.length;

    lines.push(`/** ${axisId} — ${axis.name} (entries: ${entries.length}, capacity: ${capacity}) */`);
    lines.push(`export const ${constName} = {`);
    for (const entry of entries) {
      lines.push(`  ${toTsConstKey(entry)}: "${entry}",`);
    }
    lines.push(`} as const;`);

    if (entries.length > 0) {
      lines.push(`export type ${pascalName} = typeof ${constName}[keyof typeof ${constName}];`);
    } else {
      lines.push(`export type ${pascalName} = string;`);
    }
    lines.push(``);
  }

  return lines.join("\n");
}

// ── dims.ts ────────────────────────────────────────────

function genDims(catalog: Catalog, contentHash: string): string {
  const lines = [header(catalog.id, contentHash)];

  lines.push(`import type * as Axes from "./axes.js";`);
  lines.push(``);

  const prefixEntries = Object.entries(catalog.prefixes).sort((a, b) => a[0].localeCompare(b[0]));
  const dimInterfaces: string[] = [];

  for (const [prefixId, prefix] of prefixEntries) {
    const pascalName = toPascal(prefixId);
    const interfaceName = `${pascalName}Dims`;
    dimInterfaces.push(`  ${prefixId}: ${interfaceName};`);

    lines.push(`/** ${prefixId} — ${prefix.name} */`);
    lines.push(`export interface ${interfaceName} {`);

    for (const label of prefix.labels) {
      const dim = prefix.dims[label];
      if (!dim) continue;

      if (dim.kind === "axis") {
        const axisId = dim.axisId;
        const axis = catalog.axes[axisId];
        const versionKeys = Object.keys(axis?.versions ?? {});
        const latestKey = versionKeys[versionKeys.length - 1];
        const latest = axis?.versions[latestKey];
        const hasEntries = (latest?.entries?.length ?? 0) > 0;

        if (hasEntries) {
          lines.push(`  ${label}: Axes.${toPascal(axisId)};`);
        } else {
          lines.push(`  ${label}: string;`);
        }
      } else if (dim.kind === "prefix_ref") {
        lines.push(`  /** prefix_ref → ${dim.prefixId} */`);
        lines.push(`  ${label}: number;`);
      } else if (dim.kind === "table_ref") {
        lines.push(`  /** table_ref → ${dim.table} */`);
        lines.push(`  ${label}: number;`);
      }
    }

    lines.push(`}`);
    lines.push(``);
  }

  // PrefixDimsMap
  lines.push(`/** prefix → dims 매핑 타입 */`);
  lines.push(`export interface PrefixDimsMap {`);
  for (const entry of dimInterfaces) {
    lines.push(entry);
  }
  lines.push(`}`);
  lines.push(``);

  return lines.join("\n");
}

// ── dsl.ts ─────────────────────────────────────────────

function genDsl(_catalog: Catalog, dkgConfig: DkgConfig, contentHash: string): string {
  const lines = [header(_catalog.id, contentHash)];

  // DSL bundles
  for (const dsl of dkgConfig.dslBundles) {
    const constName = dsl.id.toUpperCase().replace(/-/g, "_");
    lines.push(`/** ${dsl.name} — ${dsl.description ?? ""} */`);
    lines.push(`export const ${constName} = {`);
    lines.push(`  id: "${dsl.id}" as const,`);
    lines.push(`  members: [${dsl.memberPrefixes.map(m => `"${m}"`).join(", ")}] as const,`);
    if (dsl.serviceBindingPrefix) {
      lines.push(`  serviceBindingPrefix: "${dsl.serviceBindingPrefix}" as const,`);
    }
    lines.push(`  fixedDims: [${dsl.fixedDims.map(d => `"${d}"`).join(", ")}] as const,`);
    if (dsl.invariants && dsl.invariants.length > 0) {
      lines.push(`  invariants: [`);
      for (const inv of dsl.invariants) {
        lines.push(`    "${inv.replace(/"/g, '\\"')}",`);
      }
      lines.push(`  ] as const,`);
    }
    lines.push(`} as const;`);
    lines.push(``);
  }

  // DslId union
  const dslIds = dkgConfig.dslBundles.map(d => d.id);
  lines.push(`/** DSL bundle ID 리터럴 유니온 (${dslIds.length}개) */`);
  lines.push(`export type DslId =`);
  for (let i = 0; i < dslIds.length; i++) {
    const sep = i < dslIds.length - 1 ? "" : ";";
    lines.push(`  | "${dslIds[i]}"${sep}`);
  }
  lines.push(``);
  lines.push(`export const DSL_IDS = [${dslIds.map(id => `"${id}"`).join(", ")}] as const;`);

  // Constraint IDs
  if (dkgConfig.constraints.length > 0) {
    lines.push(``);
    const conIds = dkgConfig.constraints.map(c => c.id);
    lines.push(`/** Constraint ID 리터럴 유니온 */`);
    lines.push(`export type ConstraintId =`);
    for (let i = 0; i < conIds.length; i++) {
      const sep = i < conIds.length - 1 ? "" : ";";
      lines.push(`  | "${conIds[i]}"${sep}`);
    }
    lines.push(``);
  }

  // Domain IDs
  if (dkgConfig.domains.length > 0) {
    const domIds = dkgConfig.domains.map(d => d.id);
    lines.push(`/** Domain ID 리터럴 유니온 */`);
    lines.push(`export type DomainId =`);
    for (let i = 0; i < domIds.length; i++) {
      const sep = i < domIds.length - 1 ? "" : ";";
      lines.push(`  | "${domIds[i]}"${sep}`);
    }
    lines.push(``);
  }

  lines.push(``);
  return lines.join("\n");
}

// ── sdk-factory.ts ─────────────────────────────────────

function genSdkFactory(catalog: Catalog, contentHash: string): string {
  const lines = [header(catalog.id, contentHash)];

  lines.push(`import { createIndexSDK } from "@qa-sdk/codec";`);
  lines.push(``);

  // SdkSchema 구성 — axis dims만 포함 (createIndexSDK 호환)
  lines.push(`const SCHEMA = {`);
  lines.push(`  axes: {`);

  // axis dims만 수집 (prefix에서 사용되는 축만)
  const usedAxes = new Set<string>();
  for (const prefix of Object.values(catalog.prefixes)) {
    for (const dim of Object.values(prefix.dims)) {
      if (dim.kind === "axis") usedAxes.add(dim.axisId);
    }
  }

  for (const axisId of [...usedAxes].sort()) {
    const axis = catalog.axes[axisId];
    if (!axis) continue;
    const versionKeys = Object.keys(axis.versions);
    const latestKey = versionKeys[versionKeys.length - 1];
    const latest = axis.versions[latestKey];
    if (!latest) continue;

    const entries = latest.entries ?? [];
    const capacity = latest.capacity ?? entries.length;

    lines.push(`    ${axisId}: {`);
    lines.push(`      entries: [${entries.map(e => `"${e}"`).join(", ")}],`);
    if (capacity > entries.length) {
      lines.push(`      capacity: ${capacity},`);
    }
    lines.push(`    },`);
  }

  lines.push(`  },`);
  lines.push(`  prefixes: {`);

  // prefix — axis dims만 포함
  for (const [prefixId, prefix] of Object.entries(catalog.prefixes).sort((a, b) => a[0].localeCompare(b[0]))) {
    const axisDims = prefix.labels.filter(l => prefix.dims[l]?.kind === "axis");
    if (axisDims.length === 0) continue;

    lines.push(`    ${prefixId}: { dims: [${axisDims.map(d => `"${d}"`).join(", ")}] },`);
  }

  lines.push(`  },`);
  lines.push(`} as const;`);
  lines.push(``);
  lines.push(`/** Catalog "${catalog.id}" 기반 타입 안전 SDK */`);
  lines.push(`export const sdk = createIndexSDK(SCHEMA);`);
  lines.push(``);

  // SNAPSHOT_SUPPLY — prefix별 스냅샷 전략
  lines.push(`/** prefix별 snapshot supply 전략 */`);
  lines.push(`export const SNAPSHOT_SUPPLY = {`);
  for (const [prefixId, prefix] of Object.entries(catalog.prefixes).sort((a, b) => a[0].localeCompare(b[0]))) {
    const hasPrefixRef = Object.values(prefix.dims).some(d => d.kind === "prefix_ref");
    const strategy = hasPrefixRef ? "envelope" : "implicit";
    lines.push(`  "${prefixId}": "${strategy}" as const,`);
  }
  lines.push(`} as const;`);
  lines.push(``);

  return lines.join("\n");
}

// ── context-types.ts ───────────────────────────────────

function genContextTypes(catalog: Catalog, contentHash: string): string {
  const lines = [header(catalog.id, contentHash)];

  lines.push(`import type { QaContext } from "@qa-sdk/context";`);
  lines.push(`import type { PrefixId } from "./prefix-ids.js";`);
  lines.push(``);
  lines.push(`/** Catalog "${catalog.id}" 기반 타입 안전 QaContext. prefix 자동완성 제공. */`);
  lines.push(`export type TypedQaContext = QaContext<PrefixId>;`);
  lines.push(``);

  return lines.join("\n");
}

// ── Migration Test ─────────────────────────────────────

export interface MigrationTestResult {
  readonly prefixId: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly totalCoords: number;
  readonly passed: number;
  readonly failed: number;
  readonly errors: readonly { coord: Record<string, number>; error: string }[];
}

/**
 * prefix의 multi-version 라운드트립 검증.
 * encode(fromVersion, coord) → decode(toVersion, address) 일치 확인.
 */
export function testMigration(
  catalog: Catalog,
  prefixId: string,
  fromVersion: string,
  toVersion: string,
  maxSamples = 100,
): MigrationTestResult {
  // encodePrefix, decodePrefix는 top-level import
  const prefix = catalog.prefixes[prefixId];
  if (!prefix) throw new Error(`Unknown prefix: ${prefixId}`);

  const fromDef = prefix.versions.find(v => v.version === fromVersion);
  const toDef = prefix.versions.find(v => v.version === toVersion);
  if (!fromDef) throw new Error(`Version ${fromVersion} not found for ${prefixId}`);
  if (!toDef) throw new Error(`Version ${toVersion} not found for ${prefixId}`);

  // from version의 shape 계산
  const fromShape: number[] = [];
  for (const label of prefix.labels) {
    const dim = prefix.dims[label];
    if (dim.kind === "axis") {
      const axisVer = fromDef.axisVersions[label];
      const axis = catalog.axes[dim.axisId];
      const snap = axis?.versions[axisVer];
      fromShape.push(snap?.capacity ?? snap?.entries?.length ?? 1);
    } else {
      // prefix_ref/table_ref: refEntries 크기 또는 1
      const refEntries = fromDef.refEntries?.[label];
      fromShape.push(refEntries?.values?.length ?? 1);
    }
  }

  // 좌표 샘플링 (전수 또는 random)
  const totalCapacity = fromShape.reduce((a, b) => a * b, 1);
  const sampleCount = Math.min(totalCapacity, maxSamples);
  const errors: { coord: Record<string, number>; error: string }[] = [];
  let passed = 0;

  for (let i = 0; i < sampleCount; i++) {
    const address = sampleCount === totalCapacity ? i : Math.floor(Math.random() * totalCapacity);
    try {
      // decode from old version
      const decoded = decodePrefix(catalog, prefixId, fromVersion, address);
      const values: Record<string, number> = {};
      for (const [k, v] of Object.entries(decoded)) values[k] = v.position;

      // re-encode with new version
      const reEncoded = encodePrefix(catalog, prefixId, toVersion, values);

      // decode from new version
      const reDecoded = decodePrefix(catalog, prefixId, toVersion, reEncoded);

      // 값 비교
      let match = true;
      for (const [k, v] of Object.entries(decoded)) {
        if (reDecoded[k]?.value !== v.value) {
          match = false;
          break;
        }
      }

      if (match) passed++;
      else errors.push({ coord: values, error: "value mismatch after re-encode" });
    } catch (e) {
      errors.push({ coord: { address }, error: (e as Error).message });
    }
  }

  return { prefixId, fromVersion, toVersion, totalCoords: sampleCount, passed, failed: errors.length, errors };
}

// ── index.ts (barrel) ──────────────────────────────────

function genBarrel(_catalog: Catalog, hasDkg: boolean, contentHash: string): string {
  const lines = [header(_catalog.id, contentHash)];

  lines.push(`export * from "./prefix-ids.js";`);
  lines.push(`export * from "./axes.js";`);
  lines.push(`export * from "./dims.js";`);
  lines.push(`export { sdk } from "./sdk-factory.js";`);
  lines.push(`export type { TypedQaContext } from "./context-types.js";`);

  if (hasDkg) {
    lines.push(`export * from "./dsl.js";`);
  }

  lines.push(``);
  return lines.join("\n");
}
