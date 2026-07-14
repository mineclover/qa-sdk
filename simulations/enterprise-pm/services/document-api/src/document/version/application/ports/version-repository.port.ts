// @def.boundary sim-document-api
// @def.doc domain-slice-architecture

import type { VersionEntity } from '../../domain/index.js';
import type { VersionTransactionScope } from './version-transaction.port.js';

export abstract class VersionRepositoryPort {
  abstract save(entity: VersionEntity, scope: VersionTransactionScope): Promise<void>;
  abstract findByKey(documentId: string, versionNumber: number): Promise<VersionEntity | null>;
  abstract listByDocument(documentId: string): Promise<VersionEntity[]>;
  /** documentId 의 마지막 버전 번호를 반환. 없으면 0. */
  abstract latestVersionNumber(documentId: string): Promise<number>;
}
