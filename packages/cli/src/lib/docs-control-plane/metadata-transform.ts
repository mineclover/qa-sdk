// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  extractFrontmatter,
  extractSourceEntriesFromYaml,
  parseDocument,
  parseYaml,
} from "definition-catalog";

import { DEFINITION_MARKDOWN_ADAPTER_ID } from "./adapters/definition-markdown.js";
import type {
  DocumentChange,
  DocumentDiagnostic,
  DocumentEnvelope,
  DocumentMetadata,
} from "doc-envelope";

export interface LoadedMetadataTransformRule {
  readonly source: string;
  readonly rule: Record<string, unknown>;
}

export interface MetadataTransformPreview {
  readonly command: "docs transform metadata";
  readonly mode: "dry-run";
  readonly dryRunDefaulted: boolean;
  readonly applySupported: false;
  readonly ruleSource: string;
  readonly counts: {
    readonly matched: number;
    readonly affected: number;
    readonly changes: number;
    readonly diagnostics: number;
  };
  readonly changeSets: readonly MetadataTransformChangeSet[];
  readonly diagnostics: readonly DocumentDiagnostic[];
}

export interface MetadataTransformChangeSet {
  readonly adapterId: string;
  readonly stableId: string;
  readonly familyId?: string;
  readonly path: string;
  readonly summary: string;
  readonly before: MetadataPreview;
  readonly after: MetadataPreview;
  readonly changes: readonly DocumentChange[];
  readonly diagnostics: readonly DocumentDiagnostic[];
  readonly metadata: DocumentMetadata;
}

export interface MetadataPreview {
  readonly id: string;
  readonly lifecycle?: string;
  readonly level?: string;
  readonly tags: readonly string[];
  readonly links: readonly LinkPreview[];
  readonly svc?: string;
  readonly sources: readonly string[];
}

export interface StructuredDocsError {
  readonly error: {
    readonly code: string;
    readonly operation: string;
    readonly message: string;
    readonly laterPrd?: string;
    readonly remediation: string;
  };
}

interface NormalizedRule {
  readonly selector: MetadataTransformSelector | null;
  readonly set: {
    readonly lifecycle?: string;
    readonly level?: string;
    readonly svc?: string | null;
    readonly sources?: readonly string[];
  };
  readonly tags: AddRemoveStrings;
  readonly links: {
    readonly add: readonly LinkPreview[];
    readonly remove: readonly PartialLinkPreview[];
  };
  readonly sources: AddRemoveStrings & {
    readonly set?: readonly string[];
  };
}

interface MetadataTransformSelector {
  readonly ids?: readonly string[];
  readonly stableIds?: readonly string[];
  readonly defIds?: readonly string[];
  readonly paths?: readonly string[];
  readonly familyIds?: readonly string[];
  readonly kinds?: readonly string[];
  readonly metadata?: Record<string, unknown>;
}

interface AddRemoveStrings {
  readonly add: readonly string[];
  readonly remove: readonly string[];
}

interface LinkPreview {
  readonly target: string;
  readonly type: string;
}

interface PartialLinkPreview {
  readonly target: string;
  readonly type?: string;
}

const VALID_TOP_LEVEL_RULE_KEYS = new Set(["select", "match", "set", "tags", "links", "sources"]);
const VALID_SELECTOR_KEYS = new Set(["ids", "stableIds", "defIds", "paths", "familyIds", "kinds", "metadata"]);
const VALID_SET_KEYS = new Set(["lifecycle", "level", "svc", "sources"]);
const VALID_LIFECYCLES = new Set(["draft", "review", "approved", "deprecated", "archived"]);
const VALID_LEVELS = new Set(["group", "module", "leaf"]);
const VALID_LINK_TYPES = new Set([
  "depends_on",
  "implements",
  "refines",
  "constrains",
  "traces_to",
  "contains",
  "evolves_from",
  "supersedes",
]);
const FORBIDDEN_ID_FIELDS = new Set(["id", "def.id", "defId"]);

