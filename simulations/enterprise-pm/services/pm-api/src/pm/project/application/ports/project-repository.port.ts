// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { ProjectEntity } from "../../domain/index.js";
import type { ProjectTransactionScope } from "./project-transaction.port.js";

/**
 * Project Aggregate 의 영속 추상.
 */
export abstract class ProjectRepositoryPort {
  abstract save(entity: ProjectEntity, scope: ProjectTransactionScope): Promise<void>;
  abstract findById(id: string): Promise<ProjectEntity | null>;
  abstract listByDepartment(departmentId: string): Promise<ProjectEntity[]>;
  abstract listByOwner(ownerId: string): Promise<ProjectEntity[]>;
  abstract delete(id: string, scope: ProjectTransactionScope): Promise<void>;
}
