// @def.boundary sim-document-api
// @def.doc sim-erp-pm-design

import { Inject, Injectable } from "@nestjs/common";
import { DOCUMENT_REPOSITORY } from "../document-db.module.js";
import type { DocumentRepository } from "../shared/port.js";
import type { DocumentVersion, DocumentVersionCreate } from "../shared/types.js";

@Injectable()
export class VersionService {
  constructor(@Inject(DOCUMENT_REPOSITORY) private readonly repo: DocumentRepository) {}

  create(args: DocumentVersionCreate): Promise<DocumentVersion> {
    return this.repo.createVersion(args);
  }
  find(documentId: string, versionNumber: number): Promise<DocumentVersion | null> {
    return this.repo.findVersion(documentId, versionNumber);
  }
  list(documentId: string): Promise<DocumentVersion[]> {
    return this.repo.listVersions(documentId);
  }
}
