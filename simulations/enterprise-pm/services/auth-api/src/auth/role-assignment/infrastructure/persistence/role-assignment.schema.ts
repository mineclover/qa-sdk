// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export * as sqliteRoleAssignmentSchema from './sqlite.schema.js';
export * as pgRoleAssignmentSchema from './pg.schema.js';

export { SIM_AUTH_ROLE_ASSIGNMENT_SQLITE_DDL } from './sqlite.schema.js';
export { SIM_AUTH_ROLE_ASSIGNMENT_PG_DDL } from './pg.schema.js';
