import { AssignmentTransactionPort } from "../../application/ports/assignment-transaction.port.js";
import {
  TransactionalAssignmentStore,
  type AssignmentUnitOfWorkScope,
} from "./assignment.unit-of-work.js";

export interface AssignmentDrizzleTransactionClient {
  readonly id: string;
}

export interface AssignmentDrizzleDb {
  transaction<T>(handler: (tx: AssignmentDrizzleTransactionClient) => Promise<T>): Promise<T>;
}

export interface DrizzleAssignmentTransactionScope extends AssignmentUnitOfWorkScope {
  readonly tx: AssignmentDrizzleTransactionClient;
}

export class DrizzleAssignmentTransaction extends AssignmentTransactionPort {
  private nextId = 1;

  constructor(
    private readonly store: TransactionalAssignmentStore,
    private readonly db: AssignmentDrizzleDb,
  ) {
    super();
  }

  async run<T>(
    name: string,
    handler: (scope: DrizzleAssignmentTransactionScope) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (tx) => {
      const scope = Object.assign(this.store.begin(`${name}:${this.nextId++}`, name), { tx });
      const result = await handler(scope);
      this.store.commit(scope);
      return result;
    });
  }
}
