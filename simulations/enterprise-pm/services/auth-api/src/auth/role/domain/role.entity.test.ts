// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import { RoleEntity } from './role.entity.js';
import {
  InvalidRoleInputException,
  DuplicateRoleNameException,
  RoleNotFoundException,
} from './role.exceptions.js';

describe('RoleEntity', () => {
  const baseInput = {
    id: 'role_admin',
    name: 'admin',
    scopeType: 'global' as const,
    defaultMaskHex: 'ffff',
    now: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('create() 는 정상 입력에 대해 entity 반환', () => {
    const r = RoleEntity.create(baseInput);
    expect(r.id).toBe('role_admin');
    expect(r.name).toBe('admin');
    expect(r.toSnapshot().scopeType).toBe('global');
    expect(r.toSnapshot().defaultMaskHex).toBe('ffff');
  });

  it('create() 는 빈 id 거부', () => {
    expect(() => RoleEntity.create({ ...baseInput, id: '  ' })).toThrow(InvalidRoleInputException);
  });

  it('create() 는 빈 name 거부', () => {
    expect(() => RoleEntity.create({ ...baseInput, name: '' })).toThrow(InvalidRoleInputException);
  });

  it('create() 는 비-hex defaultMaskHex 거부', () => {
    expect(() => RoleEntity.create({ ...baseInput, defaultMaskHex: 'zzz' })).toThrow(
      InvalidRoleInputException,
    );
  });

  it('defaultMaskHex 는 lowercase 정규화', () => {
    const r = RoleEntity.create({ ...baseInput, defaultMaskHex: 'FFFF' });
    expect(r.toSnapshot().defaultMaskHex).toBe('ffff');
  });

  it('toSnapshot() / rehydrate() 라운드트립', () => {
    const original = RoleEntity.create(baseInput);
    const rehydrated = RoleEntity.rehydrate(original.toSnapshot());
    expect(rehydrated.toSnapshot()).toEqual(original.toSnapshot());
  });

  it("InvalidRoleInputException name='ValidationError'", () => {
    expect(new InvalidRoleInputException('x').name).toBe('ValidationError');
  });

  it("DuplicateRoleNameException name='ConflictError'", () => {
    expect(new DuplicateRoleNameException('x').name).toBe('ConflictError');
  });

  it("RoleNotFoundException name='NotFoundError'", () => {
    expect(new RoleNotFoundException('x').name).toBe('NotFoundError');
  });
});
