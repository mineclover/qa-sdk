// @def.boundary spec-engine-system
// @def.doc spec-engine-system

import type { ContractEvidence, ContractMarkerKind } from './types.js';
import type { ClaimSectionInput, ExtractedClaim } from './claim-extractor.js';
import { extractClaimsFromSections } from './claim-extractor.js';
import type {
  ClaimDefinitionInput,
  ClaimImplementationInput,
  ClaimReviewInput,
  ClaimRuntimeInput,
  ClaimTestingInput,
  VerificationClaimInput,
  VerificationClaimSnapshot,
} from './verification-claim.js';
import { deriveVerificationClaim } from './verification-claim.js';

export type GateVerificationStatus = 'verified' | 'failed' | 'stale' | 'unverified';

export type ReviewStatus = 'reviewed' | 'stale' | 'unreviewed';

export interface ClaimAuditGateStatus {
  readonly gateDocId: string;
  readonly status: GateVerificationStatus;
}

export interface ClaimAuditFileReview {
  readonly filePath: string;
  readonly status: ReviewStatus;
}

export interface ClaimAuditBinding {
  readonly claimId?: string;
  readonly sourceId?: string;
  readonly marker?: ContractMarkerKind;
  readonly implementation?: ClaimImplementationInput;
  readonly testing?: ClaimTestingInput;
  readonly runtime?: ClaimRuntimeInput;
  readonly review?: ClaimReviewInput;
  readonly stale?: boolean;
}

export interface VerificationClaimAuditInput {
  readonly sections: readonly ClaimSectionInput[];
  readonly bindings?: readonly ClaimAuditBinding[];
  readonly gateStatuses?: readonly ClaimAuditGateStatus[];
  readonly reviews?: readonly ClaimAuditFileReview[];
  readonly definition?: ClaimDefinitionInput;
}

export interface VerificationClaimAuditRow extends VerificationClaimSnapshot {
  readonly gateStatuses: readonly ClaimAuditGateStatus[];
  readonly reviews: readonly ClaimAuditFileReview[];
}

export interface VerificationClaimAuditReport {
  readonly claims: readonly VerificationClaimAuditRow[];
  readonly counts: Readonly<Record<string, number>>;
  readonly generatedAt: string;
}

const VALIDATION_MARKERS = new Set<ContractMarkerKind>(['postcondition', 'failure', 'evidence']);

export function generateVerificationClaimAudit(
  input: VerificationClaimAuditInput,
): VerificationClaimAuditReport {
  const claims = extractClaimsFromSections(input.sections);

  const rows = claims.map((claim) =>
    buildAuditRow(
      claim,
      input.bindings ?? [],
      input.gateStatuses ?? [],
      input.reviews ?? [],
      input.definition,
    ),
  );

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.compositeState] = (counts[row.compositeState] ?? 0) + 1;
  }

  return {
    claims: rows,
    counts,
    generatedAt: new Date().toISOString(),
  };
}

function buildAuditRow(
  claim: ExtractedClaim,
  bindings: readonly ClaimAuditBinding[],
  gateStatuses: readonly ClaimAuditGateStatus[],
  reviews: readonly ClaimAuditFileReview[],
  defaultDefinition?: ClaimDefinitionInput,
): VerificationClaimAuditRow {
  const binding = resolveBinding(claim, bindings);
  const gateProjection = projectGateStatuses(claim.marker, gateStatuses);
  const reviewProjection = projectReviewState(reviews);

  const snapshot = deriveVerificationClaim({
    claim,
    definition: {
      declared: true,
      structured: true,
      linked: true,
      ...defaultDefinition,
    },
    implementation: binding.implementation,
    testing: mergeTesting(binding.testing, gateProjection.testing),
    runtime: mergeRuntime(binding.runtime, gateProjection.runtime),
    review: mergeReview(binding.review, reviewProjection.review),
    stale: binding.stale === true || gateProjection.stale || reviewProjection.stale,
  });

  return {
    ...snapshot,
    gateStatuses,
    reviews,
  };
}

