// @def.boundary docs-control-plane
// @def.doc docs-control-plane

/**
 * qa-sdk spec — spec-core CLI 명령어.
 *
 * spec-core를 직접 import하여 NestJS 없이 동작.
 * DI 없이 직접 인스턴스화.
 */

import {
  ExportSurfaceRegistry,
  SchemaRegistry,
  SchemaValidator,
  SpecDocumentRegistry,
  catalogToPrefixSpecs,
  loadSpecs,
  registerPresets,
} from "@qa-sdk/spec-core";
import type { PrefixSpec } from "@qa-sdk/spec-core";
import {
  buildIR,
  generateFromIR,
  generateJSFromIR,
  generateCJSFromIR,
  generateProtoFromIR,
  generateJsonSchemaFromIR,
  generateDtsFromIR,
} from "@qa-sdk/spec-core/codegen";
import type { AxisInput } from "@qa-sdk/spec-core/codegen";
import { resolveAddress, type DemoCatalog } from "demo-snapshot";
import { decodePrefixAsResult, type ResolvedAddress, type ResolvedDimValue } from "@qa-sdk/core";
import { parseArgs } from "node:util";

// ── Shared bootstrap ────────────────────────────────

export type CatalogInputLike = Parameters<typeof catalogToPrefixSpecs>[0];
type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export type SchemaValidationInput = Record<string, JsonValue>;

interface ResolvedRefJson {
  address: string;
  prefix: string;
  version: string;
  dims: Record<string, ResolvedDimJson>;
}

interface ResolvedDimJson {
  value: string | number;
  position: number;
  ko?: string;
  ref?: ResolvedRefJson;
}

interface SpecContext {
  surfaces: ExportSurfaceRegistry;
  schemas: SchemaRegistry;
  validator: SchemaValidator;
  specDocs: SpecDocumentRegistry;
  prefixSpecs: PrefixSpec[];
  catalogInput?: CatalogInputLike;
}

/** 싱글턴 캐시 — 같은 옵션이면 재생성하지 않음 */
let cachedContext: SpecContext | null = null;
let cachedKey = "";

/**
 * spec context 초기화.
 * catalogInput이 있으면 catalog bridge, specPath가 있으면 파일 로딩.
 */
export async function createSpecContext(options: {
  catalogInput?: CatalogInputLike;
  specPath?: string;
}): Promise<SpecContext> {
  const key = JSON.stringify({ catalog: !!options.catalogInput, specPath: options.specPath });
  if (cachedContext && cachedKey === key) return cachedContext;

  const surfaces = new ExportSurfaceRegistry();
  const schemas = new SchemaRegistry();
  registerPresets(schemas);
  const validator = new SchemaValidator(schemas);
  const specDocs = new SpecDocumentRegistry();
  let prefixSpecs: PrefixSpec[] = [];

  // catalog bridge
  if (options.catalogInput) {
    prefixSpecs = catalogToPrefixSpecs(options.catalogInput as Parameters<typeof catalogToPrefixSpecs>[0]);
    for (const spec of prefixSpecs) {
      surfaces.register(spec.id, spec.export);
    }
  }

  // file-based spec loading
  if (options.specPath) {
    const result = await loadSpecs(options.specPath);

    for (const fragment of result.fragments) {
      schemas.registerFragment(fragment);
    }
    for (const schema of result.schemas) {
      schemas.registerSchema(schema);
    }
    for (const doc of result.specs) {
      specDocs.register(doc);
    }
    for (const prefix of result.prefixes) {
      prefixSpecs.push(prefix);
      if (!surfaces.has(prefix.id)) {
        surfaces.register(prefix.id, prefix.export);
      }
    }

    if (result.errors.length > 0) {
      for (const err of result.errors) {
        console.error(`  ⚠ ${err.file}: ${err.message}`);
      }
    }
  }

  cachedContext = { surfaces, schemas, validator, specDocs, prefixSpecs, catalogInput: options.catalogInput };
  cachedKey = key;
  return cachedContext;
}

// ── spec 공통: --catalog / --specs 파싱 ─────────────

const SPEC_BASE_OPTIONS = {
  specs: { type: "string" as const },
  catalog: { type: "boolean" as const, default: false },
};

