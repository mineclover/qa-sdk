// @def.boundary qa-sdk-core-system
// @def.doc qa-sdk-core-system

export type {
  ModuleRef, DataRef, PipeRef, RuleRef,
  SourceLocation, ModuleInterface, ModuleRelations, ModuleMeta,
  ModuleIR,
  FieldDescriptor, DataDefinition, DataManagement, DataLifecycle, DataStorage,
  DataIR,
  PipeSourceLocation,
  PipeIR,
} from "./ir-types.js";

export {
  inferModuleLevel,
  computeSchemaHash,
  deriveCertainty,
} from "./ir-types.js";

export type { IRIssue, IRIssueSeverity, IRIssueType, IRGraph } from "./ir-validate.js";
export { validateIRGraph } from "./ir-validate.js";

export { pipeSpecToIR, pipeGraphToModuleIR, stepContractToDataIR } from "./ir-bridge.js";

export type { AuditSeverity, AuditRule, AuditIssue } from "./ir-audit.js";
export { auditIRGraph } from "./ir-audit.js";

export type { CrossValidationIssue, CrossValidationResult, PrecomputedValidation } from "./ir-nesting-bridge.js";
export { crossValidate, nestingToModuleIRs } from "./ir-nesting-bridge.js";

export type { ParserPort, FileStructure, FunctionInfo, ConditionalInfo, TypeInfo } from "./extraction-parser.js";
export { createRegexParser } from "./extraction-parser.js";

export type { PipelineOptions } from "./extraction-pipeline.js";
export { runExtractionPipeline } from "./extraction-pipeline.js";

export { PROMPT_TEMPLATES, buildPrompt, createMockLlm } from "./extraction-prompts.js";

export type {
  PathBranchPoint, IntentPathSegment, SpacetimeUID, DecodedPath,
} from "./spacetime-uid.js";
export {
  buildSegments, totalAddressSpace,
  encodePathAddress, decodePathAddress,
  createSpacetimeUID, parseSpacetimeUID,
  pathAddressRange, addressesForBranch,
} from "./spacetime-uid.js";
