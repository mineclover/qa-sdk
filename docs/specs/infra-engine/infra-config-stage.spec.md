---
def:
  id: infra-config-stage
  scope: feature
  aspect: func_def
  depth: specification
  level: leaf
  tier: component
  lifecycle: approved
  layer: operation
  tags: [infra, secret, config]
  links:
    - target: infra-engine-pipeline
      type: implements
---
# ConfigStage — SOPS 복호화 + 설정 검증

## 목적 ^purpose

SOPS로 암호화된 YAML 설정을 복호화하고, zod 스키마로 검증하여 타입 안전한 `ResolvedConfig`를 파이프라인에 제공한다. 평문은 메모리에만 존재하며 디스크에 기록하지 않는다.

## 구성 ^overview

- SOPS YAML = 시크릿 + 일반설정 + 서비스 연결정보의 SSOT
- KMS를 통한 봉투 암호화(Envelope Encryption)
- 복호화는 메모리 상에서만 — 디스크에 평문 잔류 금지
- zod 스키마로 런타임 검증 — 각 서비스의 `env.ts`와 통합 완료 (중앙 포트 할당표 참조)
- 환경별 설정 파일: `config/{env}.yaml`

---

## SOPS YAML 구조

```yaml
# config/staging.yaml (SOPS 암호화 후 커밋)
global:
  region: ap-northeast-2
  tailscale_auth_key: ENC[AES256_GCM,...]   # 시크릿
  
services:
  ingest-server:
    port: 3200
    database_url: ENC[AES256_GCM,...]        # 시크릿
    store_driver: d1
    insights_driver: local
    
  registry-service:
    port: 3300
    database_url: ENC[AES256_GCM,...]
    
  gate-service:
    port: 3400
    depends_on:                               # 서비스 연결정보
      - registry-service
      - ingest-server

connections:                                  # 서비스 간 연결 탐색용
  registry-service:
    endpoint: https://registry.example.com
  ingest-server:
    endpoint: https://ingest.example.com

sops:
  kms:
    - arn: arn:aws:kms:ap-northeast-2:ACCOUNT:key/KEY_ID
  encrypted_regex: "^(.*_key|.*_secret|.*_password|.*_url|.*_token)$"
```

### 암호화 규칙 (`sops.yaml`)

```yaml
creation_rules:
  - path_regex: config/.*\.yaml$
    encrypted_regex: "^(.*_key|.*_secret|.*_password|.*_url|.*_token)$"
    kms: "arn:aws:kms:ap-northeast-2:ACCOUNT:key/KEY_ID"
```

- `encrypted_regex`로 특정 필드만 암호화 — 나머지는 평문으로 Git diff 가능
- KMS ARN은 환경별 분리 가능 (dev/staging/prod 별도 키)

## 정의 ^defines

### ResolvedConfig

```typescript
interface ResolvedConfig {
  global: GlobalConfig;
  services: Record<string, ServiceConfig>;
  connections: Record<string, ConnectionConfig>;
  monitoring?: MonitoringConfig;
}

interface MonitoringConfig {
  interval: number;           // 헬스체크 주기 (초). 기본 60
  webhooks?: WebhookConfig[];
}

interface WebhookConfig {
  url: string;
  events: string[];           // 알림 트리거 상태 (예: ["OutOfSync", "Unknown"])
}

interface GlobalConfig {
  region: string;
  tailscale_auth_key?: string;
  [key: string]: unknown;
}

interface ServiceConfig {
  port: number;
  depends_on?: string[];
  [key: string]: unknown;           // 서비스별 고유 설정
}

interface ConnectionConfig {
  endpoint: string;
  health_path?: string;             // 기본: /health
  [key: string]: unknown;
}
```

### SopsLoader — `sops` CLI shell-out

npm에 안정적인 SOPS 순수 JS 라이브러리가 없으므로, `sops` CLI 바이너리를 `execa`로 호출한다.
(프로젝트에 이미 `execa` 기반 `git-utils` 패키지가 있어 패턴 일관)

```typescript
interface SopsLoader {
  /** SOPS YAML 복호화 → 메모리 객체. 디스크 기록 없음 */
  decrypt(configPath: string): Promise<Record<string, unknown>>;
}

// 구현 개요
async function decrypt(configPath: string): Promise<Record<string, unknown>> {
  // sops --decrypt --output-type json config/staging.yaml
  // → stdout에 평문 JSON 출력 (디스크 기록 없음)
  const { stdout } = await execa("sops", ["--decrypt", "--output-type", "json", configPath]);
  return JSON.parse(stdout);
}
```

**사전 조건**: `sops` CLI가 PATH에 설치되어 있어야 함.
- CI: GitHub Actions에서 `sops` 바이너리 설치 (`mozilla/sops` releases)
- 로컬: `brew install sops` (macOS) 또는 `go install` 등

### createPlainLoader — SOPS 미설치 환경용 평문 JSON 로더

```typescript
/** 평문 JSON 설정 파일 로더. SOPS 미설치 환경에서 사용. */
function createPlainLoader(): SopsLoader;
```

