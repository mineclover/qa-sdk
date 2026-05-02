// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

/** Read-side detail DTO — command 측 entity 와 독립. */
export interface DocumentDetailReadModel {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly currentVersion: number;
  readonly ownerId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Read 전용 추상 (CQRS — Primary DB 직접 read 금지, Read Model 우선). */
export abstract class DocumentReadModelQuery {
  abstract findDetail(id: string): Promise<DocumentDetailReadModel | null>;
  abstract listByProject(projectId: string): Promise<DocumentDetailReadModel[]>;
}
