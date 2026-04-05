// stages/register-stage.ts — 레지스트리 동기화 + 프로필 갱신 스테이지
import type { Stage, DeployContext, RegistrationResult, ConnectionCheck } from "../core/types.js";
import type { RegistryAdapter, ServiceProfileAdapter, InfraProfileAdapter } from "../adapters/adapter.js";

export function createRegisterStage(
  registry: RegistryAdapter,
  profile: ServiceProfileAdapter,
  infraProfile: InfraProfileAdapter,
): Stage {
  return {
    name: "register",
    async execute(ctx: DeployContext): Promise<DeployContext> {
      const provision = ctx.provision!;
      const endpoint = provision.outputs.endpoint;

      // 1. registry-service 동기화
      const syncResult = await registry.syncDeployment({
        serviceId: ctx.service,
        deploymentVersion: provision.outputs.version ?? "unknown",
        runtime: {
          namespace: "default",
          name: ctx.service,
          env: ctx.env,
          region: ctx.region,
        },
        provider: ctx.provider,
        project: `infra-engine-${ctx.service}`,
        stack: provision.stackName,
        resourceKey: provision.outputs.resourceId ?? ctx.service,
        url: endpoint,
        outputs: provision.outputs,
      });

      // 2. service-profile URL 업데이트
      await profile.set(ctx.service, endpoint);

      // 3. infra-profile 확장 메타데이터 기록
      await infraProfile.setDeployment(ctx.service, {
        serviceId: ctx.service,
        provider: ctx.provider,
        env: ctx.env,
        region: ctx.region,
        endpoint,
        healthPath: ctx.config?.connections[ctx.service]?.health_path ?? "/health",
        stackName: provision.stackName,
        deploymentVersion: provision.outputs.version ?? "unknown",
        deployedAt: new Date().toISOString(),
        triggeredBy: ctx.triggeredBy,
        metadata: {},
      });

      // 4. 연결 사전 검증
      const connectionChecks: ConnectionCheck[] = [];
      const deps = ctx.config?.services[ctx.service]?.depends_on ?? [];
      for (const dep of deps) {
        const conn = ctx.config?.connections[dep];
        if (conn?.endpoint) {
          try {
            const start = Date.now();
            await fetch(conn.endpoint + (conn.health_path ?? "/health"), {
              method: "HEAD",
              signal: AbortSignal.timeout(5_000),
            });
            connectionChecks.push({ target: dep, reachable: true, latency: Date.now() - start });
          } catch {
            connectionChecks.push({ target: dep, reachable: false });
          }
        }
      }

      const registration: RegistrationResult = {
        synced: syncResult.synced,
        manifestImpact: syncResult.manifestImpact,
        profileUpdated: true,
        infraProfileUpdated: true,
        connectionChecks,
      };

      return { ...ctx, registration };
    },

    async rollback(ctx: DeployContext): Promise<void> {
      await infraProfile.restore(ctx.service);
      await profile.restore(ctx.service);
    },
  };
}
