---
def:
  id: infra-providers
  scope: feature
  aspect: func_def
  depth: specification
  tier: component
  lifecycle: approved
  layer: operation
  tags: [infra, pulumi, multi-cloud]
  links:
    - target: infra-engine-pipeline
      type: implements
sources:
  - packages/infra-engine/src/providers/all.ts
  - packages/infra-engine/src/providers/registry.ts
  - packages/infra-engine/src/providers/cloudflare.ts
  - packages/infra-engine/src/providers/local.ts
  - packages/infra-engine/src/providers/pulumi-deploy.ts
  - packages/infra-engine/__tests__/providers/pulumi-deploy.test.ts
---
# 프로바이더 추상화 — 멀티 클라우드 배포

## 목적 ^purpose

6개 프로바이더(Cloudflare, AWS, GCP, Railway, Vultr, 온프레미스)를 `DeployProvider` 인터페이스로 통합 추상화하여, 사용자가 배포 시점에 프로바이더를 자유롭게 선택할 수 있게 한다.

## 방법 ^method

각 프로바이더가 `DeployProvider` 인터페이스를 구현하며, `getProgram()`이 해당 프로바이더의 Pulumi Program을 반환한다. 프로바이더 선택은 `ctx.provider` 문자열로 결정 — 역할 고정 없음.

---

## 프로바이더 레지스트리

```typescript
const providers: Record<string, DeployProvider> = {
  cloudflare: new CloudflareProvider(),
  aws:        new AwsProvider(),
  gcp:        new GcpProvider(),
  railway:    new RailwayProvider(),
  vultr:      new VultrProvider(),
  local:      new LocalProvider(),
};

function getProvider(name: string): DeployProvider {
  const p = providers[name];
  if (!p) throw new Error(`Unknown provider: ${name}`);
  return p;
}
```

## 프로바이더별 배포 대상

| 프로바이더 | Pulumi SDK | 버전 | 배포 대상 | 인증 |
|-----------|-----------|------|----------|------|
| `cloudflare` | `@pulumi/cloudflare` | `^6.14.0` | Workers, Pages, D1 | `CLOUDFLARE_API_TOKEN` |
| `aws` | `@pulumi/aws` | `^7.24.0` | ECS, Lambda, App Runner | OIDC (STS) |
| `gcp` | `@pulumi/gcp` | `^9.18.0` | Cloud Run, App Engine | Service Account / Workload Identity |
| `railway` | `@pulumi/command` | `^1.2.1` | Railway 서비스 (CLI/API) | `RAILWAY_TOKEN` |
| `vultr` | `@ediri/vultr` (커뮤니티) | `^2.27.1` | K3s 위 컨테이너 | `VULTR_API_KEY` |
| `local` | `@pulumi/command` | `^1.2.1` | Docker Compose / K3s | SSH 또는 Tailscale |

> **참고**: `@pulumi/vultr`는 공식 프로바이더가 없음. `@ediri/vultr`는 커뮤니티 유지 패키지로, 공식 프로바이더 출시 시 교체 가능.

### 프로바이더별 Pulumi Program 패턴

**Cloudflare (Workers)**
```typescript
// wrangler CLI 기반 배포. validate()는 서비스 디렉토리에서 wrangler 실행 (devDependency)
// shell: true로 npx wrangler 호출
```

#### CF 프로바이더 운영 특성

- **비파괴적 롤백**: `destroy()`는 verify 실패 시 Worker를 삭제하지 않고 유지. 배포된 Worker가 정상 동작할 가능성을 보존
- **명시적 삭제**: `explicitDestroyWorker()`로 Worker를 의도적으로 삭제할 때만 사용
- **wrangler 경로**: `validate()`가 서비스 디렉토리(wrangler가 devDependency인 곳)에서 실행, `shell: true` 적용
- **엔드포인트 피드백**: 성공적 배포 후 발견된 endpoint를 cloudflare-prod.json에 자동 기록하여 다음 배포에서 의존 해석에 활용

