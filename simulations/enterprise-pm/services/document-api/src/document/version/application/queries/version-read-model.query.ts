// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

export interface VersionDetailReadModel {
  readonly documentId: string;
  readonly versionNumber: number;
  readonly contentRef: string;
  readonly authorId: string;
  readonly createdAt: string;
}

export abstract class VersionReadModelQuery {
  abstract findDetail(
    documentId: string,
    versionNumber: number,
  ): Promise<VersionDetailReadModel | null>;
  abstract listByDocument(documentId: string): Promise<VersionDetailReadModel[]>;
}
