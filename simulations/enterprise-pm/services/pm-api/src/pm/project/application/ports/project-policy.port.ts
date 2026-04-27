// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

/**
 * Project policy lifecycle port — auth-deps 의 ResourcePolicyRegistry /
 * DelegationGraphStore 의 함수형 추상 (cross-domain query/command port).
 *
 * - 기존 `permission-engine` 의 ResourcePolicyRegistry 와 형식 일치 (Optional).
 * - 슬라이스는 cross-aggregate 직접 의존 금지 — 본 port 를 통해서만 접근.
 */
export interface PolicyLifecyclePort {
  create(input: { resourceId: string; resourceType: string; ownerId: string }): Promise<void>;
  remove(resourceId: string): Promise<void>;
  resolve(resourceId: string): Promise<{
    state: string;
    graphRootId?: string;
  } | null>;
  register(resourceId: string, input: { cerbosPolicyRef: string }): Promise<void>;
  delegate(resourceId: string, input: { graphRootId: string }): Promise<void>;
}

export interface DelegationGraphPort {
  grant(graphRootId: string, delegateUserId: string): Promise<void>;
  getLatest(graphRootId: string): Promise<{
    graphId: string;
    snapshotId: string;
    graph: {
      nodes: Array<{ nodeId: string; coord: { anchor: string } }>;
      relations: Array<{ relationId: string }>;
    };
  } | null>;
}
