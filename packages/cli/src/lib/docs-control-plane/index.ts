// @def.boundary docs-control-plane
// @def.doc docs-control-plane

export { defineDocumentAdapter, normalizeDocumentEnvelope } from 'doc-envelope';
export {
  ARTIFACT_EVIDENCE_ADAPTER_ID,
  createArtifactEvidenceAdapter,
} from './adapters/artifact-evidence.js';
export {
  createDefinitionMarkdownAdapter,
  DEFINITION_MARKDOWN_ADAPTER_ID,
} from './adapters/definition-markdown.js';
export { createPrdMarkdownAdapter, PRD_MARKDOWN_ADAPTER_ID } from './adapters/prd-markdown.js';
export {
  buildRalphPrdJsonEnvelopeFromContent,
  createRalphPrdJsonAdapter,
  createRalphSessionAdapter,
} from 'ralph-tui-integration';
export { previewPrdCompletionSync } from './prd-completion-sync.js';
export {
  AUTHORED_LINK_AXIS_MAP,
  CANONICAL_TRAVERSAL_AXES,
  DOCUMENT_GRAPH_FAMILY_ROLE_TYPES,
  DOCUMENT_GRAPH_EDGE_KINDS,
  DOCUMENT_GRAPH_NODE_KINDS,
  ENVELOPE_FIELD_AXIS_MAP,
  isDocumentGraphNodeKind,
  isTraversalAxis,
  isTraversalDirection,
  isTraversalPresetId,
  TRAVERSAL_AXIS_PRIORITY,
  TRAVERSAL_DIRECTIONS,
  TRAVERSAL_PRESET_IDS,
} from './graph-types.js';
export { getTraversalPreset, TRAVERSAL_PRESETS } from './graph-presets.js';
export { normalizeDocumentGraphEdges } from './graph-normalize.js';
export { buildDocumentGraphIndex } from './graph-index.js';
export {
  BROAD_DOCUMENT_GRAPH_TRAVERSAL_WARNING,
  DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_DEPTH,
  DEFAULT_DOCUMENT_GRAPH_TRAVERSAL_LIMIT,
  formatDocumentGraphTraversalRoleGroups,
  MAX_DOCUMENT_GRAPH_TRAVERSAL_LIMIT,
  MAX_DOCUMENT_GRAPH_TRAVERSAL_DEPTH,
  normalizeDocumentGraphTraversalInput,
  summarizeDocumentGraphTraversalMissingRoles,
  traverseDocumentGraph,
} from './graph-traverse.js';
export {
  DOCUMENT_GRAPH_RANK_ALGORITHM,
  DOCUMENT_GRAPH_RANK_FACTORS,
  rankDocumentGraphTraversal,
} from './graph-rank.js';
export {
  DOCUMENT_GRAPH_FILTER_ALGORITHM,
  filterDocumentGraphRanking,
  normalizeDocumentGraphViewFilters,
} from './graph-filter.js';
export { DOCUMENT_GRAPH_SUMMARY_ALGORITHM, summarizeDocumentGraphResult } from './graph-summary.js';
export {
  collectDocumentGraphTraversalDocuments,
  defaultDocumentGraphTraversalNodeReason,
} from './graph-scope.js';
export {
  collectDocumentFamilyOnlyScope,
  isArchivedPrdDocument,
  isTransientDocument,
} from 'doc-envelope';
export {
  buildDocumentRoleMatrix,
  DOCUMENT_ROLE_MATRIX_ROLES,
  roleOfDocument,
} from './role-matrix.js';
export {
  CANONICAL_TODO_CATEGORY_LABELS,
  classifyTodoHeading,
  parseTodoFollowUps,
} from 'doc-envelope';
export { detectCompletedRecords } from 'doc-envelope';
export { findNextFollowUps } from './follow-ups.js';
export {
  extractBddDocumentMetadata,
  hasBddMetadata,
  validateBddDocumentSet,
} from './bdd-contract-extract.js';
export { extractWorkTopicDocumentMetadata, hasWorkTopicMetadata } from './work-topic-extract.js';
export type {
  AuthoredLinkType,
  DocumentGraphEdgeKind,
  DocumentGraphEdgeReason,
  DocumentGraphEdgeSummary,
  DocumentGraphFamilyRoleType,
  DocumentGraphNodeKind,
  DocumentGraphNodeSummary,
  EnvelopeFieldAxisKey,
  TraversalAxis,
  TraversalDirection,
  TraversalInputSummary,
  TraversalOmittedCounts,
  TraversalPresetDefinition,
  TraversalPresetId,
  TraversalResultSummary,
} from './graph-types.js';
export type { NormalizeDocumentGraphEdgesOptions } from './graph-normalize.js';
export type {
  BuildDocumentGraphIndexOptions,
  DocumentGraphIndex,
  DocumentGraphIndexNode,
  DocumentGraphIndexNodeKind,
  DocumentGraphLookupIndexes,
  DocumentGraphNodeReason,
  DocumentGraphTargetLookupKind,
  DocumentGraphTargetResolution,
} from './graph-index.js';
export type {
  DocumentGraphTraversalEdge,
  DocumentGraphTraversalInput,
  DocumentGraphTraversalMissingRole,
  DocumentGraphTraversalMissingRoleSummary,
  DocumentGraphTraversalNode,
  DocumentGraphTraversalPath,
  DocumentGraphTraversalPathStep,
  DocumentGraphTraversalRoleGroup,
  DocumentGraphTraversalRoleNode,
  DocumentGraphTraversalResult,
  NormalizedDocumentGraphTraversalInput,
} from './graph-traverse.js';
export type {
  DocumentGraphRankedNode,
  DocumentGraphRankFactor,
  DocumentGraphRankFactorName,
  DocumentGraphRankStrength,
  DocumentGraphRankingResult,
} from './graph-rank.js';
export type {
  DocumentGraphFilterCounts,
  DocumentGraphFilterResult,
  DocumentGraphViewFilterInput,
  FilteredDocumentGraphRanking,
  NormalizedDocumentGraphViewFilters,
} from './graph-filter.js';
export type {
  DocumentGraphResultSummary,
  DocumentGraphSummaryArchiveCounts,
  DocumentGraphSummaryDiagnosticCounts,
} from './graph-summary.js';
export type { DocumentGraphTraversalDocumentScope } from './graph-scope.js';
export type { DocumentFamilyOnlyScope, DocumentFamilyOnlyScopeOptions } from 'doc-envelope';
export type {
  BuildDocumentRoleMatrixOptions,
  DocumentRoleMatrix,
  DocumentRoleMatrixDocument,
  DocumentRoleMatrixLinkedDocument,
  DocumentRoleMatrixRelation,
  DocumentRoleMatrixRole,
  DocumentRoleMatrixRoleCoverage,
} from './role-matrix.js';
export type {
  TodoFollowUpCategory,
  TodoHeadingCategory,
  TodoLifecycleFollowUp,
} from 'doc-envelope';
export type { CompletedRecordDetectionOptions, CompletedRecordState } from 'doc-envelope';
export type {
  BddContractDiagnostic,
  BddDocumentMetadata,
  BddValidationDocument,
} from './bdd-contract-extract.js';
export type {
  WorkTopic,
  WorkTopicBoundary,
  WorkTopicDiagnostic,
  WorkTopicDiagnosticSeverity,
  WorkTopicDocumentMetadata,
} from './work-topic-extract.js';
export type { FollowUpDetectionOptions, FollowUpState } from './follow-ups.js';
export type {
  DeterministicLabelInventory,
  DeterministicLabelInventoryOptions,
  DeterministicLabelInventorySummary,
} from 'deterministic-label-registry';
export type {
  DeterministicLabelRecord,
  DeterministicLabelRecordInput,
  DeterministicLabelRecordProjection,
  DeterministicLabelRecordProjectionOptions,
  SemanticCoordinate,
  SemanticCoordinateCandidate,
  SemanticCoordinateCandidateInventory,
  SemanticCoordinateCandidateInventoryOptions,
  SemanticCoordinateCandidateInput,
  SemanticCoordinateCandidateResult,
  SemanticCoordinateDiagnostic,
  SemanticCoordinateDiagnosticCode,
  SemanticCoordinateDomain,
  SemanticCoordinateSkippedDocument,
  SemanticExistingIdSource,
  SemanticCoordinateLabelKind,
  SemanticPhysicalRef,
  SemanticPhysicalRefInput,
  SemanticPhysicalRefKind,
} from 'deterministic-label-registry';
export type {
  DocumentAdapter,
  DocumentAdapterCapabilities,
  DocumentAdapterCapabilityDeclaration,
  DocumentChange,
  DocumentChangeSet,
  DocumentCollectionQuery,
  DocumentDiagnostic,
  DocumentEnvelope,
  DocumentEnvelopeInput,
  DocumentEvidence,
  DocumentLink,
  DocumentMetadata,
  DocumentRawSourcePointer,
  DocumentSection,
  DocumentSource,
  DocumentTask,
} from 'doc-envelope';
export type {
  ArtifactEvidenceAdapterOptions,
  ArtifactEvidenceCollectionQuery,
} from './adapters/artifact-evidence.js';
export type { DefinitionMarkdownAdapterOptions } from './adapters/definition-markdown.js';
export type { PrdMarkdownAdapterOptions } from './adapters/prd-markdown.js';
export type {
  PrdCompletionAffectedDocument,
  PrdCompletionCandidateScore,
  PrdCompletionCandidateSupport,
  PrdCompletionEvidenceRef,
  PrdCompletionOpenTodoCandidate,
  PrdCompletionPromotionState,
  PrdCompletionRoadmapUpdateCandidate,
  PrdCompletionScenarioMatrixUpdateCandidate,
  PrdCompletionSpecUpdateCandidate,
  PrdCompletionStorySummary,
  PrdCompletionSyncOptions,
  PrdCompletionSyncPreview,
} from './prd-completion-sync.js';
export type {
  RalphPrdJsonAdapterOptions,
  RalphPrdJsonSummary,
  RalphSessionAdapterOptions,
} from 'ralph-tui-integration';
