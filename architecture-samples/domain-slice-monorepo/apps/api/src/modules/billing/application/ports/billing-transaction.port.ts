export interface BillingTransactionScope {
  readonly id: string;
  readonly name: string;
}

export abstract class BillingTransactionPort {
  abstract run<T>(
    name: string,
    handler: (scope: BillingTransactionScope) => Promise<T>,
  ): Promise<T>;
}
