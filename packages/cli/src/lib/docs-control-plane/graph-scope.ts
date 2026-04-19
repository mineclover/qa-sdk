// @def.boundary docs-control-plane
// @def.doc docs-control-plane

import type { DocumentGraphTraversalResult } from "./graph-traverse.js";
import type { DocumentEnvelope } from "doc-envelope";

export interface DocumentGraphTraversalDocumentScope {
  readonly documents: readonly DocumentEnvelope[];
  readonly reasonByDocumentKey: ReadonlyMap<string, string>;
}

type TraversalNode = DocumentGraphTraversalResult["nodes"][number];

export function collectDocumentGraphTraversalDocuments(
  documents: readonly DocumentEnvelope[],
  traversal: DocumentGraphTraversalResult,
  reasonForNode: (node: TraversalNode) => string = defaultDocumentGraphTraversalNodeReason,
): DocumentGraphTraversalDocumentScope {
  const selected = new Map<string, DocumentEnvelope>();
  const reasonByDocumentKey = new Map<string, string>();

  for (const node of traversal.nodes) {
    const reason = reasonForNode(node);
    for (const document of documentsForTraversalNode(documents, node)) {
      const key = documentKey(document);
      selected.set(key, document);
      if (!reasonByDocumentKey.has(key) || reason === "target") {
        reasonByDocumentKey.set(key, reason);
      }
    }
  }

  return {
    documents: [...selected.values()].toSorted(compareDocuments),
    reasonByDocumentKey,
  };
}

export function defaultDocumentGraphTraversalNodeReason(node: TraversalNode): string {
  if (node.depth === 0) return "target";
  const axis = node.pathFromTarget.steps[node.pathFromTarget.steps.length - 1]?.axis;
  return axis ? `graph:${axis}` : "graph";
}

function documentsForTraversalNode(
  documents: readonly DocumentEnvelope[],
  node: TraversalNode,
): readonly DocumentEnvelope[] {
  const identities: Array<{ readonly stableId?: string; readonly path?: string }> = [];

  if (node.id.startsWith("document:")) {
    identities.push({
      stableId: node.stableId,
      path: node.path,
    });
  }

  const sourceDocumentId = asString(node.metadata.sourceDocumentId);
  const sourceDocumentPath = asString(node.metadata.sourceDocumentPath);
  if (sourceDocumentId || sourceDocumentPath) {
    identities.push({
      stableId: sourceDocumentId,
      path: sourceDocumentPath,
    });
  }

  for (const reason of node.reasons) {
    if (reason.sourceDocumentId || reason.sourceDocumentPath) {
      identities.push({
        stableId: reason.sourceDocumentId,
        path: reason.sourceDocumentPath,
      });
    }
  }

  const seen = new Set<string>();
  const matches: DocumentEnvelope[] = [];
  for (const identity of identities) {
    for (const document of documents) {
      if (!documentMatchesTraversalIdentity(document, identity)) continue;
      const key = documentKey(document);
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push(document);
    }
  }
  return matches;
}

function documentMatchesTraversalIdentity(
  document: DocumentEnvelope,
  identity: { readonly stableId?: string; readonly path?: string },
): boolean {
  if (identity.stableId && document.stableId === identity.stableId) return true;
  if (!identity.path) return false;
  return normalizePath(document.path) === normalizePath(stripNodePathAnchor(identity.path));
}

function stripNodePathAnchor(path: string): string {
  return path.split("#")[0] ?? path;
}

function documentKey(document: DocumentEnvelope): string {
  return `${document.adapterId}:${document.stableId}:${document.path}`;
}

function compareDocuments(left: DocumentEnvelope, right: DocumentEnvelope): number {
  return left.path.localeCompare(right.path)
    || left.kind.localeCompare(right.kind)
    || left.stableId.localeCompare(right.stableId);
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+/g, "/");
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}
