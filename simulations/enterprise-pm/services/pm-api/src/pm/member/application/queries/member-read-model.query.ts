// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

export interface MemberDetailReadModel {
  readonly projectId: string;
  readonly userId: string;
  readonly role: string;
  readonly joinedAt: string;
}

export abstract class MemberReadModelQuery {
  abstract listForProject(projectId: string): Promise<MemberDetailReadModel[]>;
  abstract listForUser(userId: string): Promise<MemberDetailReadModel[]>;
}
