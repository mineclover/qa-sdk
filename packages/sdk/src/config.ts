import type {
  ActorContext,
  TransmissionOwner,
  TransmissionSource,
  TransmissionRuntime,
  TransmissionBuild,
} from "@qa-sdk/core";
import type { Transport } from "./transport/transport.js";
import type { MaskingRule } from "./masking.js";

export interface QaLoggerConfig {
  /** Transport layer for sending envelopes */
  transport: Transport;

  /** Owner of the transmission (tenant, workspace, user, agent) */
  owner: TransmissionOwner;

  /** Source identification */
  source: TransmissionSource;

  /** Runtime environment info */
  runtime: TransmissionRuntime;

  /** Build info */
  build: TransmissionBuild;

  /** Actor context — 모든 레코드에 자동으로 주입된다 */
  actor?: ActorContext;

  /** Global masking rules applied to all payloads */
  maskingRules?: MaskingRule[];

  /** Max records per envelope before auto-flush */
  batchSize?: number;

  /** Auto-flush interval in ms (0 = disabled) */
  flushIntervalMs?: number;

  /** Hard cap on in-memory buffer. Oldest records are dropped when exceeded. */
  maxBufferSize?: number;

  /** Called when a flush or transport error occurs. Defaults to console.error. */
  onError?: (err: Error, context: string) => void;
}

export const DEFAULT_BATCH_SIZE = 50;
export const DEFAULT_FLUSH_INTERVAL_MS = 5_000;
/** Hard cap on in-memory buffer size. Oldest records are dropped with a warning when exceeded. */
export const DEFAULT_MAX_BUFFER_SIZE = 500;
