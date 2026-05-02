// @def.boundary nest-service-event-envelope
// @def.doc nest-service-event-envelope

import { randomUUID } from "node:crypto";

export type RequesterType = "user" | "service" | "job" | "system";
export type EventOutcome = "success" | "failure" | "noop";

export interface RequesterContext {
  requesterType?: RequesterType;
  requesterId?: string;
  actorRole?: string;
}

export interface EventEnvelope<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  eventId: string;
  eventKey: string;
  eventVersion: string;
  occurredAt: string;
  producerService: string;
  producerModule?: string;
  correlationId?: string;
  causationId?: string;
  requestId?: string;
  requesterType?: RequesterType;
  requesterId?: string;
  actorRole?: string;
  behaviorUnit?: string;
  requestRoute?: string;
  requestMethod?: string;
  subjectType?: string;
  subjectId?: string;
  effectKind?: string;
  outcome?: EventOutcome;
  payload: TPayload;
}

export interface CreateEventEnvelopeInput<TPayload extends Record<string, unknown> = Record<string, unknown>>
  extends RequesterContext {
  eventId?: string;
  eventKey: string;
  eventVersion: string;
  occurredAt?: string;
  producerService: string;
  producerModule?: string;
  correlationId?: string;
  causationId?: string;
  requestId?: string;
  behaviorUnit?: string;
  requestRoute?: string;
  requestMethod?: string;
  subjectType?: string;
  subjectId?: string;
  effectKind?: string;
  outcome?: EventOutcome;
  payload: TPayload;
}

export function createEventEnvelope<TPayload extends Record<string, unknown>>(
  input: CreateEventEnvelopeInput<TPayload>,
): EventEnvelope<TPayload> {
  return {
    eventId: input.eventId ?? randomUUID(),
    eventKey: input.eventKey,
    eventVersion: input.eventVersion,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    producerService: input.producerService,
    ...(input.producerModule ? { producerModule: input.producerModule } : {}),
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    ...(input.causationId ? { causationId: input.causationId } : {}),
    ...(input.requestId ? { requestId: input.requestId } : {}),
    ...(input.requesterType ? { requesterType: input.requesterType } : {}),
    ...(input.requesterId ? { requesterId: input.requesterId } : {}),
    ...(input.actorRole ? { actorRole: input.actorRole } : {}),
    ...(input.behaviorUnit ? { behaviorUnit: input.behaviorUnit } : {}),
    ...(input.requestRoute ? { requestRoute: input.requestRoute } : {}),
    ...(input.requestMethod ? { requestMethod: input.requestMethod } : {}),
    ...(input.subjectType ? { subjectType: input.subjectType } : {}),
    ...(input.subjectId ? { subjectId: input.subjectId } : {}),
    ...(input.effectKind ? { effectKind: input.effectKind } : {}),
    ...(input.outcome ? { outcome: input.outcome } : {}),
    payload: input.payload,
  };
}
