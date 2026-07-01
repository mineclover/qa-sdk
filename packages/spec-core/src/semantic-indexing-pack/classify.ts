// @def.boundary spec-engine-system
// @def.doc coord-semantic-indexing-pack

import type {
  SemanticIndexingPackChange,
  SemanticIndexingPackManifest,
  SemanticIndexingPlane,
  SemanticIndexingSurfaceChangeInput,
} from "./types.js";

function normalizePath(path: string | undefined): string {
  return (path ?? "").toLowerCase();
}

function inferPlaneFromPath(path: string): SemanticIndexingPlane {
  if (path.includes("feedback") || path.includes("unresolved") || path.includes("proposal")) return "feedback";
  if (path.includes("transition")) return "transition";
  if (
    path.includes("address-index") ||
    path.includes("text-index") ||
    path.includes("vector") ||
    path.includes("sql") ||
    path.includes("materialized")
  ) {
    return "materialization";
  }
  if (
    path.includes("coord-") ||
    path.includes("coordinate") ||
    path.includes("index-meta") ||
    path.includes("weighted-index") ||
    path.includes("schema-layer") ||
    path.includes("prefix") ||
    path.includes("axis") ||
    path.includes("address")
  ) {
    return "coordinate";
  }
  if (path.includes("taxonomy") || path.includes("ontology")) return "taxonomy";
  if (path.includes("semantic")) return "semantic-source";
  return "semantic-source";
}

function buildManifestPlaneIndex(manifest: SemanticIndexingPackManifest): Map<string, SemanticIndexingPlane> {
  const index = new Map<string, SemanticIndexingPlane>();
  for (const plane of manifest.planes) {
    for (const ref of plane.refs) {
      index.set(ref.id, plane.plane);
      if (ref.path) index.set(normalizePath(ref.path), plane.plane);
    }
  }
  return index;
}

export function classifySemanticIndexingPackChanges(
  manifest: SemanticIndexingPackManifest,
  changes: readonly SemanticIndexingSurfaceChangeInput[],
): readonly SemanticIndexingPackChange[] {
  const manifestPlaneIndex = buildManifestPlaneIndex(manifest);

  return changes.map((change) => {
    if (change.plane) {
      return { ...change, plane: change.plane, reason: "explicit-plane" };
    }

    const path = normalizePath(change.surface.path);
    const manifestPlane = manifestPlaneIndex.get(change.surface.id) ?? manifestPlaneIndex.get(path);
    if (manifestPlane) {
      return { ...change, plane: manifestPlane, reason: "manifest-ref" };
    }

    if (path.length > 0) {
      return { ...change, plane: inferPlaneFromPath(path), reason: "path-heuristic" };
    }

    return { ...change, plane: "semantic-source", reason: "fallback" };
  });
}
