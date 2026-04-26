import type { AssignmentTransactionScope } from "./assignment-transaction.port.js";

export interface AssignmentCreatedEvent {
  readonly id: string;
  readonly assigneeId: string;
  readonly occurredAt: string;
}

export abstract class AssignmentOutboxPort {
  abstract appendCreated(event: AssignmentCreatedEvent, scope?: AssignmentTransactionScope): Promise<void>;
}
