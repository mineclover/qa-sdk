// stages/provision-stage.ts — 프로바이더 검증 + 배포 스테이지
import type { Stage, DeployContext, ProvisionResult, ResolvedConfig } from "../core/types.js";
import type { DeployProvider } from "../adapters/adapter.js";

type DeployFn = (
  provider: DeployProvider,
  config: ResolvedConfig,
  serviceId: string,
  stackName: string,
) => Promise<{ stackName: string; outputs: Record<string, string> }>;

type ProviderResolver = (name: string) => DeployProvider;

export function createProvisionStage(
  resolveProvider: ProviderResolver,
  deployFn: DeployFn,
): Stage {
  let lastProvider: DeployProvider | null = null;
  let lastStackName: string | null = null;

  return {
    name: "provision",
    async execute(ctx: DeployContext): Promise<DeployContext> {
      const provider = resolveProvider(ctx.provider);
      lastProvider = provider;

      // 사전 검증
      const validation = await provider.validate(ctx.config!);
      if (!validation.valid) {
        throw new Error(`프로바이더 검증 실패 (${provider.name}): ${validation.errors.join(", ")}`);
      }

      const stackName = `${ctx.service}-${ctx.env}-${ctx.provider}-${ctx.region}`;
      lastStackName = stackName;
      const start = Date.now();

      const result = await deployFn(provider, ctx.config!, ctx.service, stackName);

      const provision: ProvisionResult = {
        stackName: result.stackName,
        outputs: result.outputs,
        provider: ctx.provider,
        region: ctx.region,
        duration: Date.now() - start,
      };

      return { ...ctx, provision };
    },

    async rollback(): Promise<void> {
      if (lastProvider && lastStackName) {
        await lastProvider.destroy(lastStackName);
      }
    },
  };
}