function isSchemaValidationInput(value: unknown): value is SchemaValidationInput {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

async function loadCatalogInput(): Promise<CatalogInputLike | undefined> {
  try {
    const { DEMO_CATALOG } = await import("demo-snapshot");
    return DEMO_CATALOG;
  } catch {
    console.error("demo-snapshot 패키지를 로딩할 수 없습니다");
    process.exit(1);
  }
}

// ── spec list ───────────────────────────────────────

export async function specList(options: {
  catalogInput?: CatalogInputLike;
  specPath?: string;
}): Promise<void> {
  const ctx = await createSpecContext(options);

  console.log(`\nPrefix Specs (${ctx.prefixSpecs.length}):`);
  for (const spec of ctx.prefixSpecs) {
    const exportDims = spec.export.dims.join(", ");
    const pattern = spec.export.pattern;
    const internal = Object.keys(spec.dims).filter(d => !spec.export.dims.includes(d));
    console.log(`  ${spec.id} (${spec.version})`);
    console.log(`    export: [${exportDims}] → ${pattern}`);
    if (internal.length > 0) {
      console.log(`    internal: [${internal.join(", ")}]`);
    }
    if (spec.imports) {
      const imports = Object.entries(spec.imports).map(([k, v]) => `${k}→${v}`).join(", ");
      console.log(`    imports: ${imports}`);
    }
    if (spec.specRef) {
      console.log(`    specRef: ${spec.specRef}`);
    }
    if (spec.rationale) {
      console.log(`    rationale: ${spec.rationale}`);
    }
  }

  if (ctx.schemas.schemaCount > 0) {
    console.log(`\nSchemas (${ctx.schemas.schemaCount}):`);
    for (const id of ctx.schemas.schemaKeys()) {
      const schema = ctx.schemas.getSchema(id);
      const axisCount = Object.keys(schema.axes).length;
      const fragments = schema.use?.join(", ") ?? "—";
      console.log(`  ${schema.id} [${schema.category}] ${schema.version} (${axisCount} axes, use: ${fragments})`);
    }
  }

  if (ctx.schemas.fragmentCount > 0) {
    console.log(`\nFragments (${ctx.schemas.fragmentCount}):`);
    for (const id of ctx.schemas.fragmentKeys()) {
      const f = ctx.schemas.getFragment(id);
      console.log(`  ${f.id} (${Object.keys(f.axes).join(", ")})`);
    }
  }

  if (ctx.specDocs.size > 0) {
    console.log(`\nSpec Documents (${ctx.specDocs.size}):`);
    for (const id of ctx.specDocs.keys()) {
      const doc = ctx.specDocs.get(id);
      console.log(`  ${doc.id} [${doc.type}] ${doc.title} (${doc.lifecycle})`);
    }
  }
}

export async function runSpecList(argv: string[]): Promise<void> {
  const { values } = parseArgs({ args: argv, options: { ...SPEC_BASE_OPTIONS }, strict: true });
  await specList({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
  });
}

// ── spec resolve ────────────────────────────────────

export async function specResolve(options: {
  catalogInput?: CatalogInputLike;
  specPath?: string;
  prefixId: string;
  values: Record<string, string>;
}): Promise<void> {
  const ctx = await createSpecContext(options);
  const title = ctx.surfaces.resolve(options.prefixId, options.values);
  console.log(title);
}

export async function runSpecResolve(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { ...SPEC_BASE_OPTIONS, prefix: { type: "string" }, values: { type: "string" } },
    strict: true,
  });

  if (!values.prefix || !values.values) {
    console.error("--prefix <id> --values <json> 필수");
    console.error(
      '예: qa-sdk spec resolve --catalog --prefix permission --values \'{"perm_svc":"40","role":"admin"}\'',
    );
    process.exit(1);
  }

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(values.values) as Record<string, string>;
  } catch {
    console.error("--values JSON 파싱 실패");
    process.exit(1);
  }

  await specResolve({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
    prefixId: values.prefix,
    values: parsed,
  });
}

// ── spec validate ───────────────────────────────────

export async function specValidate(options: {
  catalogInput?: CatalogInputLike;
  specPath?: string;
  schemaId: string;
  data: SchemaValidationInput;
}): Promise<void> {
  const ctx = await createSpecContext(options);

  if (!ctx.schemas.hasSchema(options.schemaId)) {
    console.error(`Schema "${options.schemaId}" not found.`);
    console.error(`Available schemas: ${[...ctx.schemas.schemaKeys()].join(", ") || "(none — add schema JSON files to specs dir)"}`);
    process.exitCode = 1;
    return;
  }

  const result = ctx.validator.validate(options.schemaId, options.data);

  if (result.valid) {
    console.log("✓ Valid");
  } else {
    console.log("✗ Invalid:");
    for (const err of result.errors) {
      console.log(`  L${err.layer} [${err.rule}] ${err.axis ?? ""}: ${err.message}`);
    }
    process.exitCode = 1;
  }
}

