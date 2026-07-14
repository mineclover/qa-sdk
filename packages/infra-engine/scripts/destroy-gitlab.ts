#!/usr/bin/env npx tsx
/**
 * 로컬 K3s의 GitLab CE 인스턴스 + Pulumi state를 정리한다.
 * emptyDir 사용으로 컨테이너 안의 모든 데이터(repo/issue/user)도 함께 사라진다.
 *
 * 사용:
 *   tsx packages/infra-engine/scripts/destroy-gitlab.ts [--backend-url <url>] [--context <ctx>]
 */

process.env.PULUMI_CONFIG_PASSPHRASE ??= '';

import { LocalWorkspace } from '@pulumi/pulumi/automation/index.js';

interface CliFlags {
  backendUrl?: string;
  k8sContext?: string;
}

function parseFlags(argv: readonly string[]): CliFlags {
  const flags: CliFlags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const next = argv[i + 1];
    if (arg === '--backend-url') {
      flags.backendUrl = next;
      i += 1;
    } else if (arg === '--context') {
      flags.k8sContext = next;
      i += 1;
    }
  }
  return flags;
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const backendUrl = flags.backendUrl ?? process.env.PULUMI_BACKEND_URL ?? 'file://~/.pulumi-local';
  const k8sContext = flags.k8sContext ?? process.env.KUBECONFIG_CONTEXT ?? 'k3d-qa-local';

  const projectName = 'infra-engine-gitlab';
  const stackName = 'gitlab-local';

  const stack = await LocalWorkspace.selectStack(
    {
      stackName,
      projectName,
      // destroy에는 program이 사용되지 않지만 LocalWorkspace.selectStack 시그니처가 요구
      program: async () => ({}),
    },
    {
      projectSettings: {
        name: projectName,
        runtime: 'nodejs',
        backend: { url: backendUrl },
      },
    },
  );

  await stack.setConfig('kubernetes:context', { value: k8sContext });

  console.log(`[gitlab-destroy] stack ${stackName} destroy…`);
  await stack.destroy({ onOutput: (msg) => process.stdout.write(msg) });

  console.log('');
  console.log(
    '[gitlab-destroy] 정리 완료. emptyDir 사용으로 GitLab 데이터(repo/issue/user)는 모두 제거됨.',
  );
  console.log(
    '[gitlab-destroy] Pulumi stack 자체를 지우려면: PULUMI_BACKEND_URL=file://~/.pulumi-local pulumi stack rm infra-engine-gitlab/gitlab-local --yes',
  );
}

main().catch((err) => {
  console.error('[gitlab-destroy] 실패:', err);
  process.exit(1);
});
