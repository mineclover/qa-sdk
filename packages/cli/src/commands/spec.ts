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
import { decodePrefix, resolveAddress, type DemoCatalog } from "demo-snapshot";

// ── Shared bootstrap ────────────────────────────────

interface SpecContext {
  surfaces: ExportSurfaceRegistry;
  schemas: SchemaRegistry;
  validator: SchemaValidator;
  specDocs: SpecDocumentRegistry;
  prefixSpecs: PrefixSpec[];
  catalogInput?: unknown;
}

/** 싱글턴 캐시 — 같은 옵션이면 재생성하지 않음 */
let cachedContext: SpecContext | null = null;
let cachedKey = "";

/**
 * spec context 초기화.
 * catalogInput이 있으면 catalog bridge, specPath가 있으면 파일 로딩.
 */
export async function createSpecContext(options: {
  catalogInput?: unknown;
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

// ── spec list ───────────────────────────────────────

export async function specList(options: {
  catalogInput?: unknown;
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

// ── spec resolve ────────────────────────────────────

export async function specResolve(options: {
  catalogInput?: unknown;
  specPath?: string;
  prefixId: string;
  values: Record<string, string>;
}): Promise<void> {
  const ctx = await createSpecContext(options);
  const title = ctx.surfaces.resolve(options.prefixId, options.values);
  console.log(title);
}

// ── spec validate ───────────────────────────────────

export async function specValidate(options: {
  catalogInput?: unknown;
  specPath?: string;
  schemaId: string;
  data: Record<string, unknown>;
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

// ── spec decode ─────────────────────────────────────

export async function specDecode(options: {
  catalogInput?: unknown;
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

  // 1단계: decode → positions + values
  let decoded: Record<string, { position: number; value: string | number }>;
  try {
    decoded = decodePrefix(catalog, prefixId, version, address);
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
    const result: Record<string, unknown> = {
      address: `${prefixId}:${version}:${address}`,
      title,
      prefix: prefixId,
      version,
      index: address,
      dims: {} as Record<string, unknown>,
    };

    if (spec) {
      (result as Record<string, unknown>).export = { dims: spec.export.dims, pattern: spec.export.pattern };
    }

    const dims: Record<string, unknown> = {};
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

function buildResolvedJson(
  dims: Record<string, { label: string; position: number; value: string | number; ko?: string; ref?: unknown }>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [label, dim] of Object.entries(dims)) {
    const entry: Record<string, unknown> = { value: dim.value, position: dim.position };
    if (dim.ko) entry.ko = dim.ko;
    if (dim.ref && typeof dim.ref === "object") {
      const ref = dim.ref as { prefix: string; version: string; address: number; dims: typeof dims };
      entry.ref = {
        address: `${ref.prefix}:${ref.version}:${ref.address}`,
        dims: buildResolvedJson(ref.dims),
      };
    }
    result[label] = entry;
  }
  return result;
}

function printResolved(
  dims: Record<string, { label: string; position: number; value: string | number; ko?: string; ref?: unknown }>,
  indent: string,
): void {
  for (const [label, dim] of Object.entries(dims)) {
    const ko = dim.ko ? ` (${dim.ko})` : "";
    console.log(`${indent}${label}: ${dim.value}${ko} [pos:${dim.position}]`);
    if (dim.ref && typeof dim.ref === "object") {
      const ref = dim.ref as { prefix: string; version: string; address: number; dims: typeof dims };
      console.log(`${indent}  → ${ref.prefix}:${ref.version}:${ref.address}`);
      printResolved(ref.dims, indent + "    ");
    }
  }
}

// ── spec trace ──────────────────────────────────────

export async function specTrace(options: {
  catalogInput?: unknown;
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
