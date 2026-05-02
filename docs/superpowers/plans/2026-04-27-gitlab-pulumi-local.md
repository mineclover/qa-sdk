# GitLab Pulumi Local Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로컬 K3s(`k3d-qa-local`) 위에 GitLab CE Omnibus를 잠깐 띄우고 깔끔히 내릴 수 있는 Pulumi 모듈 + thin script를 `infra-engine` 패키지에 추가한다.

**Architecture:** `packages/infra-engine/src/programs/gitlab-program.ts`가 Pulumi 프로그램(Namespace 참조 + 선택적 Secret + Deployment + NodePort Service)을 빌드하고, `scripts/deploy-gitlab.ts` / `scripts/destroy-gitlab.ts`가 Pulumi Automation API(`LocalWorkspace`)로 stack을 올리거나 내린다. Omnibus 단일 컨테이너 + `emptyDir`이라 destroy 한 번이면 데이터까지 사라진다.

**Tech Stack:** TypeScript ESM, `@pulumi/pulumi` 3.x, `@pulumi/kubernetes` 4.x, `vitest`, `tsx`, `execa`, K3s/k3d.

**Spec:** `docs/superpowers/specs/2026-04-27-gitlab-pulumi-local-design.md`

---

## File Structure

| 경로 | 책임 |
|---|---|
| `packages/infra-engine/src/programs/gitlab-program.ts` | 순수 헬퍼 `buildOmnibusConfig` + 팩토리 `createGitlabProgram` (Pulumi 리소스 트리) |
| `packages/infra-engine/scripts/deploy-gitlab.ts` | CLI 인자 파싱 → kubectl 사전 검증 → `LocalWorkspace.up` → 사용자 안내 출력 |
| `packages/infra-engine/scripts/destroy-gitlab.ts` | `LocalWorkspace.selectStack` → `stack.destroy` |
| `packages/infra-engine/__tests__/programs/gitlab-program.test.ts` | `buildOmnibusConfig` 단위 테스트 + `pulumi.runtime.setMocks`로 리소스 모양 스냅샷 검증 |

`src/programs/` 디렉토리는 새로 만든다(현재 `providers/`, `stages/` 등 옆자리). `index.ts`에 re-export하지 않는다 — 스크립트에서만 직접 import한다(YAGNI).

---

## Task 1: `buildOmnibusConfig` 순수 헬퍼 + 디렉토리 부트스트랩

**Files:**
- Create: `packages/infra-engine/src/programs/gitlab-program.ts`
- Create: `packages/infra-engine/__tests__/programs/gitlab-program.test.ts`

- [ ] **Step 1: 디렉토리/스켈레톤 파일 생성**

`packages/infra-engine/src/programs/gitlab-program.ts` 를 다음 내용으로 만든다 (이 단계에서는 헬퍼 함수만; Pulumi 리소스는 Task 2에서 추가):

```ts
// @def.boundary infra-engine-system
// @def.doc infra-engine-system

// programs/gitlab-program.ts — 로컬 K3s에 GitLab CE Omnibus를 띄우는 Pulumi 프로그램

export interface BuildOmnibusConfigInput {
  /** GitLab external_url (예: "http://localhost:8929") */
  externalUrl: string;
  /** true면 GITLAB_ROOT_PASSWORD env에서 초기 비밀번호를 주입하는 라인을 포함 */
  useRootPasswordEnv: boolean;
}

/**
 * GitLab Omnibus가 인식하는 GITLAB_OMNIBUS_CONFIG 문자열을 만든다.
 * 결정론적: 같은 입력 → 같은 출력.
 */
export function buildOmnibusConfig(input: BuildOmnibusConfigInput): string {
  const lines: string[] = [`external_url '${input.externalUrl}'`];
  if (input.useRootPasswordEnv) {
    lines.push(
      "gitlab_rails['initial_root_password'] = ENV['GITLAB_ROOT_PASSWORD'] if ENV['GITLAB_ROOT_PASSWORD']",
    );
  }
  return lines.join("; ");
}
```

- [ ] **Step 2: 테스트 파일 생성 — failing 단위 테스트**

`packages/infra-engine/__tests__/programs/gitlab-program.test.ts` 를 만든다:

