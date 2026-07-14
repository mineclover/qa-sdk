// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// fault-injector Registry — FaultKind 키로 enable/disable/resetAll 위임.
// controller 라이프사이클 종료 시 resetAll()로 누수 방지(Stage 11 시나리오 runner에서 호출).
// spec 2026-05-02 §8 — getFault(kind) 노출 (admin controller 가 active/params 조회용).

import type { Fault, FaultKind } from './types.js';

export class FaultInjector {
  constructor(private readonly registry: Record<FaultKind, Fault>) {}

  private resolve(kind: FaultKind): Fault {
    const f = this.registry[kind];
    if (!f) throw new Error(`unknown fault kind: ${kind}`);
    return f;
  }

  /** Record<FaultKind, Fault> 매핑에서 인스턴스 lookup. admin endpoint 응답 합성용. */
  getFault(kind: FaultKind): Fault {
    return this.resolve(kind);
  }

  async enable(kind: FaultKind, params: unknown): Promise<void> {
    await this.resolve(kind).enable(params);
  }

  async disable(kind: FaultKind, target?: unknown): Promise<void> {
    await this.resolve(kind).disable(target);
  }

  async resetAll(): Promise<void> {
    for (const kind of Object.keys(this.registry) as FaultKind[]) {
      await this.registry[kind].reset();
    }
  }
}
