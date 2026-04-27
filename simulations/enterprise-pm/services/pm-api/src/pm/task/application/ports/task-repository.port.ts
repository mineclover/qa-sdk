// @def.boundary sim-pm-api
// @def.doc domain-slice-architecture

import type { TaskEntity } from "../../domain/index.js";
import type { TaskTransactionScope } from "./task-transaction.port.js";

/**
 * Task Aggregate 의 영속 추상.
 *
 * - dialect (sqlite/pg) 무관 — 어댑터에서 분기.
 * - save 는 트랜잭션 스코프를 받아 동일 트랜잭션 내 INSERT/UPDATE.
 */
export abstract class TaskRepositoryPort {
  abstract save(entity: TaskEntity, scope: TaskTransactionScope): Promise<void>;
  abstract findById(id: string): Promise<TaskEntity | null>;
  abstract listByProject(projectId: string): Promise<TaskEntity[]>;
  abstract listSubtasks(parentTaskId: string): Promise<TaskEntity[]>;
  abstract delete(id: string, scope: TaskTransactionScope): Promise<void>;
}
