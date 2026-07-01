// @def.boundary spec-engine-system
// @def.doc coord-semantic-indexing-pack

import type { SemanticIndexingSurfaceRef, SemanticIndexingSurfaceRole } from "./types.js";

const ROLE_PRIORITY: Record<SemanticIndexingSurfaceRole, number> = {
  "public-library": 0,
  "browser-edge": 1,
  "runtime-service": 2,
  "ui-demo": 3,
  visualization: 4,
  other: 5,
};

function timestamp(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function rolePriority(role: SemanticIndexingSurfaceRole | undefined): number {
  return ROLE_PRIORITY[role ?? "other"];
}

export function sortSemanticIndexingPackSurfaces(
  surfaces: readonly SemanticIndexingSurfaceRef[],
): readonly SemanticIndexingSurfaceRef[] {
  return [...surfaces].sort((left, right) => {
    if (Boolean(left.dirty) !== Boolean(right.dirty)) return left.dirty ? -1 : 1;
    const freshness = timestamp(right.lastChangedAt) - timestamp(left.lastChangedAt);
    if (freshness !== 0) return freshness;
    const role = rolePriority(left.role) - rolePriority(right.role);
    if (role !== 0) return role;
    return left.id.localeCompare(right.id);
  });
}
