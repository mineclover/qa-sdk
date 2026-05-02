// @def.boundary shared-utility-group
// @def.doc shared-utility-group

/**
 * ProtoTransport — 진짜 Protobuf 바이너리 전송.
 *
 * TransmissionEnvelope → protobuf encode → HTTP POST (application/x-protobuf).
 * 수신 측: protobuf decode → JSON TransmissionEnvelope 복원.
 */
import type { TransmissionEnvelope } from "@qa-sdk/core";
import { encodeEnvelope } from "./codec.js";

export interface ProtoTransportOptions {
  endpoint: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export class ProtoTransport {
  private readonly endpoint: string;
  private readonly headers: Record<string, string>;
  private readonly timeoutMs: number;

  constructor(options: ProtoTransportOptions) {
    this.endpoint = options.endpoint;
    this.headers = options.headers ?? {};
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async send(envelope: TransmissionEnvelope): Promise<void> {
    const binary = encodeEnvelope(envelope);

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-protobuf",
        ...this.headers,
      },
      body: binary.buffer.slice(binary.byteOffset, binary.byteOffset + binary.byteLength) as ArrayBuffer,
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!res.ok) {
      throw new Error(`ProtoTransport: ${res.status} ${res.statusText}`);
    }
  }

  async flush(): Promise<void> {}
  async shutdown(): Promise<void> {}
}
