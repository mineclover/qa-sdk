import type { BillingEntity } from "../../domain/index.js";
import type { BillingTransactionScope } from "./billing-transaction.port.js";

export abstract class BillingRepositoryPort {
  abstract save(entity: BillingEntity, scope?: BillingTransactionScope): Promise<void>;
}
