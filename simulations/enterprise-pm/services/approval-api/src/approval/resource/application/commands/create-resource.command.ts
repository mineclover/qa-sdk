// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

export interface CreateResourceCommand {
  readonly id: string;
  readonly projectId: string;
  readonly requesterId: string;
  readonly resourceType: string;
  readonly description: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
