// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

export * as sqliteDepartmentSchema from "./sqlite.schema.js";
export * as pgDepartmentSchema from "./pg.schema.js";

export { SIM_AUTH_DEPARTMENT_SQLITE_DDL } from "./sqlite.schema.js";
export { SIM_AUTH_DEPARTMENT_PG_DDL } from "./pg.schema.js";
