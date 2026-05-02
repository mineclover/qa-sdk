// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import {
  VersionReadModelQuery,
  type VersionDetailReadModel,
} from "../../application/queries/version-read-model.query.js";
import type { VersionRepositoryPort } from "../../application/ports/version-repository.port.js";

export class RepositoryVersionReadModel extends VersionReadModelQuery {
  constructor(private readonly repository: VersionRepositoryPort) {
    super();
  }

  async findDetail(
    documentId: string,
    versionNumber: number,
  ): Promise<VersionDetailReadModel | null> {
    const e = await this.repository.findByKey(documentId, versionNumber);
    if (!e) return null;
    const s = e.toSnapshot();
    return {
      documentId: s.documentId,
      versionNumber: s.versionNumber,
      contentRef: s.contentRef,
      authorId: s.authorId,
      createdAt: s.createdAt,
    };
  }

  async listByDocument(documentId: string): Promise<VersionDetailReadModel[]> {
    const list = await this.repository.listByDocument(documentId);
    return list.map((e) => {
      const s = e.toSnapshot();
      return {
        documentId: s.documentId,
        versionNumber: s.versionNumber,
        contentRef: s.contentRef,
        authorId: s.authorId,
        createdAt: s.createdAt,
      };
    });
  }
}
