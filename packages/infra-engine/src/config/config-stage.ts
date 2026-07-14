// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// config/config-stage.ts — 설정 복호화 + 검증 스테이지
import type { Stage, DeployContext, ResolvedConfig } from '../core/types.js';
import type { SopsLoader } from './sops-loader.js';
import { configSchema } from './config-schema.js';

export function createConfigStage(loader: SopsLoader): Stage {
  return {
    name: 'config',
    async execute(ctx: DeployContext): Promise<DeployContext> {
      const raw = await loader.decrypt(ctx.configPath);
      const config = configSchema.parse(raw) as ResolvedConfig;
      return { ...ctx, config };
    },
    // rollback 없음 — 읽기 전용
  };
}
