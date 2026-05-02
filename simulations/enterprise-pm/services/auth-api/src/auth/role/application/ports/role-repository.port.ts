// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { RoleEntity } from "../../domain/index.js";
import type { RoleTransactionScope } from "./role-transaction.port.js";

export abstract class RoleRepositoryPort {
  abstract save(entity: RoleEntity, scope: RoleTransactionScope): Promise<void>;
  abstract findById(id: string): Promise<RoleEntity | null>;
  abstract findByName(name: string): Promise<RoleEntity | null>;
  abstract list(): Promise<RoleEntity[]>;
  abstract delete(id: string, scope: RoleTransactionScope): Promise<void>;
}
