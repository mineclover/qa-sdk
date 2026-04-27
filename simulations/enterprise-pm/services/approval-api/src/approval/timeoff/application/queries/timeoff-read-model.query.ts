// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

export interface TimeOffDetailReadModel {
  readonly id: string;
  readonly requesterId: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly reason: string;
  readonly status: string;
  readonly updatedAt: string;
}

export abstract class TimeOffReadModelQuery {
  abstract findDetail(id: string): Promise<TimeOffDetailReadModel | null>;
}
