// Parser
export { parse, type ParseError, type ParseResult } from "./parser/index.js";

// Query (show + slice + walkRelation + walkByCoordinate)
export { show, slice, walkRelation, walkByCoordinate, type SliceRange } from "./query/index.js";

// Ref grammar (3-tier parser + resolver)
export { parseRef } from "./ref/parser.js";
export { resolveRef } from "./ref/resolver.js";
export type { TaxonomyRef, RefResult } from "./ref/types.js";

// Indexer (bidirectional id/address + coordinate packing)
export { indexAxis, packCoordinate, unpackCoordinate } from "./indexer/index.js";
export type { IndexedAxis } from "./indexer/index.js";

// Registry
export { TaxonomyRegistry } from "./registry/index.js";

// Validator (capacity/ref/constraint/axis-5q + fail-collect)
export { validate, type ValidateOptions } from "./validate/index.js";

// Codegen (TS file output + deterministic contentHash)
export { codegen, CodegenValidationError, type CodegenOptions, type CodegenResult } from "./codegen/index.js";

// Codegen helpers (drift detection)
export { checkContentHashDrift, validateRegistryVersions } from "./drift/index.js";

// Doctor (yaml ↔ external SSOT drift detection)
export { doctor, type ExpectedTaxonomy } from "./doctor/index.js";
export {
  extractIdsFromMarkdownTable,
  extractTextsFromMarkdownTable,
  extractDkgExpected,
  extractIngestExpected,
  extractVocabExpected,
} from "./doctor/extract/index.js";

// Diff (두 IR 비교)
export { diff, type DiffEntry, type DiffResult, type BreakingLevel } from "./diff/index.js";

// Migration (두 IR 간 마이그레이션 계획 추정)
export {
  migrationPlan,
  type MigrationPlan,
  type IdRename,
  type AddressConflict,
} from "./migration/index.js";

// Types
export type { TaxonomyIR, AxisIR, EntryIR, RelationIR, ConstraintIR, ImportIR, Coordinate, RelationKind, ConstraintKind, Severity, Lifecycle } from "./schema/ir.js";
export type { Diagnostic, DiagnosticCode } from "./schema/diagnostic.js";
export { TaxonomyDocSchema } from "./schema/zod.js";
export type { TaxonomyDoc } from "./schema/zod.js";
