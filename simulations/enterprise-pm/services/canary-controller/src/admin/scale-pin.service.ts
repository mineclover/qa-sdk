// @def.boundary sim-canary-controller
// spec 2026-05-02 §6 endpoint 9~10 — Scale pin service.
// Plan: docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1b-admin-and-fault.md Task 1b.7
//
// pin(service, replicas) / unpin(service) / getPin(service) / listPins() 4 메서드.
// pin 활성화 service 는 controller scale 결정 (Task 1b.10) 에서 SKIP + alert 발행.
// 같은 service 재 pin 은 409 ConflictException — admin/scale/pin POST 가 RFC 7807 변환.

import { ConflictException, Injectable } from "@nestjs/common";
import { ScaleStore } from "./scale-store.js";

@Injectable()
export class ScalePinService {
  constructor(private readonly store: ScaleStore) {}

  /**
   * pin: replicas >= 1 정수 강제. 이미 pin 된 service 는 409.
   * 중복 pin 을 reject 하는 이유: e2e 시나리오에서 의도치 않은 overwrite 차단 — 변경
   * 의도가 있다면 unpin 후 pin (명시적 의도) 으로 강제.
   */
  pin(service: string, replicas: number): void {
    if (!Number.isInteger(replicas) || replicas < 1) {
      throw new Error(`replicas must be >= 1 (integer), got ${replicas}`);
    }
    if (this.store.has(service)) {
      throw new ConflictException({
        type: "https://qa-sdk.dev/errors/conflict",
        title: "service already pinned",
        status: 409,
        detail: `service=${service} replicas=${this.store.get(service)}`,
      });
    }
    this.store.set(service, replicas);
  }

  /** unpin: 이미 없으면 no-op (idempotent). */
  unpin(service: string): void {
    this.store.delete(service);
  }

  /** getPin: pin 없으면 null. */
  getPin(service: string): number | null {
    const v = this.store.get(service);
    return v ?? null;
  }

  /** listPins: plain Record<service, replicas> — JSON 직렬화 가능. */
  listPins(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const [k, v] of this.store.entries()) out[k] = v;
    return out;
  }
}
