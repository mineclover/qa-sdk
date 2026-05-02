// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { MemberEntity } from "../../domain/index.js";
import type { MemberTransactionScope } from "./member-transaction.port.js";

export abstract class MemberRepositoryPort {
  abstract save(entity: MemberEntity, scope: MemberTransactionScope): Promise<void>;
  abstract findById(projectId: string, userId: string): Promise<MemberEntity | null>;
  abstract listForProject(projectId: string): Promise<MemberEntity[]>;
  abstract listForUser(userId: string): Promise<MemberEntity[]>;
  abstract delete(projectId: string, userId: string, scope: MemberTransactionScope): Promise<void>;
}
