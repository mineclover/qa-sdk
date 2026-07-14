// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import {
  MemberReadModelQuery,
  type MemberDetailReadModel,
} from '../../application/queries/member-read-model.query.js';
import type { MemberRepositoryPort } from '../../application/ports/member-repository.port.js';
import type { MemberEntity } from '../../domain/index.js';

export class RepositoryMemberReadModel extends MemberReadModelQuery {
  constructor(private readonly repository: MemberRepositoryPort) {
    super();
  }

  async listForProject(projectId: string): Promise<MemberDetailReadModel[]> {
    const entities = await this.repository.listForProject(projectId);
    return entities.map(toDetail);
  }

  async listForUser(userId: string): Promise<MemberDetailReadModel[]> {
    const entities = await this.repository.listForUser(userId);
    return entities.map(toDetail);
  }
}

function toDetail(entity: MemberEntity): MemberDetailReadModel {
  const snapshot = entity.toSnapshot();
  return {
    projectId: snapshot.projectId,
    userId: snapshot.userId,
    role: snapshot.role,
    joinedAt: snapshot.joinedAt,
  };
}
