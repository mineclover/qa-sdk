---
def:
  id: infra-config-stage
  scope: feature
  aspect: func_def
  depth: specification
  level: leaf
  lifecycle: implemented
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
- zod 스키마로 런타임 검증 — env.ts의 역할을 통합
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

## 에러 처리

| 에러 | 원인 | 대응 |
|------|------|------|
| `sops` binary not found | PATH에 미설치 | "sops CLI를 설치하세요" 메시지 |
| KMS AccessDenied | OIDC 미설정 또는 권한 부족 | "AWS OIDC trust relationship 확인" |
| YAML parse error | SOPS 파일 손상 | "sops --decrypt 수동 실행하여 확인" |
| zod validation error | 설정값 누락/타입 불일치 | 어떤 필드가 실패했는지 상세 출력 |
