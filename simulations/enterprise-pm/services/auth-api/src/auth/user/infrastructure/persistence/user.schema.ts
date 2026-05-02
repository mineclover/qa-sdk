// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

/**
 * Dialect-aggregating re-export — Phase 2 컨벤션. dialect 별 schema 는 개별
 * import 하여 ambiguity 를 방지한다.
 */
export * as sqliteUserSchema from "./sqlite.schema.js";
export * as pgUserSchema from "./pg.schema.js";

export { SIM_AUTH_USER_SQLITE_DDL } from "./sqlite.schema.js";
export { SIM_AUTH_USER_PG_DDL } from "./pg.schema.js";
