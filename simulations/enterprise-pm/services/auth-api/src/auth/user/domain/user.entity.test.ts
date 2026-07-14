// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import { describe, expect, it } from 'vitest';
import { UserEntity } from './user.entity.js';
import {
  DuplicateUserEmailException,
  InvalidUserInputException,
  UserNotFoundException,
} from './user.exceptions.js';

describe('UserEntity', () => {
  const baseInput = {
    id: 'usr_001',
    email: 'alice@example.com',
    displayName: 'Alice',
    now: new Date('2026-01-01T00:00:00.000Z'),
  };

  it("create() 는 status='active' 로 시작한다", () => {
    const u = UserEntity.create(baseInput);
    expect(u.status).toBe('active');
    expect(u.id).toBe('usr_001');
    expect(u.email).toBe('alice@example.com');
  });

  it('create() 는 빈 id 에 대해 InvalidUserInputException', () => {
    expect(() => UserEntity.create({ ...baseInput, id: '  ' })).toThrow(InvalidUserInputException);
  });

  it('create() 는 빈 email 에 대해 InvalidUserInputException', () => {
    expect(() => UserEntity.create({ ...baseInput, email: '' })).toThrow(InvalidUserInputException);
  });

  it('create() 는 빈 displayName 에 대해 InvalidUserInputException', () => {
    expect(() => UserEntity.create({ ...baseInput, displayName: '  ' })).toThrow(
      InvalidUserInputException,
    );
  });

  it('create() 는 departmentId / primaryRoleId 옵셔널', () => {
    const u = UserEntity.create({ ...baseInput, departmentId: 'dept_1', primaryRoleId: 'role_1' });
    expect(u.toSnapshot().departmentId).toBe('dept_1');
    expect(u.toSnapshot().primaryRoleId).toBe('role_1');
  });

  it('updateProfile() 은 새 인스턴스를 반환한다 (불변)', () => {
    const u = UserEntity.create(baseInput);
    const updated = u.updateProfile({ displayName: 'Alice2' });
    expect(updated).not.toBe(u);
    expect(u.toSnapshot().displayName).toBe('Alice');
    expect(updated.toSnapshot().displayName).toBe('Alice2');
  });

  it('updateProfile() 은 부분 갱신만 적용한다 (departmentId 유지)', () => {
    const u = UserEntity.create({ ...baseInput, departmentId: 'dept_1' });
    const updated = u.updateProfile({ displayName: 'Alice2' });
    expect(updated.toSnapshot().departmentId).toBe('dept_1');
  });

  it('updateProfile() 은 빈 email 거부', () => {
    const u = UserEntity.create(baseInput);
    expect(() => u.updateProfile({ email: '  ' })).toThrow(InvalidUserInputException);
  });

  it('toSnapshot() / rehydrate() 는 라운드트립을 보존한다', () => {
    const original = UserEntity.create({
      ...baseInput,
      departmentId: 'dept_1',
      primaryRoleId: 'role_1',
    });
    const snapshot = original.toSnapshot();
    const rehydrated = UserEntity.rehydrate(snapshot);
    expect(rehydrated.toSnapshot()).toEqual(snapshot);
  });

  it("InvalidUserInputException name 이 'ValidationError' 매핑된다", () => {
    const err = new InvalidUserInputException('...');
    expect(err.name).toBe('ValidationError');
    expect(err.code).toBe('INVALID_USER_INPUT');
  });

  it("DuplicateUserEmailException name 이 'ConflictError' 매핑된다", () => {
    const err = new DuplicateUserEmailException('a@x');
    expect(err.name).toBe('ConflictError');
    expect(err.code).toBe('DUPLICATE_USER_EMAIL');
  });

  it("UserNotFoundException name 이 'NotFoundError' 매핑된다", () => {
    const err = new UserNotFoundException('usr_x');
    expect(err.name).toBe('NotFoundError');
    expect(err.code).toBe('USER_NOT_FOUND');
  });
});
