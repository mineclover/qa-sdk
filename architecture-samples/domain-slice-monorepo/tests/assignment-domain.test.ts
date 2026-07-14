import { describe, expect, it } from 'vitest';

import { AssignmentEntity } from '../apps/api/src/modules/assignment/domain/assignment.entity.js';
import {
  AssignmentCancelledException,
  InvalidAssignmentIdException,
} from '../apps/api/src/modules/assignment/domain/assignment.exceptions.js';
import { toAssignmentId } from '../apps/api/src/modules/assignment/domain/assignment.ids.js';

describe('AssignmentEntity', () => {
  it('creates a draft assignment and transitions it to assigned', () => {
    const createdAt = new Date('2026-04-25T00:00:00.000Z');
    const assignedAt = new Date('2026-04-25T00:01:00.000Z');

    const assignment = AssignmentEntity.create({
      id: 'assignment-1',
      assigneeId: 'user-1',
      now: createdAt,
    }).assign(assignedAt);

    expect(assignment.toSnapshot()).toEqual({
      id: 'assignment-1',
      assigneeId: 'user-1',
      status: 'assigned',
      createdAt: '2026-04-25T00:00:00.000Z',
      updatedAt: '2026-04-25T00:01:00.000Z',
    });
  });

  it('rejects cancelled assignment transition with a named domain exception', () => {
    const cancelled = AssignmentEntity.rehydrate({
      id: 'assignment-cancelled',
      assigneeId: 'user-1',
      status: 'cancelled',
      createdAt: '2026-04-25T00:00:00.000Z',
      updatedAt: '2026-04-25T00:00:00.000Z',
    });

    expect(() => cancelled.assign()).toThrow(AssignmentCancelledException);
  });
});

describe('toAssignmentId', () => {
  it('rejects blank identifiers with a named domain exception', () => {
    expect(() => toAssignmentId(' ')).toThrow(InvalidAssignmentIdException);
  });
});