export function unsupportedMetadataTransformApplyError(): StructuredDocsError {
  return {
    error: {
      code: "unsupported-operation",
      operation: "docs.transform.metadata.apply",
      message: "`qa-sdk docs transform metadata --apply` is not supported in this PRD.",
      laterPrd: "metadata-transform-apply",
      remediation: "Run the command without --apply to preview the change set. Apply support is deferred to a later apply PRD.",
    },
  };
}

export async function loadMetadataTransformRule(
  rootDir: string,
  rawRule: string,
): Promise<LoadedMetadataTransformRule> {
  const trimmed = rawRule.trim();
  if (!trimmed || trimmed === "true") {
    throw new Error("docs transform metadata requires --rule <json-file|inline-json>");
  }

  if (trimmed.startsWith("{")) {
    return {
      source: "inline-json",
      rule: parseRuleJson(trimmed, "inline-json"),
    };
  }

  const path = trimmed.startsWith("/") ? trimmed : join(rootDir, trimmed);
  if (!existsSync(path)) {
    throw new Error(`metadata transform rule file not found: ${trimmed}`);
  }

  const content = await readFile(path, "utf8");
  return {
    source: trimmed,
    rule: parseRuleJson(content, trimmed),
  };
}

export async function previewMetadataTransform(
  options: {
    readonly rootDir: string;
    readonly documents: readonly DocumentEnvelope[];
    readonly rule: Record<string, unknown>;
    readonly ruleSource: string;
    readonly dryRunDefaulted: boolean;
  },
): Promise<MetadataTransformPreview> {
  const diagnostics: DocumentDiagnostic[] = [];
  const normalized = normalizeRule(options.rule, diagnostics);
  if (!normalized || hasErrorDiagnostic(diagnostics)) {
    return buildPreview(options, [], 0, diagnostics);
  }

  const matched = selectDocuments(options.documents, normalized.selector);
  const changeSets: MetadataTransformChangeSet[] = [];

  for (const document of matched) {
    if (!isDefinitionMarkdown(document)) {
      diagnostics.push(diagnostic({
        code: "metadata-transform-unsupported-source",
        severity: "error",
        message: "metadata transforms only preview definition markdown frontmatter; PRD JSON and other source schemas are refused",
        path: document.path,
        pointer: "metadata-transform.select",
        metadata: {
          adapterId: document.adapterId,
          kind: document.kind,
          stableId: document.stableId,
        },
      }));
      continue;
    }

    const changeSet = await previewDefinitionDocument(options.rootDir, document, normalized);
    if (changeSet.diagnostics.some((item) => item.severity === "error")) {
      diagnostics.push(...changeSet.diagnostics);
      continue;
    }
    if (changeSet.changes.length > 0) changeSets.push(changeSet);
  }

  return buildPreview(options, changeSets, matched.length, diagnostics);
}

function parseRuleJson(content: string, source: string): Record<string, unknown> {
  const parsed = JSON.parse(content) as unknown;
  if (!isRecord(parsed) || Array.isArray(parsed)) {
    throw new Error(`metadata transform rule must be a JSON object: ${source}`);
  }
  return parsed;
}

function normalizeRule(
  raw: Record<string, unknown>,
  diagnostics: DocumentDiagnostic[],
): NormalizedRule | null {
  for (const key of Object.keys(raw)) {
    if (!VALID_TOP_LEVEL_RULE_KEYS.has(key)) {
      diagnostics.push(ruleDiagnostic(
        "metadata-transform-unsupported-field",
        `unsupported metadata transform rule key: ${key}`,
        { key },
      ));
    }
  }

  const selector = normalizeSelector(raw.select ?? raw.match, diagnostics);
  const set = normalizeSet(raw.set, diagnostics);
  const tags = normalizeStringOps(raw.tags, "tags", diagnostics);
  const links = normalizeLinkOps(raw.links, diagnostics);
  const sources = normalizeSources(raw.sources, diagnostics);

  return {
    selector,
    set,
    tags,
    links,
    sources,
  };
}

