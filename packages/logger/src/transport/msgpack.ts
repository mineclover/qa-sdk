// @def.boundary observability-system-root
// @def.doc observability-system-root

import { encode } from "@msgpack/msgpack";
import type { TransmissionEnvelope } from "@qa-sdk/core";
import type { Transport } from "./transport.js";

export interface MsgpackTransportOptions {
  endpoint: string;
  headers?: Record<string, string>;
  timeout_ms?: number;
}

/**
 * MessagePack Transport — JSON 호환 바이너리 직렬화.
 *
 * JSON 대비 ~50% 크기 절약. 스키마 불필요 (드롭인 대체).
 * Content-Type: application/msgpack
 */
export class MsgpackTransport implements Transport {
  private readonly endpoint: string;
  private readonly headers: Record<string, string>;
  private readonly timeout_ms: number;

  constructor(options: MsgpackTransportOptions) {
    this.endpoint = options.endpoint;
    this.headers = options.headers ?? {};
    this.timeout_ms = options.timeout_ms ?? 10_000;
  }

  async send(envelope: TransmissionEnvelope): Promise<void> {
    const bytes = encode(envelope);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout_ms);

    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/msgpack",
          ...this.headers,
        },
        body: new Uint8Array(bytes) as unknown as ArrayBuffer,
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`MsgpackTransport send failed: ${res.status} ${res.statusText}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async flush(): Promise<void> {}
  async shutdown(): Promise<void> {}
}
