// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import { readFile } from "node:fs/promises";
import { basename, isAbsolute, relative, resolve } from "node:path";

import type {
  DocumentDiagnostic,
  DocumentEnvelope,
  DocumentMetadata,
  DocumentTask,
} from "doc-envelope";
import {
  collectDocumentFamilyOnlyScope,
  isArchivedPrdDocument,
} from "doc-envelope";
import { buildDocumentGraphIndex } from "./graph-index.js";
import { collectDocumentGraphTraversalDocuments } from "./graph-scope.js";
import {
  traverseDocumentGraph,
  type DocumentGraphTraversalResult,
} from "./graph-traverse.js";
import {
  buildDocumentRoleMatrix,
  type DocumentRoleMatrixDocument,
  type DocumentRoleMatrixLinkedDocument,
} from "./role-matrix.js";

export interface PrdCompletionSyncOptions {
  readonly rootDir: string;
  readonly documents: readonly DocumentEnvelope[];
  readonly prdPath: string;
  readonly dryRunDefaulted: boolean;
  readonly familyOnly?: boolean;
  readonly includeTransient?: boolean;
}

export interface PrdCompletionStorySummary {
  readonly id: string;
  readonly title: string;
  readonly notes?: string;
  readonly completionNotes?: string;
  readonly acceptanceCriteria: readonly string[];
  readonly evidenceRefs: readonly string[];
}

export interface PrdCompletionAffectedDocument {
  readonly kind: string;
  readonly stableId: string;
  readonly path: string;
  readonly title?: string;
  readonly reason: string;
  readonly metadata: DocumentMetadata;
}

export interface PrdCompletionEvidenceRef {
  readonly kind: "source" | "test" | "evidence";
  readonly id: string;
  readonly path?: string;
  readonly summary?: string;
}

export type PrdCompletionPromotionState = "eligible" | "blocked";

export interface PrdCompletionOpenTodoCandidate {
  readonly documentId: string;
  readonly path: string;
  readonly pointer: string;
  readonly text: string;
  readonly matchedStoryIds: readonly string[];
  readonly promotionState: PrdCompletionPromotionState;
  readonly reason: string;
  readonly evidence: readonly PrdCompletionEvidenceRef[];
}

export interface PrdCompletionSpecUpdateCandidate {
  readonly documentId: string;
  readonly path: string;
  readonly title?: string;
  readonly matchedStoryIds: readonly string[];
  readonly promotionState: PrdCompletionPromotionState;
  readonly reason: string;
  readonly evidence: readonly PrdCompletionEvidenceRef[];
}

export interface PrdCompletionRoadmapUpdateCandidate {
  readonly documentId: string;
  readonly path: string;
  readonly title?: string;
  readonly matchedStoryIds: readonly string[];
  readonly reason: string;
}

export interface PrdCompletionScenarioMatrixUpdateCandidate {
  readonly documentId: string;
  readonly path: string;
  readonly rowIndex?: number;
  readonly evidenceIds: readonly string[];
  readonly matchedStoryIds: readonly string[];
  readonly reason: string;
}

export interface PrdCompletionSyncPreview {
  readonly mode: "dry-run";
  readonly dryRunDefaulted: boolean;
  readonly prd: {
    readonly stableId: string;
    readonly path: string;
    readonly title?: string;
    readonly storyCount: number;
    readonly completedStoryCount: number;
    readonly allStoriesPassing: boolean;
  } | null;
  readonly counts: {
    readonly completedStories: number;
    readonly affectedDocs: number;
    readonly openTodoCandidates: number;
    readonly specUpdateCandidates: number;
    readonly blockedPromotions: number;
    readonly roadmapUpdateCandidates: number;
    readonly scenarioMatrixUpdateCandidates: number;
    readonly sessionDrift: number;
    readonly diagnostics: number;
  };
  readonly completedStories: readonly PrdCompletionStorySummary[];
  readonly affectedDocs: readonly PrdCompletionAffectedDocument[];
  readonly openTodoCandidates: readonly PrdCompletionOpenTodoCandidate[];
  readonly specUpdateCandidates: readonly PrdCompletionSpecUpdateCandidate[];
  readonly roadmapUpdateCandidates: readonly PrdCompletionRoadmapUpdateCandidate[];
  readonly scenarioMatrixUpdateCandidates: readonly PrdCompletionScenarioMatrixUpdateCandidate[];
  readonly sessionDrift: readonly DocumentDiagnostic[];
  readonly diagnostics: readonly DocumentDiagnostic[];
}