function normalizeSelector(
  value: unknown,
  diagnostics: DocumentDiagnostic[],
): MetadataTransformSelector | null {
  if (value === undefined) return null;
  if (!isRecord(value)) {
    diagnostics.push(ruleDiagnostic(
      "metadata-transform-invalid-selector",
      "select must be a JSON object",
      {},
    ));
    return null;
  }

  for (const key of Object.keys(value)) {
    if (!VALID_SELECTOR_KEYS.has(key)) {
      diagnostics.push(ruleDiagnostic(
        "metadata-transform-unsupported-selector",
        `unsupported metadata transform selector key: ${key}`,
        { key },
      ));
    }
  }

  const metadata = isRecord(value.metadata) ? value.metadata : undefined;
  if (value.metadata !== undefined && !metadata) {
    diagnostics.push(ruleDiagnostic(
      "metadata-transform-invalid-selector",
      "select.metadata must be a JSON object",
      { key: "metadata" },
    ));
  }

  return {
    ids: optionalStringList(value.ids),
    stableIds: optionalStringList(value.stableIds),
    defIds: optionalStringList(value.defIds),
    paths: optionalStringList(value.paths),
    familyIds: optionalStringList(value.familyIds),
    kinds: optionalStringList(value.kinds),
    ...(metadata ? { metadata } : {}),
  };
}

function normalizeSet(
  value: unknown,
  diagnostics: DocumentDiagnostic[],
): NormalizedRule["set"] {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    diagnostics.push(ruleDiagnostic(
      "metadata-transform-invalid-set",
      "set must be a JSON object",
      {},
    ));
    return {};
  }

  const result: {
    lifecycle?: string;
    level?: string;
    svc?: string | null;
    sources?: readonly string[];
  } = {};

  for (const [key, rawValue] of Object.entries(value)) {
    if (FORBIDDEN_ID_FIELDS.has(key)) {
      diagnostics.push(ruleDiagnostic(
        "metadata-transform-protected-field",
        "metadata transforms must not remove or replace def.id",
        { key },
      ));
      continue;
    }
    if (!VALID_SET_KEYS.has(key)) {
      diagnostics.push(ruleDiagnostic(
        "metadata-transform-unsupported-field",
        `unsupported metadata transform set field: ${key}`,
        { key },
      ));
      continue;
    }

    if (key === "lifecycle") {
      const lifecycle = requiredString(rawValue);
      if (!lifecycle || !VALID_LIFECYCLES.has(lifecycle)) {
        diagnostics.push(ruleDiagnostic(
          "metadata-transform-invalid-value",
          `invalid lifecycle value: ${String(rawValue)}`,
          { key, value: rawValue },
        ));
        continue;
      }
      result.lifecycle = lifecycle;
    }

    if (key === "level") {
      const level = requiredString(rawValue);
      if (!level || !VALID_LEVELS.has(level)) {
        diagnostics.push(ruleDiagnostic(
          "metadata-transform-invalid-value",
          `invalid level value: ${String(rawValue)}`,
          { key, value: rawValue },
        ));
        continue;
      }
      result.level = level;
    }

    if (key === "svc") {
      if (rawValue === null) {
        result.svc = null;
        continue;
      }
      const svc = requiredString(rawValue);
      if (!svc) {
        diagnostics.push(ruleDiagnostic(
          "metadata-transform-invalid-value",
          "svc must be a non-empty string or null",
          { key, value: rawValue },
        ));
        continue;
      }
      result.svc = svc;
    }

    if (key === "sources") {
      const sources = stringList(rawValue);
      if (!sources) {
        diagnostics.push(ruleDiagnostic(
          "metadata-transform-invalid-value",
          "set.sources must be a string array",
          { key },
        ));
        continue;
      }
      result.sources = sources;
    }
  }

  return result;
}

function normalizeStringOps(
  value: unknown,
  field: string,
  diagnostics: DocumentDiagnostic[],
): AddRemoveStrings {
  if (value === undefined) return { add: [], remove: [] };
  if (Array.isArray(value)) return { add: stringList(value) ?? [], remove: [] };
  if (!isRecord(value)) {
    diagnostics.push(ruleDiagnostic(
      "metadata-transform-invalid-value",
      `${field} must be an array or add/remove object`,
      { field },
    ));
    return { add: [], remove: [] };
  }

  return {
    add: stringList(value.add) ?? [],
    remove: stringList(value.remove) ?? [],
  };
}

