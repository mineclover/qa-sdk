// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import type { TimeOffEntity } from '../../domain/index.js';
import type { TimeOffTransactionScope } from './timeoff-transaction.port.js';

export abstract class TimeOffRepositoryPort {
  abstract save(entity: TimeOffEntity, scope: TimeOffTransactionScope): Promise<void>;
  abstract findById(id: string): Promise<TimeOffEntity | null>;
}
