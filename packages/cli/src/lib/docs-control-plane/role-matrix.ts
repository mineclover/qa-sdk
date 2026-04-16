import { AUTHORED_LINK_AXIS_MAP, type TraversalAxis } from "./graph-types.js";
import { isArchivedPrdDocument, isTransientSessionDocument } from "./family-scope.js";
import type { DocumentEnvelope, DocumentLink, DocumentMetadata } from "./types.js";

export const DOCUMENT_ROLE_MATRIX_ROLES = [
  "spec",
  "plan",
  "todo",
  "rule",
  "cases",
  "test",
  "memo",
  "knowledge",
  "prd",
  "ralph-prd-json",
] as const;

export type DocumentRoleMatrixRole = (typeof DOCUMENT_ROLE_MATRIX_ROLES)[number];

export type DocumentRoleMatrixRelation = "composition" | "refinement" | "trace";

export interface DocumentRoleMatrixDocument {
  readonly adapterId: string;
  readonly kind: string;
  readonly stableId: string;
  readonly familyId?: string;
  readonly path: string;
  readonly title?: string;
  readonly metadata: DocumentMetadata;
}

export interface DocumentRoleMatrixLinkedDocument extends DocumentRoleMatrixDocument {
  readonly relation: DocumentRoleMatrixRelation;
  readonly linkType: string;
  readonly direction: "out" | "in";
  readonly sourceDocumentId: string;
  readonly sourceDocumentPath: string;
  readonly targetId: string;
  readonly reason: string;
}

export interface DocumentRoleMatrixRoleCoverage {
  readonly role: DocumentRoleMatrixRole;
  readonly present: boolean;
  readonly sameFamilyPresent: boolean;
  readonly linkedPresent: boolean;
  readonly sameFamily: readonly DocumentRoleMatrixDocument[];
  readonly linked: readonly DocumentRoleMatrixLinkedDocument[];
}

export interface DocumentRoleMatrix {
  readonly familyId: string;
  readonly target: DocumentRoleMatrixDocument;
  readonly roles: readonly DocumentRoleMatrixRoleCoverage[];
  readonly missingRoles: readonly DocumentRoleMatrixRole[];
  readonly missingSameFamilyRoles: readonly DocumentRoleMatrixRole[];
  readonly counts: {
    readonly roles: number;
    readonly presentRoles: number;
    readonly sameFamilyPresentRoles: number;
    readonly linkedPresentRoles: number;
    readonly missingRoles: number;
    readonly missingSameFamilyRoles: number;
    readonly sameFamilyDocuments: number;
    readonly linkedDocuments: number;
  };
}

export interface BuildDocumentRoleMatrixOptions {
  readonly target: DocumentEnvelope;
}

export function buildDocumentRoleMatrix(
  documents: readonly DocumentEnvelope[],
  options: BuildDocumentRoleMatrixOptions,
): DocumentRoleMatrix | undefined {
  const familyId = options.target.familyId ?? options.target.stableId;
  if (!familyId) return undefined;

  const activeDocuments = documents.filter(isActiveRoleMatrixDocument);
  const target = isActiveRoleMatrixDocument(options.target)
    ? options.target
    : options.target;
  const sameFamilyDocuments = activeDocuments.filter((document) =>
    document.familyId === familyId && roleOfDocument(document)
  );
  const seedDocuments = uniqueDocuments([
    target,
    ...sameFamilyDocuments,
  ]).filter(isActiveRoleMatrixDocument);

  const sameFamilyByRole = new Map<DocumentRoleMatrixRole, DocumentRoleMatrixDocument[]>();
  for (const document of sameFamilyDocuments) {
    const role = roleOfDocument(document);
    if (!role) continue;
    appendRoleMatrixDocument(sameFamilyByRole, role, toRoleMatrixDocument(document));
  }

  const linkedByRole = new Map<DocumentRoleMatrixRole, DocumentRoleMatrixLinkedDocument[]>();
  for (const linked of collectLinkedRoleDocuments(activeDocuments, seedDocuments, familyId)) {
    appendRoleMatrixDocument(linkedByRole, linked.role, linked.document);
  }

  const roles = DOCUMENT_ROLE_MATRIX_ROLES.map((role) => {
    const sameFamily = (sameFamilyByRole.get(role) ?? []).toSorted(compareRoleMatrixDocuments);
    const linked = (linkedByRole.get(role) ?? []).toSorted(compareLinkedRoleMatrixDocuments);
    return {
      role,
      present: sameFamily.length > 0 || linked.length > 0,
      sameFamilyPresent: sameFamily.length > 0,
      linkedPresent: linked.length > 0,
      sameFamily,
      linked,
    };
  });

  const missingRoles = roles
    .filter((coverage) => !coverage.present)
    .map((coverage) => coverage.role);
  const missingSameFamilyRoles = roles
    .filter((coverage) => !coverage.sameFamilyPresent)
    .map((coverage) => coverage.role);

  return {
    familyId,
    target: toRoleMatrixDocument(options.target),
    roles,
    missingRoles,
    missingSameFamilyRoles,
    counts: {
      roles: roles.length,
      presentRoles: roles.filter((coverage) => coverage.present).length,
      sameFamilyPresentRoles: roles.filter((coverage) => coverage.sameFamilyPresent).length,
      linkedPresentRoles: roles.filter((coverage) => coverage.linkedPresent).length,
      missingRoles: missingRoles.length,
      missingSameFamilyRoles: missingSameFamilyRoles.length,
      sameFamilyDocuments: uniqueRoleMatrixDocumentCount(roles.flatMap((role) => role.sameFamily)),
      linkedDocuments: uniqueRoleMatrixDocumentCount(roles.flatMap((role) => role.linked)),
    },
  };
}

