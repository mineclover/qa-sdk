// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import {
  DocumentQueryPort,
  type DocumentRefSummary,
} from "../../application/ports/document-query.port.js";
import { DocumentReadModelQuery } from "../../../document/application/queries/document-read-model.query.js";

/**
 * Document slice 의 ReadModel 을 DocumentQueryPort 로 어댑팅.
 */
export class DocumentReadModelDocumentQueryAdapter extends DocumentQueryPort {
  constructor(private readonly readModel: DocumentReadModelQuery) {
    super();
  }

  async findSummary(documentId: string): Promise<DocumentRefSummary | null> {
    const detail = await this.readModel.findDetail(documentId);
    if (!detail) return null;
    return {
      id: detail.id,
      title: detail.title,
      projectId: detail.projectId,
      currentVersion: detail.currentVersion,
    };
  }
}