interface AffectedDocumentEntry {
  readonly document: DocumentEnvelope;
  readonly reason: string;
}

interface OpenTodoItem {
  readonly text: string;
  readonly pointer: string;
}

interface ScenarioMatrixRow {
  readonly rowIndex: number;
  readonly cells: Readonly<Record<string, string>>;
  readonly evidenceIds: readonly string[];
}

const GENERIC_TOKENS = new Set([
  "completed",
  "completion",
  "docs",
  "json",
  "markdown",
  "prd",
  "ralph",
  "story",
  "sync",
  "task",
  "tasks",
  "test",
]);

export async function previewPrdCompletionSync(
  options: PrdCompletionSyncOptions,
): Promise<PrdCompletionSyncPreview> {
  const prdPath = toRepoPath(options.rootDir, options.prdPath);
  const prdDocument = findPrdJsonDocument(options.documents, prdPath);
  const diagnostics: DocumentDiagnostic[] = [];

  if (!prdDocument) {
    diagnostics.push(diagnostic(
      prdPath,
      "prd-completion-sync-prd-not-found",
      "error",
      "PRD JSON input could not be found through the ralph PRD JSON adapter.",
    ));
    return emptyPreview(options.dryRunDefaulted, diagnostics);
  }

  const completedStories = prdDocument.tasks
    .filter((task) => task.metadata.passes === true)
    .map(toCompletedStorySummary);
  const storyCount = asNumber(prdDocument.metadata.storyCount) ?? prdDocument.tasks.length;
  const completedStoryCount = completedStories.length;
  const allStoriesPassing = storyCount > 0 && completedStoryCount === storyCount;
  if (!allStoriesPassing) {
    diagnostics.push(diagnostic(
      prdDocument.path,
      "prd-completion-sync-incomplete-prd",
      "warning",
      "PRD JSON has incomplete stories; dry-run candidates only cover stories with passes=true.",
    ));
  }

  const affectedEntries = options.familyOnly === true
    ? collectFamilyOnlyAffectedDocuments(options.documents, prdDocument, options.includeTransient === true)
    : collectAffectedDocuments(
      options.documents,
      options.rootDir,
      prdDocument,
      completedStories,
    );
  const trackedAffectedEntries = options.includeTransient === true
    ? affectedEntries
    : affectedEntries.filter((entry) => entry.document.kind !== "ralph-session");
  const affectedDocuments = trackedAffectedEntries.map(toAffectedDocument);
  const affectedDocs = trackedAffectedEntries.map((entry) => entry.document);
  const openTodoCandidates = await collectOpenTodoCandidates(
    options.rootDir,
    affectedDocs,
    completedStories,
    options.documents,
  );
  const specUpdateCandidates = collectSpecUpdateCandidates(
    affectedDocs,
    completedStories,
    options.documents,
  );
  const roadmapUpdateCandidates = collectRoadmapUpdateCandidates(affectedDocs, completedStories);
  const scenarioMatrixUpdateCandidates = await collectScenarioMatrixUpdateCandidates(
    options.rootDir,
    affectedDocs,
    completedStories,
  );
  const sessionDrift = options.includeTransient === true
    ? affectedDocs
      .filter((document) => document.kind === "ralph-session")
      .flatMap((document) => document.diagnostics)
      .filter((item) => item.code.startsWith("ralph-session-"))
    : [];
  const blockedPromotions = openTodoCandidates
    .filter((candidate) => candidate.promotionState === "blocked").length
    + specUpdateCandidates.filter((candidate) => candidate.promotionState === "blocked").length;

  return {
    mode: "dry-run",
    dryRunDefaulted: options.dryRunDefaulted,
    prd: {
      stableId: prdDocument.stableId,
      path: prdDocument.path,
      ...(titleOf(prdDocument) ? { title: titleOf(prdDocument) } : {}),
      storyCount,
      completedStoryCount,
      allStoriesPassing,
    },
    counts: {
      completedStories: completedStories.length,
      affectedDocs: affectedDocuments.length,
      openTodoCandidates: openTodoCandidates.length,
      specUpdateCandidates: specUpdateCandidates.length,
      blockedPromotions,
      roadmapUpdateCandidates: roadmapUpdateCandidates.length,
      scenarioMatrixUpdateCandidates: scenarioMatrixUpdateCandidates.length,
      sessionDrift: sessionDrift.length,
      diagnostics: diagnostics.length,
    },
    completedStories,
    affectedDocs: affectedDocuments,
    openTodoCandidates,
    specUpdateCandidates,
    roadmapUpdateCandidates,
    scenarioMatrixUpdateCandidates,
    sessionDrift,
    diagnostics,
  };
}

