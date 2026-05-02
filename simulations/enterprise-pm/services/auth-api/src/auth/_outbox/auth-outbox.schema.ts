// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

/**
 * Dialect-aggregating re-export — auth 도메인의 단일 outbox table.
 *
 * 6 슬라이스가 모두 import 하여 동일 `auth_outbox_events` 테이블에 적재한다.
 */
export * as sqliteAuthOutboxSchema from "./sqlite.schema.js";
export * as pgAuthOutboxSchema from "./pg.schema.js";

export { SIM_AUTH_OUTBOX_SQLITE_DDL } from "./sqlite.schema.js";
export { SIM_AUTH_OUTBOX_PG_DDL } from "./pg.schema.js";