function normalizeSources(
  value: unknown,
  diagnostics: DocumentDiagnostic[],
): NormalizedRule["sources"] {
  if (value === undefined) return { add: [], remove: [] };
  if (Array.isArray(value)) return { set: stringList(value) ?? [], add: [], remove: [] };
  if (!isRecord(value)) {
    diagnostics.push(ruleDiagnostic(
      "metadata-transform-invalid-value",
      "sources must be an array or set/add/remove object",
      { field: "sources" },
    ));
    return { add: [], remove: [] };
  }

  return {
    ...(value.set !== undefined ? { set: stringList(value.set) ?? [] } : {}),
    add: stringList(value.add) ?? [],
    remove: stringList(value.remove) ?? [],
  };
}

function normalizeLinkOps(
  value: unknown,
  diagnostics: DocumentDiagnostic[],
): NormalizedRule["links"] {
  if (value === undefined) return { add: [], remove: [] };
  if (!isRecord(value)) {
    diagnostics.push(ruleDiagnostic(
      "metadata-transform-invalid-value",
      "links must be an add/remove object",
      { field: "links" },
    ));
    return { add: [], remove: [] };
  }

  return {
    add: linkList(value.add, true, diagnostics),
    remove: partialLinkList(value.remove, diagnostics),
  };
}

function linkList(
  value: unknown,
  requireType: boolean,
  diagnostics: DocumentDiagnostic[],
): readonly LinkPreview[] {
  const items = Array.isArray(value) ? value : value === undefined ? [] : [value];
  const links: LinkPreview[] = [];
  for (const item of items) {
    if (!isRecord(item)) {
      diagnostics.push(ruleDiagnostic(
        "metadata-transform-invalid-link",
        "link transform entries must be objects",
        { item },
      ));
      continue;
    }
    const target = requiredString(item.target);
    const type = requiredString(item.type);
    if (!target || (requireType && !type)) {
      diagnostics.push(ruleDiagnostic(
        "metadata-transform-invalid-link",
        "link add entries require target and type",
        { item },
      ));
      continue;
    }
    if (type && !VALID_LINK_TYPES.has(type)) {
      diagnostics.push(ruleDiagnostic(
        "metadata-transform-invalid-link",
        `invalid link type: ${type}`,
        { item },
      ));
      continue;
    }
    if (target && type) links.push({ target, type });
  }
  return uniqueLinks(links);
}

function partialLinkList(
  value: unknown,
  diagnostics: DocumentDiagnostic[],
): readonly PartialLinkPreview[] {
  const items = Array.isArray(value) ? value : value === undefined ? [] : [value];
  const links: PartialLinkPreview[] = [];
  for (const item of items) {
    if (!isRecord(item)) {
      diagnostics.push(ruleDiagnostic(
        "metadata-transform-invalid-link",
        "link remove entries must be objects",
        { item },
      ));
      continue;
    }
    const target = requiredString(item.target);
    const type = requiredString(item.type);
    if (!target) {
      diagnostics.push(ruleDiagnostic(
        "metadata-transform-invalid-link",
        "link remove entries require target",
        { item },
      ));
      continue;
    }
    if (type && !VALID_LINK_TYPES.has(type)) {
      diagnostics.push(ruleDiagnostic(
        "metadata-transform-invalid-link",
        `invalid link type: ${type}`,
        { item },
      ));
      continue;
    }
    links.push({
      target,
      ...(type ? { type } : {}),
    });
  }
  return links;
}

