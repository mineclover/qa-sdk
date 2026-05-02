// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

/**
 * Dialect-aggregating re-export.
 */
export * as sqliteDocumentSchema from "./sqlite.schema.js";
export * as pgDocumentSchema from "./pg.schema.js";

export { SIM_DOC_DOCUMENT_SQLITE_DDL } from "./sqlite.schema.js";
export { SIM_DOC_DOCUMENT_PG_DDL } from "./pg.schema.js";
