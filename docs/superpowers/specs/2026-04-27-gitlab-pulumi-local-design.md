# GitLab Pulumi Local Design

> 로컬 K3s에 GitLab CE Omnibus를 Pulumi로 잠깐 띄웠다 내리는 일회성 테스트 환경.

## 1. 목적과 범위

**목적**
- 로컬 K3s(`k3d-qa-local`) 위에 GitLab CE 인스턴스를 한 번에 띄우고, 다 쓰면 깔끔하게 내릴 수 있는 Pulumi 모듈을 추가한다.
- 기존 `infra-engine`의 Pulumi Automation API 패턴(`pulumi-deploy.ts`)과 톤을 맞춘다.

**범위 안**
- Pulumi 프로그램 + 배포/파괴 스크립트 + Pulumi mock 기반 단위 테스트.
- 호스트 `localhost:8929`에서 GitLab Web UI 접근.
- Git over HTTP(S 아님) push/pull.

**범위 밖 (YAGNI)**
- GitLab Helm 차트 (Cloud Native 토폴로지) — Omnibus 단일 컨테이너로 충분.
- Ingress/TLS — `localhost` 직결.
- GitLab Runner — 테스트 시점에 필요해지면 별도로 추가.
- SSH(2222), Container Registry, Pages — 노출하지 않음.
- Zitadel SSO 연동.
- `@pulumi/gitlab` 프로바이더로 GitLab 내부 리소스(group/project/CI 변수) 관리 — 별도 시나리오(B).
- 영속 PVC — `pulumi destroy` 시 데이터가 함께 사라지도록 `emptyDir` 사용.

## 2. 기존 컨텍스트와 정렬

| 기존 구성 | 역할 | 이번 작업의 정렬 방식 |
|---|---|---|
| `packages/infra-engine/src/providers/local.ts` | K3s용 generic Deployment+NodePort 패턴 | 직접 재사용 안 함. GitLab은 다중 포트/긴 부팅/리소스 큰 단일 컨테이너라 generic 패턴에 맞지 않음 |
| `packages/infra-engine/src/providers/pulumi-deploy.ts` | Pulumi Automation API 호출 + 백엔드/컨텍스트 결정 | `pulumiDeployFn`은 generic provider용. GitLab은 Pulumi 프로그램을 직접 작성하고 별도 thin script로 `pulumi up` 실행 |
| `packages/infra-engine/docker-compose.infra.yaml` | Zitadel/MinIO 등 인프라 서비스 | 같은 톤(단일 서비스 단위 자급자족) 유지. 단 GitLab은 docker-compose가 아닌 K3s 위에 띄움 |
| `~/.pulumi-local` 백엔드 | Pulumi state 로컬 파일 | 그대로 사용 (`PULUMI_BACKEND_URL`로 override 허용) |
| `kubectl context = k3d-qa-local` | 배포 대상 | 그대로 사용 |
| 네임스페이스 `qa-dev` | 기존 dev 환경 컨벤션 | 그대로 사용 |
| 호스트 포트 사용 현황 (8085 zitadel, 9000/9001 minio) | — | 충돌 회피 위해 GitLab은 8929 |

## 3. 토폴로지

