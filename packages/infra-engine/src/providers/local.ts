// providers/local.ts — 로컬 K3s (k3d) 프로바이더
import * as k8s from "@pulumi/kubernetes";
import type { DeployProvider, ValidationResult } from "../adapters/adapter.js";
import type { ResolvedConfig } from "../core/types.js";

/** K3s 환경에서 namespace를 결정하는 매핑 */
const ENV_NAMESPACE: Record<string, string> = {
  dev: "qa-dev",
  stage: "qa-stage",
  prod: "qa-prod",
};

export function createLocalProvider(): DeployProvider {
  return {
    name: "local",

    getProgram(config: ResolvedConfig, serviceId: string) {
      return async () => {
        const svcConfig = config.services[serviceId];
        const port = svcConfig?.port ?? 3200;
        const image = `qa-sdk/${serviceId}:latest`;
        const namespace =
          ENV_NAMESPACE[config.global.region] ??
          ENV_NAMESPACE["dev"] ??
          "qa-dev";

        // 서비스 설정에서 env vars 추출 (port, depends_on, gates 제외)
        const envVars = Object.entries(svcConfig ?? {})
          .filter(
            ([k, v]) => typeof v === "string" || typeof v === "number",
          )
          .filter(
            ([k]) => k !== "port" && k !== "depends_on" && k !== "gates",
          )
          .map(([k, v]) => ({
            name: k.toUpperCase(),
            value: String(v),
          }));

        // K8s Deployment
        const deployment = new k8s.apps.v1.Deployment(serviceId, {
          metadata: { namespace, labels: { app: serviceId } },
          spec: {
            replicas: 1,
            selector: { matchLabels: { app: serviceId } },
            template: {
              metadata: { labels: { app: serviceId } },
              spec: {
                containers: [
                  {
                    name: serviceId,
                    image,
                    imagePullPolicy: "IfNotPresent", // k3d imported images
                    ports: [{ containerPort: port }],
                    env: envVars,
                    readinessProbe: {
                      httpGet: { path: "/health/live", port },
                      initialDelaySeconds: 5,
                      periodSeconds: 10,
                    },
                  },
                ],
              },
            },
          },
        });

        // K8s Service (NodePort)
        const service = new k8s.core.v1.Service(`${serviceId}-svc`, {
          metadata: { namespace, labels: { app: serviceId } },
          spec: {
            type: "NodePort",
            selector: { app: serviceId },
            ports: [{ port, targetPort: port }],
          },
        });

        return {
          deploymentName: deployment.metadata.name,
          serviceName: service.metadata.name,
          endpoint: service.spec.clusterIP,
        };
      };
    },

    async destroy(stackName: string) {
      // Pulumi destroy가 처리 — 여기서는 로그만
      console.log(`[local] destroy: ${stackName}`);
    },

    async validate(config: ResolvedConfig): Promise<ValidationResult> {
      // kubectl 접근 가능 여부 + K8s 클러스터 상태 확인
      try {
        const { execa } = await import("execa");
        const { stdout } = await execa("kubectl", [
          "cluster-info",
          "--request-timeout=3s",
        ]);
        if (stdout.includes("running")) {
          return { valid: true, errors: [] };
        }
        return {
          valid: false,
          errors: ["K8s 클러스터에 연결할 수 없습니다"],
        };
      } catch {
        return {
          valid: false,
          errors: [
            "kubectl이 설치되어 있지 않거나 K8s 클러스터가 실행 중이 아닙니다",
          ],
        };
      }
    },
  };
}