- `readFile(configPath, "utf-8")` → `JSON.parse()` — SOPS CLI 호출 없이 평문 JSON 파일을 직접 읽는다
- SopsLoader 인터페이스와 동일하므로 ConfigStage에 그대로 주입 가능
- 개발/테스트 환경에서 SOPS 없이 파이프라인을 실행할 때 사용

### ConfigStage 실행 흐름

```
configPath (SOPS YAML)
  → SopsLoader.decrypt() (KMS 임시 권한으로 복호화)
    → 메모리 상 평문 객체
      → zod 스키마 검증 (configSchema.parse())
        → ResolvedConfig
          → ctx.config에 저장
```

### env-bridge — SOPS → 서비스별 환경변수 변환

```typescript
/** ResolvedConfig에서 특정 서비스의 환경변수 맵을 추출 */
function extractServiceEnv(
  config: ResolvedConfig,
  serviceId: string
): Record<string, string>;

/** 서비스 간 연결 URL을 환경변수로 변환 */
function resolveConnectionEnv(
  config: ResolvedConfig,
  serviceId: string
): Record<string, string>;
// 예: { REGISTRY_SERVICE_URL: "https://registry.example.com" }
```

## 소비 ^consumes

- `sops` CLI 바이너리 — Mozilla SOPS (shell-out via `execa`)
- `execa` — 프로세스 실행 (`^9.0.0`)
- `@aws-sdk/client-kms` — KMS 복호화 키 접근 (OIDC 임시 권한, `^3.1024.0`)
- `zod` — 설정 스키마 검증

## 보안 제약

1. **평문 디스크 잔류 금지** — 복호화 결과는 메모리 객체로만 존재
2. **KMS 키 접근은 OIDC 임시 토큰** — 정적 Access Key 사용 금지
3. **Git에는 암호화된 YAML만 커밋** — `.gitignore`에 `*.decrypted.yaml` 추가
4. **키 교체**: `scripts/rotate-keys.ts`로 KMS 키 교체 + SOPS 파일 재암호화 자동화

## env 파일 생성 — config JSON → 환경변수 변환

배포 후 각 서비스에 주입할 `.env` 파일을 config JSON에서 자동 생성한다. `export/env-file.ts`의 `configToEnvVars()`와 `generateEnvFile()`이 담당한다.

### 변환 규칙

1. config JSON의 `services.<serviceId>` 객체에서 **primitive 값**(string, number, boolean)만 추출
2. 키를 `UPPER_SNAKE_CASE`로 변환 (`store_driver` → `STORE_DRIVER`)
3. **SKIP_KEYS** — 인프라 전용 키는 env vars로 변환하지 않음:
   - `depends_on` — 서비스 의존 관계 (env var이 아닌 연결 URL로 해석)
   - `gates` — 배포 품질 게이트 설정
   - `health_path` — 헬스체크 경로 (인프라 내부 사용)

### 서비스 설정 + 연결 URL 통합

생성되는 `.env` 파일은 두 종류의 환경변수를 통합한다:

```
# 서비스 설정 (config JSON의 서비스별 primitive 값)
PORT=3200
STORE_DRIVER=d1
INSIGHTS_DRIVER=local
```

- **PORT 결정**: 
  1. `config/{env}.yaml`에 정의된 값이 최우선
  2. 미정의 시 `@qa-sdk/core`의 `SERVICE_PORTS` (SSOT) 값을 사용하여 주입
- **서비스 설정**: `configToEnvVars(serviceConfig)` — SKIP_KEYS 제외 후 UPPER_SNAKE_CASE
- **연결 URL**: `resolveConnectionEnv(config, serviceId)` — depends_on 의존 서비스의 endpoint를 `{SERVICE_ID}_URL` 형식으로
- **config 우선**: 같은 키가 config와 연결 URL에 모두 있으면 config 값 우선

### post-deploy codegen

`infra deploy --sync` 실행 시 배포 후 자동으로:
1. TypeScript 연결 모듈 재생성 (`generated/service-connections.{env}.ts`)
2. 배포된 서비스 + 의존 서비스의 `.env` 파일 재생성 (`generated/env/.env.{serviceId}.{env}`)

### 엔드포인트 자동 피드백

CF Workers 등 원격 배포 성공 시, 발견된 endpoint가 config JSON(예: `cloudflare-prod.json`)의 `connections` 섹션에 자동 기록된다. 이를 통해:
- 최초 배포 시 endpoint가 사전 설정 없이도 자동 등록
- 이후 배포에서 의존 서비스 endpoint를 config에서 바로 해석 가능
- service-profile.json과 config JSON 양쪽에 endpoint가 기록되어 이중 소스 역할

## 에러 처리

| 에러 | 원인 | 대응 |
|------|------|------|
| `sops` binary not found | PATH에 미설치 | "sops CLI를 설치하세요" 메시지 |
| KMS AccessDenied | OIDC 미설정 또는 권한 부족 | "AWS OIDC trust relationship 확인" |
| YAML parse error | SOPS 파일 손상 | "sops --decrypt 수동 실행하여 확인" |
| zod validation error | 설정값 누락/타입 불일치 | 어떤 필드가 실패했는지 상세 출력 |
