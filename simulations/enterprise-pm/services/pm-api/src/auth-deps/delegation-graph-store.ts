// @def.boundary sim-pm-api
// @def.doc authorization-graph-store

import {
  createAuthorizationRealm,
  createPrincipalNode,
  createResourceNode,
  mergeAuthorizationGraphs,
  InMemoryAuthorizationGraphStore,
  type AuthorizationGraphStore,
  type AuthorizationOntologyGraph,
} from "authorization-ontology";

const SIM_PM_GRAPH_REALM = createAuthorizationRealm({
  kind: "application",
  authority: "sim-pm-api",
  environment: "sim",
});

function emptyDelegationGraph(graphRootId: string): AuthorizationOntologyGraph {
  return {
    realms: [SIM_PM_GRAPH_REALM],
    nodes: [
      createResourceNode({
        realm: SIM_PM_GRAPH_REALM,
        resourceId: graphRootId,
        resourceKind: "graph_node",
        attributes: {
          graphKind: "delegation",
          graphRootId,
        },
      }),
    ],
    relations: [],
  };
}

function delegateGraph(graphRootId: string, delegateUserId: string): AuthorizationOntologyGraph {
  return {
    realms: [SIM_PM_GRAPH_REALM],
    nodes: [
      createPrincipalNode({
        realm: SIM_PM_GRAPH_REALM,
        principalId: delegateUserId,
        principalKind: "human_user",
        attributes: {
          graphKind: "delegation",
          graphRootId,
          delegated: true,
        },
      }),
    ],
    relations: [],
  };
}

export class ProjectDelegationGraphStore {
  constructor(
    private readonly store: AuthorizationGraphStore = new InMemoryAuthorizationGraphStore(),
  ) {}

  async grant(graphRootId: string, delegateUserId: string): Promise<void> {
    const previous = await this.latestSnapshot(graphRootId);
    const nextGraph = previous
      ? mergeAuthorizationGraphs(previous.graph, delegateGraph(graphRootId, delegateUserId))
      : mergeAuthorizationGraphs(
          emptyDelegationGraph(graphRootId),
          delegateGraph(graphRootId, delegateUserId),
        );

    await this.store.saveSnapshot({
      graphId: graphRootId,
      graph: nextGraph,
      sourceRef: `sim-pm-api://delegation/${graphRootId}`,
      labels: {
        graphKind: "delegation",
      },
      metadata: {
        delegateUserId,
      },
    });
  }

  async hasDelegate(graphRootId: string, userId: string): Promise<boolean> {
    const snapshot = await this.latestSnapshot(graphRootId);
    if (!snapshot) return false;
    return snapshot.graph.nodes.some((node) =>
      node.kind === "principal" &&
      node.coord.anchor === userId &&
      node.metadata?.attributes &&
      typeof node.metadata.attributes === "object" &&
      (node.metadata.attributes as Record<string, unknown>).graphRootId === graphRootId,
    );
  }

  private async latestSnapshot(graphRootId: string) {
    const snapshots = await this.store.listSnapshots({ graphId: graphRootId });
    return snapshots[snapshots.length - 1];
  }
}
