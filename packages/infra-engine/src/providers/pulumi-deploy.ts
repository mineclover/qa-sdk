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

  // K3s NodePort → kubectl port-forward로 호스트에서 접근 가능하게
  const port = config.services[serviceId]?.port ?? 3200;
  const localPort = port + 20000; // 충돌 방지: 80 → 20080, 3200 → 23200 (10080은 Node.js unsafe port)
  const namespace = outputs.serviceName
    ? "qa-dev" // TODO: env 기반 namespace 결정
    : "default";

  if (outputs.serviceName) {
    try {
      const { execa } = await import("execa");
      // 기존 port-forward 프로세스 정리
      try {
        await execa("pkill", ["-f", `port-forward.*${outputs.serviceName}`]);
      } catch { /* 기존 프로세스 없으면 무시 */ }

      // 백그라운드 port-forward 실행
      const pf = execa("kubectl", [
        "-n", namespace,
        "port-forward",
        `svc/${outputs.serviceName}`,
        `${localPort}:${port}`,
      ], { detached: true, stdio: "ignore" });
      pf.unref();

      // port-forward 준비 대기 (연결 확인까지)
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        try {
          await globalThis.fetch(`http://127.0.0.1:${localPort}/`, { signal: AbortSignal.timeout(2000) });
          break;
        } catch { /* 아직 준비 안 됨 */ }
      }
      console.log(`[port-forward] svc/${outputs.serviceName} → localhost:${localPort}`);
    } catch (err) {
      console.warn(`[port-forward] 설정 실패: ${err}`);
    }
  }

  // Node.js fetch는 localhost를 IPv6로 해석할 수 있으므로 127.0.0.1 사용
  outputs.endpoint = `http://127.0.0.1:${localPort}`;
  return { stackName, outputs };
}
