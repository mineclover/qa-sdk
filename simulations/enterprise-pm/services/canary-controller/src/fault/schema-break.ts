// @def.boundary sim-canary-controller
// @def.doc canary-controller-config
// 시나리오 #10 (spec 05 §3) — v2 outbox event에 호환 깨지는 신규 필수 필드를 강제 주입
// 해 controller Pass 1 `compatibility` hard rule이 FAIL로 떨어지는지 검증한다.
// 본 fault는 /v1/insights/schema-compat 응답을 덮어쓰지 않고 outbox publisher fixture가
// 다음 발행부터 추가 필드를 첨부하도록 토글한다 — 결정 모델은 정상 측정 경로로 hard FAIL을 본다.

import { z } from 'zod';
import type { Fault } from './types.js';

export interface SchemaBreakStore {
  setBreak(fieldName: string): Promise<void>;
  clearBreak(): Promise<void>;
  readBreak(): Promise<{ active: boolean; fieldName: string | null }>;
}

const ParamsSchema = z.object({ fieldName: z.string().min(1) });

export class SchemaBreakFault implements Fault {
  constructor(private readonly store: SchemaBreakStore) {}
  async enable(params: unknown) {
    const { fieldName } = ParamsSchema.parse(params);
    await this.store.setBreak(fieldName);
  }
  async disable() {
    await this.store.clearBreak();
  }
  async reset() {
    await this.store.clearBreak();
  }
}
