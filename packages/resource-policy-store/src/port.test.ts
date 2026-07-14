// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

import { describe, expect, it } from 'vitest';

import {
  DuplicatePolicyError,
  PolicyNotFoundError,
  type ResourcePolicy,
  type ResourcePolicyRegistry,
  type ResourcePolicyState,
} from './port.js';

import {
  DuplicatePolicyError as PeDuplicate,
  PolicyNotFoundError as PeNotFound,
} from 'permission-engine';

describe('port re-export — permission-engine 인터페이스 동일성', () => {
  it('DuplicatePolicyError가 permission-engine 동일 클래스', () => {
    expect(DuplicatePolicyError).toBe(PeDuplicate);
    const err = new DuplicatePolicyError('r1');
    expect(err).toBeInstanceOf(PeDuplicate);
    expect(err.resourceId).toBe('r1');
  });

  it('PolicyNotFoundError도 동일 클래스', () => {
    expect(PolicyNotFoundError).toBe(PeNotFound);
    const err = new PolicyNotFoundError('r2');
    expect(err).toBeInstanceOf(PeNotFound);
    expect(err.resourceId).toBe('r2');
  });

  it('ResourcePolicyState 리터럴 union 검증 (구조 타입 smoke)', () => {
    const states: ResourcePolicyState[] = ['UNREGISTERED', 'REGISTERED', 'DELEGATED'];
    expect(states).toHaveLength(3);
  });

  it('ResourcePolicyRegistry 인터페이스 메서드 6종을 포함하는 dummy 구현 가능', () => {
    // 컴파일 통과 자체가 검증 — runtime check는 dummy 호출
    const dummy: ResourcePolicyRegistry = {
      async resolve() {
        return null;
      },
      async create() {
        return makeStub();
      },
      async register() {
        return makeStub();
      },
      async delegate() {
        return makeStub();
      },
      async remove() {
        /* noop */
      },
      async listByOwner() {
        return [];
      },
      async listByState() {
        return [];
      },
    };
    expect(typeof dummy.resolve).toBe('function');
    expect(typeof dummy.create).toBe('function');
    expect(typeof dummy.register).toBe('function');
    expect(typeof dummy.delegate).toBe('function');
    expect(typeof dummy.remove).toBe('function');
    expect(typeof dummy.listByOwner).toBe('function');
    expect(typeof dummy.listByState).toBe('function');
  });
});

function makeStub(): ResourcePolicy {
  return {
    resourceId: 'stub',
    resourceType: 'doc',
    state: 'UNREGISTERED',
    ownerId: 'u',
    updatedAt: '2026-04-22T00:00:00.000Z',
  };
}
