// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// providers/pulumi-deploy.ts — Pulumi Automation API 기반 배포 함수
import { LocalWorkspace } from '@pulumi/pulumi/automation/index.js';
import type { DeployProvider } from '../adapters/adapter.js';
import type { ResolvedConfig } from '../core/types.js';
import { isSafePid } from '../lib/validation.js';
import { loadPfMap, registerPfEntry } from '../lib/pf-registry.js';

/**
 * Pulumi Automation API를 사용하여 프로바이더의 프로그램을 실행한다.
 * ProvisionStage의 deployFn으로 주입된다.
 *
 * - 로컬 파일 백엔드 사용 (S3 불필요)
 * - K8s context를 k3d-qa-local로 설정
 */
export interface PulumiDeployOptions {
  env?: string;
  dryRun?: boolean;
  backendUrl?: string; // 기본: process.env.PULUMI_BACKEND_URL ?? "file://~/.pulumi-local"
  k8sContext?: string; // 기본: process.env.KUBECONFIG_CONTEXT ?? "k3d-qa-local"
}

export function resolveLocalPort(env: string, port: number): number {
  const envOffset: Record<string, number> = {
    test: 23000,
    dev: 20000,
    stage: 21000,
    staging: 21000,
    prod: 22000,
    production: 22000,
  };
  return port + (envOffset[env] ?? 24000);
}

export function createPulumiDeployFn(options?: PulumiDeployOptions) {
  return (provider: DeployProvider, config: ResolvedConfig, serviceId: string, stackName: string) =>
    pulumiDeployFn(provider, config, serviceId, stackName, options);
}

export async function pulumiDeployFn(
  provider: DeployProvider,
  config: ResolvedConfig,
  serviceId: string,
  stackName: string,
  options?: PulumiDeployOptions,
): Promise<{ stackName: string; outputs: Record<string, string> }> {
  const program = provider.getProgram(config, serviceId);
  const projectName = `infra-engine-${serviceId}`;

  const backendUrl =
    options?.backendUrl ?? process.env.PULUMI_BACKEND_URL ?? 'file://~/.pulumi-local';

  const k8sContext = options?.k8sContext ?? process.env.KUBECONFIG_CONTEXT ?? 'k3d-qa-local';

  const stack = await LocalWorkspace.createOrSelectStack(
    {
      stackName,
      projectName,
      program: program as () => Promise<Record<string, unknown> | void>,
    },
    {
      projectSettings: {
        name: projectName,
        runtime: 'nodejs',
        backend: { url: backendUrl },
      },
    },
  );

  // K8s 컨텍스트 설정
  await stack.setConfig('kubernetes:context', { value: k8sContext });

  // dry-run: preview만 실행하고 반환
  if (options?.dryRun) {
    console.log(`[pulumi] previewing ${serviceId} (dry-run)...`);
    const preview = await stack.preview({ onOutput: (msg) => process.stdout.write(msg) });
    return {
      stackName,
      outputs: { endpoint: '(dry-run)', changeSummary: JSON.stringify(preview.changeSummary) },
    };
  }

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
  const env = options?.env ?? 'dev';
  const ENV_NS: Record<string, string> = {
    test: 'qa-dev',
    dev: 'qa-dev',
    stage: 'qa-stage',
    staging: 'qa-stage',
    prod: 'qa-prod',
    production: 'qa-prod',
  };
  const namespace = ENV_NS[env] ?? 'qa-dev';
  const localPort = resolveLocalPort(env, port);

  if (outputs.serviceName) {
    const pfKey = `${serviceId}-${env}`;
    try {
      const { execa } = await import('execa');

      // 기존 port-forward 프로세스 정리 — PID 기반 (pkill fallback)
      const pfMap = await loadPfMap();
      if (isSafePid(pfMap[pfKey]?.pid)) {
        try {
          process.kill(pfMap[pfKey].pid, 'SIGTERM');
          console.log(`[port-forward] 기존 PID ${pfMap[pfKey].pid} 종료`);
        } catch {
          /* 이미 종료됨 */
        }
      }

      // 백그라운드 port-forward 실행
      const pf = execa(
        'kubectl',
        ['-n', namespace, 'port-forward', `svc/${outputs.serviceName}`, `${localPort}:${port}`],
        { detached: true, stdio: 'ignore' },
      );
      pf.unref();

      // PID를 infra-pf.json에 저장
      if (pf.pid) {
        await registerPfEntry(pfKey, {
          pid: pf.pid,
          localPort,
          service: outputs.serviceName,
          namespace,
          endpoint: `http://127.0.0.1:${localPort}`,
          kind: 'port-forward',
        });
      }

      // port-forward 준비 대기 (연결 확인까지)
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        try {
          await globalThis.fetch(`http://127.0.0.1:${localPort}/`, {
            signal: AbortSignal.timeout(2000),
          });
          break;
        } catch {
          /* 아직 준비 안 됨 */
        }
      }
      console.log(
        `[port-forward] svc/${outputs.serviceName} → localhost:${localPort} (PID: ${pf.pid})`,
      );
    } catch (err) {
      console.warn(`[port-forward] 설정 실패: ${err}`);
    }
  }

  // Node.js fetch는 localhost를 IPv6로 해석할 수 있으므로 127.0.0.1 사용
  outputs.endpoint = `http://127.0.0.1:${localPort}`;
  return { stackName, outputs };
}