```
┌─────────────────────────────────────────────────┐
│ Host (macOS)                                    │
│                                                 │
│   curl http://localhost:8929 ───┐               │
│                                 │               │
│   kubectl port-forward 8929:80 ─┘               │
│                                                 │
│   ┌─────────────────────────────────────────┐   │
│   │ k3d cluster (k3d-qa-local)              │   │
│   │                                         │   │
│   │  ns: qa-dev                             │   │
│   │  ┌──────────────────────────────────┐   │   │
│   │  │ Secret: gitlab-root-credentials  │   │   │
│   │  │   GITLAB_ROOT_PASSWORD=…         │   │   │
│   │  └──────────────────────────────────┘   │   │
│   │                                         │   │
│   │  ┌──────────────────────────────────┐   │   │
│   │  │ Deployment: gitlab               │   │   │
│   │  │   image: gitlab/gitlab-ce:latest │   │   │
│   │  │   env:  GITLAB_OMNIBUS_CONFIG    │   │   │
│   │  │        GITLAB_ROOT_PASSWORD ←Sec │   │   │
│   │  │   volumes:                       │   │   │
│   │  │     /etc/gitlab    → emptyDir    │   │   │
│   │  │     /var/log/gitlab→ emptyDir    │   │   │
│   │  │     /var/opt/gitlab→ emptyDir    │   │   │
│   │  │   ports: 80                      │   │   │
│   │  │   readiness: /-/readiness        │   │   │
│   │  └──────────────────────────────────┘   │   │
│   │                                         │   │
│   │  ┌──────────────────────────────────┐   │   │
│   │  │ Service: gitlab-svc (NodePort)   │   │   │
│   │  │   80 → containerPort 80          │   │   │
│   │  └──────────────────────────────────┘   │   │
│   └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## 4. Pulumi 프로그램 설계

### 4.1 위치와 형태

`packages/infra-engine/src/programs/gitlab-program.ts` — 함수 export 한 개.

```ts
export interface GitlabProgramOptions {
  namespace?: string;        // 기본 "qa-dev"
  image?: string;            // 기본 "gitlab/gitlab-ce:latest"
  externalUrl?: string;      // 기본 "http://localhost:8929"
  rootPassword?: string;     // 미지정 시 Secret 생성 안 함, GitLab이 컨테이너 안에 자동 생성
  resources?: {
    requests?: { cpu?: string; memory?: string };
    limits?:   { cpu?: string; memory?: string };
  };
}

