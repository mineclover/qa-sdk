// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import { TimeOffEntity } from './timeoff.entity.js';
import {
  InvalidTimeOffIdException,
  InvalidTimeOffRangeException,
  TimeOffStatusConflictException,
} from './timeoff.exceptions.js';

const baseInput = {
  id: 'tof_001',
  requesterId: 'user_001',
  startDate: '2026-05-01',
  endDate: '2026-05-03',
  reason: 'vacation',
  now: new Date('2026-04-01T00:00:00.000Z'),
};

describe('TimeOffEntity', () => {
  it('create() draft', () => {
    expect(TimeOffEntity.create(baseInput).status).toBe('draft');
  });
  it('빈 id → InvalidTimeOffIdException', () => {
    expect(() => TimeOffEntity.create({ ...baseInput, id: '' })).toThrow(InvalidTimeOffIdException);
  });
  it('start > end → InvalidTimeOffRangeException', () => {
    expect(() =>
      TimeOffEntity.create({ ...baseInput, startDate: '2026-05-05', endDate: '2026-05-03' }),
    ).toThrow(InvalidTimeOffRangeException);
  });
  it('changeStatus draft → submitted', () => {
    const e = TimeOffEntity.create(baseInput).changeStatus('submitted');
    expect(e.status).toBe('submitted');
  });
  it('approved 에서 변경 → TimeOffStatusConflictException', () => {
    const approved = TimeOffEntity.rehydrate({
      ...baseInput,
      status: 'approved',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(() => approved.changeStatus('submitted')).toThrow(TimeOffStatusConflictException);
  });
  it('snapshot 라운드트립', () => {
    const e = TimeOffEntity.create(baseInput).changeStatus('submitted');
    expect(TimeOffEntity.rehydrate(e.toSnapshot()).toSnapshot()).toEqual(e.toSnapshot());
  });
});
