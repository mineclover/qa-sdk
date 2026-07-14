// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// core/pipeline.ts — 순차 실행 + 역순 rollback 파이프라인
import type { DeployContext, DeployPipeline, DeployResult, Stage, StageResult } from './types.js';

export function createPipeline(stages: Stage[]): DeployPipeline {
  return {
    stages,
    async run(input: DeployContext): Promise<DeployResult> {
      const startTime = Date.now();
      const stageResults: StageResult[] = [];
      const completedStages: Stage[] = [];
      let ctx = input;

      for (const stage of stages) {
        const stageStart = Date.now();
        try {
          ctx = await stage.execute(ctx);
          stageResults.push({
            stage: stage.name,
            status: 'success',
            duration: Date.now() - stageStart,
          });
          completedStages.push(stage);
        } catch (err) {
          stageResults.push({
            stage: stage.name,
            status: 'failed',
            duration: Date.now() - stageStart,
            error: err instanceof Error ? err.message : String(err),
          });

          // 역순 rollback (완료된 스테이지만)
          for (let i = completedStages.length - 1; i >= 0; i--) {
            const completed = completedStages[i];
            const idx = stageResults.findIndex((r) => r.stage === completed.name);
            if (completed.rollback) {
              try {
                await completed.rollback(ctx);
                stageResults[idx].status = 'rolled_back';
              } catch {
                // rollback 실패는 무시 (best-effort)
              }
            } else {
              stageResults[idx].status = 'skipped';
            }
          }

          return {
            success: false,
            healthStatus: 'failed',
            gateVerdict: 'fail',
            duration: Date.now() - startTime,
            stageResults,
          };
        }
      }

      return {
        success: true,
        endpoint: ctx.provision?.outputs.endpoint,
        healthStatus: ctx.verification?.healthStatus ?? 'healthy',
        gateVerdict: ctx.verification?.gateVerdict ?? 'pass',
        duration: Date.now() - startTime,
        stageResults,
      };
    },
  };
}
