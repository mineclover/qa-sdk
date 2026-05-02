// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { DepartmentEntity } from "../../domain/index.js";
import type { DepartmentTransactionScope } from "./department-transaction.port.js";

export abstract class DepartmentRepositoryPort {
  abstract save(entity: DepartmentEntity, scope: DepartmentTransactionScope): Promise<void>;
  abstract findById(id: string): Promise<DepartmentEntity | null>;
  abstract list(): Promise<DepartmentEntity[]>;
  /** parent chain — root까지의 ancestor 목록 (자기 자신 포함). */
  abstract resolveChain(id: string): Promise<DepartmentEntity[]>;
  abstract delete(id: string, scope: DepartmentTransactionScope): Promise<void>;
}
