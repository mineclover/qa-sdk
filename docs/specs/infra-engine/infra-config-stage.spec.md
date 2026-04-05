---
def:
  id: infra-config-stage
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
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

### SopsLoader

```typescript
interface SopsLoader {
  /** SOPS YAML 복호화 → 메모리 객체. 디스크 기록 없음 */
  decrypt(configPath: string): Promise<Record<string, unknown>>;
}
```

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

- `node-sops` — Node.js SOPS 복호화 라이브러리
- `aws-sdk/kms` — KMS 복호화 키 접근 (OIDC 임시 권한)
- `zod` — 설정 스키마 검증

## 보안 제약

1. **평문 디스크 잔류 금지** — 복호화 결과는 메모리 객체로만 존재
2. **KMS 키 접근은 OIDC 임시 토큰** — 정적 Access Key 사용 금지
3. **Git에는 암호화된 YAML만 커밋** — `.gitignore`에 `*.decrypted.yaml` 추가
4. **키 교체**: `scripts/rotate-keys.ts`로 KMS 키 교체 + SOPS 파일 재암호화 자동화
