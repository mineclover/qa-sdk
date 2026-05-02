---
def:
  id: infra-provision-stage
  scope: feature
  aspect: func_def
  depth: specification
  tier: component
  lifecycle: approved
  layer: operation
  tags: [infra, pulumi, deploy]
  links:
    - target: infra-engine-pipeline
      type: implements
    - target: infra-config-stage
      type: depends_on
    - target: infra-providers
      type: depends_on
---
# ProvisionStage — Pulumi 실행 + 프로바이더 분기

## 목적 ^purpose

Pulumi Automation API를 사용하여 선택된 프로바이더에 서비스를 배포한다. Pulumi DIY backend(AWS S3 / MinIO / file)로 상태를 영속하고, backend의 기본 lock/history 메커니즘을 사용해 상태 일관성을 유지한다.

## 구성 ^overview

- Pulumi Automation API — CLI 없이 TypeScript 코드로 인프라 제어
- 프로바이더별 Pulumi Program — `DeployProvider` 인터페이스 구현
- DIY state backend — `s3://qa-sdk-infra-state` 또는 `file://~/.pulumi-local`
- Pulumi backend lock/history — `.pulumi/locks/`, `.pulumi/history/`
- 프로바이더 선택은 사용자 입력 (`ctx.provider`)

---

## Pulumi Automation API 실행 흐름

```
ctx.config (ResolvedConfig)
  → provider 선택 (ctx.provider)
    → DeployProvider.getProgram() → Pulumi Program
      → LocalWorkspace.createOrSelectStack()
        → stack.setConfig() (복호화된 설정 주입)
          → stack.up() (배포 실행)
            → ProvisionResult (outputs: endpoint, resourceId 등)
```

### State Backend 설정

```typescript
// AWS S3 또는 MinIO 같은 DIY backend URL
const backendUrl = "s3://qa-sdk-infra-state?endpoint=http://localhost:9000&disableSSL=true&s3ForcePathStyle=true";

const stackName = `${ctx.service}-${ctx.env}-${ctx.provider}-${ctx.region}`;

const workspace = await LocalWorkspace.create({
  projectSettings: {
    name: `infra-engine-${ctx.service}`,
    runtime: "nodejs",
    backend: { url: backendUrl },
  },
});

const stack = await LocalWorkspace.createOrSelectStack({
  stackName,
  workDir: workspace.workDir,
});

// DIY backend는 Pulumi가 .pulumi/locks 아래 lock file을 관리한다.
```

- 스택 이름: `{service}-{env}-{provider}-{region}` (예: `ingest-server-staging-railway-apne2`)
- S3/MinIO backend는 `.pulumi/stacks/`, `.pulumi/history/`, `.pulumi/locks/` 구조를 사용
- self-managed backend에서 버저닝/백업/접근 제어는 운영자가 관리

## 정의 ^defines

### ProvisionResult

```typescript
interface ProvisionResult {
  stackName: string;
  outputs: Record<string, string>;  // endpoint, ip, resourceId 등
  provider: string;
  region: string;
  duration: number;
}
```

### DeployProvider 인터페이스

```typescript
/** 프로바이��� 식별자 — 소문자 kebab-case */
type ProviderId = "cloudflare" | "aws" | "gcp" | "railway" | "vultr" | "local";

interface DeployProvider {
  readonly name: ProviderId;
  
  /** Pulumi Program 반환 — 이 함수가 실제 리소스를 선언 */
  getProgram(config: ResolvedConfig, serviceId: string): PulumiFn;
  
  /** 배포 취소 (rollback용) */
  destroy(stackName: string): Promise<void>;
  
  /** 프로바이더별 사전 검증 (API 키 존재, 권한 확인 등) */
  validate(config: ResolvedConfig): Promise<ValidationResult>;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];     // valid=false일 때 사유
}
```

### 출력 키 규약

모든 프로바이더의 `stack.outputs()`는 반드시 `endpoint` 키를 포함해야 한다:

```typescript
// 필수 출력 키
outputs.endpoint   // 서비스 접근 URL (예: "https://ingest-staging.up.railway.app")
// 선택 출력 키
outputs.ip         // IP 주소 (있는 경우)
outputs.resourceId // 프로바이더 리소스 ID
```
```

### ProvisionStage 실행 순서

1. **사전 검증** — `provider.validate()`: API 키, 권한, 쿼터 확인
2. **스택 생성/선택** — `LocalWorkspace.createOrSelectStack()`
3. **설정 주입** — `stack.setConfig()`: ResolvedConfig에서 해당 서비스 설정 추출
4. **배포** — `stack.up()`: Pulumi Program 실행
5. **출력 수집** — `stack.outputs()`: endpoint, resourceId 등

### Rollback

```typescript
async rollback(ctx: DeployContext): Promise<void> {
  // Pulumi destroy로 생성된 리소스 정리
  await provider.destroy(stackName);
}
```

## 소비 ^consumes

- `@pulumi/pulumi` `^3.229.0` — Automation API (LocalWorkspace, Stack)
- `@aws-sdk/client-s3` `^3.1024.0` — State backend
- `@aws-sdk/client-sts` `^3.1024.0` — OIDC 임시 토큰 발급
- 프로바이더별 Pulumi SDK (providers.spec.md 참조)

## 제약

- **VM 프로비저닝은 범위 밖** — 이미 존재하는 인프라 위에 애플리케이션만 배포
- **프로바이더 간 상태 공유 없음** — 각 스택은 독립. 프로바이더 간 의존은 connections 설정으로 해결
- **동시 배포 제한** — 같은 스택(service+env+provider+region)에 대한 동시 수정은 Pulumi DIY backend lock이 차단한다. 단, self-managed backend의 가용성과 스토리지 일관성은 운영 환경이 책임진다.
