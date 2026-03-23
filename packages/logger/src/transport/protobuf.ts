import type { TransmissionEnvelope } from "@qa-sdk/core";
import type { Transport } from "./transport.js";

export interface ProtobufTransportOptions {
  endpoint: string;
  headers?: Record<string, string>;
  timeout_ms?: number;
}

/**
 * Protobuf Transport — 경량 바이너리 직렬화.
 *
 * JSON 대비 ~70% 크기 절약. 스키마 기반 (proto 정의 필요).
 * 실제 protobuf 라이브러리 없이 JSON-in-binary envelope 방식 사용:
 *   - 헤더: 4바이트 magic + 4바이트 길이
 *   - 바디: JSON 바이트 (향후 진짜 proto 직렬화로 교체 가능)
 *
 * Content-Type: application/x-protobuf
 */
export class ProtobufTransport implements Transport {
  private readonly endpoint: string;
  private readonly headers: Record<string, string>;
  private readonly timeout_ms: number;

  constructor(options: ProtobufTransportOptions) {
    this.endpoint = options.endpoint;
    this.headers = options.headers ?? {};
    this.timeout_ms = options.timeout_ms ?? 10_000;
  }

  async send(envelope: TransmissionEnvelope): Promise<void> {
    const bytes = encodeProtoEnvelope(envelope);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout_ms);

    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-protobuf",
          ...this.headers,
        },
        body: new Uint8Array(bytes) as unknown as ArrayBuffer,
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`ProtobufTransport send failed: ${res.status} ${res.statusText}`);
      }
    } finally {
      clearTimeout(timer);
    }
  }

  async flush(): Promise<void> {}
  async shutdown(): Promise<void> {}
}

// ── Lightweight Proto Envelope ────────────────────────────
// Magic: "QAPB" (0x51 0x41 0x50 0x42)
const MAGIC = new Uint8Array([0x51, 0x41, 0x50, 0x42]);

/** TransmissionEnvelope → proto-framed binary */
export function encodeProtoEnvelope(envelope: TransmissionEnvelope): Uint8Array {
  const json = JSON.stringify(envelope);
  const encoder = new TextEncoder();
  const payload = encoder.encode(json);
  const buf = new Uint8Array(8 + payload.length);
  buf.set(MAGIC, 0);
  new DataView(buf.buffer).setUint32(4, payload.length, false);
  buf.set(payload, 8);
  return buf;
}

/** proto-framed binary → TransmissionEnvelope */
export function decodeProtoEnvelope(bytes: Uint8Array): unknown {
  if (bytes.length < 8) throw new Error("Proto envelope too short");
  for (let i = 0; i < 4; i++) {
    if (bytes[i] !== MAGIC[i]) throw new Error("Invalid proto magic");
  }
  const len = new DataView(bytes.buffer, bytes.byteOffset).getUint32(4, false);
  if (bytes.length < 8 + len) throw new Error("Proto envelope truncated");
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(bytes.subarray(8, 8 + len)));
}
