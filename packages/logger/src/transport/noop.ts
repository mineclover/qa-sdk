import type { TransmissionEnvelope } from "@qa-sdk/core";
import type { Transport } from "./transport.js";

/**
 * No-op transport for testing and dry-run scenarios.
 * Records sent envelopes in memory.
 */
export class NoopTransport implements Transport {
  readonly sent: TransmissionEnvelope[] = [];

  async send(envelope: TransmissionEnvelope): Promise<void> {
    this.sent.push(envelope);
  }

  async flush(): Promise<void> {}
  async shutdown(): Promise<void> {}
}