export async function runSpecValidate(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { ...SPEC_BASE_OPTIONS, schema: { type: "string" }, data: { type: "string" } },
    strict: true,
  });

  if (!values.schema || !values.data) {
    console.error("--schema <id> --data <json> 필수");
    process.exit(1);
  }

  let parsed: SchemaValidationInput;
  try {
    const raw = JSON.parse(values.data) as unknown;
    if (!isSchemaValidationInput(raw)) throw new Error("invalid");
    parsed = raw;
  } catch {
    console.error("--data JSON 파싱 실패");
    process.exit(1);
  }

  await specValidate({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
    schemaId: values.schema,
    data: parsed,
  });
}

// ── spec decode ─────────────────────────────────────

export async function specDecode(options: {
  catalogInput?: CatalogInputLike;
  specPath?: string;
  address: string;   // "prefix:version:address" 형식
  deep?: boolean;
  format?: "text" | "json";
}): Promise<void> {
  const ctx = await createSpecContext(options);

  if (!ctx.catalogInput) {
    console.error("spec decode는 --catalog 옵션이 필요합니다 (DEMO_CATALOG 기반 decode)");
    process.exitCode = 1;
    return;
  }

  // "prefix:version:address" 파싱
  const parts = options.address.split(":");
  if (parts.length !== 3) {
    console.error('주소 형식: "prefix:version:address" (예: permission:v1:42)');
    process.exitCode = 1;
    return;
  }

  const [prefixId, version, addrStr] = parts;
  const address = Number(addrStr);
  if (isNaN(address)) {
    console.error(`유효하지 않은 주소: ${addrStr}`);
    process.exitCode = 1;
    return;
  }

  const catalog = ctx.catalogInput as DemoCatalog;

  // 1단계: decode → DecodeResult (kind 기반 분기)
  let decoded: Record<string, { position: number; value: string | number }>;
  try {
    const result = decodePrefixAsResult(catalog, prefixId, version, address);
    decoded = Object.fromEntries(
      Object.entries(result.dims).map(([k, d]) => [k, { position: d.position, value: d.value }]),
    );
  } catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
    return;
  }

  // 2단계: export title
  let title = "(export surface 미등록)";
  const spec = ctx.prefixSpecs.find(s => s.id === prefixId);
  if (ctx.surfaces.has(prefixId) && spec) {
    const exportValues: Record<string, string> = {};
    for (const dim of spec.export.dims) {
      if (decoded[dim]) exportValues[dim] = String(decoded[dim].value);
    }
    try { title = ctx.surfaces.resolve(prefixId, exportValues); } catch { /* keep fallback */ }
  }

  // 3단계: deep resolve
  let resolved: ReturnType<typeof resolveAddress> | undefined;
  if (options.deep) {
    try { resolved = resolveAddress(catalog, prefixId, version, address); } catch { /* skip */ }
  }

  // ── JSON 출력 ─────────────────────────────────────
  if (options.format === "json") {
    const result: {
      address: string;
      title: string;
      prefix: string;
      version: string;
      index: number;
      dims: Record<string, { value: string | number; position: number }>;
      export?: { dims: readonly string[]; pattern: string };
      resolved?: Record<string, ResolvedDimJson>;
    } = {
      address: `${prefixId}:${version}:${address}`,
      title,
      prefix: prefixId,
      version,
      index: address,
      dims: {},
    };

    if (spec) {
      result.export = { dims: spec.export.dims, pattern: spec.export.pattern };
    }

    const dims: Record<string, { value: string | number; position: number }> = {};
    for (const [label, dim] of Object.entries(decoded)) {
      dims[label] = { value: dim.value, position: dim.position };
    }
    result.dims = dims;

    if (resolved) {
      result.resolved = buildResolvedJson(resolved.dims);
    }

    console.log(JSON.stringify(result, null, 2));
    return;
  }

  // ── Text 출력 (기본) ──────────────────────────────
  console.log(`\n${prefixId}:${version}:${address} = "${title}"`);
  console.log(`\n  Decoded dimensions:`);
  for (const [label, dim] of Object.entries(decoded)) {
    console.log(`    ${label}: ${dim.value} (position: ${dim.position})`);
  }

  if (resolved) {
    console.log(`\n  Deep resolve:`);
    printResolved(resolved.dims, "    ");
  }
}

