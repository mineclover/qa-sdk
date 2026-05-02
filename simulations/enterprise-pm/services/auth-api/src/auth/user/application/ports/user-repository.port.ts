// @def.boundary sim-auth-api
// @def.doc domain-slice-architecture

import type { UserEntity } from "../../domain/index.js";
import type { UserTransactionScope } from "./user-transaction.port.js";

/**
 * User Aggregate 의 영속 추상.
 *
 * - dialect (sqlite/pg) 무관 — 어댑터에서 분기.
 * - save 는 트랜잭션 스코프를 받아 동일 트랜잭션 내 INSERT/UPDATE.
 * - delete 는 hard delete (legacy 호환). soft-delete 는 entity.markDeleted()
 *   후 save.
 */
export abstract class UserRepositoryPort {
  abstract save(entity: UserEntity, scope: UserTransactionScope): Promise<void>;
  abstract findById(id: string): Promise<UserEntity | null>;
  abstract findByEmail(email: string): Promise<UserEntity | null>;
  abstract listByDepartment(departmentId: string): Promise<UserEntity[]>;
  abstract delete(id: string, scope: UserTransactionScope): Promise<void>;
}
