import {
  AUTHORED_LINK_AXIS_MAP,
  TRAVERSAL_AXIS_PRIORITY,
  type DocumentGraphEdgeKind,
  type DocumentGraphEdgeReason,
  type DocumentGraphEdgeSummary,
  type TraversalAxis,
} from "./graph-types.js";
import type {
  DocumentEnvelope,
  DocumentMetadata,
  DocumentRawSourcePointer,
  DocumentSource,
  DocumentTask,
} from "./types.js";

export interface NormalizeDocumentGraphEdgesOptions {
  readonly includeContext?: boolean;
}

interface ResolvedTarget {
  readonly nodeId: string;
  readonly path: string;
}

interface TaskTarget {
  readonly document: DocumentEnvelope;
  readonly task: DocumentTask;
}

interface ResolutionIndex {
  readonly documents: readonly DocumentEnvelope[];
  readonly documentByIdentity: ReadonlyMap<string, DocumentEnvelope>;
  readonly taskById: ReadonlyMap<string, TaskTarget>;
}

interface AddEdgeInput {
  readonly kind: DocumentGraphEdgeKind;
  readonly axis: TraversalAxis;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly authoredType?: string;
  readonly reason: DocumentGraphEdgeReason;
  readonly metadata?: DocumentMetadata;
}

/**
 * Projects source-owned DocumentEnvelope vocabulary into canonical graph axes.
 * This does not rewrite envelope links or metadata; it only prepares traversal
 * edges for the later graph index.
 */
export function normalizeDocumentGraphEdges(
  documents: readonly DocumentEnvelope[],
  options: NormalizeDocumentGraphEdgesOptions = {},
): readonly DocumentGraphEdgeSummary[] {
  const includeContext = options.includeContext !== false;
  const index = buildResolutionIndex(documents);
  const builder = new EdgeBuilder();

  for (const document of documents) {
    addAuthoredLinkEdges(builder, index, document);
    addRuleConstraintEdges(builder, index, document);
    addDocumentSourceEdges(builder, document);
    addDocumentEvidenceEdges(builder, index, document);
    addTaskTraceEdges(builder, index, document);
    addTaskEvidenceEdges(builder, index, document);
    if (includeContext) addContextEdges(builder, document);
  }

  addRoleEdges(builder, documents);

  return builder.edges().toSorted(compareGraphEdges);
}

function addAuthoredLinkEdges(
  builder: EdgeBuilder,
  index: ResolutionIndex,
  document: DocumentEnvelope,
): void {
  document.links.forEach((link, linkIndex) => {
    const axis = AUTHORED_LINK_AXIS_MAP[link.type as keyof typeof AUTHORED_LINK_AXIS_MAP];
    if (!axis) return;

    const target = resolveDocumentOrReference(
      index,
      link.targetId,
      axis === "evidence" ? "evidence" : "document",
    );
    const kind: DocumentGraphEdgeKind = axis === "evidence" ? "document-evidence" : "authored-link";
    builder.add({
      kind,
      axis,
      fromNodeId: documentNodeId(document),
      toNodeId: target.nodeId,
      authoredType: link.type,
      reason: reasonFor(document, {
        reason: `link:${link.type}`,
        rawSource: rawSourceFor(document, `links[${linkIndex}]`, {
          sourceId: link.sourceId,
          targetId: link.targetId,
          type: link.type,
        }),
        target,
        metadata: {
          sourceId: link.sourceId,
          targetId: link.targetId,
          targetAdapterId: link.targetAdapterId,
          ...link.metadata,
        },
      }),
      metadata: {
        source: "DocumentEnvelope.links",
        link,
      },
    });
  });
}

