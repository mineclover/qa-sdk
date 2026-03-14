import type { TransmissionEnvelope } from "@qa-sdk/core";
import type { Transport } from "@qa-sdk/sdk";

/**
 * BeaconTransport — navigator.sendBeacon을 우선 시도하고,
 * 미지원 환경 또는 beacon 실패(payload 크기 초과 등)이면 fetch keepalive로 fallback.
 * 페이지 언로드(pagehide) 타이밍에서도 이벤트를 누락하지 않는다.
 */
export class BeaconTransport implements Transport {
  private readonly endpoint: string;

  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }

  async send(envelope: TransmissionEnvelope): Promise<void> {
    const body = JSON.stringify(envelope);

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const sent = navigator.sendBeacon(this.endpoint, blob);
      if (sent) return;
    }

    // fallback: fetch with keepalive (언로드 타이밍에서도 동작)
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });

    if (!res.ok) {
      throw new Error(`[BeaconTransport] ${res.status} ${res.statusText}`);
    }
  }

  async flush(): Promise<void> {}
  async shutdown(): Promise<void> {}
}