```ts
import { describe, expect, it } from "vitest";
import { buildOmnibusConfig } from "../../src/programs/gitlab-program.js";

describe("buildOmnibusConfig", () => {
  it("external_url만 포함한다 (rootPasswordEnv 없음)", () => {
    const cfg = buildOmnibusConfig({
      externalUrl: "http://localhost:8929",
      useRootPasswordEnv: false,
    });
    expect(cfg).toBe("external_url 'http://localhost:8929'");
  });

  it("rootPasswordEnv가 true면 initial_root_password 라인을 추가한다", () => {
    const cfg = buildOmnibusConfig({
      externalUrl: "http://localhost:8929",
      useRootPasswordEnv: true,
    });
    expect(cfg).toContain("external_url 'http://localhost:8929'");
    expect(cfg).toContain(
      "gitlab_rails['initial_root_password'] = ENV['GITLAB_ROOT_PASSWORD'] if ENV['GITLAB_ROOT_PASSWORD']",
    );
  });

  it("두 라인 사이는 세미콜론+공백으로 구분한다", () => {
    const cfg = buildOmnibusConfig({
      externalUrl: "http://gitlab.test",
      useRootPasswordEnv: true,
    });
    const parts = cfg.split("; ");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe("external_url 'http://gitlab.test'");
  });
});
```

- [ ] **Step 3: 테스트 실행 — 통과 확인**

Run: `pnpm --filter infra-engine test -- gitlab-program`

Expected: 3 tests pass (`buildOmnibusConfig` 3건). Step 1에서 이미 함수를 만들었으므로 즉시 통과해야 한다.

만약 실패하면 `src/programs/gitlab-program.ts` 의 줄을 다시 본다 — 따옴표(작은따옴표 vs 큰따옴표)와 세미콜론+공백 구분자가 맞는지.

- [ ] **Step 4: 커밋**

```bash
git add packages/infra-engine/src/programs/gitlab-program.ts \
        packages/infra-engine/__tests__/programs/gitlab-program.test.ts
git commit -m "$(cat <<'EOF'
feat(infra-engine): scaffold GitLab Pulumi program — buildOmnibusConfig helper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `createGitlabProgram` — Pulumi 리소스 트리 + 모킹 테스트

**Files:**
- Modify: `packages/infra-engine/src/programs/gitlab-program.ts` (헬퍼 아래에 팩토리 추가)
- Modify: `packages/infra-engine/__tests__/programs/gitlab-program.test.ts` (mocks 기반 케이스 추가)

- [ ] **Step 1: failing 테스트 추가 (resource shape)**

`packages/infra-engine/__tests__/programs/gitlab-program.test.ts` 의 기존 `describe("buildOmnibusConfig", …)` 블록 아래에 다음을 추가한다:

```ts
import * as pulumi from "@pulumi/pulumi";
import { beforeAll, beforeEach } from "vitest";
import { createGitlabProgram } from "../../src/programs/gitlab-program.js";

interface CapturedResource {
  type: string;
  name: string;
  inputs: Record<string, unknown>;
}

const captured: CapturedResource[] = [];

beforeAll(() => {
  pulumi.runtime.setMocks(
    {
      newResource(args) {
        captured.push({
          type: args.type,
          name: args.name,
          inputs: args.inputs as Record<string, unknown>,
        });
        return { id: `${args.name}_id`, state: args.inputs };
      },
      call(args) {
        return args.inputs;
      },
    },
    "infra-engine-gitlab",
    "test",
    false,
  );
});

beforeEach(() => {
  captured.length = 0;
});

