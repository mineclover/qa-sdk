// @def.boundary observability-system-root
// @def.doc observability-system-root

import type { TransmissionEnvelope } from '@qa-sdk/core';
import type { Transport } from './transport.js';

export interface HttpTransportOptions {
  endpoint: string;
  headers?: Record<string, string>;
  timeout_ms?: number;
}

export class HttpTransport implements Transport {
  private readonly endpoint: string;
  private readonly headers: Record<string, string>;
  private readonly timeout_ms: number;

  constructor(options: HttpTransportOptions) {
    this.endpoint = options.endpoint;
    this.headers = options.headers ?? {};
    this.timeout_ms = options.timeout_ms ?? 10_000;
  }

  async send(envelope: TransmissionEnvelope): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout_ms);

    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify(envelope),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Transport send failed: ${res.status} ${res.statusText}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async flush(): Promise<void> {
    // HTTP transport is stateless per-send; nothing to flush
  }

  async shutdown(): Promise<void> {
    // No persistent connections to close
  }
}