async function previewDefinitionDocument(
  rootDir: string,
  document: DocumentEnvelope,
  rule: NormalizedRule,
): Promise<MetadataTransformChangeSet> {
  const path = document.path;
  const fullPath = path.startsWith("/") ? path : join(rootDir, path);
  const diagnostics: DocumentDiagnostic[] = [];

  let content = "";
  try {
    content = await readFile(fullPath, "utf8");
  } catch (error) {
    diagnostics.push(diagnostic({
      code: "metadata-transform-read-failed",
      severity: "error",
      message: error instanceof Error ? error.message : String(error),
      path,
      pointer: "frontmatter",
      metadata: {},
    }));
    return emptyChangeSet(document, diagnostics);
  }

  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) {
    diagnostics.push(diagnostic({
      code: "metadata-transform-frontmatter-missing",
      severity: "error",
      message: "definition markdown file has no frontmatter",
      path,
      pointer: "frontmatter",
      metadata: {},
    }));
    return emptyChangeSet(document, diagnostics);
  }

  let parsedDocument;
  try {
    parsedDocument = parseDocument(content, fullPath);
  } catch (error) {
    diagnostics.push(diagnostic({
      code: "metadata-transform-frontmatter-invalid",
      severity: "error",
      message: error instanceof Error ? error.message : String(error),
      path,
      pointer: "frontmatter",
      metadata: {},
    }));
    return emptyChangeSet(document, diagnostics);
  }

  const yamlObject = parseYaml(frontmatter.yaml);
  if (!isRecord(yamlObject.def)) {
    diagnostics.push(diagnostic({
      code: "metadata-transform-def-missing",
      severity: "error",
      message: "definition markdown file has no def frontmatter object",
      path,
      pointer: "frontmatter.def",
      metadata: {},
    }));
    return emptyChangeSet(document, diagnostics);
  }

  const before = metadataPreview(parsedDocument.def, extractSourceEntriesFromYaml(frontmatter.yaml));
  const nextYaml = cloneRecord(yamlObject);
  const nextDef = cloneRecord(yamlObject.def);
  nextYaml.def = nextDef;

  applySet(nextDef, rule.set);
  applyTags(nextDef, rule.tags);
  applyLinks(nextDef, rule.links);
  applySources(nextYaml, before.sources, rule);

  if (!isRecord(nextYaml.def) || typeof nextYaml.def.id !== "string" || !nextYaml.def.id.trim()) {
    diagnostics.push(diagnostic({
      code: "metadata-transform-protected-field",
      severity: "error",
      message: "metadata transforms must not remove def.id",
      path,
      pointer: "frontmatter.def.id",
      metadata: {},
    }));
    return emptyChangeSet(document, diagnostics);
  }

  const projectedYaml = stringifyYaml(nextYaml);
  let projectedDocument;
  try {
    projectedDocument = parseDocument(`---\n${projectedYaml}\n---\n${frontmatter.body}`, fullPath);
  } catch (error) {
    diagnostics.push(diagnostic({
      code: "metadata-transform-projected-frontmatter-invalid",
      severity: "error",
      message: error instanceof Error ? error.message : String(error),
      path,
      pointer: "frontmatter",
      metadata: {},
    }));
    return emptyChangeSet(document, diagnostics);
  }

  const after = metadataPreview(projectedDocument.def, sourceEntriesFromYamlObject(nextYaml));
  const changes = metadataChanges(path, before, after);

  return {
    adapterId: document.adapterId,
    stableId: document.stableId,
    ...(document.familyId ? { familyId: document.familyId } : {}),
    path,
    summary: changes.length === 0
      ? "no metadata changes"
      : `${changes.length} metadata change(s) planned`,
    before,
    after,
    changes,
    diagnostics,
    metadata: {
      dryRun: true,
      sourceSchema: "definition-frontmatter",
      before,
      after,
      projectedFrontmatter: projectedYaml,
    },
  };
}

function applySet(
  def: Record<string, unknown>,
  set: NormalizedRule["set"],
): void {
  if (set.lifecycle !== undefined) def.lifecycle = set.lifecycle;
  if (set.level !== undefined) def.level = set.level;
  if ("svc" in set) {
    if (set.svc === null) delete def.svc;
    else if (set.svc !== undefined) def.svc = set.svc;
  }
}

