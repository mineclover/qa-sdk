---
def:
  id: infra-provision-stage
  scope: feature
  aspect: func_def
  depth: specification
  level: leaf
  lifecycle: draft
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

Pulumi Automation API를 사용하여 선택된 프로바이더에 서비스를 배포한다. S3 state backend로 상태를 영속하고, DynamoDB로 동시 배포 충돌을 방지한다.

## 구성 ^overview

- Pulumi Automation API — CLI 없이 TypeScript 코드로 인프라 제어
- 프로바이더별 Pulumi Program — `DeployProvider` 인터페이스 구현
- S3 state backend — `s3://qa-sdk-infra-state/{project}/{stack}`
- DynamoDB lock — 동시 배포 시 mutex
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
// S3 backend URL에 DynamoDB lock 테이블 명시
const backendUrl = "s3://qa-sdk-infra-state"
  + `?region=ap-northeast-2`
  + `&dynamoTable=qa-sdk-infra-lock`;  // DynamoDB lock 테이블

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

// secretsProvider는 스택 레벨에서 설정
await stack.setConfig("aws:secretsProvider", { value: "awskms://KEY_ID" });
```

- 스택 이름: `{service}-{env}-{provider}-{region}` (예: `ingest-server-staging-railway-apne2`)
- S3 버저닝 활성 — 상태 파일 히스토리 보존
- DynamoDB lock: S3 URL의 `dynamoTable` 파라미터로 지정
- DynamoDB TTL — 비정상 종료 시 lock 자동 해제 (30분)

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
- `@aws-sdk/client-dynamodb` `^3.1024.0` — Lock table
- `@aws-sdk/client-sts` `^3.1024.0` — OIDC 임시 토큰 발급
- 프로바이더별 Pulumi SDK (providers.spec.md 참조)

## 제약

- **VM 프로비저닝은 범위 밖** — 이미 존재하는 인프라 위에 애플리케이션만 배포
- **프로바이더 간 상태 공유 없음** — 각 스택은 독립. 프로바이더 간 의존은 connections 설정으로 해결
- **동시 배포 제한** — 같은 스택(service+env+provider+region)에 대한 동시 배포는 DynamoDB lock이 차단
