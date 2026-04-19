// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// stages/observe-stage.ts — deploy_event emit + 모니터링 등록 (fail-open)
import type { Stage, DeployContext, ObserveResult, StageResult } from "../core/types.js";
import type { IngestAdapter, CoordinateAdapter, InfraProfileAdapter } from "../adapters/adapter.js";

function mapHealthStatus(status: "healthy" | "degraded" | "failed"): "healthy" | "degraded" | "unhealthy" {
  return status === "failed" ? "unhealthy" : status;
}

export function createObserveStage(
  ingest: IngestAdapter,
  coordinate: CoordinateAdapter,
  infraProfile: InfraProfileAdapter,
): Stage {
  return {
    name: "observe",
    async execute(ctx: DeployContext): Promise<DeployContext> {
      const warnings: string[] = [];
      let eventEmitted = false;
      let monitorRegistered = false;

      // 1. 좌표 해석 (fail-open)
      const svcRef = coordinate.resolveSvcRef(ctx.service, ctx.env, ctx.region);
      const action = ctx.verification?.healthStatus === "failed" ? "rollback" : "deploy";
      const addressContext = coordinate.encodeDeployEvent(svcRef, action);

      // 2. ingest emit (fail-open)
      try {
        const payload = {
          service_id: ctx.service,
          provider: ctx.provider,
          env: ctx.env,
          region: ctx.region,
          endpoint: ctx.provision?.outputs.endpoint ?? "",
          health_status: mapHealthStatus(ctx.verification?.healthStatus ?? "healthy"),
          gate_verdict: ctx.verification?.gateVerdict ?? "pass",
          duration_ms: ctx.provision?.duration ?? 0,
          stage_results: [] as StageResult[], // 파이프라인 실행기가 나중에 채움
          triggered_by: ctx.triggeredBy,
          rollback: action === "rollback",
          stack_name: ctx.provision?.stackName ?? "",
        };

        const result = await ingest.emit("deploy_event", payload, addressContext);
        if (result.ok) {
          eventEmitted = true;
        } else {
          warnings.push(result.error ?? "ingest emit 실패");
        }
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : String(err));
      }

      // 3. 모니터 등록 (fail-open)
      try {
        await infraProfile.setMonitor(ctx.service, {
          serviceId: ctx.service,
          endpoint: ctx.provision?.outputs.endpoint ?? "",
          healthPath: ctx.config?.connections[ctx.service]?.health_path ?? "/health",
          provider: ctx.provider,
          env: ctx.env,
          region: ctx.region,
          namespace: "default",
          interval: ctx.config?.monitoring?.interval ?? 60,
        });
        monitorRegistered = true;
      } catch (err) {
        warnings.push(err instanceof Error ? err.message : String(err));
      }

      const observation: ObserveResult = { eventEmitted, monitorRegistered, warnings };
      return { ...ctx, observation };
    },
    // rollback 없음 — fail-open
  };
}
