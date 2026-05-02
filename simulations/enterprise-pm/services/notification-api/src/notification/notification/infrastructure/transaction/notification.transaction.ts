// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

/**
 * Re-export of the notification slice TransactionPort wiring helpers.
 */
export {
  createNotificationTransactionPort,
  createNotificationSqliteTransactionPort,
  createNotificationPgTransactionPort,
} from "./notification.drizzle-transaction.js";
export type {
  NotificationDialect,
  NotificationTransactionFactoryOpts,
} from "./notification.drizzle-transaction.js";
