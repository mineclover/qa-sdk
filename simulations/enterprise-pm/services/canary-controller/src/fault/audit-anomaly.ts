// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// 시나리오 #11 (spec 05 §3) — v2 단계 skip으로 audit-recorder critical anomaly 1건이
// 자동 분류되는 흐름. 본 fault는 audit-recorder-store에 severity="critical" row 1건을
// append-only 적재 — CON-005에 따라 controller Pass 1 auditSafety가 즉시 FAIL을 산출하고
// 결정 객체가 verdict="rollback", triggerCategory="auditSafety"로 떨어진다.

import { z } from 'zod';
import type { Fault } from './types.js';

export interface AuditAnomalyStore {
  appendAnomaly(row: { severity: string; reason: string; recordedAt: number }): Promise<void>;
  clearInjected(): Promise<void>;
}

const ParamsSchema = z.object({ reason: z.string().min(1) });

export class AuditAnomalyFault implements Fault {
  constructor(
    private readonly store: AuditAnomalyStore,
    private readonly now: () => number = () => Date.now(),
  ) {}
  async enable(params: unknown) {
    const { reason } = ParamsSchema.parse(params);
    // CON-005: severity "critical" 고정.
    await this.store.appendAnomaly({
      severity: 'critical',
      reason,
      recordedAt: this.now(),
    });
  }
  async disable() {
    await this.store.clearInjected();
  }
  async reset() {
    await this.store.clearInjected();
  }
}
