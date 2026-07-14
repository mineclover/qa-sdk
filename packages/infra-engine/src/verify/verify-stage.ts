// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// verify/verify-stage.ts — 헬스체크 + 품질 게이트 검증 스테이지
import type { Stage, DeployContext, VerifyResult, GateCheckResult } from '../core/types.js';
import type { GateAdapter, ServiceProfileAdapter } from '../adapters/adapter.js';
import { runBuiltinGates, type GateOptions } from './gate-definitions.js';

interface VerifyOptions {
  maxRetries?: number;
  retryDelay?: number;
  /** service-profile을 통한 endpoint 피드백 루프 */
  serviceProfile?: ServiceProfileAdapter;
}

export function createVerifyStage(gate: GateAdapter, options?: VerifyOptions): Stage {
  const maxRetries = options?.maxRetries ?? 3;
  const retryDelay = options?.retryDelay ?? 5_000;
  const gateOptions: GateOptions = { serviceProfile: options?.serviceProfile };

  return {
    name: 'verify',
    async execute(ctx: DeployContext): Promise<DeployContext> {
      const start = Date.now();
      let checks: GateCheckResult[] = [];
      let retryCount = 0;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        checks = await runBuiltinGates(ctx, gateOptions);
        const verdict = gate.evaluate(checks);
        if (verdict !== 'fail') {
          const verification: VerifyResult = {
            healthStatus: verdict === 'pass' ? 'healthy' : 'degraded',
            gateVerdict: verdict,
            checks,
            retryCount: attempt,
            totalDuration: Date.now() - start,
          };
          return { ...ctx, verification };
        }
        retryCount = attempt;
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, retryDelay));
        }
      }

      // 최종 실패 → throw (파이프라인 rollback 트리거)
      throw new Error(
        `VerifyStage 실패 (${retryCount + 1}회 시도): ${checks
          .filter((c) => c.verdict === 'fail')
          .map((c) => `${c.gate}: ${c.detail}`)
          .join(', ')}`,
      );
    },
    // rollback 없음 — 읽기 전용 검증
  };
}
