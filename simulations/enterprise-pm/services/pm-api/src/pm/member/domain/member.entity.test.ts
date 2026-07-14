// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import { MemberEntity } from './member.entity.js';
import {
  InvalidMemberProjectIdException,
  InvalidMemberUserIdException,
  MemberRoleConflictException,
} from './member.exceptions.js';

describe('MemberEntity', () => {
  const baseInput = {
    projectId: 'prj_001',
    userId: 'u_001',
    role: 'lead' as const,
    now: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('create() — projectId/userId 빈값에 ValidationError', () => {
    expect(() => MemberEntity.create({ ...baseInput, projectId: '' })).toThrow(
      InvalidMemberProjectIdException,
    );
    expect(() => MemberEntity.create({ ...baseInput, userId: '' })).toThrow(
      InvalidMemberUserIdException,
    );
  });

  it('create() — role 정상 생성', () => {
    const e = MemberEntity.create(baseInput);
    expect(e.role).toBe('lead');
    expect(e.projectId).toBe('prj_001');
  });

  it('changeRole — lead → contributor 전이', () => {
    const e = MemberEntity.create(baseInput).changeRole('contributor');
    expect(e.role).toBe('contributor');
  });

  it('changeRole — viewer → lead 직접 전이 금지', () => {
    const e = MemberEntity.create({ ...baseInput, role: 'viewer' });
    expect(() => e.changeRole('lead')).toThrow(MemberRoleConflictException);
  });

  it('changeRole — viewer → contributor → lead 우회 가능', () => {
    const e = MemberEntity.create({ ...baseInput, role: 'viewer' })
      .changeRole('contributor')
      .changeRole('lead');
    expect(e.role).toBe('lead');
  });

  it('toSnapshot/rehydrate 라운드트립', () => {
    const original = MemberEntity.create(baseInput);
    const rehydrated = MemberEntity.rehydrate(original.toSnapshot());
    expect(rehydrated.toSnapshot()).toEqual(original.toSnapshot());
  });

  it("MemberRoleConflictException name = 'ConflictError'", () => {
    const err = new MemberRoleConflictException('test');
    expect(err.name).toBe('ConflictError');
  });
});
