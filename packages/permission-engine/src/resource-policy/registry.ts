// @def.boundary permission-engine-spec
// @def.doc authorization-ontology-resource-lifecycle

/**
 * ResourcePolicyRegistry — 리소스 policy의 조회·전이 인터페이스.
 *
 * 본 파일은 순수 인터페이스 + 인메모리 구현만 제공한다.
 * 실제 DB 저장 구현(Drizzle/D1/PG)은 소비 서비스가 각자 어댑터로 구현한다.
 * permission-engine의 "no DB dep" 규율 유지.
 */

import {
  createUnregistered,
  delegate,
  register,
  type CreateArgs,
  type DelegateArgs,
  type RegisterArgs,
  type ResourcePolicy,
} from "./state.js";

// ── Interface ────────────────────────────────────────────────────────────────

export interface ResourcePolicyRegistry {
  /** 리소스 ID로 policy 조회. 없으면 null. */
  resolve(resourceId: string): Promise<ResourcePolicy | null>;

  /** 새 policy 삽입 (UNREGISTERED). 이미 있으면 DuplicatePolicyError. */
  create(args: CreateArgs): Promise<ResourcePolicy>;

  /** UNREGISTERED → REGISTERED 전이. 상태 불일치 시 InvalidTransitionError. */
  register(resourceId: string, args: RegisterArgs): Promise<ResourcePolicy>;

  /** REGISTERED → DELEGATED 전이. 상태 불일치 시 InvalidTransitionError. */
  delegate(resourceId: string, args: DelegateArgs): Promise<ResourcePolicy>;

  /** 리소스 삭제 시 policy도 삭제. orphan 방지. */
  remove(resourceId: string): Promise<void>;

  /** owner별 리소스 목록 (감사/소유자 UI용). */
  listByOwner(ownerId: string): Promise<ResourcePolicy[]>;

  /** 상태별 리소스 목록 (배치 감사용). */
  listByState(state: ResourcePolicy["state"]): Promise<ResourcePolicy[]>;
}

// ── Errors ───────────────────────────────────────────────────────────────────

export class PolicyNotFoundError extends Error {
  constructor(public readonly resourceId: string) {
    super(`Resource policy not found: ${resourceId}`);
    this.name = "PolicyNotFoundError";
  }
}

export class DuplicatePolicyError extends Error {
  constructor(public readonly resourceId: string) {
    super(`Resource policy already exists: ${resourceId}`);
    this.name = "DuplicatePolicyError";
  }
}

// ── InMemory impl ────────────────────────────────────────────────────────────

/**
 * InMemory 구현 — 테스트·프로토타입·단일 프로세스 캐시용.
 * 실 운영에서는 DB 기반 구현을 별도 패키지/서비스에서 제공한다.
 */
export class InMemoryResourcePolicyRegistry implements ResourcePolicyRegistry {
  private readonly store = new Map<string, ResourcePolicy>();

  async resolve(resourceId: string): Promise<ResourcePolicy | null> {
    return this.store.get(resourceId) ?? null;
  }

  async create(args: CreateArgs): Promise<ResourcePolicy> {
    if (this.store.has(args.resourceId)) {
      throw new DuplicatePolicyError(args.resourceId);
    }
    const policy = createUnregistered(args);
    this.store.set(args.resourceId, policy);
    return policy;
  }

  async register(resourceId: string, args: RegisterArgs): Promise<ResourcePolicy> {
    const cur = this.store.get(resourceId);
    if (!cur) throw new PolicyNotFoundError(resourceId);
    const next = register(cur, args);
    this.store.set(resourceId, next);
    return next;
  }

  async delegate(resourceId: string, args: DelegateArgs): Promise<ResourcePolicy> {
    const cur = this.store.get(resourceId);
    if (!cur) throw new PolicyNotFoundError(resourceId);
    const next = delegate(cur, args);
    this.store.set(resourceId, next);
    return next;
  }

  async remove(resourceId: string): Promise<void> {
    this.store.delete(resourceId);
  }

  async listByOwner(ownerId: string): Promise<ResourcePolicy[]> {
    const result: ResourcePolicy[] = [];
    for (const p of this.store.values()) {
      if (p.ownerId === ownerId) result.push(p);
    }
    return result;
  }

  async listByState(state: ResourcePolicy["state"]): Promise<ResourcePolicy[]> {
    const result: ResourcePolicy[] = [];
    for (const p of this.store.values()) {
      if (p.state === state) result.push(p);
    }
    return result;
  }
}
