export interface AssignmentLogEvent {
  readonly traceId: string;
  readonly correlationId: string;
  readonly domain: 'assignment';
  readonly useCase: string;
  readonly aggregateId: string;
  readonly commandName?: string;
  readonly queryName?: string;
  readonly eventName?: string;
  readonly eventVersion?: string;
  readonly outcome: 'started' | 'success' | 'failure';
  readonly errorCode?: string;
  readonly cacheKeyPrefix?: string;
  readonly cacheHit?: boolean;
}

export abstract class AssignmentLoggerPort {
  abstract record(event: AssignmentLogEvent): Promise<void>;
}
