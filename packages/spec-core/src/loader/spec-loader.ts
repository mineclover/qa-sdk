/**
 * 파일 시스템에서 spec 정의를 로딩하는 순수 TS 로더.
 *
 * YAML/JSON 파일을 읽어 SpecDocument, PrefixSpec, SchemaDef, SchemaFragment로 변환.
 * NestJS 의존 없음 — CLI, 서버, 테스트에서 동일하게 사용.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import type { SpecDocument } from "../spec/spec.types.js";
import type { PrefixSpec } from "../spec/prefix-spec.types.js";
import type { SchemaDef, SchemaFragment } from "../schema/schema.types.js";
import { SpecError } from "../shared/errors.js";

/** 로딩 결과 */
export interface LoadResult {
  specs: SpecDocument[];
  prefixes: PrefixSpec[];
  schemas: SchemaDef[];
  fragments: SchemaFragment[];
  errors: LoadError[];
}

export interface LoadError {
  file: string;
  message: string;
}

/**
 * 디렉토리에서 모든 spec 파일을 로딩한다.
 *
 * @param dirPath - spec 파일이 있는 디렉토리 경로
 * @returns 로딩 결과 (specs, prefixes, schemas, fragments, errors)
 */
export async function loadSpecs(dirPath: string): Promise<LoadResult> {
  const result: LoadResult = { specs: [], prefixes: [], schemas: [], fragments: [], errors: [] };

  let entries: string[];
  try {
    entries = await readdir(dirPath, { recursive: true }) as unknown as string[];
  } catch {
    result.errors.push({ file: dirPath, message: `Directory not found: ${dirPath}` });
    return result;
  }

  const files = entries.filter(e => isSpecFile(e));

  for (const file of files) {
    const fullPath = join(dirPath, file);
    try {
      const content = await readFile(fullPath, "utf-8");
      const parsed = parseSpecFile(fullPath, content);

      switch (parsed.kind) {
        case "spec":
          result.specs.push(parsed.data);
          break;
        case "prefix":
          result.prefixes.push(parsed.data);
          break;
        case "schema":
          result.schemas.push(parsed.data);
          break;
        case "fragment":
          result.fragments.push(parsed.data);
          break;
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      result.errors.push({ file: fullPath, message });
    }
  }

  return result;
}

/** 파싱 결과 유니온 */
export type ParseResult =
  | { kind: "spec"; data: SpecDocument }
  | { kind: "prefix"; data: PrefixSpec }
  | { kind: "schema"; data: SchemaDef }
  | { kind: "fragment"; data: SchemaFragment };

/**
 * 단일 spec 파일을 파싱한다.
 */
export function parseSpecFile(filePath: string, content: string): ParseResult {
  const ext = extname(filePath).toLowerCase();
  let raw: unknown;

  if (ext === ".json") {
    raw = JSON.parse(content);
  } else if (ext === ".yaml" || ext === ".yml") {
    raw = parseSimpleYaml(content);
  } else {
    throw new SpecError("UNSUPPORTED_FORMAT", `Unsupported file format: ${ext}`);
  }

  if (!raw || typeof raw !== "object") {
    throw new SpecError("INVALID_SPEC", `Invalid spec file: ${filePath}`);
  }

  const obj = raw as Record<string, unknown>;

  // SchemaDef: has "category" + "axes"
  if ("category" in obj && "axes" in obj && "id" in obj) {
    return { kind: "schema", data: validateSchemaDef(obj, filePath) };
  }

  // SchemaFragment: has "axes" but no "category"
  if ("axes" in obj && "id" in obj && !("category" in obj) && !("dims" in obj)) {
    return { kind: "fragment", data: validateSchemaFragment(obj, filePath) };
  }

  // PrefixSpec: has "export" + "dims"
  if ("export" in obj && "dims" in obj) {
    return { kind: "prefix", data: validatePrefixSpec(obj, filePath) };
  }

  // SpecDocument: has "type" + "id"
  if ("type" in obj && "id" in obj) {
    return { kind: "spec", data: validateSpecDocument(obj, filePath) };
  }

  throw new SpecError("UNKNOWN_SPEC_TYPE", `Cannot determine spec type for: ${filePath}`);
}

// ── Validation ──────────────────────────────────────

const SPEC_TYPES = new Set(["req", "feat", "uc", "evt", "ls", "adr"]);
const LIFECYCLES = new Set(["draft", "active", "deprecated"]);
const SCHEMA_CATEGORIES = new Set(["entity", "event", "relation", "state", "policy", "observation"]);

function validateSpecDocument(obj: Record<string, unknown>, filePath: string): SpecDocument {
  const errors: string[] = [];

  if (typeof obj.id !== "string") errors.push("missing or invalid 'id'");
  if (typeof obj.type !== "string" || !SPEC_TYPES.has(obj.type)) {
    errors.push(`invalid 'type': expected one of ${[...SPEC_TYPES].join(", ")}`);
  }
  if (typeof obj.title !== "string") errors.push("missing or invalid 'title'");
  if (typeof obj.lifecycle !== "string" || !LIFECYCLES.has(obj.lifecycle)) {
    errors.push(`invalid 'lifecycle': expected one of ${[...LIFECYCLES].join(", ")}`);
  }

  if (errors.length > 0) {
    throw new SpecError("INVALID_SPEC_DOCUMENT", `Invalid SpecDocument in ${filePath}: ${errors.join("; ")}`);
  }

  return {
    id: obj.id as string,
    type: obj.type as SpecDocument["type"],
    title: obj.title as string,
    lifecycle: obj.lifecycle as SpecDocument["lifecycle"],
    rationale: typeof obj.rationale === "string" ? obj.rationale : undefined,
    relations: Array.isArray(obj.relations) ? obj.relations as SpecDocument["relations"] : undefined,
  };
}

function validatePrefixSpec(obj: Record<string, unknown>, filePath: string): PrefixSpec {
  const errors: string[] = [];

  if (typeof obj.id !== "string") errors.push("missing or invalid 'id'");
  if (typeof obj.version !== "string") errors.push("missing or invalid 'version'");
  if (!obj.dims || typeof obj.dims !== "object") errors.push("missing or invalid 'dims'");
  if (!obj.export || typeof obj.export !== "object") errors.push("missing or invalid 'export'");

  if (errors.length > 0) {
    throw new SpecError("INVALID_PREFIX_SPEC", `Invalid PrefixSpec in ${filePath}: ${errors.join("; ")}`);
  }

  return obj as unknown as PrefixSpec;
}

function validateSchemaDef(obj: Record<string, unknown>, filePath: string): SchemaDef {
  const errors: string[] = [];

  if (typeof obj.id !== "string") errors.push("missing or invalid 'id'");
  if (typeof obj.version !== "string") errors.push("missing or invalid 'version'");
  if (typeof obj.category !== "string" || !SCHEMA_CATEGORIES.has(obj.category)) {
    errors.push(`invalid 'category': expected one of ${[...SCHEMA_CATEGORIES].join(", ")}`);
  }
  if (!obj.axes || typeof obj.axes !== "object") errors.push("missing or invalid 'axes'");

  if (errors.length > 0) {
    throw new SpecError("INVALID_SCHEMA_DEF", `Invalid SchemaDef in ${filePath}: ${errors.join("; ")}`);
  }

  return obj as unknown as SchemaDef;
}

function validateSchemaFragment(obj: Record<string, unknown>, filePath: string): SchemaFragment {
  const errors: string[] = [];

  if (typeof obj.id !== "string") errors.push("missing or invalid 'id'");
  if (!obj.axes || typeof obj.axes !== "object") errors.push("missing or invalid 'axes'");

  if (errors.length > 0) {
    throw new SpecError("INVALID_SCHEMA_FRAGMENT", `Invalid SchemaFragment in ${filePath}: ${errors.join("; ")}`);
  }

  return obj as unknown as SchemaFragment;
}

// ── Helpers ─────────────────────────────────────────

function isSpecFile(filename: string): boolean {
  const ext = extname(filename).toLowerCase();
  return ext === ".json" || ext === ".yaml" || ext === ".yml";
}

/**
 * 최소한의 YAML 파서 — key: value 형태의 flat YAML만 지원.
 * 중첩 구조가 필요하면 JSON을 사용하거나 별도 YAML 파서 의존 추가.
 */
function parseSimpleYaml(content: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let value: string | number | boolean = trimmed.slice(colonIdx + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    } else if (value === "true") {
      result[key] = true; continue;
    } else if (value === "false") {
      result[key] = false; continue;
    } else if (!isNaN(Number(value)) && value !== "") {
      result[key] = Number(value); continue;
    }

    result[key] = value;
  }

  return result;
}
