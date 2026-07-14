// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import {
  TimeOffReadModelQuery,
  type TimeOffDetailReadModel,
} from '../../application/queries/timeoff-read-model.query.js';
import type { TimeOffRepositoryPort } from '../../application/ports/timeoff-repository.port.js';

export class RepositoryTimeOffReadModel extends TimeOffReadModelQuery {
  constructor(private readonly repository: TimeOffRepositoryPort) {
    super();
  }
  async findDetail(id: string): Promise<TimeOffDetailReadModel | null> {
    const e = await this.repository.findById(id);
    if (!e) return null;
    const s = e.toSnapshot();
    return {
      id: s.id,
      requesterId: s.requesterId,
      startDate: s.startDate,
      endDate: s.endDate,
      reason: s.reason,
      status: s.status,
      updatedAt: s.updatedAt,
    };
  }
}
