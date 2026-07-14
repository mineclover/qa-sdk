// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { ResourcePolicyRegistry } from 'permission-engine';
import type {
  PolicyLifecyclePort,
  DelegationGraphPort,
} from '../../application/ports/project-policy.port.js';
import type { ProjectDelegationGraphStore } from '../../../../auth-deps/delegation-graph-store.js';

/**
 * permission-engine 의 ResourcePolicyRegistry 를
 * 슬라이스의 PolicyLifecyclePort 로 어댑팅.
 */
export class ResourcePolicyAdapter implements PolicyLifecyclePort {
  constructor(private readonly registry: ResourcePolicyRegistry) {}

  async create(input: {
    resourceId: string;
    resourceType: string;
    ownerId: string;
  }): Promise<void> {
    await this.registry.create(input);
  }

  async remove(resourceId: string): Promise<void> {
    await this.registry.remove(resourceId);
  }

  async resolve(resourceId: string): Promise<{ state: string; graphRootId?: string } | null> {
    const policy = await this.registry.resolve(resourceId);
    if (!policy) return null;
    return {
      state: policy.state,
      graphRootId: policy.graphRootId,
    };
  }

  async register(resourceId: string, input: { cerbosPolicyRef: string }): Promise<void> {
    await this.registry.register(resourceId, input);
  }

  async delegate(resourceId: string, input: { graphRootId: string }): Promise<void> {
    await this.registry.delegate(resourceId, input);
  }
}

/**
 * ProjectDelegationGraphStore (auth-deps) → DelegationGraphPort 어댑터.
 */
export class DelegationGraphAdapter implements DelegationGraphPort {
  constructor(private readonly store: ProjectDelegationGraphStore) {}

  async grant(graphRootId: string, delegateUserId: string): Promise<void> {
    await this.store.grant(graphRootId, delegateUserId);
  }

  async getLatest(graphRootId: string): Promise<{
    graphId: string;
    snapshotId: string;
    graph: {
      nodes: Array<{ nodeId: string; coord: { anchor: string } }>;
      relations: Array<{ relationId: string }>;
    };
  } | null> {
    const snapshot = await this.store.getLatest(graphRootId);
    if (!snapshot) return null;
    return {
      graphId: snapshot.graphId,
      snapshotId: snapshot.snapshotId,
      graph: {
        nodes: snapshot.graph.nodes.map((n) => ({
          nodeId: n.nodeId,
          coord: { anchor: n.coord.anchor },
        })),
        relations: snapshot.graph.relations.map((r) => ({ relationId: r.relationId })),
      },
    };
  }
}
