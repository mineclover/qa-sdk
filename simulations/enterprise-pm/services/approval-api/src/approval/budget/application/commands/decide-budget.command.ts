// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

/** budget request 의 단계 결정 (승인/거절) 명령. */
export interface DecideBudgetCommand {
  readonly id: string;
  readonly approverId: string;
  readonly decision: 'approved' | 'rejected';
  readonly comment?: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
