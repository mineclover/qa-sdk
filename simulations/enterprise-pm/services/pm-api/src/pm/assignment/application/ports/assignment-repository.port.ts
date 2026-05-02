// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { AssignmentEntity } from "../../domain/index.js";
import type { AssignmentTransactionScope } from "./assignment-transaction.port.js";

/**
 * Assignment Aggregate 의 영속 추상.
 *
 * - dialect (sqlite/pg) 무관 — 어댑터에서 분기.
 * - save 는 트랜잭션 스코프를 받아 동일 트랜잭션 내 INSERT/UPDATE.
 */
export abstract class AssignmentRepositoryPort {
  abstract save(entity: AssignmentEntity, scope: AssignmentTransactionScope): Promise<void>;
  abstract findById(id: string): Promise<AssignmentEntity | null>;
}
