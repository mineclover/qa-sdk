export {
  declareDocumentAdapterCapabilities,
  defineDocumentAdapter,
  normalizeDocumentEnvelope,
} from "./normalize.js";
export {
  createDefinitionMarkdownAdapter,
  DEFINITION_MARKDOWN_ADAPTER_ID,
} from "./adapters/definition-markdown.js";

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
