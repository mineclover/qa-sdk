import type { TransmissionEnvelope } from "@qa-sdk/core";

export interface Transport {
  send(envelope: TransmissionEnvelope): Promise<void>;
  flush(): Promise<void>;
  shutdown(): Promise<void>;
}
