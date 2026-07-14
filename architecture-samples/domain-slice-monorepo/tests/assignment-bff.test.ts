import { describe, expect, it } from 'vitest';

import { AssignmentLoggerPort } from '../apps/api/src/modules/assignment/application/ports/assignment-logger.port.js';
import type { AssignmentLogEvent } from '../apps/api/src/modules/assignment/application/ports/assignment-logger.port.js';
import { AssignmentReadModelPort } from '../apps/api/src/modules/assignment/application/queries/assignment-read-model.query.js';
import type { AssignmentDetailReadModel } from '../apps/api/src/modules/assignment/application/queries/assignment-read-model.query.js';
import { AssignmentDetailBff } from '../apps/api/src/modules/assignment/presentation/bff/assignment-detail.bff.js';

class FakeLogger extends AssignmentLoggerPort {
  readonly events: AssignmentLogEvent[] = [];

  async record(event: AssignmentLogEvent): Promise<void> {
    this.events.push(event);
  }
}

class FakeReadModel extends AssignmentReadModelPort {
  constructor(private readonly row: AssignmentDetailReadModel | null) {
    super();
  }

  async findDetail(): Promise<AssignmentDetailReadModel | null> {
    return this.row;
  }
}

describe('AssignmentDetailBff', () => {
  it('composes BFF detail from read model without exposing domain entity', async () => {
    const logger = new FakeLogger();
    const bff = new AssignmentDetailBff(
      new FakeReadModel({
        id: 'assignment-1',
        assigneeId: 'user-1',
        status: 'assigned',
        updatedAt: '2026-04-25T00:00:00.000Z',
      }),
      logger,
    );

    const result = await bff.getDetail({
      id: 'assignment-1',
      traceId: 'trace-1',
      correlationId: 'corr-1',
    });

    expect(result).toEqual({
      id: 'assignment-1',
      title: 'Assignment assignment-1',
      assigneeLabel: 'Assignee user-1',
      statusLabel: 'ASSIGNED',
      updatedAt: '2026-04-25T00:00:00.000Z',
      cacheKey: 'assignment-bff-detail:v1:assignment-1',
    });
    expect(logger.events[0]).toMatchObject({
      cacheKeyPrefix: 'assignment-bff-detail:v1',
      cacheHit: false,
      queryName: 'AssignmentDetailBffQuery',
    });
  });
});
