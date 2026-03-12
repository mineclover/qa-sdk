import type {
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

  /** Global masking rules applied to all payloads */
  maskingRules?: MaskingRule[];

  /** Max records per envelope before auto-flush */
  batchSize?: number;

  /** Auto-flush interval in ms (0 = disabled) */
  flushIntervalMs?: number;
}

export const DEFAULT_BATCH_SIZE = 50;
export const DEFAULT_FLUSH_INTERVAL_MS = 5_000;