function addRuleConstraintEdges(
  builder: EdgeBuilder,
  index: ResolutionIndex,
  document: DocumentEnvelope,
): void {
  if (!isRuleDocument(document) || !document.familyId) return;

  const sameFamily = index.documents.filter((candidate) =>
    candidate !== document && candidate.familyId === document.familyId
  );
  const targets = sameFamily.some((candidate) => candidate.kind === "spec")
    ? sameFamily.filter((candidate) => candidate.kind === "spec")
    : sameFamily;

  for (const targetDocument of targets) {
    const target = documentTarget(targetDocument);
    builder.add({
      kind: "document-constraint",
      axis: "constraint",
      fromNodeId: documentNodeId(document),
      toNodeId: target.nodeId,
      authoredType: "rule-family",
      reason: reasonFor(document, {
        reason: ".rule.md same-family constraint",
        rawSource: rawSourceFor(document, "familyId", {
          familyId: document.familyId,
          targetKind: targetDocument.kind,
        }),
        target,
        metadata: {
          familyId: document.familyId,
          targetKind: targetDocument.kind,
        },
      }),
      metadata: {
        source: "DocumentEnvelope.familyId",
        familyId: document.familyId,
      },
    });
  }
}

function addDocumentSourceEdges(
  builder: EdgeBuilder,
  document: DocumentEnvelope,
): void {
  addSourceRefEdge(builder, document, document.path, "path", document.rawSource);
  addSourceRefEdge(
    builder,
    document,
    asString(document.metadata.sourcePath),
    "sourcePath",
    rawSourceFor(document, "metadata.sourcePath"),
  );

  for (const source of document.sources) {
    const targetValue = sourceTargetValue(source);
    if (!targetValue) continue;
    const target = sourceTarget(targetValue);
    builder.add({
      kind: "document-source",
      axis: "source",
      fromNodeId: documentNodeId(document),
      toNodeId: target.nodeId,
      authoredType: asString(source.metadata.sourceKind),
      reason: reasonFor(document, {
        reason: `source:${source.id}`,
        rawSource: source.rawSource ?? rawSourceFor(document, `sources.${source.id}`),
        target,
        metadata: {
          sourceId: source.id,
          sourceKind: source.metadata.sourceKind,
          value: source.metadata.value,
          label: source.label,
          path: source.path,
        },
      }),
      metadata: {
        source: "DocumentEnvelope.sources",
        sourceId: source.id,
        ...source.metadata,
      },
    });
  }

  for (const value of metadataStringValues(document.metadata.sourceRefs)) {
    addSourceRefEdge(builder, document, value, "sourceRefs", rawSourceFor(document, "metadata.sourceRefs"));
  }
  for (const value of metadataStringValues(document.metadata.verificationRefs).filter(isPathLikeRef)) {
    addSourceRefEdge(
      builder,
      document,
      value,
      "verificationRefs",
      rawSourceFor(document, "metadata.verificationRefs"),
    );
  }
  for (const field of ["artifactRef", "outputPath"] as const) {
    const value = asString(document.metadata[field]);
    if (value && isPathLikeRef(value)) {
      addSourceRefEdge(builder, document, value, field, rawSourceFor(document, `metadata.${field}`));
    }
  }
}

function addSourceRefEdge(
  builder: EdgeBuilder,
  document: DocumentEnvelope,
  value: string | undefined,
  field: string,
  rawSource: DocumentRawSourcePointer,
): void {
  if (!value) return;
  const target = sourceTarget(value);
  builder.add({
    kind: "document-source",
    axis: "source",
    fromNodeId: documentNodeId(document),
    toNodeId: target.nodeId,
    authoredType: field,
    reason: reasonFor(document, {
      reason: `source-field:${field}`,
      rawSource,
      target,
      metadata: {
        field,
        value,
      },
    }),
    metadata: {
      source: `DocumentEnvelope.${field}`,
      field,
      value,
    },
  });
}

