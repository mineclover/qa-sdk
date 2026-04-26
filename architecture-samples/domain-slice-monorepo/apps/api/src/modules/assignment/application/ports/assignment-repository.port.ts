import type { AssignmentEntity } from "../../domain/index.js";
import type { AssignmentTransactionScope } from "./assignment-transaction.port.js";

export abstract class AssignmentRepositoryPort {
  abstract save(entity: AssignmentEntity, scope?: AssignmentTransactionScope): Promise<void>;
  abstract findById(id: string): Promise<AssignmentEntity | null>;
}
