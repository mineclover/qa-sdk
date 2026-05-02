export interface BillingLogEvent {
  readonly traceId: string;
  readonly correlationId: string;
  readonly domain: "billing";
  readonly useCase: string;
  readonly aggregateId: string;
  readonly commandName: string;
  readonly outcome: "started" | "success" | "failure";
  readonly errorCode?: string;
}

export abstract class BillingLoggerPort {
  abstract record(event: BillingLogEvent): Promise<void>;
}