function emptyPreview(
  dryRunDefaulted: boolean,
  diagnostics: readonly DocumentDiagnostic[],
): PrdCompletionSyncPreview {
  return {
    mode: "dry-run",
    dryRunDefaulted,
    prd: null,
    counts: {
      completedStories: 0,
      affectedDocs: 0,
      openTodoCandidates: 0,
      specUpdateCandidates: 0,
      blockedPromotions: 0,
      roadmapUpdateCandidates: 0,
      scenarioMatrixUpdateCandidates: 0,
      sessionDrift: 0,
      diagnostics: diagnostics.length,
    },
    completedStories: [],
    affectedDocs: [],
    openTodoCandidates: [],
    specUpdateCandidates: [],
    roadmapUpdateCandidates: [],
    scenarioMatrixUpdateCandidates: [],
    sessionDrift: [],
    diagnostics,
  };
}

function findPrdJsonDocument(
  documents: readonly DocumentEnvelope[],
  prdPath: string,
): DocumentEnvelope | undefined {
  const familyId = stripKnownExtension(prdPath);
  return documents.find((document) =>
    document.kind === "ralph-prd-json"
    && (document.path === prdPath
      || document.stableId === familyId
      || document.familyId === familyId
      || stripKnownExtension(document.path) === familyId)
  );
}

function toCompletedStorySummary(task: DocumentTask): PrdCompletionStorySummary {
  const notes = asString(task.metadata.notes);
  const completionNotes = asString(task.metadata.completionNotes);
  const acceptanceCriteria = stringList(task.metadata.acceptanceCriteria);
  const evidenceRefs = unique([
    ...extractEvidenceRefs(task.title),
    ...extractEvidenceRefs(asString(task.metadata.description) ?? ""),
    ...acceptanceCriteria.flatMap(extractEvidenceRefs),
    ...extractEvidenceRefs(notes ?? ""),
    ...extractEvidenceRefs(completionNotes ?? ""),
  ]);
  return {
    id: task.id,
    title: task.title,
    ...(notes ? { notes } : {}),
    ...(completionNotes ? { completionNotes } : {}),
    acceptanceCriteria,
    evidenceRefs,
  };
}

function collectAffectedDocuments(
  documents: readonly DocumentEnvelope[],
  rootDir: string,
  prdDocument: DocumentEnvelope,
  stories: readonly PrdCompletionStorySummary[],
): readonly AffectedDocumentEntry[] {
  const byKey = new Map<string, AffectedDocumentEntry>();
  const index = buildDocumentGraphIndex(documents, {
    rootDir,
    includeContext: false,
  });
  const traversals = [
    traverseDocumentGraph(index, {
      target: prdDocument.path,
      preset: "prd-completion",
      includeContext: false,
    }),
    ...stories.flatMap((story) =>
      story.evidenceRefs.map((ref) =>
        traverseDocumentGraph(index, {
          target: ref,
          axes: ref.startsWith("E-") ? ["evidence"] : ["source", "evidence"],
          direction: "both",
          depth: 1,
          includeContext: false,
        })
      )
    ),
  ];

  for (const traversal of traversals) {
    const scope = collectDocumentGraphTraversalDocuments(
      documents,
      traversal,
      prdCompletionGraphReasonForNode,
    );
    for (const document of scope.documents) {
      if (document.kind === "ralph-prd-json" && document.path !== prdDocument.path) continue;
      if (isArchivedPrdDocument(document) && document.path !== prdDocument.path) continue;
      addAffected(
        byKey,
        document,
        canonicalCompletionReason(scope.reasonByDocumentKey.get(documentKey(document)) ?? "trace"),
      );
    }
  }

  return [...byKey.values()].toSorted((left, right) => compareDocuments(left.document, right.document));
}

