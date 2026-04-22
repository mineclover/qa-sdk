// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { DOCUMENT_REPOSITORY } from "../document-db.module.js";
import type { DocumentRepository } from "../shared/port.js";
import type { Document, DocumentCreate } from "../shared/types.js";

@Injectable()
export class DocumentService {
  constructor(@Inject(DOCUMENT_REPOSITORY) private readonly repo: DocumentRepository) {}

  create(args: DocumentCreate): Promise<Document> {
    return this.repo.createDocument(args);
  }
  find(id: string): Promise<Document | null> {
    return this.repo.findDocument(id);
  }
  listByProject(projectId: string): Promise<Document[]> {
    return this.repo.listDocumentsByProject(projectId);
  }
  update(id: string, patch: Partial<DocumentCreate>): Promise<Document> {
    return this.repo.updateDocument(id, patch);
  }
  delete(id: string): Promise<void> {
    return this.repo.deleteDocument(id);
  }
}
