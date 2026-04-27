#!/usr/bin/env npx tsx
/**
 * 로컬 K3s에 GitLab CE Omnibus 배포 (테스트 일회용)
 *
 * 사전 조건:
 * 1. k3d cluster running (context: k3d-qa-local)
 * 2. namespace qa-dev 존재 (없으면: kubectl create ns qa-dev)
 *
 * 사용:
 *   tsx packages/infra-engine/scripts/deploy-gitlab.ts [--root-password <value>] [--external-url <url>] [--namespace <ns>] [--dry-run]
 *
 * 환경변수:
 *   QA_GITLAB_ROOT_PASSWORD — --root-password가 없을 때 fallback
 *   PULUMI_BACKEND_URL       — Pulumi state 백엔드 (기본 file://~/.pulumi-local)
 *   KUBECONFIG_CONTEXT       — kubectl context (기본 k3d-qa-local)
 */

// Pulumi 로컬 백엔드 비밀번호 프롬프트 방지
process.env.PULUMI_CONFIG_PASSPHRASE ??= "";

import { LocalWorkspace } from "@pulumi/pulumi/automation/index.js";
import { execa } from "execa";
import { createGitlabProgram } from "../src/programs/gitlab-program.js";

interface CliFlags {
  rootPassword?: string;
  externalUrl?: string;
  namespace?: string;
  backendUrl?: string;
  k8sContext?: string;
  dryRun: boolean;
}

function parseFlags(argv: readonly string[]): CliFlags {
  const flags: CliFlags = { dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const next = argv[i + 1];
    switch (arg) {
      case "--root-password":
        flags.rootPassword = next;
        i += 1;
        break;
      case "--external-url":
        flags.externalUrl = next;
        i += 1;
        break;
      case "--namespace":
        flags.namespace = next;
        i += 1;
        break;
      case "--backend-url":
        flags.backendUrl = next;
        i += 1;
        break;
      case "--context":
        flags.k8sContext = next;
        i += 1;
        break;
      case "--dry-run":
        flags.dryRun = true;
        break;
    }
  }
  return flags;
}

async function checkKubectlContext(expected: string): Promise<void> {
  try {
    const { stdout } = await execa("kubectl", ["config", "current-context"]);
    if (stdout.trim() !== expected) {
      console.error(
        `[gitlab-deploy] kubectl context가 '${expected}'가 아닙니다 (현재: '${stdout.trim()}'). 중단합니다.`,
      );
      process.exit(1);
    }
  } catch (err) {
    console.error(
      `[gitlab-deploy] kubectl을 찾을 수 없거나 실행 실패: ${(err as Error).message}`,
    );
    process.exit(1);
  }

  try {
    await execa("kubectl", ["cluster-info", "--request-timeout=3s"]);
  } catch {
    console.error(
      "[gitlab-deploy] K8s 클러스터에 연결할 수 없습니다. k3d 클러스터를 확인하세요.",
    );
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const k8sContext =
    flags.k8sContext ?? process.env.KUBECONFIG_CONTEXT ?? "k3d-qa-local";
  const backendUrl =
    flags.backendUrl ?? process.env.PULUMI_BACKEND_URL ?? "file://~/.pulumi-local";
  const rootPassword =
    flags.rootPassword ?? process.env.QA_GITLAB_ROOT_PASSWORD;

  await checkKubectlContext(k8sContext);

  const program = createGitlabProgram({
    namespace: flags.namespace,
    externalUrl: flags.externalUrl,
    rootPassword,
  });

  const projectName = "infra-engine-gitlab";
  const stackName = "gitlab-local";

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
        backend: { url: backendUrl },
      },
    },
  );

  await stack.setConfig("kubernetes:context", { value: k8sContext });

  if (flags.dryRun) {
    console.log("[gitlab-deploy] dry-run preview 실행…");
    const preview = await stack.preview({
      onOutput: (msg) => process.stdout.write(msg),
    });
    console.log(
      `[gitlab-deploy] preview 완료: ${JSON.stringify(preview.changeSummary)}`,
    );
    return;
  }

  console.log(`[gitlab-deploy] stack ${stackName} up…`);
  const result = await stack.up({ onOutput: (msg) => process.stdout.write(msg) });

  const ns =
    typeof result.outputs.namespace?.value === "string"
      ? result.outputs.namespace.value
      : "qa-dev";
  const svcName =
    typeof result.outputs.serviceName?.value === "string"
      ? result.outputs.serviceName.value
      : "gitlab-svc";
  const externalUrl = flags.externalUrl ?? "http://localhost:8929";
  const externalPort = new URL(externalUrl).port || "8929";

  console.log("");
  console.log("[gitlab-deploy] 배포 완료. 다음 단계:");
  console.log("");
  console.log(`  1) Web UI 접근 (호스트):`);
  console.log(
    `     kubectl -n ${ns} port-forward svc/${svcName} ${externalPort}:80`,
  );
  console.log(`     → ${externalUrl}`);
  console.log("");
  if (rootPassword === undefined) {
    console.log(
      `  2) 초기 root 비밀번호 (Omnibus 자동 생성, 첫 부팅 후 24시간 유효):`,
    );
    console.log(
      `     kubectl -n ${ns} exec deploy/gitlab -- cat /etc/gitlab/initial_root_password`,
    );
  } else {
    console.log(
      `  2) root 비밀번호: 배포 시 전달한 값 (Secret '${ns}/gitlab-root-credentials')`,
    );
  }
  console.log("");
  console.log(
    `  3) Omnibus 부팅은 보통 5~10분 걸립니다. readiness 확인:`,
  );
  console.log(`     kubectl -n ${ns} get pod -l app=gitlab -w`);
  console.log("");
}

main().catch((err) => {
  console.error("[gitlab-deploy] 실패:", err);
  process.exit(1);
});
