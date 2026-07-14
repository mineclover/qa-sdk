// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import {
  DocumentReadModelQuery,
  type DocumentDetailReadModel,
} from '../../application/queries/document-read-model.query.js';
import type { DocumentRepositoryPort } from '../../application/ports/document-repository.port.js';

/**
 * Repository 위에 얇게 얹은 Read Model.
 */
export class RepositoryDocumentReadModel extends DocumentReadModelQuery {
  constructor(private readonly repository: DocumentRepositoryPort) {
    super();
  }

  async findDetail(id: string): Promise<DocumentDetailReadModel | null> {
    const entity = await this.repository.findById(id);
    if (!entity) return null;
    const s = entity.toSnapshot();
    return {
      id: s.id,
      projectId: s.projectId,
      title: s.title,
      currentVersion: s.currentVersion,
      ownerId: s.ownerId,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }

  async listByProject(projectId: string): Promise<DocumentDetailReadModel[]> {
    const entities = await this.repository.listByProject(projectId);
    return entities.map((e) => {
      const s = e.toSnapshot();
      return {
        id: s.id,
        projectId: s.projectId,
        title: s.title,
        currentVersion: s.currentVersion,
        ownerId: s.ownerId,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      };
    });
  }
}
