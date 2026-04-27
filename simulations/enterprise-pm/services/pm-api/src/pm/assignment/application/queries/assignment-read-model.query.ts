// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

/** Read-side detail DTO — command 측 entity 와 독립. */
export interface AssignmentDetailReadModel {
  readonly id: string;
  readonly projectId: string;
  readonly managerId: string;
  readonly status: string;
  readonly updatedAt: string;
}

/** Read 전용 추상 (CQRS — Primary DB 직접 read 금지, Read Model 우선). */
export abstract class AssignmentReadModelQuery {
  abstract findDetail(id: string): Promise<AssignmentDetailReadModel | null>;
}