function addDocumentEvidenceEdges(
  builder: EdgeBuilder,
  index: ResolutionIndex,
  document: DocumentEnvelope,
): void {
  for (const evidence of document.evidence) {
    const target = evidenceTarget(evidence.id);
    builder.add({
      kind: "document-evidence",
      axis: "evidence",
      fromNodeId: documentNodeId(document),
      toNodeId: target.nodeId,
      authoredType: evidence.kind,
      reason: reasonFor(document, {
        reason: `evidence:${evidence.kind ?? evidence.id}`,
        rawSource: evidence.rawSource ?? rawSourceFor(document, `evidence.${evidence.id}`),
        target,
        metadata: {
          evidenceId: evidence.id,
          evidenceKind: evidence.kind,
          summary: evidence.summary,
          ...evidence.metadata,
        },
      }),
      metadata: {
        source: "DocumentEnvelope.evidence",
        evidenceId: evidence.id,
        evidenceKind: evidence.kind,
      },
    });
  }

  addEvidenceMetadataRefs(builder, index, document, "verifiesRefs", "verifies");
  addEvidenceMetadataRefs(builder, index, document, "materializesOutputRefs", "materializes_output");
  addEvidenceMetadataRefs(builder, index, document, "verificationRefs", "verificationRefs");
  addQualityOrActivationEvidenceRefs(builder, index, document);
}

function addEvidenceMetadataRefs(
  builder: EdgeBuilder,
  index: ResolutionIndex,
  document: DocumentEnvelope,
  field: string,
  authoredType: string,
): void {
  for (const value of metadataStringValues(document.metadata[field])) {
    const target = resolveDocumentOrReference(index, value, "evidence");
    builder.add({
      kind: "document-evidence",
      axis: "evidence",
      fromNodeId: documentNodeId(document),
      toNodeId: target.nodeId,
      authoredType,
      reason: reasonFor(document, {
        reason: `evidence-field:${field}`,
        rawSource: rawSourceFor(document, `metadata.${field}`),
        target,
        metadata: {
          field,
          value,
        },
      }),
      metadata: {
        source: `DocumentEnvelope.metadata.${field}`,
        field,
        value,
      },
    });
  }
}

function addQualityOrActivationEvidenceRefs(
  builder: EdgeBuilder,
  index: ResolutionIndex,
  document: DocumentEnvelope,
): void {
  if (document.kind !== "quality-status" && document.kind !== "activation-evidence") return;

  for (const field of ["artifactId", "artifactRef", "packId", "ontologyId", "outputPath"] as const) {
    const value = asString(document.metadata[field]);
    if (!value) continue;
    const target = field === "outputPath"
      ? sourceTarget(value)
      : resolveDocumentOrReference(index, value, "evidence");
    builder.add({
      kind: "document-evidence",
      axis: "evidence",
      fromNodeId: documentNodeId(document),
      toNodeId: target.nodeId,
      authoredType: document.kind,
      reason: reasonFor(document, {
        reason: `evidence-artifact:${field}`,
        rawSource: rawSourceFor(document, `metadata.${field}`),
        target,
        metadata: {
          field,
          value,
          artifactKind: document.kind,
        },
      }),
      metadata: {
        source: `DocumentEnvelope.metadata.${field}`,
        field,
        value,
        artifactKind: document.kind,
      },
    });
  }
}

function addTaskTraceEdges(
  builder: EdgeBuilder,
  index: ResolutionIndex,
  document: DocumentEnvelope,
): void {
  for (const task of document.tasks) {
    const taskTarget = taskNodeTarget(document, task);
    builder.add({
      kind: "task-trace",
      axis: "trace",
      fromNodeId: documentNodeId(document),
      toNodeId: taskTarget.nodeId,
      authoredType: "task",
      reason: reasonFor(document, {
        reason: "document-task trace",
        rawSource: task.rawSource ?? rawSourceFor(document, `tasks.${task.id}`),
        target: taskTarget,
        metadata: {
          taskId: task.id,
          taskStatus: task.status,
          sourceOrder: task.metadata.sourceOrder,
        },
      }),
      metadata: {
        source: "DocumentEnvelope.tasks",
        taskId: task.id,
      },
    });

    for (const dependency of taskTraceDependencies(task)) {
      const target = resolveTaskOrReference(index, document, dependency);
      builder.add({
        kind: "task-trace",
        axis: "trace",
        fromNodeId: taskNodeId(document, task),
        toNodeId: target.nodeId,
        authoredType: "task-dependency",
        reason: reasonFor(document, {
          reason: "task dependency trace",
          rawSource: task.rawSource ?? rawSourceFor(document, `tasks.${task.id}.dependencies`),
          target,
          metadata: {
            taskId: task.id,
            dependency,
          },
        }),
        metadata: {
          source: "DocumentTask.metadata",
          taskId: task.id,
          dependency,
        },
      });
    }
  }

  const prdPath = asString(document.metadata.prdPath);
  if (document.kind === "ralph-session" && prdPath) {
    const target = resolveDocumentOrReference(index, prdPath.replace(/\.json$/, ""), "document");
    builder.add({
      kind: "task-trace",
      axis: "trace",
      fromNodeId: documentNodeId(document),
      toNodeId: target.nodeId,
      authoredType: "ralph-session-prd",
      reason: reasonFor(document, {
        reason: "ralph session PRD trace",
        rawSource: rawSourceFor(document, "metadata.prdPath"),
        target,
        metadata: {
          prdPath,
        },
      }),
      metadata: {
        source: "DocumentEnvelope.metadata.prdPath",
        prdPath,
      },
    });
  }
}