function applyTags(def: Record<string, unknown>, tags: AddRemoveStrings): void {
  if (tags.add.length === 0 && tags.remove.length === 0) return;
  const current = Array.isArray(def.tags)
    ? def.tags.filter((item): item is string => typeof item === "string")
    : [];
  const removed = current.filter((tag) => !tags.remove.includes(tag));
  const next = uniqueStrings([...removed, ...tags.add]);
  if (next.length > 0) def.tags = next;
  else delete def.tags;
}

function applyLinks(
  def: Record<string, unknown>,
  ops: NormalizedRule["links"],
): void {
  if (ops.add.length === 0 && ops.remove.length === 0) return;
  const current = Array.isArray(def.links)
    ? def.links.flatMap((item): LinkPreview[] => {
      if (!isRecord(item)) return [];
      const target = requiredString(item.target);
      const type = requiredString(item.type);
      return target && type ? [{ target, type }] : [];
    })
    : [];
  const removed = current.filter((link) =>
    !ops.remove.some((item) => item.target === link.target && (!item.type || item.type === link.type))
  );
  const next = uniqueLinks([...removed, ...ops.add]);
  if (next.length > 0) def.links = next.map((link) => ({ target: link.target, type: link.type }));
  else delete def.links;
}

function applySources(
  yamlObject: Record<string, unknown>,
  beforeSources: readonly string[],
  rule: NormalizedRule,
): void {
  const setSources = rule.set.sources ?? rule.sources.set;
  if (
    setSources === undefined
    && rule.sources.add.length === 0
    && rule.sources.remove.length === 0
  ) {
    return;
  }

  const base = setSources !== undefined ? [...setSources] : [...beforeSources];
  const removed = base.filter((source) => !rule.sources.remove.includes(source));
  const next = uniqueStrings([...removed, ...rule.sources.add]);
  delete yamlObject.source;
  delete yamlObject.sources;
  if (next.length === 1) {
    yamlObject.source = next[0];
  } else if (next.length > 1) {
    yamlObject.sources = next;
  }
}

function selectDocuments(
  documents: readonly DocumentEnvelope[],
  selector: MetadataTransformSelector | null,
): readonly DocumentEnvelope[] {
  if (!selector) return documents.filter(isDefinitionMarkdown);
  return documents.filter((document) => matchesSelector(document, selector));
}

function matchesSelector(
  document: DocumentEnvelope,
  selector: MetadataTransformSelector,
): boolean {
  if (selector.ids && !selector.ids.some((id) => documentIdentityValues(document).includes(id))) return false;
  if (selector.stableIds && !selector.stableIds.includes(document.stableId)) return false;
  if (selector.defIds && !selector.defIds.includes(String(document.metadata.defId ?? ""))) return false;
  if (selector.paths && !selector.paths.includes(document.path)) return false;
  if (selector.familyIds && !selector.familyIds.includes(document.familyId ?? "")) return false;
  if (selector.kinds && !selector.kinds.includes(document.kind)) return false;
  if (selector.metadata) {
    for (const [key, expected] of Object.entries(selector.metadata)) {
      const actual = document.metadata[key];
      if (Array.isArray(actual)) {
        if (!actual.map(String).includes(String(expected))) return false;
        continue;
      }
      if (String(actual) !== String(expected)) return false;
    }
  }
  return true;
}

