// Parser
export { parse, type ParseError, type ParseResult } from "./parser/index.js";

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

// Types
export type { TaxonomyIR, AxisIR, EntryIR, RelationIR, ConstraintIR, ImportIR, Coordinate, RelationKind, ConstraintKind } from "./schema/ir.js";
export type { Diagnostic, DiagnosticCode } from "./schema/diagnostic.js";
export type { TaxonomyDoc } from "./schema/zod.js";
