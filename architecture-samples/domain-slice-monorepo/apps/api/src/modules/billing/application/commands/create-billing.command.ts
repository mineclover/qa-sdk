export interface CreateBillingCommand {
  readonly id: string;
  readonly assignmentId: string;
  readonly requiredAssignmentVersion: number;
  readonly traceId?: string;
  readonly correlationId?: string;
}
