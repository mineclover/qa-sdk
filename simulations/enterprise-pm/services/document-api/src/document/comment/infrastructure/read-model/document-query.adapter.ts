// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import {
  DocumentQueryPort,
  type DocumentRefSummary,
} from '../../application/ports/document-query.port.js';
import { DocumentReadModelQuery } from '../../../document/application/queries/document-read-model.query.js';

/**
 * Document slice 의 ReadModel 을 DocumentQueryPort 로 어댑팅.
 *
 * - infrastructure 계층 한정의 의존: comment 의 application/domain 은
 *   document slice 의 어떤 것도 import 하지 않는다.
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
    };
  }
}