export function roleOfDocument(
  document: DocumentEnvelope,
): DocumentRoleMatrixRole | undefined {
  if (document.metadata.type === "knowledge" || document.kind === "knowledge") {
    return "knowledge";
  }
  if (isDocumentRoleMatrixRole(document.kind)) return document.kind;

  const documentKind = asString(document.metadata.documentKind);
  if (documentKind && isDocumentRoleMatrixRole(documentKind)) return documentKind;

  const pathRole = roleFromPath(document.path);
  return pathRole;
}

function collectLinkedRoleDocuments(
  documents: readonly DocumentEnvelope[],
  seedDocuments: readonly DocumentEnvelope[],
  familyId: string,
): readonly {
  readonly role: DocumentRoleMatrixRole;
  readonly document: DocumentRoleMatrixLinkedDocument;
}[] {
  const seedKeys = new Set(seedDocuments.map(documentKey));
  const seedIdentities = new Set(seedDocuments.flatMap(documentIdentityValues));
  const linked: Array<{
    readonly role: DocumentRoleMatrixRole;
    readonly document: DocumentRoleMatrixLinkedDocument;
  }> = [];

  for (const seed of seedDocuments) {
    for (const link of seed.links) {
      const relation = relationForLink(link);
      if (!relation) continue;
      for (const target of resolveLinkedDocuments(documents, seed, link, relation)) {
        addLinkedRoleDocument(linked, target, {
          relation,
          link,
          direction: "out",
          source: seed,
          reason: `graph:${relation}`,
        }, familyId, seedKeys);
      }
    }
  }

  for (const candidate of documents) {
    if (seedKeys.has(documentKey(candidate))) continue;
    for (const link of candidate.links) {
      const relation = relationForLink(link);
      if (!relation) continue;
      if (!seedIdentities.has(link.targetId) && !seedIdentities.has(normalizePath(link.targetId))) {
        continue;
      }
      addLinkedRoleDocument(linked, candidate, {
        relation,
        link,
        direction: "in",
        source: candidate,
        reason: `graph:${relation}`,
      }, familyId, seedKeys);
    }
  }

  return dedupeLinkedRoleDocuments(linked);
}

function resolveLinkedDocuments(
  documents: readonly DocumentEnvelope[],
  source: DocumentEnvelope,
  link: DocumentLink,
  relation: DocumentRoleMatrixRelation,
): readonly DocumentEnvelope[] {
  if (relation === "trace") {
    const taskOwners = documents.filter((document) =>
      document.tasks.some((task) => task.id === link.targetId)
    );
    if (taskOwners.length > 0) return taskOwners;
  }

  return documents.filter((document) =>
    document !== source &&
    documentIdentityValues(document).includes(link.targetId)
  );
}

function addLinkedRoleDocument(
  linked: Array<{
    readonly role: DocumentRoleMatrixRole;
    readonly document: DocumentRoleMatrixLinkedDocument;
  }>,
  document: DocumentEnvelope,
  context: {
    readonly relation: DocumentRoleMatrixRelation;
    readonly link: DocumentLink;
    readonly direction: "out" | "in";
    readonly source: DocumentEnvelope;
    readonly reason: string;
  },
  familyId: string,
  seedKeys: ReadonlySet<string>,
): void {
  if (document.familyId === familyId) return;
  if (seedKeys.has(documentKey(document))) return;
  const role = roleOfDocument(document);
  if (!role) return;
  linked.push({
    role,
    document: {
      ...toRoleMatrixDocument(document),
      relation: context.relation,
      linkType: context.link.type,
      direction: context.direction,
      sourceDocumentId: context.source.stableId,
      sourceDocumentPath: context.source.path,
      targetId: context.link.targetId,
      reason: context.reason,
    },
  });
}