function collectFamilyOnlyAffectedDocuments(
  documents: readonly DocumentEnvelope[],
  prdDocument: DocumentEnvelope,
  includeTransient: boolean,
): readonly AffectedDocumentEntry[] {
  const byKey = new Map<string, AffectedDocumentEntry>();
  const prdFamilyScope = collectDocumentFamilyOnlyScope(documents, {
    target: prdDocument,
    includeTransient,
  });

  for (const document of prdFamilyScope.documents) {
    addAffected(
      byKey,
      document,
      canonicalCompletionReason(prdFamilyScope.reasonByDocumentKey.get(documentKey(document)) ?? "role"),
    );
  }

  const linkedDocuments = directCompletionRoleLinks(documents, prdDocument);
  for (const linked of linkedDocuments) {
    const document = resolveRoleMatrixDocument(documents, linked);
    if (!document || isArchivedPrdDocument(document)) continue;
    addAffected(byKey, document, canonicalCompletionReason(linked.reason));
  }

  for (const linked of linkedDocuments) {
    const linkedDocument = resolveRoleMatrixDocument(documents, linked);
    if (!linkedDocument || isArchivedPrdDocument(linkedDocument)) continue;
    addLinkedFamilyRoleContext(byKey, documents, linkedDocument);
  }

  return [...byKey.values()].toSorted((left, right) => compareDocuments(left.document, right.document));
}

function directCompletionRoleLinks(
  documents: readonly DocumentEnvelope[],
  target: DocumentEnvelope,
): readonly DocumentRoleMatrixLinkedDocument[] {
  const matrix = buildDocumentRoleMatrix(documents, { target });
  if (!matrix) return [];
  return matrix.roles
    .flatMap((role) => role.linked)
    .filter((document) => document.relation === "composition" || document.relation === "trace");
}

function addLinkedFamilyRoleContext(
  byKey: Map<string, AffectedDocumentEntry>,
  documents: readonly DocumentEnvelope[],
  linkedDocument: DocumentEnvelope,
): void {
  const familyScope = collectDocumentFamilyOnlyScope(documents, {
    target: linkedDocument,
    includeTransient: false,
  });

  for (const document of familyScope.documents) {
    if (isArchivedPrdDocument(document)) continue;
    addAffected(
      byKey,
      document,
      canonicalCompletionReason(familyScope.reasonByDocumentKey.get(documentKey(document)) ?? "role"),
    );
  }

  const linkedMatrix = buildDocumentRoleMatrix(documents, { target: linkedDocument });
  if (!linkedMatrix) return;
  for (const linked of linkedMatrix.roles.flatMap((role) => role.linked)) {
    if (linked.relation !== "composition") continue;
    const document = resolveRoleMatrixDocument(documents, linked);
    if (!document || isArchivedPrdDocument(document)) continue;
    addAffected(byKey, document, "composition");
  }
}

function resolveRoleMatrixDocument(
  documents: readonly DocumentEnvelope[],
  summary: DocumentRoleMatrixDocument,
): DocumentEnvelope | undefined {
  return documents.find((document) =>
    document.adapterId === summary.adapterId
    && document.stableId === summary.stableId
    && document.path === summary.path
  );
}

function addAffected(
  byKey: Map<string, AffectedDocumentEntry>,
  document: DocumentEnvelope,
  reason: string,
): void {
  const key = documentKey(document);
  if (byKey.has(key)) return;
  byKey.set(key, { document, reason });
}

function prdCompletionGraphReasonForNode(
  node: DocumentGraphTraversalResult["nodes"][number],
): string {
  if (node.depth === 0) {
    if (node.kind === "source") return "source";
    if (node.kind === "evidence") return "evidence";
    return "target";
  }
  const axis = node.pathFromTarget.steps[node.pathFromTarget.steps.length - 1]?.axis;
  return axis ? canonicalCompletionReason(axis) : "trace";
}

function canonicalCompletionReason(reason: string): string {
  if (reason === "prd-completion-target") return "target";
  if (reason === "family-only" || reason === "family-only:role") return "role";
  if (reason === "family-only:contains") return "composition";
  if (reason === "family-only:transient") return "transient";
  if (reason.startsWith("graph:")) return canonicalCompletionReason(reason.slice("graph:".length));
  if (reason === "dependency" || reason === "refinement") return "composition";
  if (reason === "role" || reason === "composition" || reason === "trace"
    || reason === "source" || reason === "evidence" || reason === "target") {
    return reason;
  }
  return reason;
}

