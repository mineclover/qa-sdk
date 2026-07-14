export interface AssignmentTransactionScope {
  readonly id: string;
  readonly name: string;
}

export abstract class AssignmentTransactionPort {
  abstract run<T>(
    name: string,
    handler: (scope: AssignmentTransactionScope) => Promise<T>,
  ): Promise<T>;
}
