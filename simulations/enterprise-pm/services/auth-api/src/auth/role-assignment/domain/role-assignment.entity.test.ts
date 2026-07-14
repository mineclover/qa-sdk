// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import { RoleAssignmentEntity } from './role-assignment.entity.js';
import {
  InvalidScopeException,
  InvalidRoleAssignmentInputException,
  DuplicateRoleAssignmentException,
  RoleAssignmentNotFoundException,
} from './role-assignment.exceptions.js';

describe('RoleAssignmentEntity', () => {
  it('create() global + null scopeId', () => {
    const ra = RoleAssignmentEntity.create({
      userId: 'u1',
      roleId: 'r1',
      scopeType: 'global',
      scopeId: null,
    });
    expect(ra.toSnapshot().scopeType).toBe('global');
    expect(ra.toSnapshot().scopeId).toBeNull();
  });

  it('create() department + scopeId', () => {
    const ra = RoleAssignmentEntity.create({
      userId: 'u1',
      roleId: 'r1',
      scopeType: 'department',
      scopeId: 'd1',
    });
    expect(ra.toSnapshot().scopeId).toBe('d1');
  });

  it('create() department + null scopeId 거부', () => {
    expect(() =>
      RoleAssignmentEntity.create({
        userId: 'u1',
        roleId: 'r1',
        scopeType: 'department',
        scopeId: null,
      }),
    ).toThrow(InvalidScopeException);
  });

  it('create() project + null scopeId 거부', () => {
    expect(() =>
      RoleAssignmentEntity.create({
        userId: 'u1',
        roleId: 'r1',
        scopeType: 'project',
        scopeId: null,
      }),
    ).toThrow(InvalidScopeException);
  });

  it('create() 빈 userId 거부', () => {
    expect(() =>
      RoleAssignmentEntity.create({ userId: '', roleId: 'r1', scopeType: 'global', scopeId: null }),
    ).toThrow(InvalidRoleAssignmentInputException);
  });

  it('composite id 생성 — userId|roleId|scopeType|scopeId', () => {
    const ra = RoleAssignmentEntity.create({
      userId: 'u1',
      roleId: 'r1',
      scopeType: 'department',
      scopeId: 'd1',
    });
    expect(ra.id).toBe('u1|r1|department|d1');
  });

  it('rehydrate 라운드트립', () => {
    const ra = RoleAssignmentEntity.create({
      userId: 'u1',
      roleId: 'r1',
      scopeType: 'global',
      scopeId: null,
    });
    const re = RoleAssignmentEntity.rehydrate(ra.toSnapshot());
    expect(re.toSnapshot()).toEqual(ra.toSnapshot());
  });

  it("InvalidScopeException name='ValidationError'", () => {
    expect(new InvalidScopeException('x').name).toBe('ValidationError');
  });

  it("DuplicateRoleAssignmentException name='ConflictError'", () => {
    expect(new DuplicateRoleAssignmentException('u', 'r').name).toBe('ConflictError');
  });

  it("RoleAssignmentNotFoundException name='NotFoundError'", () => {
    expect(new RoleAssignmentNotFoundException('u', 'r').name).toBe('NotFoundError');
  });
});
