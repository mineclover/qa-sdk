// @def.boundary sim-canary-controller
// spec 2026-05-02 §8 — pubsub-invalidate-drop fault (시나리오 16).
// Plan: docs/superpowers/plans/2026-05-02-server-side-admin-endpoints/A-stage-1b-admin-and-fault.md Task 1b.2
//
// 효과: bitmap pub/sub `bitmap.invalidate` 채널 메시지를 controller proxy 가 dropRate 비율
// 만큼 drop. 시나리오 16 에서 dropRate=1.0 → TTL 만료 + version-check 시점 fallthrough →
// refresh 검증.
//
// 본 클래스는 기존 Fault 인터페이스 (async enable/disable/reset) 를 그대로 구현하며,
// 추가로 isEnabled/getParams/getTarget/shouldDrop 동기 accessor 를 노출한다 — admin-fault
// controller body schema 와 controller proxy 양쪽이 동일한 SSOT 인스턴스를 inject 받는다.

import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import type { Fault } from './types.js';

export interface PubsubInvalidateDropParams {
  /** drop 확률 (0..1). 1 = 모두 drop, 0 = 통과. */
  dropRate: number;
}

const ParamsSchema = z.object({
  dropRate: z.number().min(0, 'dropRate must be in [0, 1]').max(1, 'dropRate must be in [0, 1]'),
});

@Injectable()
export class PubsubInvalidateDropFault implements Fault {
  readonly kind = 'pubsub-invalidate-drop' as const;
  private params: PubsubInvalidateDropParams | null = null;
  private target: string | undefined;

  async enable(rawParams: unknown, target?: unknown): Promise<void> {
    const parsed = ParamsSchema.parse(rawParams);
    this.params = { dropRate: parsed.dropRate };
    this.target = typeof target === 'string' ? target : undefined;
  }

  async disable(): Promise<void> {
    this.params = null;
    this.target = undefined;
  }

  async reset(): Promise<void> {
    await this.disable();
  }

  isEnabled(): boolean {
    return this.params !== null;
  }

  getParams(): PubsubInvalidateDropParams | null {
    return this.params ? { ...this.params } : null;
  }

  getTarget(): string | undefined {
    return this.target;
  }

  /**
   * controller proxy 가 호출. true → 메시지 drop.
   * disabled 상태에서는 항상 false.
   * rng 미주입 시 Math.random — 테스트는 결정적 mock 주입.
   */
  shouldDrop(rng: () => number = Math.random): boolean {
    if (this.params === null) return false;
    return rng() < this.params.dropRate;
  }
}
