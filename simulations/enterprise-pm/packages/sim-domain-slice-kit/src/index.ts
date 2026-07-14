// @def.boundary sim-domain-slice-kit
// @def.doc domain-slice-architecture

// Ports
export type { TransactionPort, TransactionScope } from './transaction.port.js';
export type { OutboxPort, OutboxRecord } from './outbox.port.js';
export type { LoggerPort, SliceLogContext } from './logger.port.js';

// Error mapping
export { mapDomainErrorToHttp } from './error-mapping.js';
export type { DomainErrorPayload } from './error-mapping.js';

// Transaction adapters
export { createSqliteTransactionPort } from './transaction/sqlite.js';
export type { DrizzleSqliteLike } from './transaction/sqlite.js';
export { createPgTransactionPort } from './transaction/pg.js';
export type { DrizzlePgLike } from './transaction/pg.js';

// Outbox adapter
export { createDrizzleOutboxPort } from './outbox/drizzle.js';
export type { DrizzleOutboxPortOptions, DrizzleInsertable } from './outbox/drizzle.js';

// Logger adapter
export { createDefaultLoggerAdapter } from './logger/default.js';
export type { HostLoggerLike } from './logger/default.js';

// NestJS integration
export {
  SLICE_LOGGER_PORT,
  InjectSliceLogger,
  createSliceLoggerProvider,
} from './nest/slice-logger.provider.js';
export { DomainExceptionFilter } from './nest/domain-exception.filter.js';
export {
  REQUEST_TRACE_CONTEXT,
  requestTraceContextProvider,
  transactionScopeProviders,
} from './nest/transaction-scope.provider.js';
export type { RequestTraceContext } from './nest/transaction-scope.provider.js';
