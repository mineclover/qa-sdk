// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export * as sqliteRoleSchema from './sqlite.schema.js';
export * as pgRoleSchema from './pg.schema.js';

export { SIM_AUTH_ROLE_SQLITE_DDL } from './sqlite.schema.js';
export { SIM_AUTH_ROLE_PG_DDL } from './pg.schema.js';
