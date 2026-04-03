/**
 * 파일 시스템에서 spec 정의를 로딩하는 순수 TS 로더.
 *
 * YAML/JSON 파일을 읽어 SpecDocument, PrefixSpec, SchemaDef, SchemaFragment로 변환.
 * NestJS 의존 없음 — CLI, 서버, 테스트에서 동일하게 사용.
 */

import { readdir, readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import type { SpecDocument, SpecRelation } from "../spec/spec.types.js";
import type { PrefixSpec } from "../spec/prefix-spec.types.js";
import type { ExportSurface } from "../export-surface/export-surface.types.js";
import type { SchemaDef, SchemaFragment, SchemaCategory, SchemaConstraint, SchemaAxis } from "spec-schema";
import { SpecError } from "spec-schema";

type JsonScalar = string | number | boolean | null;
type JsonValue = JsonScalar | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}

function isJsonObject(value: unknown): value is JsonObject {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isSpecRelation(value: unknown): value is SpecRelation {
  return isJsonObject(value)
    && typeof value.from === "string"
    && typeof value.to === "string"
    && typeof value.type === "string";
}

function isExportSurface(value: unknown): value is ExportSurface {
  return isJsonObject(value)
    && isStringArray(value.dims)
    && typeof value.pattern === "string";
}

function isSchemaAxes(value: unknown): value is Record<string, SchemaAxis> {
  if (!isJsonObject(value)) return false;
  return Object.values(value).every((axis) =>
    isJsonObject(axis)
    && typeof axis.axisId === "string"
    && typeof axis.required === "boolean"
    && typeof axis.multi === "boolean"
    && typeof axis.valueType === "string",
  );
}

function isSchemaConstraints(value: unknown): value is readonly SchemaConstraint[] {
  return Array.isArray(value)
    && value.every((item) =>
      isJsonObject(item)
      && typeof item.rule === "string"
      && typeof item.axis === "string",
    );
}

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
    entries = await readdir(dirPath, { recursive: true });
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
  let raw: JsonObject;

  if (ext === ".json") {
    const parsed = JSON.parse(content) as unknown;
    if (!isJsonObject(parsed)) {
      throw new SpecError("INVALID_SPEC", `Invalid spec file: ${filePath}`);
    }
    raw = parsed;
  } else if (ext === ".yaml" || ext === ".yml") {
    raw = parseSimpleYaml(content);
  } else {
    throw new SpecError("UNSUPPORTED_FORMAT", `Unsupported file format: ${ext}`);
  }

  const obj = raw;

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

function validateSpecDocument(obj: JsonObject, filePath: string): SpecDocument {
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
    relations: Array.isArray(obj.relations)
      ? obj.relations.reduce<SpecRelation[]>((acc, item) => {
          if (isSpecRelation(item)) acc.push(item);
          return acc;
        }, [])
      : undefined,
  };
}

function validatePrefixSpec(obj: JsonObject, filePath: string): PrefixSpec {
  const errors: string[] = [];

  if (typeof obj.id !== "string") errors.push("missing or invalid 'id'");
  if (typeof obj.version !== "string") errors.push("missing or invalid 'version'");
  if (!obj.dims || typeof obj.dims !== "object") errors.push("missing or invalid 'dims'");
  if (!obj.export || typeof obj.export !== "object") errors.push("missing or invalid 'export'");

  if (errors.length > 0) {
    throw new SpecError("INVALID_PREFIX_SPEC", `Invalid PrefixSpec in ${filePath}: ${errors.join("; ")}`);
  }

  return {
    id: obj.id as string,
    version: obj.version as string,
    dims: obj.dims as PrefixSpec["dims"],
    export: isExportSurface(obj.export)
      ? obj.export
      : { dims: [], pattern: "" },
    imports: isJsonObject(obj.imports) ? obj.imports as PrefixSpec["imports"] : undefined,
    schema: isJsonObject(obj.schema) && typeof obj.schema.category === "string"
      ? {
          category: obj.schema.category as SchemaCategory,
          schemaRef: typeof obj.schema.schemaRef === "string" ? obj.schema.schemaRef : undefined,
        }
      : undefined,
    rationale: typeof obj.rationale === "string" ? obj.rationale : undefined,
    specRef: typeof obj.specRef === "string" ? obj.specRef : undefined,
  };
}

function validateSchemaDef(obj: JsonObject, filePath: string): SchemaDef {
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

  return {
    id: obj.id as string,
    version: obj.version as string,
    category: obj.category as SchemaCategory,
    axes: isSchemaAxes(obj.axes) ? obj.axes : {},
    use: isStringArray(obj.use) ? obj.use : undefined,
    constraints: isSchemaConstraints(obj.constraints) ? obj.constraints : undefined,
  };
}

function validateSchemaFragment(obj: JsonObject, filePath: string): SchemaFragment {
  const errors: string[] = [];

  if (typeof obj.id !== "string") errors.push("missing or invalid 'id'");
  if (!obj.axes || typeof obj.axes !== "object") errors.push("missing or invalid 'axes'");

  if (errors.length > 0) {
    throw new SpecError("INVALID_SCHEMA_FRAGMENT", `Invalid SchemaFragment in ${filePath}: ${errors.join("; ")}`);
  }

  return {
    id: obj.id as string,
    axes: isSchemaAxes(obj.axes) ? obj.axes : {},
  };
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
function parseSimpleYaml(content: string): JsonObject {
  const result: JsonObject = {};
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