function toAffectedDocument(entry: AffectedDocumentEntry): PrdCompletionAffectedDocument {
  const title = titleOf(entry.document);
  return {
    kind: entry.document.kind,
    stableId: entry.document.stableId,
    path: entry.document.path,
    ...(title ? { title } : {}),
    reason: entry.reason,
    metadata: entry.document.metadata,
  };
}

async function collectOpenTodoCandidates(
  rootDir: string,
  documents: readonly DocumentEnvelope[],
  stories: readonly PrdCompletionStorySummary[],
  allDocuments: readonly DocumentEnvelope[],
): Promise<readonly PrdCompletionOpenTodoCandidate[]> {
  const candidates: PrdCompletionOpenTodoCandidate[] = [];
  for (const document of documents) {
    if (document.kind !== "todo") continue;
    const content = await readRepoFile(rootDir, document.path);
    if (!content) continue;
    for (const item of parseOpenTodos(content)) {
      const matchedStories = matchingStoriesForText(stories, item.text);
      if (matchedStories.length === 0 && stories.length === 0) continue;
      const effectiveStories = matchedStories.length > 0 ? matchedStories : stories;
      const evidence = evidenceForDocument(document, effectiveStories, allDocuments);
      const promotionState: PrdCompletionPromotionState = evidence.length > 0 ? "eligible" : "blocked";
      candidates.push({
        documentId: document.stableId,
        path: document.path,
        pointer: item.pointer,
        text: item.text,
        matchedStoryIds: effectiveStories.map((story) => story.id),
        promotionState,
        reason: promotionState === "eligible"
          ? "Open TODO matches completed PRD story and has source/test/evidence links for reviewer confirmation."
          : "Blocked: PRD passes=true is not enough to promote TODO state without source/test/evidence links.",
        evidence,
      });
    }
  }
  return candidates.toSorted((left, right) =>
    left.path.localeCompare(right.path) || left.pointer.localeCompare(right.pointer)
  );
}

function collectSpecUpdateCandidates(
  documents: readonly DocumentEnvelope[],
  stories: readonly PrdCompletionStorySummary[],
  allDocuments: readonly DocumentEnvelope[],
): readonly PrdCompletionSpecUpdateCandidate[] {
  return documents
    .filter((document) => document.kind === "spec")
    .map((document) => {
      const matchedStories = matchingStoriesForDocument(stories, document);
      const effectiveStories = matchedStories.length > 0 ? matchedStories : stories;
      const evidence = evidenceForDocument(document, effectiveStories, allDocuments);
      const promotionState: PrdCompletionPromotionState = evidence.length > 0 ? "eligible" : "blocked";
      return {
        documentId: document.stableId,
        path: document.path,
        ...(titleOf(document) ? { title: titleOf(document) } : {}),
        matchedStoryIds: effectiveStories.map((story) => story.id),
        promotionState,
        reason: promotionState === "eligible"
          ? "Spec can be updated to describe completed behavior with supporting source/test/evidence links."
          : "Blocked: completed PRD story needs source/test/evidence links before spec promotion is safe.",
        evidence,
      };
    })
    .toSorted((left, right) => left.path.localeCompare(right.path));
}

function collectRoadmapUpdateCandidates(
  documents: readonly DocumentEnvelope[],
  stories: readonly PrdCompletionStorySummary[],
): readonly PrdCompletionRoadmapUpdateCandidate[] {
  return documents
    .filter((document) => document.kind === "plan" || looksLikeRoadmap(document))
    .map((document) => {
      const matchedStories = matchingStoriesForDocument(stories, document);
      return {
        documentId: document.stableId,
        path: document.path,
        ...(titleOf(document) ? { title: titleOf(document) } : {}),
        matchedStoryIds: (matchedStories.length > 0 ? matchedStories : stories).map((story) => story.id),
        reason: "Review roadmap/plan state so completed PRD work is marked complete without reopening future phases.",
      };
    })
    .toSorted((left, right) => left.path.localeCompare(right.path));
}

