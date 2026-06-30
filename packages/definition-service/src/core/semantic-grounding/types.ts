// @def.doc definition-service

import type { DocRecord } from "../types.js";

export type SemanticTermKind =
  | "document"
  | "prefix"
  | "axis"
  | "entry"
  | "relation"
  | "table"
  | "field"
  | "code";

export interface SemanticAliasRecord {
  readonly aliasId: string;
  readonly termId: string;
  readonly alias: string;
  readonly normalizedAlias: string;
  readonly locale?: string;
  readonly source: "document" | "manual" | "feedback" | "deterministic-label";
  readonly confidence: number;
  readonly createdAt: string;
}

export interface SemanticRelationRecord {
  readonly relationId: string;
  readonly sourceTermId: string;
  readonly relationType: "same-scope" | "depends-on" | "contains" | "refines" | "mentions";
  readonly targetTermId: string;
  readonly evidence: Record<string, unknown>;
}

export interface SemanticTermRecord {
  readonly termId: string;
  readonly kind: SemanticTermKind;
  readonly canonicalLabel: string;
  readonly normalizedLabel: string;
  readonly coordinate?: string;
  readonly prefixId?: string;
  readonly versionId?: string;
  readonly address?: number;
  readonly docId?: string;
  readonly sourcePath?: string;
  readonly evidence: Record<string, unknown>;
  readonly updatedAt: string;
}

export interface SemanticTermWithAliases extends SemanticTermRecord {
  readonly aliases: readonly SemanticAliasRecord[];
  readonly relations: readonly SemanticRelationRecord[];
}

export interface SemanticQuery {
  readonly raw: string;
  readonly normalized: string;
  readonly tokens: readonly string[];
}

export type SemanticCandidateMatch =
  | "canonical-label"
  | "alias"
  | "token-overlap"
  | "relation-neighbor";

export interface SemanticEvidence {
  readonly kind: SemanticCandidateMatch;
  readonly ref: string;
  readonly weight: number;
}

export interface SemanticCandidate {
  readonly termId: string;
  readonly canonicalLabel: string;
  readonly confidence: number;
  readonly matchedBy: SemanticCandidateMatch;
  readonly evidence: readonly SemanticEvidence[];
  readonly docId?: string;
  readonly coordinate?: string;
  readonly prefixId?: string;
  readonly versionId?: string;
  readonly address?: number;
}

export interface SemanticResolveOptions {
  readonly confidenceThreshold?: number;
  readonly limit?: number;
}

export interface SemanticResolution {
  readonly query: SemanticQuery;
  readonly candidates: readonly SemanticCandidate[];
  readonly confident: boolean;
}

export interface GroundingPlannerOptions {
  readonly confidenceThreshold?: number;
  readonly candidateLimit?: number;
}

export interface GroundingPlan {
  readonly kind: "document-search";
  readonly query: string;
  readonly candidateDocIds: readonly string[];
  readonly candidates: readonly SemanticCandidate[];
  readonly fallbackReason?: "empty-query" | "no-candidate" | "no-confident-candidate";
}

export interface SemanticDocumentMergeInput {
  readonly semanticDocs: readonly DocRecord[];
  readonly legacyDocs: readonly DocRecord[];
  readonly candidateDocIds: readonly string[];
  readonly limit: number;
  readonly offset: number;
}

export type FeedbackProposalKind =
  | "alias-add"
  | "entry-add"
  | "axis-promotion"
  | "version-transition"
  | "wrong-scope-or-alias-missing";

export interface FeedbackProposalInput {
  readonly kind: FeedbackProposalKind;
  readonly term: string;
  readonly query?: string;
  readonly evidence?: Record<string, unknown>;
}

export interface FeedbackProposalDraft {
  readonly kind: FeedbackProposalKind;
  readonly term: string;
  readonly normalizedTerm: string;
  readonly dedupeKey: string;
  readonly payload: Record<string, unknown>;
  readonly evidence: Record<string, unknown>;
}

export interface FeedbackProposalRecord extends FeedbackProposalDraft {
  readonly proposalId: string;
  readonly status: "open" | "accepted" | "rejected";
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SemanticGroundingEventInput {
  readonly query: string;
  readonly intent: "document-search" | "rag" | "text-to-sql" | "user-search";
  readonly candidates: readonly SemanticCandidate[];
  readonly plan: GroundingPlan;
  readonly outcome: "semantic-hit" | "legacy-fallback" | "no-hit" | "mixed";
}
