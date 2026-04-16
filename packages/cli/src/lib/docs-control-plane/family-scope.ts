import type { DocumentEnvelope } from "./types.js";

export interface DocumentFamilyOnlyScopeOptions {
  readonly target: DocumentEnvelope;
  readonly includeSession?: boolean;
}

export interface DocumentFamilyOnlyScope {
  readonly documents: readonly DocumentEnvelope[];
  readonly reasonByDocumentKey: ReadonlyMap<string, string>;
}

const FAMILY_ONLY_ROLE_KINDS = new Set([
  "spec",
  "todo",
  "plan",
  "rule",
  "test",
  "memo",
  "knowledge",
  "prd",
  "ralph-prd-json",
]);

export function collectDocumentFamilyOnlyScope(
  documents: readonly DocumentEnvelope[],
  options: DocumentFamilyOnlyScopeOptions,
): DocumentFamilyOnlyScope {
  const selected = new Map<string, DocumentEnvelope>();
  const reasonByDocumentKey = new Map<string, string>();
  const target = options.target;

  addFamilyScopedDocument(selected, reasonByDocumentKey, target, "target");

  if (target.familyId) {
    for (const document of documents) {
      if (document.familyId !== target.familyId) continue;
      if (!isFamilyOnlyRoleDocument(document, options.includeSession === true)) continue;
      if (!isActiveFamilyOnlyDocument(document, options)) continue;
      addFamilyScopedDocument(
        selected,
        reasonByDocumentKey,
        document,
        document.kind === "ralph-session" ? "family-only:session" : "family-only:role",
      );
    }
  }

  if (target.metadata.level === "module") {
    for (const link of target.links) {
      if (link.type !== "contains") continue;
      const contained = resolveDocumentReference(documents, link.targetId);
      if (!contained) continue;
      if (!isDirectContainedModuleOrLeaf(contained)) continue;
      if (!isActiveFamilyOnlyDocument(contained, options)) continue;
      addFamilyScopedDocument(selected, reasonByDocumentKey, contained, "family-only:contains");
    }
  }

  return {
    documents: [...selected.values()].toSorted(compareDocuments),
    reasonByDocumentKey,
  };
}

export function isArchivedPrdDocument(document: DocumentEnvelope): boolean {
  if (document.kind !== "prd" && document.kind !== "ralph-prd-json") return false;
  if (document.metadata.lifecycle === "archived") return true;
  return normalizePath(document.path).split("/").includes("archive");
}

export function isTransientSessionDocument(document: DocumentEnvelope): boolean {
  return document.kind === "ralph-session"
    || normalizePath(document.path).startsWith(".ralph-tui/");
}

function isFamilyOnlyRoleDocument(
  document: DocumentEnvelope,
  includeSession: boolean,
): boolean {
  if (document.metadata.type === "knowledge") return true;
  if (FAMILY_ONLY_ROLE_KINDS.has(document.kind)) return true;
  return includeSession && isTransientSessionDocument(document);
}

function isDirectContainedModuleOrLeaf(document: DocumentEnvelope): boolean {
  return document.metadata.level === "module" || document.metadata.level === "leaf";
}

function isActiveFamilyOnlyDocument(
  document: DocumentEnvelope,
  options: DocumentFamilyOnlyScopeOptions,
): boolean {
  if (document === options.target) return true;
  if (isArchivedPrdDocument(document)) return false;
  if (isTransientSessionDocument(document)) return options.includeSession === true;
  return true;
}

function addFamilyScopedDocument(
  selected: Map<string, DocumentEnvelope>,
  reasonByDocumentKey: Map<string, string>,
  document: DocumentEnvelope,
  reason: string,
): void {
  const key = documentKey(document);
  selected.set(key, document);
  if (!reasonByDocumentKey.has(key) || reason === "target") {
    reasonByDocumentKey.set(key, reason);
  }
}

function resolveDocumentReference(
  documents: readonly DocumentEnvelope[],
  targetId: string,
): DocumentEnvelope | undefined {
  const normalizedTarget = normalizePath(targetId);
  return documents.find((document) =>
    documentIdentityValues(document).includes(targetId)
    || documentIdentityValues(document).includes(normalizedTarget)
  );
}

function documentIdentityValues(document: DocumentEnvelope): readonly string[] {
  return unique([
    document.stableId,
    document.familyId,
    document.path,
    normalizePath(document.path),
    asString(document.metadata.defId),
    asString(document.metadata.title),
    asString(document.metadata.name),
    asString(document.metadata.sourcePath),
    asString(document.metadata.outputPath),
  ]);
}

function compareDocuments(left: DocumentEnvelope, right: DocumentEnvelope): number {
  return left.path.localeCompare(right.path)
    || left.kind.localeCompare(right.kind)
    || left.stableId.localeCompare(right.stableId);
}

function documentKey(document: DocumentEnvelope): string {
  return `${document.adapterId}:${document.stableId}:${document.path}`;
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+/g, "/");
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function unique(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}
