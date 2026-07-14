// @def.boundary spec-engine-system
// @def.doc coord-semantic-indexing-pack

import { sortSemanticIndexingPackSurfaces } from './sort.js';
import type {
  SemanticIndexingGroundingIntent,
  SemanticIndexingGroundingPlan,
  SemanticIndexingGroundingPlannerInput,
  SemanticIndexingMaterializedIndexDelegation,
  SemanticIndexingPackReport,
  SemanticIndexingPlane,
  SemanticIndexingSurfaceRef,
} from './types.js';

const INTENT_PLANES: Record<SemanticIndexingGroundingIntent, readonly SemanticIndexingPlane[]> = {
  rag: ['semantic-source', 'taxonomy', 'coordinate', 'materialization'],
  'text-to-sql': ['semantic-source', 'taxonomy', 'coordinate', 'materialization'],
  'user-search': ['semantic-source', 'taxonomy', 'materialization', 'feedback'],
};

function surfacesForPlane(
  report: SemanticIndexingPackReport,
  plane: SemanticIndexingPlane,
): readonly SemanticIndexingSurfaceRef[] {
  return report.surfacesByPlane.find((entry) => entry.plane === plane)?.surfaces ?? [];
}

function materializedIndexDelegations(
  report: SemanticIndexingPackReport,
): readonly SemanticIndexingMaterializedIndexDelegation[] {
  return surfacesForPlane(report, 'materialization').map((surface) => ({
    surfaceId: surface.id,
    ...(surface.path ? { ownerPath: surface.path } : {}),
    action: 'delegate-to-owner-package',
  }));
}

function candidateSurfaces(
  report: SemanticIndexingPackReport,
  planes: readonly SemanticIndexingPlane[],
  limit: number | undefined,
): readonly SemanticIndexingSurfaceRef[] {
  const candidates = planes.flatMap((plane) => [
    ...sortSemanticIndexingPackSurfaces(surfacesForPlane(report, plane)),
  ]);
  return limit === undefined ? candidates : candidates.slice(0, limit);
}

export function planSemanticIndexingGrounding(
  input: SemanticIndexingGroundingPlannerInput,
): SemanticIndexingGroundingPlan {
  const allowedPlanes = INTENT_PLANES[input.intent];
  const delegations = materializedIndexDelegations(input.report);
  const packVerdict = input.report.compatibility.verdict;

  if (packVerdict === 'invalid') {
    return {
      intent: input.intent,
      query: input.query,
      packId: input.report.packId,
      version: input.report.version,
      packVerdict,
      groundable: false,
      reviewOnly: true,
      allowedPlanes,
      candidateSurfaces: [],
      materializedIndexDelegations: delegations,
      fallbackReason: 'invalid-pack',
    };
  }

  if (packVerdict === 'version-transition-required') {
    return {
      intent: input.intent,
      query: input.query,
      packId: input.report.packId,
      version: input.report.version,
      packVerdict,
      groundable: false,
      reviewOnly: true,
      allowedPlanes,
      candidateSurfaces: [],
      materializedIndexDelegations: delegations,
      fallbackReason: 'version-transition-required',
    };
  }

  return {
    intent: input.intent,
    query: input.query,
    packId: input.report.packId,
    version: input.report.version,
    packVerdict,
    groundable: true,
    reviewOnly: true,
    allowedPlanes,
    candidateSurfaces: candidateSurfaces(input.report, allowedPlanes, input.candidateLimit),
    materializedIndexDelegations: delegations,
  };
}
