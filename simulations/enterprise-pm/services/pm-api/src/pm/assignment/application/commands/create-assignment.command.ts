// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

/** 새 assignment 를 생성하라는 명령 (use-case 입력). */
export interface CreateAssignmentCommand {
  readonly id: string;
  readonly projectId: string;
  readonly managerId: string;
  readonly traceId?: string;
  readonly correlationId?: string;
}