function addTaskEvidenceEdges(
  builder: EdgeBuilder,
  index: ResolutionIndex,
  document: DocumentEnvelope,
): void {
  for (const task of document.tasks) {
    for (const evidenceId of task.evidenceIds) {
      const target = resolveDocumentOrReference(index, evidenceId, "evidence");
      builder.add({
        kind: "task-evidence",
        axis: "evidence",
        fromNodeId: taskNodeId(document, task),
        toNodeId: target.nodeId,
        authoredType: "task-evidence",
        reason: reasonFor(document, {
          reason: "task evidence reference",
          rawSource: task.rawSource ?? rawSourceFor(document, `tasks.${task.id}.evidenceIds`),
          target,
          metadata: {
            taskId: task.id,
            evidenceId,
          },
        }),
        metadata: {
          source: "DocumentTask.evidenceIds",
          taskId: task.id,
          evidenceId,
        },
      });
    }
  }
}

function addContextEdges(
  builder: EdgeBuilder,
  document: DocumentEnvelope,
): void {
  for (const tag of metadataStringValues(document.metadata.tags)) {
    addContextEdge(builder, document, "tag", tag);
  }
  for (const field of ["scope", "aspect", "layer", "knowledgeKind"] as const) {
    const value = asString(document.metadata[field]);
    if (value) addContextEdge(builder, document, field, value);
  }
  if (document.metadata.type === "knowledge") {
    addContextEdge(builder, document, "documentContext", "knowledge");
  }
  if (document.kind === "memo") {
    addContextEdge(builder, document, "documentContext", "memo");
  }
}

function addContextEdge(
  builder: EdgeBuilder,
  document: DocumentEnvelope,
  field: string,
  value: string,
): void {
  const target = contextTarget(field, value);
  builder.add({
    kind: "context-metadata",
    axis: "context",
    fromNodeId: documentNodeId(document),
    toNodeId: target.nodeId,
    authoredType: field,
    reason: reasonFor(document, {
      reason: `context:${field}`,
      rawSource: rawSourceFor(document, `metadata.${field}`),
      target,
      metadata: {
        field,
        value,
      },
    }),
    metadata: {
      source: "DocumentEnvelope.metadata",
      field,
      value,
    },
  });
}

function addRoleEdges(
  builder: EdgeBuilder,
  documents: readonly DocumentEnvelope[],
): void {
  const byFamily = new Map<string, DocumentEnvelope[]>();
  for (const document of documents) {
    if (!document.familyId) continue;
    const members = byFamily.get(document.familyId) ?? [];
    members.push(document);
    byFamily.set(document.familyId, members);
  }

  for (const [familyId, members] of byFamily.entries()) {
    if (members.length < 2) continue;
    for (const from of members) {
      for (const to of members) {
        if (from === to) continue;
        const target = documentTarget(to);
        builder.add({
          kind: "role-membership",
          axis: "role",
          fromNodeId: documentNodeId(from),
          toNodeId: target.nodeId,
          authoredType: "family",
          reason: reasonFor(from, {
            reason: "same-family role relationship",
            rawSource: rawSourceFor(from, "familyId", {
              familyId,
              targetKind: to.kind,
            }),
            target,
            metadata: {
              familyId,
              sourceKind: from.kind,
              targetKind: to.kind,
            },
          }),
          metadata: {
            source: "DocumentEnvelope.familyId",
            familyId,
            sourceKind: from.kind,
            targetKind: to.kind,
          },
        });
      }
    }
  }
}