async function collectScenarioMatrixUpdateCandidates(
  rootDir: string,
  documents: readonly DocumentEnvelope[],
  stories: readonly PrdCompletionStorySummary[],
): Promise<readonly PrdCompletionScenarioMatrixUpdateCandidate[]> {
  const candidates: PrdCompletionScenarioMatrixUpdateCandidate[] = [];
  for (const document of documents) {
    const content = await readRepoFile(rootDir, document.path);
    if (!content || !/Scenario Matrix/i.test(content)) continue;
    const rows = parseScenarioMatrixRows(content);
    if (rows.length === 0) {
      candidates.push({
        documentId: document.stableId,
        path: document.path,
        evidenceIds: [],
        matchedStoryIds: stories.map((story) => story.id),
        reason: "Scenario Matrix section exists but has no parseable rows; review coverage for completed PRD stories.",
      });
      continue;
    }

    const storyEvidenceIds = new Set(stories.flatMap((story) => story.evidenceRefs));
    for (const row of rows) {
      const matchedStories = stories.filter((story) =>
        row.evidenceIds.some((id) => story.evidenceRefs.includes(id))
        || textMatchesStory(Object.values(row.cells).join(" "), story)
      );
      if (matchedStories.length === 0 && storyEvidenceIds.size > 0) continue;
      candidates.push({
        documentId: document.stableId,
        path: document.path,
        rowIndex: row.rowIndex,
        evidenceIds: row.evidenceIds,
        matchedStoryIds: (matchedStories.length > 0 ? matchedStories : stories).map((story) => story.id),
        reason: row.evidenceIds.length > 0
          ? "Review scenario matrix evidence row against completed PRD story state."
          : "Scenario matrix row has no E-* evidence id; add or refresh evidence references before treating completion as covered.",
      });
    }
  }
  return candidates.toSorted((left, right) =>
    left.path.localeCompare(right.path) || (left.rowIndex ?? 0) - (right.rowIndex ?? 0)
  );
}

function evidenceForDocument(
  document: DocumentEnvelope,
  stories: readonly PrdCompletionStorySummary[],
  allDocuments: readonly DocumentEnvelope[],
): readonly PrdCompletionEvidenceRef[] {
  const refs: PrdCompletionEvidenceRef[] = [];
  const identities = new Set(documentIdentityValues(document));
  const paths = new Set(documentPathValues(document));

  for (const source of document.sources) {
    const path = source.path ?? pathLikeReference(source.label ?? "");
    if (!path) continue;
    refs.push({
      kind: isTestPath(path) ? "test" : "source",
      id: source.id,
      path,
      ...(source.label ? { summary: source.label } : {}),
    });
  }

  for (const evidence of document.evidence) {
    refs.push({
      kind: "evidence",
      id: evidence.id,
      ...(evidence.summary ? { summary: evidence.summary } : {}),
    });
  }

  for (const storyRef of stories.flatMap((story) => story.evidenceRefs)) {
    if (storyRef.startsWith("E-")) {
      refs.push({ kind: "evidence", id: storyRef });
      continue;
    }
    const path = pathLikeReference(storyRef);
    if (path) refs.push({ kind: isTestPath(path) ? "test" : "source", id: storyRef, path });
  }

  for (const candidate of allDocuments) {
    if (candidate === document || candidate.kind === "prd" || candidate.kind === "ralph-prd-json") continue;
    const candidateRefs = documentReferences(candidate);
    const sameFamily = Boolean(document.familyId && candidate.familyId === document.familyId);
    if (!sameFamily && !candidateRefs.some((ref) => identities.has(ref) || paths.has(normalizePath(ref)))) continue;
    for (const evidence of candidate.evidence) {
      refs.push({
        kind: "evidence",
        id: evidence.id,
        path: candidate.path,
        ...(evidence.summary ? { summary: evidence.summary } : {}),
      });
    }
    for (const source of candidate.sources) {
      if (!source.path) continue;
      refs.push({
        kind: isTestPath(source.path) ? "test" : "source",
        id: `${candidate.stableId}:${source.id}`,
        path: source.path,
        ...(source.label ? { summary: source.label } : {}),
      });
    }
  }

  return uniqueEvidenceRefs(refs);
}

function matchingStoriesForDocument(
  stories: readonly PrdCompletionStorySummary[],
  document: DocumentEnvelope,
): readonly PrdCompletionStorySummary[] {
  const text = searchableText(document);
  return stories.filter((story) => textMatchesStory(text, story));
}

function matchingStoriesForText(
  stories: readonly PrdCompletionStorySummary[],
  text: string,
): readonly PrdCompletionStorySummary[] {
  return stories.filter((story) => textMatchesStory(text, story));
}

