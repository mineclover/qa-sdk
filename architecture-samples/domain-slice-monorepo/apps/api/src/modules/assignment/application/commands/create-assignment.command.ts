export interface CreateAssignmentCommand {
  readonly id: string;
  readonly assigneeId: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
