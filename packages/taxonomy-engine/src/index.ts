// Parser
export { parse, type ParseError, type ParseResult } from "./parser/index.js";

// Types
export type { TaxonomyIR, AxisIR, EntryIR, RelationIR, ConstraintIR, ImportIR, Coordinate, RelationKind, ConstraintKind } from "./schema/ir.js";
export type { Diagnostic, DiagnosticCode } from "./schema/diagnostic.js";
export type { TaxonomyDoc } from "./schema/zod.js";
