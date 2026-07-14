// @def.boundary sim-notification-api
// @def.doc domain-slice-architecture

export * as sqliteSubscriptionSchema from './sqlite.schema.js';
export * as pgSubscriptionSchema from './pg.schema.js';

export { SIM_NOTIF_SUBSCRIPTION_SQLITE_DDL } from './sqlite.schema.js';
export { SIM_NOTIF_SUBSCRIPTION_PG_DDL } from './pg.schema.js';
