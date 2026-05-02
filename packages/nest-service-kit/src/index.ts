// @def.boundary nest-service-kit
// @def.doc nest-service-kit

export type {
  EventEnvelope,
  EventOutcome,
  RequesterContext,
  RequesterType,
  CreateEventEnvelopeInput,
} from "./event-envelope.js";
export { createEventEnvelope } from "./event-envelope.js";
export {
  EventPublisherPort,
  MessageBusPort,
  OutboxStorePort,
  UnitOfWorkPort,
  NoopEventPublisher,
  OutboxEventPublisher,
} from "./ports.js";
export type { ServiceLogger } from "./logger.js";
export { createConsoleServiceLogger } from "./logger.js";
export type { BootstrapNestServiceOptions, BootstrapNestServiceResult } from "./bootstrap.js";
export { bootstrapNestService } from "./bootstrap.js";
