// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// 시나리오 #13 (spec 05 §3) — dbPool 인위 축소(pool=4) + 동시 요청 ≥4 지속으로 controller
// Pass 2가 verdict="rejected", rejectedBy="resourceHeadroom"을 산출하고 replica 변동 0을
// 보이는지 검증한다. 본 fault는 metrics-collector 측 db_pool_utilization gauge에 forced
// active/max를 주입한다 — controller resource-headroom.dbPoolUtilization 카테고리 입력으로
// 즉시 반영된다.

import { z } from 'zod';
import type { Fault } from './types.js';

export interface DbPoolGaugeStore {
  setForcedUtilization(service: string, active: number, max: number): Promise<void>;
  clear(service?: string): Promise<void>;
}

const ParamsSchema = z
  .object({
    service: z.string().min(1),
    poolMax: z.number().int().positive(),
    active: z.number().int().nonnegative().optional(),
  })
  .superRefine((v, ctx) => {
    const a = v.active ?? v.poolMax;
    if (a > v.poolMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `active (${a}) must be ≤ poolMax (${v.poolMax})`,
      });
    }
  });

export class DbPoolPressureFault implements Fault {
  constructor(private readonly gauge: DbPoolGaugeStore) {}
  async enable(params: unknown) {
    const v = ParamsSchema.parse(params);
    const active = v.active ?? v.poolMax; // 기본 utilization=1.0
    await this.gauge.setForcedUtilization(v.service, active, v.poolMax);
  }
  // disable에 service 지정 가능 — admin-router가 body로 위임.
  async disable(service?: unknown) {
    const target = typeof service === 'string' ? service : undefined;
    await this.gauge.clear(target);
  }
  async reset() {
    await this.gauge.clear();
  }
}
