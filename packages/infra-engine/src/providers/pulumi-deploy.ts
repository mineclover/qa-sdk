// providers/pulumi-deploy.ts — Pulumi Automation API 기반 배포 함수
import { LocalWorkspace } from "@pulumi/pulumi/automation/index.js";
import type { DeployProvider } from "../adapters/adapter.js";
import type { ResolvedConfig } from "../core/types.js";

/**
 * Pulumi Automation API를 사용하여 프로바이더의 프로그램을 실행한다.
 * ProvisionStage의 deployFn으로 주입된다.
 *
 * - 로컬 파일 백엔드 사용 (S3 불필요)
 * - K8s context를 k3d-qa-local로 설정
 */
export async function pulumiDeployFn(
  provider: DeployProvider,
  config: ResolvedConfig,
  serviceId: string,
  stackName: string,
): Promise<{ stackName: string; outputs: Record<string, string> }> {
  const program = provider.getProgram(config, serviceId);
  const projectName = `infra-engine-${serviceId}`;

  const stack = await LocalWorkspace.createOrSelectStack(
    {
      stackName,
      projectName,
      program: program as () => Promise<Record<string, unknown> | void>,
    },
    {
      projectSettings: {
        name: projectName,
        runtime: "nodejs",
        backend: { url: "file://~/.pulumi-local" },
      },
    },
  );

  // K8s 컨텍스트 설정
  await stack.setConfig("kubernetes:context", { value: "k3d-qa-local" });

  console.log(`[pulumi] deploying ${serviceId} to stack ${stackName}...`);
  const result = await stack.up({
    onOutput: (msg) => process.stdout.write(msg),
  });

  // 출력값 추출
  const outputs: Record<string, string> = {};
  for (const [key, val] of Object.entries(result.outputs)) {
    outputs[key] = String(val.value);
  }

  // NodePort 서비스의 endpoint가 없으면 기본값 구성
  if (!outputs.endpoint) {
    const port = config.services[serviceId]?.port ?? 3200;
    outputs.endpoint = `http://localhost:${port}`;
  }

  return { stackName, outputs };
}
