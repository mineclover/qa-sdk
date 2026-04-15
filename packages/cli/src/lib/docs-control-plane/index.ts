export {
  declareDocumentAdapterCapabilities,
  defineDocumentAdapter,
  normalizeDocumentEnvelope,
} from "./normalize.js";
export {
  createDefinitionMarkdownAdapter,
  DEFINITION_MARKDOWN_ADAPTER_ID,
} from "./adapters/definition-markdown.js";
export {
  createPrdMarkdownAdapter,
  PRD_MARKDOWN_ADAPTER_ID,
} from "./adapters/prd-markdown.js";
export {
  createRalphPrdJsonAdapter,
  readRalphPrdJsonSummary,
  RALPH_PRD_JSON_ADAPTER_ID,
} from "./adapters/ralph-prd-json.js";
export {
  createRalphSessionAdapter,
  RALPH_SESSION_ADAPTER_ID,
} from "./adapters/ralph-session.js";

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
} from "./types.js";
export type {
  DefinitionMarkdownAdapterOptions,
} from "./adapters/definition-markdown.js";
export type {
  PrdMarkdownAdapterOptions,
} from "./adapters/prd-markdown.js";
export type {
  RalphPrdJsonAdapterOptions,
  RalphPrdJsonSummary,
} from "./adapters/ralph-prd-json.js";
export type {
  RalphSessionAdapterOptions,
} from "./adapters/ralph-session.js";
