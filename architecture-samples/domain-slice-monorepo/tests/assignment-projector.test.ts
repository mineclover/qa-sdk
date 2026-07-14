import { describe, expect, it } from 'vitest';

import { AssignmentReadModelProjector } from '../apps/worker/src/projectors/assignment-read-model.projector.js';

describe('AssignmentReadModelProjector', () => {
  it('projects assignment.created event payloads into worker read model rows', async () => {
    const projector = new AssignmentReadModelProjector();

    await projector.applyCreated({
      id: 'assignment-1',
      assigneeId: 'user-1',
      occurredAt: '2026-04-25T00:00:00.000Z',
    });

    expect(projector.get('assignment-1')).toEqual({
      id: 'assignment-1',
      assigneeId: 'user-1',
      status: 'assigned',
      updatedAt: '2026-04-25T00:00:00.000Z',
    });
  });
});
