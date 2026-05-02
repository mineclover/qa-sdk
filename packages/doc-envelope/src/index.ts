/**
 * doc-envelope — document envelope model.
 *
 * 목적: PRD/정의/ralph/evidence 문서를 하나의 neutral read-only data shape로
 * 표현하는 수집 계층(collection layer). 해석(graph ranking, FSM readiness 등)은
 * 소비하는 패키지가 수행한다.
 */

// @def.boundary deterministic-label-architecture
// @def.doc doc-envelope

// ─── Envelope types ─────────────────────────────────────
export type {
  DocumentAdapter,
  DocumentAdapterCapabilities,
  DocumentAdapterCapabilityDeclaration,
  DocumentChange,
  DocumentChangeSet,
  DocumentCollectionQuery,
  DocumentDiagnostic,
  DocumentDiagnosticInput,
  DocumentEnvelope,
  DocumentEnvelopeInput,
  DocumentEvidence,
  DocumentEvidenceInput,
  DocumentLink,
  DocumentLinkInput,
  DocumentMetadata,
  DocumentRawSourcePointer,
  DocumentSection,
  DocumentSectionInput,
  DocumentSource,
  DocumentSourceInput,
  DocumentTask,
  DocumentTaskInput,
  RawSourcePointerInput,
} from "./types.js";

// ─── Normalization ──────────────────────────────────────
export {
  declareDocumentAdapterCapabilities,
  defineDocumentAdapter,
  normalizeDocumentEnvelope,
  normalizeRawSourcePointer,
} from "./normalize.js";

// ─── Query ──────────────────────────────────────────────
export { matchesDocumentQuery } from "./query.js";

// ─── Family scope utilities ─────────────────────────────
export {
  collectDocumentFamilyOnlyScope,
  isArchivedPrdDocument,
  isTransientDocument,
} from "./family-scope.js";

export type {
  DocumentFamilyOnlyScope,
  DocumentFamilyOnlyScopeOptions,
} from "./family-scope.js";

// ─── Completed record detection ─────────────────────────
export {
  deduplicateCompletedRecords,
  detectCompletedRecords,
  isActiveCompletedRecordDocument,
} from "./completed-records.js";

export type {
  CompletedRecordDetectionOptions,
  CompletedRecordState,
} from "./completed-records.js";

// ─── TODO lifecycle parsing ─────────────────────────────
export {
  CANONICAL_TODO_CATEGORY_LABELS,
  classifyTodoHeading,
  countMarkdownCheckboxes,
  parseTodoFollowUps,
} from "./todo-lifecycle.js";

export type {
  TodoFollowUpCategory,
  TodoHeadingCategory,
  TodoLifecycleFollowUp,
} from "./todo-lifecycle.js";
