// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

/**
 * Dialect-aggregating re-export.
 *
 * outbox 는 pm domain 공유 테이블 (`pm_outbox_events`) 으로 통일되었으므로
 * 슬라이스-로컬 outbox DDL 상수는 더 이상 존재하지 않는다. 본 테이블 (`tasks`) 의
 * DDL 은 pm/sqlite/schema 의 SIM_PM_SQLITE_DDL 이 책임진다.
 */
export * as sqliteTaskSchema from "./sqlite.schema.js";
export * as pgTaskSchema from "./pg.schema.js";