function buildResolutionIndex(documents: readonly DocumentEnvelope[]): ResolutionIndex {
  const documentByIdentity = new Map<string, DocumentEnvelope>();
  const taskById = new Map<string, TaskTarget>();

  for (const document of documents) {
    for (const identity of documentIdentityValues(document)) {
      if (!documentByIdentity.has(identity)) {
        documentByIdentity.set(identity, document);
      }
    }
    for (const task of document.tasks) {
      const target = { document, task };
      for (const identity of [
        task.id,
        `${document.stableId}:${task.id}`,
        `${document.path}#${task.id}`,
      ]) {
        if (!taskById.has(identity)) taskById.set(identity, target);
      }
    }
  }

  return {
    documents,
    documentByIdentity,
    taskById,
  };
}

function resolveTaskOrReference(
  index: ResolutionIndex,
  document: DocumentEnvelope,
  value: string,
): ResolvedTarget {
  const task = index.taskById.get(value) ?? index.taskById.get(`${document.stableId}:${value}`);
  if (task) return taskNodeTarget(task.document, task.task);
  return resolveDocumentOrReference(index, value, "document");
}

function resolveDocumentOrReference(
  index: ResolutionIndex,
  value: string,
  fallback: "document" | "evidence",
): ResolvedTarget {
  const normalizedValue = normalizePath(value);
  const document = index.documentByIdentity.get(value)
    ?? index.documentByIdentity.get(normalizedValue);
  if (document) return documentTarget(document);
  if (isPathLikeRef(value)) return sourceTarget(value);
  return fallback === "evidence" ? evidenceTarget(value) : unresolvedDocumentTarget(value);
}

function documentIdentityValues(document: DocumentEnvelope): readonly string[] {
  return unique([
    document.stableId,
    document.path,
    document.familyId,
    asString(document.metadata.defId),
    asString(document.metadata.artifactId),
    asString(document.metadata.artifactRef),
    asString(document.metadata.outputPath),
    asString(document.metadata.sourcePath),
    asString(document.metadata.prdPath),
  ]);
}

function documentTarget(document: DocumentEnvelope): ResolvedTarget {
  return {
    nodeId: documentNodeId(document),
    path: document.path,
  };
}

function unresolvedDocumentTarget(value: string): ResolvedTarget {
  return {
    nodeId: `document:${value}`,
    path: value,
  };
}

function sourceTarget(value: string): ResolvedTarget {
  const path = normalizePath(value);
  return {
    nodeId: `source:${path}`,
    path,
  };
}

function evidenceTarget(value: string): ResolvedTarget {
  return {
    nodeId: `evidence:${value}`,
    path: value,
  };
}

function contextTarget(field: string, value: string): ResolvedTarget {
  const path = `${field}:${value}`;
  return {
    nodeId: `context:${path}`,
    path,
  };
}

function taskNodeTarget(document: DocumentEnvelope, task: DocumentTask): ResolvedTarget {
  return {
    nodeId: taskNodeId(document, task),
    path: `${document.path}#${task.id}`,
  };
}

function documentNodeId(document: DocumentEnvelope): string {
  return `document:${document.stableId}`;
}

function taskNodeId(document: DocumentEnvelope, task: DocumentTask): string {
  return `task:${document.stableId}:${task.id}`;
}