describe("createGitlabProgram (mocked Pulumi runtime)", () => {
  it("기본값으로 Deployment 1개 + Service 1개를 생성한다 (rootPassword 없음 → Secret 없음)", async () => {
    const program = createGitlabProgram();
    await program();

    const deployments = captured.filter(
      (r) => r.type === "kubernetes:apps/v1:Deployment",
    );
    const services = captured.filter(
      (r) => r.type === "kubernetes:core/v1:Service",
    );
    const secrets = captured.filter(
      (r) => r.type === "kubernetes:core/v1:Secret",
    );

    expect(deployments).toHaveLength(1);
    expect(services).toHaveLength(1);
    expect(secrets).toHaveLength(0);
  });

  it("rootPassword를 주면 Secret을 만들고 Deployment env가 그 Secret을 참조한다", async () => {
    const program = createGitlabProgram({ rootPassword: "supersecret" });
    await program();

    const secrets = captured.filter(
      (r) => r.type === "kubernetes:core/v1:Secret",
    );
    expect(secrets).toHaveLength(1);
    const secret = secrets[0]!;
    expect((secret.inputs.metadata as Record<string, unknown>).namespace).toBe(
      "qa-dev",
    );
    expect((secret.inputs.metadata as Record<string, unknown>).name).toBe(
      "gitlab-root-credentials",
    );

    const deployment = captured.find(
      (r) => r.type === "kubernetes:apps/v1:Deployment",
    )!;
    const spec = deployment.inputs.spec as Record<string, unknown>;
    const template = spec.template as Record<string, unknown>;
    const podSpec = template.spec as Record<string, unknown>;
    const containers = podSpec.containers as Array<Record<string, unknown>>;
    const env = containers[0]!.env as Array<Record<string, unknown>>;

    const rootPwEnv = env.find((e) => e.name === "GITLAB_ROOT_PASSWORD");
    expect(rootPwEnv).toBeDefined();
    expect(rootPwEnv!.valueFrom).toBeDefined();
  });

  it("Deployment metadata.namespace는 옵션값을 따른다", async () => {
    const program = createGitlabProgram({ namespace: "qa-stage" });
    await program();

    const deployment = captured.find(
      (r) => r.type === "kubernetes:apps/v1:Deployment",
    )!;
    const meta = deployment.inputs.metadata as Record<string, unknown>;
    expect(meta.namespace).toBe("qa-stage");
  });

  it("이미지 디폴트는 gitlab/gitlab-ce:latest", async () => {
    const program = createGitlabProgram();
    await program();

    const deployment = captured.find(
      (r) => r.type === "kubernetes:apps/v1:Deployment",
    )!;
    const containers = (
      ((deployment.inputs.spec as Record<string, unknown>).template as Record<
        string,
        unknown
      >).spec as Record<string, unknown>
    ).containers as Array<Record<string, unknown>>;
    expect(containers[0]!.image).toBe("gitlab/gitlab-ce:latest");
  });

  it("Service는 NodePort + selector app=gitlab + port 80", async () => {
    const program = createGitlabProgram();
    await program();

    const service = captured.find(
      (r) => r.type === "kubernetes:core/v1:Service",
    )!;
    const spec = service.inputs.spec as Record<string, unknown>;
    expect(spec.type).toBe("NodePort");
    expect((spec.selector as Record<string, unknown>).app).toBe("gitlab");
    const ports = spec.ports as Array<Record<string, unknown>>;
    expect(ports).toHaveLength(1);
    expect(ports[0]!.port).toBe(80);
    expect(ports[0]!.targetPort).toBe(80);
  });

  it("readinessProbe는 /-/readiness + initialDelay 180s", async () => {
    const program = createGitlabProgram();
    await program();

    const deployment = captured.find(
      (r) => r.type === "kubernetes:apps/v1:Deployment",
    )!;
    const containers = (
      ((deployment.inputs.spec as Record<string, unknown>).template as Record<
        string,
        unknown
      >).spec as Record<string, unknown>
    ).containers as Array<Record<string, unknown>>;
    const probe = containers[0]!.readinessProbe as Record<string, unknown>;
    const httpGet = probe.httpGet as Record<string, unknown>;
    expect(httpGet.path).toBe("/-/readiness");
    expect(httpGet.port).toBe(80);
    expect(probe.initialDelaySeconds).toBe(180);
    expect(probe.periodSeconds).toBe(30);
    expect(probe.failureThreshold).toBe(20);
  });

  it("모든 리소스에 managed-by=pulumi, qa-sdk-component=gitlab-ce 라벨이 있다", async () => {
    const program = createGitlabProgram();
    await program();

    for (const r of captured) {
      const meta = r.inputs.metadata as Record<string, unknown>;
      const labels = meta.labels as Record<string, unknown>;
      expect(labels["managed-by"]).toBe("pulumi");
      expect(labels["qa-sdk-component"]).toBe("gitlab-ce");
    }
  });

  it("Deployment strategy는 Recreate (Omnibus 단일 인스턴스 전제)", async () => {
    const program = createGitlabProgram();
    await program();

    const deployment = captured.find(
      (r) => r.type === "kubernetes:apps/v1:Deployment",
    )!;
    const spec = deployment.inputs.spec as Record<string, unknown>;
    const strategy = spec.strategy as Record<string, unknown>;
    expect(strategy.type).toBe("Recreate");
  });

  it("emptyDir 볼륨 3개 (config / logs / data)", async () => {
    const program = createGitlabProgram();
    await program();

    const deployment = captured.find(
      (r) => r.type === "kubernetes:apps/v1:Deployment",
    )!;
    const podSpec = (
      (deployment.inputs.spec as Record<string, unknown>).template as Record<
        string,
        unknown
      >
    ).spec as Record<string, unknown>;
    const volumes = podSpec.volumes as Array<Record<string, unknown>>;
    expect(volumes).toHaveLength(3);
    for (const v of volumes) {
      expect(v.emptyDir).toBeDefined();
    }
    const names = volumes.map((v) => v.name).sort();
    expect(names).toEqual(["gitlab-config", "gitlab-data", "gitlab-logs"]);
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run: `pnpm --filter infra-engine test -- gitlab-program`

Expected: `createGitlabProgram` 관련 9건 모두 FAIL — 함수가 아직 export되지 않음 (`SyntaxError` 또는 `TypeError: createGitlabProgram is not a function`).

- [ ] **Step 3: `createGitlabProgram` 구현**

`packages/infra-engine/src/programs/gitlab-program.ts` 의 `buildOmnibusConfig` 아래에 다음을 추가:

```ts
import * as k8s from "@pulumi/kubernetes";

export interface GitlabProgramOptions {
  /** 배포 namespace (기본 "qa-dev"). namespace 자체는 만들지 않음 — 사전에 존재해야 함 */
  namespace?: string;
  /** 컨테이너 이미지 (기본 "gitlab/gitlab-ce:latest") */
  image?: string;
  /** GitLab external_url (기본 "http://localhost:8929") */
  externalUrl?: string;
  /** 초기 root 비밀번호. 미지정 시 Secret 미생성 → Omnibus가 컨테이너 안에 자동 생성 */
  rootPassword?: string;
  /** 컨테이너 리소스 요청/제한 */
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?: { cpu?: string; memory?: string };
  };
}

const APP_LABEL = "gitlab";
const COMMON_LABELS = {
  app: APP_LABEL,
  "managed-by": "pulumi",
  "qa-sdk-component": "gitlab-ce",
};

/**
 * 로컬 K3s에 GitLab CE Omnibus 한 인스턴스를 배포하는 Pulumi 프로그램을 만든다.
 * 반환된 함수가 Pulumi Automation API에서 실행되며, 리소스 outputs를 반환한다.
 */
export function createGitlabProgram(
  options?: GitlabProgramOptions,
): () => Promise<Record<string, unknown>> {
  const namespace = options?.namespace ?? "qa-dev";
  const image = options?.image ?? "gitlab/gitlab-ce:latest";
  const externalUrl = options?.externalUrl ?? "http://localhost:8929";
  const rootPassword = options?.rootPassword;
  const resources = {
    requests: {
      cpu: options?.resources?.requests?.cpu ?? "2",
      memory: options?.resources?.requests?.memory ?? "4Gi",
    },
    limits: {
      cpu: options?.resources?.limits?.cpu ?? "3",
      memory: options?.resources?.limits?.memory ?? "6Gi",
    },
  };

  return async () => {
    let secret: k8s.core.v1.Secret | undefined;
    if (rootPassword !== undefined) {
      secret = new k8s.core.v1.Secret("gitlab-root-credentials", {
        metadata: {
          namespace,
          name: "gitlab-root-credentials",
          labels: COMMON_LABELS,
        },
        type: "Opaque",
        stringData: { password: rootPassword },
      });
    }

    const env: Array<{
      name: string;
      value?: string;
      valueFrom?: {
        secretKeyRef: { name: string; key: string };
      };
    }> = [
      {
        name: "GITLAB_OMNIBUS_CONFIG",
        value: buildOmnibusConfig({
          externalUrl,
          useRootPasswordEnv: secret !== undefined,
        }),
      },
    ];

    if (secret !== undefined) {
      env.push({
        name: "GITLAB_ROOT_PASSWORD",
        valueFrom: {
          secretKeyRef: { name: "gitlab-root-credentials", key: "password" },
        },
      });
    }

    const deployment = new k8s.apps.v1.Deployment("gitlab", {
      metadata: { namespace, name: "gitlab", labels: COMMON_LABELS },
      spec: {
        replicas: 1,
        strategy: { type: "Recreate" },
        selector: { matchLabels: { app: APP_LABEL } },
        template: {
          metadata: { labels: COMMON_LABELS },
          spec: {
            containers: [
              {
                name: "gitlab",
                image,
                imagePullPolicy: "IfNotPresent",
                ports: [{ containerPort: 80, name: "http" }],
                env,
                resources,
                volumeMounts: [
                  { name: "gitlab-config", mountPath: "/etc/gitlab" },
                  { name: "gitlab-logs", mountPath: "/var/log/gitlab" },
                  { name: "gitlab-data", mountPath: "/var/opt/gitlab" },
                ],
                readinessProbe: {
                  httpGet: { path: "/-/readiness", port: 80 },
                  initialDelaySeconds: 180,
                  periodSeconds: 30,
                  failureThreshold: 20,
                  timeoutSeconds: 5,
                },
              },
            ],
            volumes: [
              { name: "gitlab-config", emptyDir: {} },
              { name: "gitlab-logs", emptyDir: {} },
              { name: "gitlab-data", emptyDir: {} },
            ],
          },
        },
      },
    });

    const service = new k8s.core.v1.Service("gitlab-svc", {
      metadata: { namespace, name: "gitlab-svc", labels: COMMON_LABELS },
      spec: {
        type: "NodePort",
        selector: { app: APP_LABEL },
        ports: [{ port: 80, targetPort: 80, name: "http" }],
      },
    });

    return {
      namespace,
      deploymentName: deployment.metadata.name,
      serviceName: service.metadata.name,
      clusterIP: service.spec.clusterIP,
      nodePort: service.spec.ports[0]!.nodePort,
      rootPasswordSecretName: secret?.metadata.name,
    };
  };
}
```

- [ ] **Step 4: 테스트 재실행 — 통과 확인**

Run: `pnpm --filter infra-engine test -- gitlab-program`

Expected: 3 (buildOmnibusConfig) + 9 (createGitlabProgram) = 12 tests pass.

만약 실패하면:
- `volumes` 이름 정렬 — 테스트는 `["gitlab-config", "gitlab-data", "gitlab-logs"]` 알파벳 순. 구현은 그 순서로 `push`하면 됨.
- `Service.ports[0].port === 80` — `targetPort`도 80. number 비교.
- mocks가 동일 파일에서 `beforeAll`로 한 번만 setup되므로 `captured`는 `beforeEach`에서 비워야 함.

- [ ] **Step 5: 빌드 확인**

Run: `pnpm --filter infra-engine build`

Expected: tsup이 esm/cjs 둘 다 emit, dts emit. 무에러.

- [ ] **Step 6: 커밋**

```bash
git add packages/infra-engine/src/programs/gitlab-program.ts \
        packages/infra-engine/__tests__/programs/gitlab-program.test.ts
git commit -m "$(cat <<'EOF'
feat(infra-engine): GitLab CE Omnibus Pulumi program — Deployment + NodePort + optional root Secret

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `deploy-gitlab.ts` thin script

**Files:**
- Create: `packages/infra-engine/scripts/deploy-gitlab.ts`

- [ ] **Step 1: 스크립트 작성**

`packages/infra-engine/scripts/deploy-gitlab.ts`:

```ts
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
```

- [ ] **Step 2: 실행 권한 + 인자 파서 sanity 체크**

Run: `chmod +x packages/infra-engine/scripts/deploy-gitlab.ts`

Run: `tsx packages/infra-engine/scripts/deploy-gitlab.ts --help 2>&1 | head -20`

Expected: 인자 파서가 `--help`를 무시하고 `kubectl context` 체크 단계로 넘어가서 종료(컨텍스트 미일치 시 exit 1, 일치 시 Pulumi 단계). 이 단계에서 진짜 배포는 하지 않는다 — 다음 step에서 dry-run으로만 확인.

- [ ] **Step 3: dry-run으로 Pulumi preview 검증 (k3d 클러스터 떠 있을 때만)**

> **사전 조건이 없으면 이 step은 skip하고 다음 task로**: `kubectl config current-context` 결과가 `k3d-qa-local`이고 `kubectl cluster-info`가 OK여야 함.

Run: `tsx packages/infra-engine/scripts/deploy-gitlab.ts --dry-run`

Expected:
- Pulumi가 `~/.pulumi-local/`에 stack 메타데이터 생성
- preview output에 `kubernetes:apps/v1:Deployment gitlab create`, `kubernetes:core/v1:Service gitlab-svc create`가 보임
- `[gitlab-deploy] preview 완료: {"create":2}` 비슷한 라인

만약 `qa-dev` 네임스페이스 미존재 메시지가 preview 단계에서 나오면 무시 가능 (preview는 실제 API 호출 안 함). 실제 `up`에서야 namespace 검증이 일어난다.

- [ ] **Step 4: 커밋**

```bash
git add packages/infra-engine/scripts/deploy-gitlab.ts
git commit -m "$(cat <<'EOF'
feat(infra-engine): deploy-gitlab.ts — Pulumi up + kubectl context guard + post-deploy guidance

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `destroy-gitlab.ts` thin script

**Files:**
- Create: `packages/infra-engine/scripts/destroy-gitlab.ts`

- [ ] **Step 1: 스크립트 작성**

`packages/infra-engine/scripts/destroy-gitlab.ts`:

```ts
#!/usr/bin/env npx tsx
/**
 * 로컬 K3s의 GitLab CE 인스턴스 + Pulumi state를 정리한다.
 * emptyDir 사용으로 컨테이너 안의 모든 데이터(repo/issue/user)도 함께 사라진다.
 *
 * 사용:
 *   tsx packages/infra-engine/scripts/destroy-gitlab.ts [--backend-url <url>] [--context <ctx>]
 */

process.env.PULUMI_CONFIG_PASSPHRASE ??= "";

import { LocalWorkspace } from "@pulumi/pulumi/automation/index.js";

interface CliFlags {
  backendUrl?: string;
  k8sContext?: string;
}

function parseFlags(argv: readonly string[]): CliFlags {
  const flags: CliFlags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    const next = argv[i + 1];
    if (arg === "--backend-url") {
      flags.backendUrl = next;
      i += 1;
    } else if (arg === "--context") {
      flags.k8sContext = next;
      i += 1;
    }
  }
  return flags;
}

async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));
  const backendUrl =
    flags.backendUrl ?? process.env.PULUMI_BACKEND_URL ?? "file://~/.pulumi-local";
  const k8sContext =
    flags.k8sContext ?? process.env.KUBECONFIG_CONTEXT ?? "k3d-qa-local";

  const projectName = "infra-engine-gitlab";
  const stackName = "gitlab-local";

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
        runtime: "nodejs",
        backend: { url: backendUrl },
      },
    },
  );

  await stack.setConfig("kubernetes:context", { value: k8sContext });

  console.log(`[gitlab-destroy] stack ${stackName} destroy…`);
  await stack.destroy({ onOutput: (msg) => process.stdout.write(msg) });

  console.log("");
  console.log(
    "[gitlab-destroy] 정리 완료. emptyDir 사용으로 GitLab 데이터(repo/issue/user)는 모두 제거됨.",
  );
  console.log(
    "[gitlab-destroy] Pulumi stack 자체를 지우려면: pulumi -C ~/.pulumi-local stack rm gitlab-local --yes",
  );
}

main().catch((err) => {
  console.error("[gitlab-destroy] 실패:", err);
  process.exit(1);
});
```

- [ ] **Step 2: 실행 권한**

Run: `chmod +x packages/infra-engine/scripts/destroy-gitlab.ts`

- [ ] **Step 3: 타입체크 (실제 destroy는 사람이 검증)**

Run: `pnpm --filter infra-engine build`

Expected: 무에러. 새 스크립트는 tsup entry에 포함되지 않으므로(entry: `src/index.ts`) 빌드 산출물에 들어가진 않지만, 같은 tsconfig 컴파일러 옵션으로 타입은 점검된다.

명시적으로 타입체크가 필요하면:

Run: `pnpm --filter infra-engine exec tsc --noEmit -p tsconfig.json`

(주의: `tsconfig.json`의 `include`가 `["src"]`라 scripts는 컴파일러 검사에 안 들어갈 수 있다. 그 경우 step skip — `tsx` 실행 시점에 transient 타입 에러로 잡힌다.)

- [ ] **Step 4: 커밋**

```bash
git add packages/infra-engine/scripts/destroy-gitlab.ts
git commit -m "$(cat <<'EOF'
feat(infra-engine): destroy-gitlab.ts — Pulumi destroy stack + cleanup guidance

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 전체 검증 + 사람 수동 smoke 안내

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트 통과 재확인**

Run: `pnpm --filter infra-engine test`

Expected: 기존 테스트 + 신규 12건(gitlab-program) 모두 통과. 회귀 없음.

- [ ] **Step 2: 빌드**

Run: `pnpm --filter infra-engine build`

Expected: 무에러. tsup이 esm/cjs/dts emit.

- [ ] **Step 3: 사람이 직접 수동 smoke (선택)**

> 이 단계는 사람이 수동으로 실행. CI/agent에서는 skip.

```bash
# 사전 조건
kubectl config current-context              # → k3d-qa-local
kubectl get ns qa-dev || kubectl create ns qa-dev

# 배포
tsx packages/infra-engine/scripts/deploy-gitlab.ts

# 별도 터미널에서 port-forward
kubectl -n qa-dev port-forward svc/gitlab-svc 8929:80

# 5~10분 후 ready 되면
open http://localhost:8929

# 초기 root 비밀번호
kubectl -n qa-dev exec deploy/gitlab -- cat /etc/gitlab/initial_root_password

# 정리
tsx packages/infra-engine/scripts/destroy-gitlab.ts
kubectl get all -n qa-dev | grep gitlab     # → 비어 있어야 함
```

- [ ] **Step 4: 마지막 커밋 (필요 시)**

수동 smoke 중 발견한 사소한 버그 수정이 있다면 별도 커밋. 없으면 이 step 생략.

```bash
git status
# 변경 없으면 끝.
```

---

## Self-Review Notes (계획 작성자가 확인한 내용)

**Spec coverage:**
- §3 토폴로지 (Deployment/Service/Secret/emptyDir 3개) → Task 2 Step 3 구현 + Task 2 테스트 9건이 모두 검증.
- §4 옵션/리소스 → Task 2 구현 + 테스트.
- §5 deploy/destroy 스크립트 → Task 3, 4.
- §6 시크릿 처리 (CLI > env > 미지정) → Task 3 Step 1 `parseFlags` + `QA_GITLAB_ROOT_PASSWORD` fallback.
- §7 에러 처리 (kubectl context/cluster) → Task 3 Step 1 `checkKubectlContext`.
- §8 테스트 전략 (mocks 기반) → Task 2 Step 1.
- §10 수용 기준 → Task 5.

**Placeholder scan:** 없음 (모든 step에 코드/명령/expected 포함).

**Type consistency:**
- `createGitlabProgram` 시그니처: 옵션 객체 `GitlabProgramOptions` → returns `() => Promise<Record<string, unknown>>`. Task 2 정의, Task 3에서 호출. 일치.
- 라벨 키 `managed-by`, `qa-sdk-component` Task 2 구현(`COMMON_LABELS`)과 테스트 동일.
- 스택/프로젝트 이름 `gitlab-local` / `infra-engine-gitlab` Task 3, 4에서 동일 사용.
- 볼륨 이름 `gitlab-config`/`gitlab-logs`/`gitlab-data` 구현·테스트 일치 (테스트는 알파벳 정렬 후 비교).

---

## Errata (2026-04-28)

After first live deploy, two gaps were fixed in a follow-up commit (see `git log --grep "fix(infra-engine).*nginx listen"`):

1. `buildOmnibusConfig` now requires `nginxListenPort: number` and emits `nginx['listen_port'] = N; nginx['listen_https'] = false` lines. Without them, GitLab Omnibus listens on the `external_url` port instead of the container port, and the K8s Service routes to nothing.
2. `createGitlabProgram` now sets `progressDeadlineSeconds: 1800` on the Deployment. K8s default 600s caused `pulumi up` to fail with `ProgressDeadlineExceeded` while the pod was still progressing through Omnibus first boot.

If re-running Tasks 1 / 2 from the plan above, use the current code in `packages/infra-engine/src/programs/gitlab-program.ts` rather than the original code blocks — those are preserved as historical record.
