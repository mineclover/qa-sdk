---
def:
  id: infra-providers
  scope: feature
  aspect: func_def
  depth: specification
  level: module
  lifecycle: draft
  layer: operation
  tags: [infra, pulumi, multi-cloud]
  links:
    - target: infra-engine-pipeline
      type: implements
    - target: infra-provision-stage
      type: refines
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

| 프로바이더 | Pulumi SDK | 배포 대상 | 인증 |
|-----------|-----------|----------|------|
| `cloudflare` | `@pulumi/cloudflare` | Workers, Pages, D1 | `CLOUDFLARE_API_TOKEN` |
| `aws` | `@pulumi/aws` | ECS, Lambda, App Runner | OIDC (STS) |
| `gcp` | `@pulumi/gcp` | Cloud Run, App Engine | Service Account / Workload Identity |
| `railway` | `@pulumi/command` + Railway API | Railway 서비스 | `RAILWAY_TOKEN` |
| `vultr` | `@pulumi/vultr` | K3s 위 컨테이너 | `VULTR_API_KEY` |
| `local` | `@pulumi/command` | Docker Compose / K3s | SSH 또는 Tailscale |

### 프로바이더별 Pulumi Program 패턴

**Cloudflare (Workers)**
```typescript
// 기존 wrangler.toml 기반 배포를 Pulumi로 래핑
const worker = new cloudflare.WorkerScript("service", {
  name: `${serviceId}-${env}`,
  content: bundledCode,
  // ... env vars from config
});
```

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

- `@pulumi/cloudflare`, `@pulumi/aws`, `@pulumi/gcp`, `@pulumi/vultr` — 프로바이더별 Pulumi SDK
- `@pulumi/command` — CLI/SSH 기반 배포 (Railway, Local)
- `ResolvedConfig` — 프로바이더별 인증 정보 + 서비스 설정

## 위임 ^delegates

각 프로바이더의 상세 리소스 선언은 Phase별로 구현하며, 초기에는 Cloudflare + Railway에 집중한다.

## 확장

새 프로바이더 추가:
1. `providers/` 아래 새 파일 생성
2. `DeployProvider` 인터페이스 구현
3. `providers` 레지스트리에 등록
4. SOPS YAML에 해당 프로바이더 인증정보 추가