function reasonFor(
  document: DocumentEnvelope,
  input: {
    readonly reason: string;
    readonly rawSource: DocumentRawSourcePointer;
    readonly target: ResolvedTarget;
    readonly metadata?: DocumentMetadata;
  },
): DocumentGraphEdgeReason {
  return {
    adapterId: document.adapterId,
    reason: input.reason,
    rawSource: input.rawSource,
    sourceDocumentId: document.stableId,
    sourceDocumentPath: document.path,
    targetNodeId: input.target.nodeId,
    targetNodePath: input.target.path,
    metadata: {
      sourceDocumentKind: document.kind,
      ...(input.metadata ?? {}),
    },
  };
}

function rawSourceFor(
  document: DocumentEnvelope,
  pointer?: string,
  metadata: DocumentMetadata = {},
): DocumentRawSourcePointer {
  return {
    path: document.rawSource.path,
    ...(pointer ? { pointer } : document.rawSource.pointer ? { pointer: document.rawSource.pointer } : {}),
    ...(document.rawSource.sourceSchema ? { sourceSchema: document.rawSource.sourceSchema } : {}),
    metadata: {
      ...document.rawSource.metadata,
      ...metadata,
    },
  };
}

function sourceTargetValue(source: DocumentSource): string | undefined {
  return source.path
    ?? asString(source.metadata.value)
    ?? source.label
    ?? source.id;
}

function taskTraceDependencies(task: DocumentTask): readonly string[] {
  return unique([
    ...metadataStringValues(task.metadata.dependsOn),
    ...metadataStringValues(task.metadata.dependencies),
    ...metadataStringValues(task.metadata.prerequisites),
  ]);
}

function isRuleDocument(document: DocumentEnvelope): boolean {
  return document.kind === "rule" || document.path.endsWith(".rule.md");
}

function metadataStringValues(value: unknown): readonly string[] {
  if (typeof value === "string") return [value].filter(Boolean);
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => typeof item === "string" ? item.trim() : "")
    .filter((item) => item.length > 0);
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+/g, "/");
}

function isPathLikeRef(value: string): boolean {
  return (
    value.includes("/") ||
    value.includes("\\") ||
    /\.(?:json|js|jsx|ts|tsx|md|cjs|mjs|css|html|yml|yaml|toml|sql)(?::|$)/.test(value)
  );
}

function unique(values: readonly (string | undefined)[]): readonly string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function compareGraphEdges(
  left: DocumentGraphEdgeSummary,
  right: DocumentGraphEdgeSummary,
): number {
  return TRAVERSAL_AXIS_PRIORITY[left.axis] - TRAVERSAL_AXIS_PRIORITY[right.axis]
    || left.kind.localeCompare(right.kind)
    || left.fromNodeId.localeCompare(right.fromNodeId)
    || left.toNodeId.localeCompare(right.toNodeId)
    || (left.authoredType ?? "").localeCompare(right.authoredType ?? "");
}

class EdgeBuilder {
  private readonly edgesByKey = new Map<string, DocumentGraphEdgeSummary>();

  add(input: AddEdgeInput): void {
    const key = [
      input.kind,
      input.axis,
      input.fromNodeId,
      input.toNodeId,
      input.authoredType ?? "",
    ].join("\u0000");
    const existing = this.edgesByKey.get(key);
    if (existing) {
      this.edgesByKey.set(key, {
        ...existing,
        reasons: [...existing.reasons, input.reason],
        metadata: {
          ...existing.metadata,
          ...(input.metadata ?? {}),
        },
      });
      return;
    }

    this.edgesByKey.set(key, {
      id: `edge:${input.axis}:${input.kind}:${input.fromNodeId}->${input.toNodeId}${input.authoredType ? `:${input.authoredType}` : ""}`,
      kind: input.kind,
      axis: input.axis,
      fromNodeId: input.fromNodeId,
      toNodeId: input.toNodeId,
      ...(input.authoredType ? { authoredType: input.authoredType } : {}),
      reasons: [input.reason],
      metadata: input.metadata ?? {},
    });
  }

  edges(): readonly DocumentGraphEdgeSummary[] {
    return [...this.edgesByKey.values()];
  }
}