function relationForLink(link: DocumentLink): DocumentRoleMatrixRelation | undefined {
  const axis = AUTHORED_LINK_AXIS_MAP[link.type as keyof typeof AUTHORED_LINK_AXIS_MAP];
  if (!axis || !isRoleMatrixLinkedAxis(axis)) return undefined;
  return axis;
}

function isRoleMatrixLinkedAxis(axis: TraversalAxis): axis is DocumentRoleMatrixRelation {
  return axis === "composition" || axis === "refinement" || axis === "trace";
}

function isActiveRoleMatrixDocument(document: DocumentEnvelope): boolean {
  if (isTransientSessionDocument(document)) return false;
  if (isArchivedPrdDocument(document)) return false;
  return true;
}

function toRoleMatrixDocument(document: DocumentEnvelope): DocumentRoleMatrixDocument {
  const title = titleOf(document);
  return {
    adapterId: document.adapterId,
    kind: document.kind,
    stableId: document.stableId,
    ...(document.familyId ? { familyId: document.familyId } : {}),
    path: document.path,
    ...(title ? { title } : {}),
    metadata: document.metadata,
  };
}

function appendRoleMatrixDocument<T extends DocumentRoleMatrixDocument>(
  byRole: Map<DocumentRoleMatrixRole, T[]>,
  role: DocumentRoleMatrixRole,
  document: T,
): void {
  const documents = byRole.get(role) ?? [];
  if (!documents.some((candidate) => documentKeyLike(candidate) === documentKeyLike(document))) {
    documents.push(document);
  }
  byRole.set(role, documents);
}

function dedupeLinkedRoleDocuments(
  linked: readonly {
    readonly role: DocumentRoleMatrixRole;
    readonly document: DocumentRoleMatrixLinkedDocument;
  }[],
): readonly {
  readonly role: DocumentRoleMatrixRole;
  readonly document: DocumentRoleMatrixLinkedDocument;
}[] {
  const byKey = new Map<string, {
    readonly role: DocumentRoleMatrixRole;
    readonly document: DocumentRoleMatrixLinkedDocument;
  }>();
  for (const item of linked) {
    const key = [
      item.role,
      documentKeyLike(item.document),
      item.document.relation,
      item.document.linkType,
      item.document.direction,
      item.document.targetId,
    ].join("\0");
    if (!byKey.has(key)) byKey.set(key, item);
  }
  return [...byKey.values()];
}

function roleFromPath(path: string): DocumentRoleMatrixRole | undefined {
  const match = normalizePath(path).match(/\.(spec|plan|todo|rule|cases|test|memo)\.md$/);
  if (!match) return undefined;
  const value = match[1];
  return value && isDocumentRoleMatrixRole(value) ? value : undefined;
}

function isDocumentRoleMatrixRole(value: string): value is DocumentRoleMatrixRole {
  return (DOCUMENT_ROLE_MATRIX_ROLES as readonly string[]).includes(value);
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
    ...document.tasks.map((task) => task.id),
  ]);
}

function titleOf(document: DocumentEnvelope): string | undefined {
  for (const key of ["title", "name", "defId"] as const) {
    const value = asString(document.metadata[key]);
    if (value) return value;
  }
  return undefined;
}

function compareRoleMatrixDocuments(
  left: DocumentRoleMatrixDocument,
  right: DocumentRoleMatrixDocument,
): number {
  return left.path.localeCompare(right.path)
    || left.kind.localeCompare(right.kind)
    || left.stableId.localeCompare(right.stableId);
}

function compareLinkedRoleMatrixDocuments(
  left: DocumentRoleMatrixLinkedDocument,
  right: DocumentRoleMatrixLinkedDocument,
): number {
  return compareRoleMatrixDocuments(left, right)
    || left.relation.localeCompare(right.relation)
    || left.linkType.localeCompare(right.linkType)
    || left.direction.localeCompare(right.direction)
    || left.sourceDocumentId.localeCompare(right.sourceDocumentId)
    || left.targetId.localeCompare(right.targetId);
}

function uniqueDocuments(documents: readonly DocumentEnvelope[]): readonly DocumentEnvelope[] {
  const seen = new Set<string>();
  const uniqueDocs: DocumentEnvelope[] = [];
  for (const document of documents) {
    const key = documentKey(document);
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueDocs.push(document);
  }
  return uniqueDocs;
}

function uniqueRoleMatrixDocumentCount(
  documents: readonly DocumentRoleMatrixDocument[],
): number {
  return new Set(documents.map(documentKeyLike)).size;
}

function documentKey(document: DocumentEnvelope): string {
  return `${document.adapterId}:${document.stableId}:${document.path}`;
}

function documentKeyLike(document: DocumentRoleMatrixDocument): string {
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
