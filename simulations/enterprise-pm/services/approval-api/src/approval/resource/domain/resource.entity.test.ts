// @def.boundary sim-approval-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import { ResourceEntity } from './resource.entity.js';
import {
  InvalidResourceIdException,
  InvalidResourceTypeException,
  ResourceStatusConflictException,
} from './resource.exceptions.js';

const baseInput = {
  id: 'rsr_001',
  projectId: 'prj_001',
  requesterId: 'user_001',
  resourceType: 'consultant',
  description: 'Need a senior consultant',
  now: new Date('2026-01-01T00:00:00.000Z'),
};

describe('ResourceEntity', () => {
  it('create() draft', () => {
    expect(ResourceEntity.create(baseInput).status).toBe('draft');
  });
  it('빈 id → InvalidResourceIdException', () => {
    expect(() => ResourceEntity.create({ ...baseInput, id: '' })).toThrow(
      InvalidResourceIdException,
    );
  });
  it('빈 resourceType → InvalidResourceTypeException', () => {
    expect(() => ResourceEntity.create({ ...baseInput, resourceType: '' })).toThrow(
      InvalidResourceTypeException,
    );
  });
  it('changeStatus draft → submitted', () => {
    const e = ResourceEntity.create(baseInput).changeStatus('submitted');
    expect(e.status).toBe('submitted');
  });
  it('approved 에서 변경 → ResourceStatusConflictException', () => {
    const approved = ResourceEntity.rehydrate({
      ...baseInput,
      status: 'approved',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(() => approved.changeStatus('submitted')).toThrow(ResourceStatusConflictException);
  });
  it('snapshot 라운드트립', () => {
    const e = ResourceEntity.create(baseInput).changeStatus('submitted');
    expect(ResourceEntity.rehydrate(e.toSnapshot()).toSnapshot()).toEqual(e.toSnapshot());
  });
});