export async function runSpecDecode(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...SPEC_BASE_OPTIONS,
      address: { type: "string" },
      deep: { type: "boolean", default: false },
      format: { type: "string" },
    },
    strict: true,
  });

  if (!values.address) {
    console.error('--address "prefix:version:address" 필수');
    console.error("예: qa-sdk spec decode --catalog --address permission:v1:3");
    console.error("    qa-sdk spec decode --catalog --address permission:v1:3 --deep");
    process.exit(1);
  }

  await specDecode({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
    address: values.address,
    deep: values.deep,
    format: values.format === "json" ? "json" : "text",
  });
}

function buildResolvedJson(
  dims: Record<string, ResolvedDimValue>,
): Record<string, ResolvedDimJson> {
  const result: Record<string, ResolvedDimJson> = {};
  for (const [label, dim] of Object.entries(dims)) {
    const entry: ResolvedDimJson = { value: dim.value, position: dim.position };
    if (dim.ko) entry.ko = dim.ko;
    if (dim.ref) {
      const ref: ResolvedAddress = dim.ref;
      entry.ref = {
        address: `${ref.prefix}:${ref.version}:${ref.address}`,
        prefix: ref.prefix,
        version: ref.version,
        dims: buildResolvedJson(ref.dims),
      };
    }
    result[label] = entry;
  }
  return result;
}

function printResolved(
  dims: Record<string, ResolvedDimValue>,
  indent: string,
): void {
  for (const [label, dim] of Object.entries(dims)) {
    const ko = dim.ko ? ` (${dim.ko})` : "";
    console.log(`${indent}${label}: ${dim.value}${ko} [pos:${dim.position}]`);
    if (dim.ref) {
      const ref: ResolvedAddress = dim.ref;
      console.log(`${indent}  → ${ref.prefix}:${ref.version}:${ref.address}`);
      printResolved(ref.dims, indent + "    ");
    }
  }
}

// ── spec codegen ────────────────────────────────────

export type CodegenFormat = "ts" | "esm" | "cjs" | "proto" | "json-schema" | "dts";

export async function specCodegen(options: {
  catalogInput?: CatalogInputLike;
  specPath?: string;
  output?: string;
  format?: CodegenFormat;
}): Promise<void> {
  const ctx = await createSpecContext(options);

  if (!ctx.catalogInput) {
    console.error("spec codegen은 --catalog 옵션이 필요합니다");
    process.exitCode = 1;
    return;
  }

  // codegen 전 스키마 검증
  const _validationResult = ctx.validator.validate(
    ctx.prefixSpecs.length > 0 ? `${ctx.prefixSpecs[0].schema?.category ?? "entity"}.base` : "entity.base",
    {},
  );
  // prefix specs 자체 구조 검증 (validator가 등록된 schema가 없으면 skip)
  try {
    for (const spec of ctx.prefixSpecs) {
      if (!spec.schema) continue;
      const schemaId = spec.schema.schemaRef ?? `${spec.schema.category}.base`;
      const result = ctx.validator.validate(schemaId, {});
      if (!result.valid) {
        console.warn(`  ⚠ ${spec.id} 스키마 검증 경고: ${result.errors.length}건`);
        for (const e of result.errors) {
          console.warn(`    L${e.layer} [${e.rule}] ${e.message}`);
        }
      }
    }
  } catch {
    // schema가 등록되지 않은 경우 skip
  }

  const catalog = ctx.catalogInput as DemoCatalog;
  const format = options.format ?? "ts";

  // axis entries 추출
  const axes: AxisInput[] = [];
  const seenAxisIds = new Set<string>();
  const ko: Record<string, Record<string, string>> = {};

  for (const spec of ctx.prefixSpecs) {
    for (const [, dimRef] of Object.entries(spec.dims)) {
      if (dimRef.kind === "axis" && !seenAxisIds.has(dimRef.axisId)) {
        seenAxisIds.add(dimRef.axisId);
        const axis = catalog.axes[dimRef.axisId];
        if (axis) {
          const versionKeys = Object.keys(axis.versions);
          const latestKey = versionKeys[versionKeys.length - 1];
          const snap = axis.versions[latestKey];
          axes.push({ id: axis.id, entries: snap.entries, capacity: snap.capacity });
          if (snap.ko) ko[axis.id] = snap.ko as Record<string, string>;
        }
      }
    }
  }

  // prefix별 버전 목록 추출
  const prefixVersions: Record<string, readonly string[]> = {};
  for (const [prefixId, prefix] of Object.entries(catalog.prefixes)) {
    prefixVersions[prefixId] = prefix.versions.map((v: { version: string }) => v.version);
  }

  // IR 생성 (모든 format의 공통 입력)
  const ir = buildIR({ axes, prefixSpecs: ctx.prefixSpecs, ko, prefixVersions });

  // format별 코드 생성
  let content: string;
  switch (format) {
    case "ts":
      content = generateFromIR(ir);
      break;
    case "esm":
      content = generateJSFromIR(ir, "esm");
      break;
    case "cjs":
      content = generateCJSFromIR(ir);
      break;
    case "proto":
      content = generateProtoFromIR(ir);
      break;
    case "json-schema":
      content = generateJsonSchemaFromIR(ir);
      break;
    case "dts":
      content = generateDtsFromIR(ir);
      break;
    default:
      console.error(`지원하지 않는 format: ${format}`);
      console.error("지원 형식: ts, esm, cjs, proto, json-schema, dts");
      process.exitCode = 1;
      return;
  }

  if (options.output) {
    const { writeFile, mkdir } = await import("node:fs/promises");
    const { dirname } = await import("node:path");
    await mkdir(dirname(options.output), { recursive: true });
    await writeFile(options.output, content, "utf-8");
    console.log(`Generated: ${options.output} (${format})`);
  } else {
    console.log(content);
  }
}

