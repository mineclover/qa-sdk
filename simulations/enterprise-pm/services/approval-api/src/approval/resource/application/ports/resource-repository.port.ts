// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { ResourceEntity } from '../../domain/index.js';
import type { ResourceTransactionScope } from './resource-transaction.port.js';

export abstract class ResourceRepositoryPort {
  abstract save(entity: ResourceEntity, scope: ResourceTransactionScope): Promise<void>;
  abstract findById(id: string): Promise<ResourceEntity | null>;
}
