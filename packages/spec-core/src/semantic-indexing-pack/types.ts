// @def.boundary spec-engine-system
// @def.doc coord-semantic-indexing-pack

export const SEMANTIC_INDEXING_PLANES = [
  'semantic-source',
  'taxonomy',
  'coordinate',
  'transition',
  'materialization',
  'feedback',
] as const;

export type SemanticIndexingPlane = (typeof SEMANTIC_INDEXING_PLANES)[number];

export type SemanticIndexingSurfaceKind =
  | 'doc'
  | 'package'
  | 'source'
  | 'materialized-index'
  | 'visualization';

export type SemanticIndexingSurfaceRole =
  | 'public-library'
  | 'browser-edge'
  | 'runtime-service'
  | 'ui-demo'
  | 'visualization'
  | 'other';

export interface SemanticIndexingSurfaceRef {
  readonly id: string;
  readonly kind: SemanticIndexingSurfaceKind;
  readonly path?: string;
  readonly role?: SemanticIndexingSurfaceRole;
  readonly lastChangedAt?: string;
  readonly dirty?: boolean;
}

export interface SemanticIndexingPackPlaneRef {
  readonly plane: SemanticIndexingPlane;
  readonly refs: readonly SemanticIndexingSurfaceRef[];
}

export interface SemanticIndexingPackManifest {
  readonly packId: string;
  readonly version: string;
  readonly planes: readonly SemanticIndexingPackPlaneRef[];
  readonly metadata?: Record<string, unknown>;
}

export interface SemanticIndexingPackSnapshot {
  readonly manifest: SemanticIndexingPackManifest;
  readonly sourceFingerprint: string;
  readonly surfaces: readonly SemanticIndexingSurfaceRef[];
  readonly capturedAt: string;
}

export type SemanticIndexingChangeKind =
  | 'doc-update'
  | 'alias-add'
  | 'entry-add'
  | 'axis-add'
  | 'axis-entry-meaning-change'
  | 'prefix-shape-change'
  | 'capacity-change'
  | 'transition-add'
  | 'materialized-index-refresh'
  | 'feedback-proposal'
  | 'version-transition'
  | 'invalid'
  | 'unknown';

export interface SemanticIndexingSurfaceChangeInput {
  readonly changeId?: string;
  readonly surface: Pick<SemanticIndexingSurfaceRef, 'id' | 'path' | 'kind' | 'role'>;
  readonly plane?: SemanticIndexingPlane;
  readonly changeKind: SemanticIndexingChangeKind;
  readonly evidence?: Record<string, unknown>;
}

export type SemanticIndexingChangeClassificationReason =
  | 'explicit-plane'
  | 'manifest-ref'
  | 'path-heuristic'
  | 'fallback';

export interface SemanticIndexingPackChange extends SemanticIndexingSurfaceChangeInput {
  readonly plane: SemanticIndexingPlane;
  readonly reason: SemanticIndexingChangeClassificationReason;
}

export type SemanticIndexingCompatibilityVerdict =
  | 'compatible'
  | 'review-required'
  | 'version-transition-required'
  | 'invalid';

export interface SemanticIndexingPackValidationIssue {
  readonly level: 'error' | 'warning';
  readonly code: string;
  readonly message: string;
  readonly path: string;
}

export interface SemanticIndexingPackValidationResult {
  readonly valid: boolean;
  readonly issues: readonly SemanticIndexingPackValidationIssue[];
}

export interface SemanticIndexingCompatibilityReport {
  readonly verdict: SemanticIndexingCompatibilityVerdict;
  readonly reasons: readonly string[];
  readonly validation: SemanticIndexingPackValidationResult;
  readonly changes: readonly SemanticIndexingPackChange[];
}

export type SemanticIndexingPromotionProposalKind =
  | 'alias-add'
  | 'entry-add'
  | 'axis-promotion'
  | 'version-transition';

export interface SemanticIndexingPromotionProposalInput {
  readonly kind: SemanticIndexingPromotionProposalKind;
  readonly term: string;
  readonly evidence?: Record<string, unknown>;
}

export interface SemanticIndexingPromotionProposal {
  readonly kind: SemanticIndexingPromotionProposalKind;
  readonly term: string;
  readonly normalizedTerm: string;
  readonly dedupeKey: string;
  readonly evidence: Record<string, unknown>;
}

export interface SemanticIndexingPromotionSummary {
  readonly kind: SemanticIndexingPromotionProposalKind;
  readonly count: number;
  readonly terms: readonly string[];
}

export interface SemanticIndexingReportPlaneSurfaces {
  readonly plane: SemanticIndexingPlane;
  readonly surfaces: readonly SemanticIndexingSurfaceRef[];
}

export interface SemanticIndexingPackReportInput {
  readonly manifest: SemanticIndexingPackManifest;
  readonly changes?: readonly SemanticIndexingSurfaceChangeInput[];
  readonly promotionProposals?: readonly SemanticIndexingPromotionProposal[];
  readonly surfaces?: readonly SemanticIndexingSurfaceRef[];
  readonly generatedAt?: string;
}

export interface SemanticIndexingPackReport {
  readonly packId: string;
  readonly version: string;
  readonly generatedAt: string;
  readonly reviewOnly: true;
  readonly validation: SemanticIndexingPackValidationResult;
  readonly compatibility: SemanticIndexingCompatibilityReport;
  readonly surfaces: readonly SemanticIndexingSurfaceRef[];
  readonly surfacesByPlane: readonly SemanticIndexingReportPlaneSurfaces[];
  readonly promotionSummary: readonly SemanticIndexingPromotionSummary[];
  readonly promotionProposals: readonly SemanticIndexingPromotionProposal[];
}

export type SemanticIndexingGroundingIntent = 'rag' | 'text-to-sql' | 'user-search';

export interface SemanticIndexingGroundingPlannerInput {
  readonly report: SemanticIndexingPackReport;
  readonly intent: SemanticIndexingGroundingIntent;
  readonly query: string;
  readonly candidateLimit?: number;
}

export interface SemanticIndexingMaterializedIndexDelegation {
  readonly surfaceId: string;
  readonly ownerPath?: string;
  readonly action: 'delegate-to-owner-package';
}

export interface SemanticIndexingGroundingPlan {
  readonly intent: SemanticIndexingGroundingIntent;
  readonly query: string;
  readonly packId: string;
  readonly version: string;
  readonly packVerdict: SemanticIndexingCompatibilityVerdict;
  readonly groundable: boolean;
  readonly reviewOnly: true;
  readonly allowedPlanes: readonly SemanticIndexingPlane[];
  readonly candidateSurfaces: readonly SemanticIndexingSurfaceRef[];
  readonly materializedIndexDelegations: readonly SemanticIndexingMaterializedIndexDelegation[];
  readonly fallbackReason?: 'version-transition-required' | 'invalid-pack';
}