function resolveBinding(
  claim: ExtractedClaim,
  bindings: readonly ClaimAuditBinding[],
): ClaimAuditBinding {
  const markerBinding = bindings.find(
    (binding) => binding.claimId == null && binding.marker === claim.marker,
  );
  const sourceBinding = bindings.find(
    (binding) => binding.claimId == null && binding.sourceId === claim.sourceId,
  );
  const claimBinding = bindings.find((binding) => binding.claimId === claim.claimId);

  return {
    implementation:
      claimBinding?.implementation ??
      sourceBinding?.implementation ??
      markerBinding?.implementation,
    testing: claimBinding?.testing ?? sourceBinding?.testing ?? markerBinding?.testing,
    runtime: claimBinding?.runtime ?? sourceBinding?.runtime ?? markerBinding?.runtime,
    review: claimBinding?.review ?? sourceBinding?.review ?? markerBinding?.review,
    stale: claimBinding?.stale ?? sourceBinding?.stale ?? markerBinding?.stale,
  };
}

function mergeTesting(
  a: ClaimTestingInput | undefined,
  b: ClaimTestingInput | undefined,
): ClaimTestingInput | undefined {
  if (!a && !b) return undefined;
  return {
    bindings: [...(a?.bindings ?? []), ...(b?.bindings ?? [])],
    evidences: [...(a?.evidences ?? []), ...(b?.evidences ?? [])],
  };
}

function mergeReview(
  a: ClaimReviewInput | undefined,
  b: ClaimReviewInput | undefined,
): ClaimReviewInput | undefined {
  if (!a && !b) return undefined;
  return {
    reviewed: a?.reviewed === true || b?.reviewed === true,
    accepted: a?.accepted === true || b?.accepted === true,
  };
}

function mergeRuntime(
  a: ClaimRuntimeInput | undefined,
  b: ClaimRuntimeInput | undefined,
): ClaimRuntimeInput | undefined {
  if (!a && !b) return undefined;
  return {
    observable: a?.observable === true || b?.observable === true,
    observed: a?.observed === true || b?.observed === true,
  };
}

function projectGateStatuses(
  marker: ContractMarkerKind | undefined,
  statuses: readonly ClaimAuditGateStatus[],
): {
  readonly testing?: ClaimTestingInput;
  readonly runtime?: ClaimRuntimeInput;
  readonly stale: boolean;
} {
  if (statuses.length === 0) {
    return { stale: false };
  }

  const bindings = statuses.map((status) => status.gateDocId);
  const stale = statuses.some((status) => status.status === 'stale');
  const observed = statuses.some((status) => status.status !== 'unverified');

  if (!marker || !VALIDATION_MARKERS.has(marker)) {
    return {
      testing: { bindings },
      runtime: { observable: true, observed },
      stale,
    };
  }

  const evidences: ContractEvidence[] = [];
  if (statuses.some((status) => status.status === 'failed')) {
    evidences.push(makeGateEvidence('fail'));
  } else if (statuses.length > 0 && statuses.every((status) => status.status === 'verified')) {
    evidences.push(makeGateEvidence('pass'));
  }

  return {
    testing: { bindings, evidences },
    runtime: { observable: true, observed },
    stale,
  };
}

function projectReviewState(reviews: readonly ClaimAuditFileReview[]): {
  readonly review?: ClaimReviewInput;
  readonly stale: boolean;
} {
  if (reviews.length === 0) {
    return { stale: false };
  }

  const stale = reviews.some((review) => review.status === 'stale');
  const allReviewed = reviews.every((review) => review.status === 'reviewed');
  const anyReviewed = reviews.some((review) => review.status === 'reviewed');

  return {
    review: {
      reviewed: anyReviewed,
      accepted: allReviewed,
    },
    stale,
  };
}

function makeGateEvidence(status: 'pass' | 'fail'): ContractEvidence {
  return {
    specId: '__gate_projection__',
    status,
    source: 'test',
    timestamp: new Date().toISOString(),
  };
}
