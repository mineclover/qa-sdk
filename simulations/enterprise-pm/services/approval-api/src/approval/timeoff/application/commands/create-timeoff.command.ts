// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

export interface CreateTimeOffCommand {
  readonly id: string;
  readonly requesterId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly reason: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
