// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

export interface ResourceDetailReadModel {
  readonly id: string;
  readonly projectId: string;
  readonly requesterId: string;
  readonly resourceType: string;
  readonly description: string;
  readonly status: string;
  readonly updatedAt: string;
}

export abstract class ResourceReadModelQuery {
  abstract findDetail(id: string): Promise<ResourceDetailReadModel | null>;
}