export async function runSpecCodegen(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      ...SPEC_BASE_OPTIONS,
      output: { type: "string" },
      format: { type: "string", default: "ts" },
    },
    strict: true,
  });

  await specCodegen({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
    output: values.output,
    format: values.format as "ts" | "esm" | "cjs" | "proto" | "json-schema",
  });
}

// ── spec trace ──────────────────────────────────────

export async function specTrace(options: {
  catalogInput?: CatalogInputLike;
  specPath?: string;
  specId: string;
}): Promise<void> {
  const ctx = await createSpecContext(options);

  if (!ctx.specDocs.has(options.specId)) {
    console.error(`Spec "${options.specId}" not found.`);
    console.error(`Available specs: ${[...ctx.specDocs.keys()].join(", ") || "(none)"}`);
    process.exitCode = 1;
    return;
  }

  const doc = ctx.specDocs.get(options.specId);
  console.log(`\n${doc.id} [${doc.type}] ${doc.title} (${doc.lifecycle})`);
  if (doc.rationale) {
    console.log(`  rationale: ${doc.rationale}`);
  }

  // prefix가 이 spec을 참조하는지 확인
  const linkedPrefixes = ctx.prefixSpecs.filter(p => p.specRef === options.specId);
  if (linkedPrefixes.length > 0) {
    console.log(`\n  Linked Prefixes:`);
    for (const p of linkedPrefixes) {
      console.log(`    → ${p.id} (${p.version}) export: ${p.export.pattern}`);
    }
  }

  // outgoing relations
  const outgoing = ctx.specDocs.relationsFrom(options.specId);
  if (outgoing.length > 0) {
    console.log(`\n  Outgoing Relations:`);
    for (const rel of outgoing) {
      const target = ctx.specDocs.has(rel.to) ? ctx.specDocs.get(rel.to) : null;
      const targetLabel = target ? `${target.id} [${target.type}] ${target.title}` : rel.to;
      console.log(`    → ${rel.type} → ${targetLabel}`);
    }
  }

  // incoming relations
  const incoming = ctx.specDocs.relationsTo(options.specId);
  if (incoming.length > 0) {
    console.log(`\n  Incoming Relations:`);
    for (const rel of incoming) {
      const source = ctx.specDocs.has(rel.from) ? ctx.specDocs.get(rel.from) : null;
      const sourceLabel = source ? `${source.id} [${source.type}] ${source.title}` : rel.from;
      console.log(`    ← ${rel.type} ← ${sourceLabel}`);
    }
  }

  if (outgoing.length === 0 && incoming.length === 0 && linkedPrefixes.length === 0) {
    console.log("\n  (no relations or linked prefixes)");
  }
}

export async function runSpecTrace(argv: string[]): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: { ...SPEC_BASE_OPTIONS, id: { type: "string" } },
    strict: true,
  });

  if (!values.id) {
    console.error("--id <specId> 필수");
    console.error("예: qa-sdk spec trace --id FEAT-003");
    process.exit(1);
  }

  await specTrace({
    specPath: values.specs,
    catalogInput: values.catalog ? await loadCatalogInput() : undefined,
    specId: values.id,
  });
}
