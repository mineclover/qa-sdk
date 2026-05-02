// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

/**
 * Dialect-aggregating re-export — Phase 1 spec 의 슬라이스 트리에는
 * `<slice>.schema.ts` 가 명시되어 있다. simulations 환경은 sqlite + pg
 * 두 dialect 를 모두 운용하므로 dialect 별 schema 파일을 분리하고 본 파일에서
 * 합쳐 export.
 */
export * as sqliteNotificationSchema from "./sqlite.schema.js";
export * as pgNotificationSchema from "./pg.schema.js";

export {
  SIM_NOTIF_NOTIFICATION_SQLITE_DDL,
  SIM_NOTIF_OUTBOX_SQLITE_DDL,
} from "./sqlite.schema.js";
export {
  SIM_NOTIF_NOTIFICATION_PG_DDL,
  SIM_NOTIF_OUTBOX_PG_DDL,
} from "./pg.schema.js";
