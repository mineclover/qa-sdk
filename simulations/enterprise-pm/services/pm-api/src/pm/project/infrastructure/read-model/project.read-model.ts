// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import {
  ProjectReadModelQuery,
  type ProjectDetailReadModel,
  type ProjectDelegationReadModel,
} from "../../application/queries/project-read-model.query.js";
import type { ProjectRepositoryPort } from "../../application/ports/project-repository.port.js";
import type { ProjectEntity } from "../../domain/index.js";
import type {
  PolicyLifecyclePort,
  DelegationGraphPort,
} from "../../application/ports/project-policy.port.js";

export class RepositoryProjectReadModel extends ProjectReadModelQuery {
  constructor(
    private readonly repository: ProjectRepositoryPort,
    private readonly policies?: PolicyLifecyclePort,
    private readonly delegationGraph?: DelegationGraphPort,
  ) {
    super();
  }

  async findDetail(id: string): Promise<ProjectDetailReadModel | null> {
    const entity = await this.repository.findById(id);
    if (!entity) return null;
    return toDetail(entity);
  }

  async listByDepartment(departmentId: string): Promise<ProjectDetailReadModel[]> {
    const entities = await this.repository.listByDepartment(departmentId);
    return entities.map(toDetail);
  }

  async listByOwner(ownerId: string): Promise<ProjectDetailReadModel[]> {
    const entities = await this.repository.listByOwner(ownerId);
    return entities.map(toDetail);
  }

  async findDelegationSnapshot(id: string): Promise<ProjectDelegationReadModel | null> {
    if (!this.policies || !this.delegationGraph) return null;
    const policy = await this.policies.resolve(id);
    if (!policy?.graphRootId) return null;
    const snapshot = await this.delegationGraph.getLatest(policy.graphRootId);
    if (!snapshot) return null;
    return {
      graphId: snapshot.graphId,
      snapshotId: snapshot.snapshotId,
      nodeCount: snapshot.graph.nodes.length,
      relationCount: snapshot.graph.relations.length,
      graph: snapshot.graph,
    };
  }
}

function toDetail(entity: ProjectEntity): ProjectDetailReadModel {
  const snapshot = entity.toSnapshot();
  return {
    id: snapshot.id,
    name: snapshot.name,
    ownerId: snapshot.ownerId,
    departmentId: snapshot.departmentId,
    status: snapshot.status,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt,
  };
}
