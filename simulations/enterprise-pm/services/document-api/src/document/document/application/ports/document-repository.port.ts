// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import type { DocumentEntity } from '../../domain/index.js';
import type { DocumentTransactionScope } from './document-transaction.port.js';

/**
 * Document Aggregate 의 영속 추상.
 *
 * - dialect (sqlite/pg) 무관 — 어댑터에서 분기.
 * - save 는 트랜잭션 스코프를 받아 동일 트랜잭션 내 INSERT/UPDATE.
 */
export abstract class DocumentRepositoryPort {
  abstract save(entity: DocumentEntity, scope: DocumentTransactionScope): Promise<void>;
  abstract findById(id: string): Promise<DocumentEntity | null>;
  abstract listByProject(projectId: string): Promise<DocumentEntity[]>;
  abstract delete(id: string, scope: DocumentTransactionScope): Promise<void>;
}