export function createGitlabProgram(options?: GitlabProgramOptions): () => Promise<Record<string, unknown>>;
```

리턴된 함수가 Pulumi runtime에서 실행되며 다음 outputs를 반환한다:
- `namespace`
- `deploymentName`
- `serviceName`
- `clusterIP`
- `nodePort` (할당된 NodePort 번호)
- `rootPasswordSecretName` (Secret을 만든 경우)

### 4.2 리소스 구성

1. **Namespace check** — 기존 `qa-dev`가 있다고 가정하므로 새로 만들지 않고 reference만 한다(`metadata.namespace`로 지정). 만약 사용자가 `--ensure-namespace`를 원하면 향후 옵션 추가.
2. **Secret `gitlab-root-credentials`** — `rootPassword`가 주어진 경우에만 생성. key: `password`. `Opaque` 타입.
3. **Deployment `gitlab`**
   - `replicas: 1`, `strategy: { type: "Recreate" }` (Omnibus는 RWX 가정 안 됨, 두 개 동시에 못 뜸)
   - 환경변수
     - `GITLAB_OMNIBUS_CONFIG` — `external_url '<externalUrl>'; gitlab_rails['initial_root_password'] = ENV['GITLAB_ROOT_PASSWORD'] if ENV['GITLAB_ROOT_PASSWORD']`
     - `GITLAB_ROOT_PASSWORD` (Secret이 있는 경우) — `valueFrom.secretKeyRef`
   - `volumes` — 3개 emptyDir: `gitlab-config` → `/etc/gitlab`, `gitlab-logs` → `/var/log/gitlab`, `gitlab-data` → `/var/opt/gitlab`
   - `ports` — `containerPort: 80` 1개만
   - `readinessProbe` — `httpGet { path: "/-/readiness", port: 80 }`, `initialDelaySeconds: 180`, `periodSeconds: 30`, `failureThreshold: 20`, `timeoutSeconds: 5`
   - `resources` — 디폴트 `requests: { cpu: "2", memory: "4Gi" }`, `limits: { cpu: "3", memory: "6Gi" }`
4. **Service `gitlab-svc`** — `type: NodePort`, `selector: { app: gitlab }`, `port 80 → targetPort 80`. NodePort 번호는 K8s 자동 할당(테스트용이라 고정 안 함; 호스트 매핑은 port-forward로 해결).

### 4.3 라벨/이름 컨벤션

- 모든 리소스 라벨 `app: gitlab`, `managed-by: pulumi`, `qa-sdk-component: gitlab-ce`.
- `metadata.name` 고정 (Pulumi auto-naming 비활성). 이유: 기존 `local.ts` 패턴과 동일 — DNS 안정성과 destroy 추적성.

## 5. 배포/파괴 스크립트

### 5.1 `packages/infra-engine/scripts/deploy-gitlab.ts`

```ts
// 1. options 파싱: --root-password, --external-url, --backend-url, --context, --dry-run
// 2. createGitlabProgram(options)
// 3. LocalWorkspace.createOrSelectStack({
//      stackName: "gitlab-local",
//      projectName: "infra-engine-gitlab",
//      program,
//    }, { projectSettings: { runtime: "nodejs", backend: { url: backendUrl } } })
// 4. await stack.setConfig("kubernetes:context", { value: k8sContext })
// 5. dry-run이면 stack.preview, 아니면 stack.up
// 6. up 성공 시:
//    - outputs 콘솔 출력 (rootPasswordSecretName 포함)
//    - rootPassword가 옵션으로 안 주어졌다면 안내:
//        "초기 비밀번호: kubectl exec -n qa-dev deploy/gitlab -- cat /etc/gitlab/initial_root_password"
//        "(GitLab Omnibus가 첫 부팅 후 24시간만 보존)"
//    - port-forward 명령 안내:
//        "kubectl -n qa-dev port-forward svc/gitlab-svc 8929:80"
```

`pulumi-deploy.ts`처럼 자동으로 `kubectl port-forward`를 백그라운드로 띄우지 않는다. 이유: GitLab은 부팅이 길고, 사용자가 직접 readiness를 보고 띄우는 게 디버깅에 유리. (필요해지면 `--port-forward` 플래그로 추가)

### 5.2 `packages/infra-engine/scripts/destroy-gitlab.ts`

```ts
// 1. backend-url, context 옵션 파싱
// 2. LocalWorkspace.selectStack(...)
// 3. await stack.destroy({ onOutput })
// 4. 안내: emptyDir 사용으로 데이터가 모두 사라졌음을 명시
```

## 6. 인증/시크릿 처리

- `rootPassword` 결정 우선순위:
  1. CLI 인자 `--root-password <value>`
  2. 환경변수 `QA_GITLAB_ROOT_PASSWORD`
  3. 미지정 → Secret 생성 안 함 → GitLab Omnibus가 첫 부팅 시 컨테이너 내부에 자동 생성 (`/etc/gitlab/initial_root_password`)
- 평문이 stdout/log에 찍히지 않도록 deploy 스크립트는 비밀번호 값 자체는 출력하지 않는다. Secret 이름과 조회 방법만 안내.
- `qa-sdk` 전반의 `process.env` 직접 접근 컨벤션(`config/env.ts` zod 스키마)은 **CLI/스크립트에서는 직접 접근 허용**(CLAUDE.md §환경변수)이라 zod 스키마 추가 없이 스크립트 안에서만 읽는다.

## 7. 에러 처리와 검증

| 실패 시나리오 | 동작 |
|---|---|
| `kubectl context != k3d-qa-local` | deploy 스크립트가 시작 직전에 `execa("kubectl", ["config", "current-context"])`로 확인 후 비매치면 즉시 종료 (`local.ts`의 `validate`와 동일 메시지 톤) |
| 클러스터 미동작 | 같은 사전 체크로 잡음 (`kubectl cluster-info --request-timeout=3s`) |
| 네임스페이스 `qa-dev` 미존재 | Pulumi up이 K8s API 오류로 실패. 메시지에 `kubectl create ns qa-dev` 안내 추가 |
| GitLab Omnibus 부팅 지연 (5~10분) | `initialDelaySeconds: 180` + `periodSeconds: 30` × `failureThreshold: 20` 조합으로 첫 probe 전 3분 대기, 이후 최대 ~10분간 readiness 미충족 허용 → 그동안 Service 엔드포인트에서 제외(트래픽 차단)되며 부팅이 끝나면 자동 ready 전환. 그 시간을 넘기면 사용자가 `kubectl describe pod`/`kubectl logs`로 원인 확인 |
| `pulumi destroy` 도중 stack lock | Pulumi가 던지는 에러 그대로 전파 (state는 로컬 파일이므로 사용자가 직접 정리 가능) |

Fail-open 컨벤션은 런타임 게이트에 적용되는 것이고, 인프라 배포는 fail-fast가 정상이므로 의도적으로 fail-open 안 함.

## 8. 테스트 전략

`packages/infra-engine/__tests__/programs/gitlab-program.test.ts`

- `@pulumi/pulumi/runtime` mock 모드 사용 (`runtime.setMocks`).
- 검증 항목:
  - Deployment 1개, Service 1개, (rootPassword 주어졌을 때) Secret 1개 생성.
  - Deployment의 `metadata.namespace`가 옵션 `namespace`와 일치.
  - `image`가 옵션값 또는 디폴트.
  - `containers[0].env`에 `GITLAB_OMNIBUS_CONFIG` 존재, `external_url '<externalUrl>'` 포함.
  - rootPassword 주어진 경우: Secret이 동일 namespace에 만들어지고, Deployment env 중 `GITLAB_ROOT_PASSWORD`가 `valueFrom.secretKeyRef.name`으로 그 Secret을 가리킴.
  - Service `type === "NodePort"`, `selector.app === "gitlab"`, `ports[0].port === 80`.
  - readinessProbe `path === "/-/readiness"`, `initialDelaySeconds === 180`.
  - 모든 리소스에 `metadata.labels["managed-by"] === "pulumi"`, `qa-sdk-component === "gitlab-ce"`.

실제 K3s 배포는 단위 테스트 범위 밖. 로컬에서 사람이 한 번 검증한다 (수용 기준 §10).

## 9. 패키지 의존성

`packages/infra-engine/package.json` — 추가 dep 없음. 이미 있는 것:
- `@pulumi/pulumi` ^3.229.0
- `@pulumi/kubernetes` ^4.28.0
- `execa` ^9.0.0

## 10. 수용 기준

- [ ] `pnpm --filter infra-engine test` 통과 (gitlab-program 테스트 포함).
- [ ] `pnpm --filter infra-engine build` 무에러.
- [ ] 사람이 직접: `tsx packages/infra-engine/scripts/deploy-gitlab.ts` 실행 → 5~10분 후 `localhost:8929`에서 GitLab 로그인 화면 표시 (port-forward 별도 실행).
- [ ] `tsx packages/infra-engine/scripts/destroy-gitlab.ts` 실행 후 `kubectl get all -n qa-dev | grep gitlab` 결과 비어 있음.
- [ ] PVC 잔존 없음(`kubectl get pvc -n qa-dev`에서 gitlab 관련 항목 없음 — emptyDir이라 애초에 안 만듦).

## 11. 향후 확장 메모 (지금 안 함)

- Runner를 띄우려면: `gitlab/gitlab-runner` 이미지로 별도 Deployment + register 토큰 주입.
- 영속이 필요해지면: `emptyDir` → `PersistentVolumeClaim` (k3d local-path provisioner) 옵션 분기.
- HTTPS가 필요해지면: cert-manager + Ingress 또는 NodePort + 호스트 측 mkcert.
- B 시나리오(`@pulumi/gitlab`)와 결합하면, 이 stack의 outputs(`externalUrl` + `rootPassword`)을 입력으로 받아 GitLab 내부에 group/project를 IaC로 선언 가능.