function textMatchesStory(text: string, story: PrdCompletionStorySummary): boolean {
  const haystack = normalizeSearchText(text);
  const direct = normalizeSearchText([
    story.id,
    story.title,
    story.notes,
    story.completionNotes,
    ...story.acceptanceCriteria,
  ].filter(isString).join(" "));
  if (direct.length >= 12 && haystack.includes(direct)) return true;
  const tokens = significantStoryTokens(story);
  if (tokens.length === 0) return false;
  const matched = tokens.filter((token) => haystack.includes(token)).length;
  return matched >= Math.max(1, Math.ceil(tokens.length * 0.45));
}

function significantStoryTokens(story: PrdCompletionStorySummary): readonly string[] {
  return unique([
    ...tokenize(story.title),
    ...tokenize(story.notes ?? ""),
    ...tokenize(story.completionNotes ?? ""),
    ...story.acceptanceCriteria.flatMap(tokenize),
  ]).filter((token) => token.length >= 4 && !GENERIC_TOKENS.has(token));
}

function searchableText(document: DocumentEnvelope): string {
  return [
    document.kind,
    document.stableId,
    document.familyId,
    document.path,
    ...metadataValues(document.metadata),
    ...document.links.flatMap((link) => [link.type, link.sourceId, link.targetId, ...metadataValues(link.metadata)]),
    ...document.sources.flatMap((source) => [source.id, source.path, source.label, ...metadataValues(source.metadata)]),
    ...document.sections.flatMap((section) => [section.id, section.title, section.content, ...metadataValues(section.metadata)]),
    ...document.tasks.flatMap((task) => [task.id, task.title, task.status, ...metadataValues(task.metadata)]),
    ...document.evidence.flatMap((evidence) => [evidence.id, evidence.kind, evidence.summary, ...metadataValues(evidence.metadata)]),
  ].filter(isString).join("\n");
}

function documentIdentityValues(document: DocumentEnvelope): readonly string[] {
  return unique([
    document.stableId,
    document.familyId,
    document.path,
    asString(document.metadata.defId),
    asString(document.metadata.sourcePath),
    asString(document.metadata.ownerDefinitionId),
    asString(document.metadata.artifactId),
    asString(document.metadata.artifactRef),
    asString(document.metadata.outputPath),
  ]);
}

function documentPathValues(document: DocumentEnvelope): readonly string[] {
  return unique([
    document.path,
    asString(document.metadata.sourcePath),
    asString(document.metadata.outputPath),
    ...document.sources.flatMap((source) => [source.path, pathLikeReference(source.label ?? "")]),
  ].filter(isString).map(normalizePath));
}

function documentReferences(document: DocumentEnvelope): readonly string[] {
  return unique([
    ...documentIdentityValues(document),
    ...documentPathValues(document),
    ...document.links.flatMap((link) => [link.sourceId, link.targetId]),
    ...document.sources.flatMap((source) => [source.path, source.label, ...metadataValues(source.metadata)]),
    ...document.evidence.flatMap((evidence) => [evidence.id, evidence.summary, ...metadataValues(evidence.metadata)]),
    ...metadataValues(document.metadata),
  ].filter(isString));
}

function looksLikeRoadmap(document: DocumentEnvelope): boolean {
  const text = normalizeSearchText([
    document.stableId,
    document.path,
    titleOf(document),
    asString(document.metadata.defId),
  ].filter(isString).join(" "));
  return text.includes("roadmap");
}

function parseOpenTodos(content: string): readonly OpenTodoItem[] {
  return content
    .split(/\r?\n/)
    .map((line, index) => {
      const match = line.match(/^\s*[-*]\s+\[ \]\s+(.+?)\s*$/);
      if (!match) return null;
      return {
        text: match[1]?.trim() ?? "",
        pointer: `line ${index + 1}`,
      };
    })
    .filter((item): item is OpenTodoItem => item !== null && item.text.length > 0);
}

function parseScenarioMatrixRows(content: string): readonly ScenarioMatrixRow[] {
  const section = extractMarkdownSection(content, "Scenario Matrix");
  if (!section) return [];
  const tableLines = section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|") && line.endsWith("|"));
  if (tableLines.length < 2) return [];
  const headers = splitMarkdownTableRow(tableLines[0]!);
  return tableLines.slice(2).map((line, index) => {
    const cells = splitMarkdownTableRow(line);
    const row: Record<string, string> = {};
    headers.forEach((header, columnIndex) => {
      row[header || `column${columnIndex + 1}`] = cells[columnIndex] ?? "";
    });
    return {
      rowIndex: index + 1,
      cells: row,
      evidenceIds: unique(Object.values(row).flatMap((value) =>
        value.match(/\bE-[A-Za-z0-9][A-Za-z0-9_-]*\b/g) ?? []
      )),
    };
  }).filter((row) => Object.values(row.cells).some((value) => value.length > 0));
}

