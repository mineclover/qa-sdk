// @def.boundary spec-engine-system
// @def.doc spec-engine-system

import type {
  ClaimCompositeState,
  VerificationClaimInput,
  VerificationClaimSnapshot,
} from "./verification-claim.js";
import { deriveVerificationClaim } from "./verification-claim.js";

export interface ClaimStateCount {
  readonly state: ClaimCompositeState;
  readonly count: number;
}

export interface VerificationClaimReport {
  readonly snapshots: readonly VerificationClaimSnapshot[];
  readonly counts: readonly ClaimStateCount[];
  readonly generatedAt: string;
}

const CLAIM_STATES: readonly ClaimCompositeState[] = [
  "absent",
  "declared",
  "bound",
  "exercised",
  "verified",
  "contradicted",
  "stale",
];

export function generateVerificationClaimReport(
  inputs: readonly VerificationClaimInput[],
): VerificationClaimReport {
  const snapshots = inputs
    .map((input) => deriveVerificationClaim(input))
    .toSorted((a, b) =>
      a.claim.specId.localeCompare(b.claim.specId)
      || a.claim.claimId.localeCompare(b.claim.claimId),
    );

  const counts = CLAIM_STATES.map((state) => ({
    state,
    count: snapshots.filter((snapshot) => snapshot.compositeState === state).length,
  }));

  return {
    snapshots,
    counts,
    generatedAt: new Date().toISOString(),
  };
}