function documentIdentityValues(document: DocumentEnvelope): readonly string[] {
  return [
    document.stableId,
    document.familyId,
    document.path,
    stringValue(document.metadata.defId),
    stringValue(document.metadata.sourcePath),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
}

function isDefinitionMarkdown(document: DocumentEnvelope): boolean {
  return document.adapterId === DEFINITION_MARKDOWN_ADAPTER_ID
    && document.rawSource.sourceSchema === "definition-frontmatter";
}

function metadataPreview(
  def: {
    readonly id: string;
    readonly lifecycle?: string;
    readonly level?: string;
    readonly tags?: readonly string[];
    readonly links?: readonly { readonly target: string; readonly type: string }[];
    readonly svc?: string;
  },
  sources: readonly string[],
): MetadataPreview {
  return {
    id: def.id,
    ...(def.lifecycle ? { lifecycle: def.lifecycle } : {}),
    ...(def.level ? { level: def.level } : {}),
    tags: [...(def.tags ?? [])],
    links: [...(def.links ?? [])].map((link) => ({ target: link.target, type: link.type })),
    ...(def.svc ? { svc: def.svc } : {}),
    sources: [...sources],
  };
}

function sourceEntriesFromYamlObject(yamlObject: Record<string, unknown>): readonly string[] {
  const values: string[] = [];
  const source = stringValue(yamlObject.source);
  if (source) values.push(source);
  if (Array.isArray(yamlObject.sources)) {
    values.push(...yamlObject.sources.filter((item): item is string => typeof item === "string"));
  }
  return uniqueStrings(values);
}

function metadataChanges(
  path: string,
  before: MetadataPreview,
  after: MetadataPreview,
): readonly DocumentChange[] {
  const changes: DocumentChange[] = [];
  for (const field of ["lifecycle", "level", "svc", "tags", "links", "sources"] as const) {
    const beforeValue = before[field];
    const afterValue = after[field];
    if (JSON.stringify(beforeValue) === JSON.stringify(afterValue)) continue;
    changes.push({
      id: `metadata:${field}`,
      description: `${field}: ${formatPreviewValue(beforeValue)} -> ${formatPreviewValue(afterValue)}`,
      rawSource: {
        path,
        pointer: field === "sources" ? "frontmatter.sources" : `frontmatter.def.${field}`,
        sourceSchema: "definition-frontmatter",
        metadata: {},
      },
      metadata: {
        field,
        before: beforeValue ?? null,
        after: afterValue ?? null,
      },
    });
  }
  return changes;
}

function formatPreviewValue(value: unknown): string {
  if (value === undefined) return "(unset)";
  return JSON.stringify(value);
}

function emptyChangeSet(
  document: DocumentEnvelope,
  diagnostics: readonly DocumentDiagnostic[],
): MetadataTransformChangeSet {
  const emptyPreview: MetadataPreview = {
    id: String(document.metadata.defId ?? document.stableId),
    tags: [],
    links: [],
    sources: [],
  };
  return {
    adapterId: document.adapterId,
    stableId: document.stableId,
    ...(document.familyId ? { familyId: document.familyId } : {}),
    path: document.path,
    summary: "metadata transform preview failed",
    before: emptyPreview,
    after: emptyPreview,
    changes: [],
    diagnostics,
    metadata: { dryRun: true },
  };
}

function buildPreview(
  options: {
    readonly ruleSource: string;
    readonly dryRunDefaulted: boolean;
  },
  changeSets: readonly MetadataTransformChangeSet[],
  matched: number,
  diagnostics: readonly DocumentDiagnostic[],
): MetadataTransformPreview {
  return {
    command: "docs transform metadata",
    mode: "dry-run",
    dryRunDefaulted: options.dryRunDefaulted,
    applySupported: false,
    ruleSource: options.ruleSource,
    counts: {
      matched,
      affected: changeSets.length,
      changes: changeSets.reduce((count, changeSet) => count + changeSet.changes.length, 0),
      diagnostics: diagnostics.length + changeSets.reduce((count, changeSet) => count + changeSet.diagnostics.length, 0),
    },
    changeSets,
    diagnostics,
  };
}

function stringifyYaml(value: Record<string, unknown>): string {
  const keys = orderTopLevelKeys(Object.keys(value));
  const lines = keys.flatMap((key) => stringifyKeyValue(key, value[key], 0));
  return lines.join("\n");
}

function stringifyKeyValue(key: string, value: unknown, indent: number): string[] {
  const prefix = " ".repeat(indent);
  if (isScalar(value)) return [`${prefix}${key}: ${formatScalar(value)}`];
  if (Array.isArray(value)) return stringifyArray(key, value, indent);
  if (isRecord(value)) {
    const orderedKeys = key === "def" ? orderDefKeys(Object.keys(value)) : Object.keys(value);
    if (orderedKeys.length === 0) return [`${prefix}${key}: {}`];
    return [
      `${prefix}${key}:`,
      ...orderedKeys.flatMap((childKey) => stringifyKeyValue(childKey, value[childKey], indent + 2)),
    ];
  }
  return [`${prefix}${key}: ${formatScalar(String(value))}`];
}

function stringifyArray(key: string, value: readonly unknown[], indent: number): string[] {
  const prefix = " ".repeat(indent);
  if (value.length === 0) return [`${prefix}${key}: []`];
  if (key === "tags" && value.every(isScalar)) {
    return [`${prefix}${key}: [${value.map(formatScalar).join(", ")}]`];
  }

  const lines = [`${prefix}${key}:`];
  for (const item of value) {
    if (isScalar(item)) {
      lines.push(`${prefix}  - ${formatScalar(item)}`);
      continue;
    }
    if (isRecord(item)) {
      const keys = Object.keys(item);
      if (keys.length === 0) {
        lines.push(`${prefix}  - {}`);
        continue;
      }
      const [firstKey, ...restKeys] = keys;
      lines.push(`${prefix}  - ${firstKey}: ${formatScalarOrNested(item[firstKey])}`);
      for (const childKey of restKeys) {
        lines.push(...stringifyKeyValue(childKey, item[childKey], indent + 4));
      }
      continue;
    }
    lines.push(`${prefix}  - ${formatScalar(String(item))}`);
  }
  return lines;
}

function formatScalarOrNested(value: unknown): string {
  return isScalar(value) ? formatScalar(value) : JSON.stringify(value);
}

function formatScalar(value: string | number | boolean | null): string {
  if (value === null) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (/^[A-Za-z0-9_./:@#-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

function orderTopLevelKeys(keys: readonly string[]): readonly string[] {
  return orderKeys(keys, ["def", "source", "sources", "gate", "tests"]);
}

function orderDefKeys(keys: readonly string[]): readonly string[] {
  return orderKeys(keys, [
    "id",
    "address",
    "version",
    "revision",
    "type",
    "knowledge_kind",
    "level",
    "scope",
    "aspect",
    "depth",
    "lifecycle",
    "layer",
    "svc",
    "tags",
    "links",
  ]);
}

function orderKeys(keys: readonly string[], preferred: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const ordered = preferred.filter((key) => {
    if (!keys.includes(key)) return false;
    seen.add(key);
    return true;
  });
  return [...ordered, ...keys.filter((key) => !seen.has(key))];
}

function ruleDiagnostic(
  code: string,
  message: string,
  metadata: DocumentMetadata,
): DocumentDiagnostic {
  return diagnostic({
    code,
    severity: "error",
    message,
    path: "(rule)",
    pointer: "metadata-transform.rule",
    metadata,
  });
}

function diagnostic(input: {
  readonly code: string;
  readonly severity: string;
  readonly message: string;
  readonly path: string;
  readonly pointer?: string;
  readonly metadata: DocumentMetadata;
}): DocumentDiagnostic {
  return {
    code: input.code,
    severity: input.severity,
    message: input.message,
    rawSource: {
      path: input.path,
      ...(input.pointer ? { pointer: input.pointer } : {}),
      metadata: input.metadata,
    },
    metadata: input.metadata,
  };
}

function hasErrorDiagnostic(diagnostics: readonly DocumentDiagnostic[]): boolean {
  return diagnostics.some((item) => item.severity === "error");
}

function stringList(value: unknown): readonly string[] | null {
  if (!Array.isArray(value)) return null;
  const result = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return uniqueStrings(result);
}

function optionalStringList(value: unknown): readonly string[] | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return [value];
  return stringList(value) ?? undefined;
}

function requiredString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function uniqueLinks(values: readonly LinkPreview[]): readonly LinkPreview[] {
  const seen = new Set<string>();
  const result: LinkPreview[] = [];
  for (const value of values) {
    const key = `${value.target}:${value.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function cloneRecord(value: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(value) as Record<string, unknown>;
}

function isScalar(value: unknown): value is string | number | boolean | null {
  return value === null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