function extractMarkdownSection(content: string, title: string): string | null {
  const headingRe = new RegExp(String.raw`^##\s+${escapeRegExp(title)}\s*$`, "im");
  const match = content.match(headingRe);
  if (!match || match.index === undefined) return null;
  const start = match.index + match[0].length;
  const rest = content.slice(start);
  const nextHeading = rest.search(/^##\s+/m);
  return (nextHeading >= 0 ? rest.slice(0, nextHeading) : rest).trim();
}

function splitMarkdownTableRow(line: string): readonly string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

async function readRepoFile(rootDir: string, path: string): Promise<string | null> {
  try {
    return await readFile(resolve(rootDir, normalizePath(path)), "utf8");
  } catch {
    return null;
  }
}

function extractEvidenceRefs(value: string): readonly string[] {
  return unique([
    ...(value.match(/\bE-[A-Za-z0-9][A-Za-z0-9_-]*\b/g) ?? []),
    ...(value.match(/[A-Za-z0-9._/-]+\.(?:c|cc|cpp|css|go|html|java|js|json|jsx|kt|md|py|rb|rs|ts|tsx|txt|yaml|yml)(?::[A-Za-z0-9_$.-]+)?/g) ?? []),
  ]);
}

function pathLikeReference(value: string): string | undefined {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.+\.(?:c|cc|cpp|css|go|html|java|js|json|jsx|kt|md|py|rb|rs|ts|tsx|txt|yaml|yml))(?:[:#].*)?$/);
  if (match?.[1]) return normalizePath(match[1]);
  return undefined;
}

function isTestPath(path: string): boolean {
  return /(?:^|[/.])(?:test|spec)\.[cm]?[jt]sx?$/.test(path)
    || /(?:^|\/)__tests__\//.test(path)
    || /(?:^|\/)tests?\//.test(path);
}

function metadataValues(metadata: DocumentMetadata): readonly string[] {
  const values: string[] = [];
  for (const value of Object.values(metadata)) appendMetadataValue(values, value);
  return values;
}

function appendMetadataValue(values: string[], value: unknown): void {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    values.push(String(value));
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) appendMetadataValue(values, item);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) appendMetadataValue(values, item);
  }
}

function uniqueEvidenceRefs(
  refs: readonly PrdCompletionEvidenceRef[],
): readonly PrdCompletionEvidenceRef[] {
  const seen = new Set<string>();
  const result: PrdCompletionEvidenceRef[] = [];
  for (const ref of refs) {
    const key = `${ref.kind}:${ref.id}:${ref.path ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(ref);
  }
  return result;
}

function stringList(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter(Boolean);
}

function tokenize(value: string): readonly string[] {
  return normalizeSearchText(value)
    .split(" ")
    .filter((token) => token.length >= 3);
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleOf(document: DocumentEnvelope): string | undefined {
  for (const key of ["title", "name", "defId"] as const) {
    const value = asString(document.metadata[key]);
    if (value) return value;
  }
  return basename(document.path).replace(/\.(?:md|json)$/i, "");
}

function diagnostic(
  path: string,
  code: string,
  severity: "error" | "warning",
  message: string,
): DocumentDiagnostic {
  return {
    code,
    severity,
    message,
    rawSource: {
      path,
      metadata: {},
    },
    metadata: {
      source: "prd-completion-sync",
    },
  };
}

function compareDocuments(left: DocumentEnvelope, right: DocumentEnvelope): number {
  return left.path.localeCompare(right.path)
    || left.kind.localeCompare(right.kind)
    || left.stableId.localeCompare(right.stableId);
}

function documentKey(document: DocumentEnvelope): string {
  return `${document.adapterId}:${document.stableId}:${document.path}`;
}

function stripKnownExtension(value: string): string {
  return normalizePath(value).replace(/\.(?:md|json)$/i, "");
}

function toRepoPath(rootDir: string, path: string): string {
  const absolutePath = isAbsolute(path) ? resolve(path) : resolve(rootDir, path);
  const relativePath = relative(rootDir, absolutePath);
  return normalizePath(relativePath && !relativePath.startsWith("..") ? relativePath : path);
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+/g, "/");
}

function unique(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values.filter(isString))];
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