**Railway**
```typescript
// Railway는 Pulumi 네이티브 프로바이더 없음 → Command 프로바이더로 Railway CLI/API 호출
const deploy = new command.local.Command("railway-deploy", {
  create: `railway up --service ${serviceId} --environment ${env}`,
  environment: extractServiceEnv(config, serviceId),
});
```

**Local (온프레미스)**
```typescript
// SSH 또는 Tailscale을 통해 원격 Docker Compose / K3s 배포
const deploy = new command.remote.Command("local-deploy", {
  connection: { host: tailscaleIp, user: "deploy" },
  create: `docker compose -f docker-compose.yaml up -d ${serviceId}`,
  environment: extractServiceEnv(config, serviceId),
});
```

## 정의 ^defines

- `DeployProvider` — 프로바이더 통합 인터페이스 (provision-stage에서 정의)
- `CloudflareProvider` / `AwsProvider` / `GcpProvider` / `RailwayProvider` / `VultrProvider` / `LocalProvider`
- `providers` registry — 문자열 → 프로바이더 매핑

## 소비 ^consumes

- `@pulumi/cloudflare` `^6.14.0`, `@pulumi/aws` `^7.24.0`, `@pulumi/gcp` `^9.18.0`, `@ediri/vultr` `^2.27.1` — 프로바이더별 Pulumi SDK
- `@pulumi/command` — CLI/SSH 기반 배포 (Railway, Local)
- `ResolvedConfig` — 프로바이더별 인증 정보 + 서비스 설정

## 위임 ^delegates

각 프로바이더의 상세 리소스 선언은 Phase별로 구현하며, 초기에는 Cloudflare + Railway에 집중한다.

## Local 프로바이더 구현 상세

팩토리: `createLocalProvider(options?: LocalProviderOptions): DeployProvider`

### LocalProviderOptions

```typescript
interface LocalProviderOptions {
  env?: string;              // 배포 대상 환경 (namespace 결정용)
  imageOverride?: string;    // 이미지 오버라이드 (기본: qa-sdk/{serviceId}:latest)
  healthPath?: string;       // 헬스체크 경로 (기본: /health/live)
}
```

### Env → Namespace 매핑

| env | namespace |
|-----|-----------|
| test, dev | qa-dev |
| stage, staging | qa-stage |
| prod, production | qa-prod |

### Pulumi 배포 함수 (createPulumiDeployFn)

팩토리: `createPulumiDeployFn(options?: { env?: string })` — ProvisionStage의 `deployFn`으로 주입

- 로컬 파일 백엔드 사용 (`file://~/.pulumi-local`) — S3 불필요
- K8s context: `k3d-qa-local` 고정
- 배포 후 `kubectl port-forward`를 백그라운드로 실행하여 호스트에서 접근 가능하게 함

### Port-Forward 메커니즘

K3s NodePort로 배포된 서비스에 호스트에서 접근하기 위해 `kubectl port-forward`를 자동으로 실행한다.

- 기존 동일 서비스의 port-forward 프로세스를 먼저 정리 (`pkill`)
- `kubectl -n {namespace} port-forward svc/{serviceName} {localPort}:{port}` — detached 모드
- 연결 준비 대기: 최대 10초 (1초 간격 polling)
- 최종 endpoint: `http://127.0.0.1:{localPort}` (IPv6 해석 방지를 위해 127.0.0.1 사용)

### Env → Port Offset 매핑

동일 서비스를 여러 환경에 배포할 때 포트 충돌을 방지한다.

| env | port offset | 예시 (port=3200) |
|-----|------------|-----------------|
| dev | +20000 | 23200 |
| stage | +21000 | 24200 |
| prod | +22000 | 25200 |

`localPort = port + envOffset[env]` (기본 offset: 20000)

## 확장

새 프로바이더 추가:
1. `providers/` 아래 새 파일 생성
2. `DeployProvider` 인터페이스 구현
3. `providers` 레지스트리에 등록
4. SOPS YAML에 해당 프로바이더 인증정보 추가
