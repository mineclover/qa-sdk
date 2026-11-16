# 로컬 인프라 Docker Compose 구현 계획

> 목표: `docker compose up -d` 한 번으로 로컬 인프라 전체 구동, prod와 동일한 코드 경로 사용

## 아키텍처

```
docker compose -f docker-compose.infra.yaml up -d
  │
  ├── localstack (S3 + DynamoDB + KMS)     ← Pulumi state + lock + SOPS
  │     └── localhost:4566
  │
  ├── k3d-qa-local (K3s in Docker)         ← 서비스 배포 대상
  │     └── kubectl context: k3d-qa-local
  │
  └── init-localstack (1회성)              ← S3 버킷 + DynamoDB 테이블 + KMS 키 자동 생성

infra deploy svc dev
  → SOPS decrypt (KMS @ localhost:4566)
  → Pulumi up (state → S3 @ localhost:4566, lock → DynamoDB @ localhost:4566)
  → K8s deploy (k3d-qa-local)
```

## 코드 경로 일치

| 코드 | 로컬 | prod |
|------|------|------|
| `createSopsLoader()` | `sops --decrypt` → KMS @ localhost:4566 | `sops --decrypt` → KMS @ AWS |
| `LocalWorkspace.create({ backend })` | `s3://qa-sdk-infra-state?endpoint=http://localhost:4566` | `s3://qa-sdk-infra-state` |
| DynamoDB lock | `dynamoTable=qa-sdk-infra-lock` (same) | same |
| K8s deploy | k3d-qa-local | K3s / EKS |

**차이점 = endpoint URL만.** 환경변수 하나로 전환:
```
INFRA_AWS_ENDPOINT=http://localhost:4566   # 로컬
INFRA_AWS_ENDPOINT=                        # prod (AWS 기본)
```

## 구현 항목

### Phase 1: Docker Compose + LocalStack

#### 1-1. `packages/infra-engine/docker-compose.infra.yaml`

```yaml
services:
  localstack:
    image: localstack/localstack:latest
    ports:
      - "4566:4566"
    environment:
      SERVICES: s3,dynamodb,kms
      DEFAULT_REGION: ap-northeast-2
      EAGER_SERVICE_LOADING: 1
    volumes:
      - localstack-data:/var/lib/localstack
      - ./scripts/init-localstack.sh:/etc/localstack/init/ready.d/init.sh
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4566/_localstack/health"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  localstack-data:
```

#### 1-2. `scripts/init-localstack.sh`

LocalStack 시작 시 자동 실행되는 초기화 스크립트:

```bash
#!/bin/bash
# S3 버킷 생성
awslocal s3 mb s3://qa-sdk-infra-state

# DynamoDB lock 테이블 생성
awslocal dynamodb create-table \
  --table-name qa-sdk-infra-lock \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

# KMS 키 생성
KEY_ID=$(awslocal kms create-key --query 'KeyMetadata.KeyId' --output text)
awslocal kms create-alias --alias-name alias/qa-sdk-sops --target-key-id $KEY_ID
echo "KMS Key: $KEY_ID"
echo "KMS Alias: alias/qa-sdk-sops"
echo "$KEY_ID" > /tmp/kms-key-id.txt
```

#### 1-3. 환경 설정 파일 `packages/infra-engine/.env.infra.example` (복사 후 `.env.docker`로 사용)

```env
# LocalStack endpoint (로컬)
INFRA_AWS_ENDPOINT=http://localhost:4566
INFRA_AWS_REGION=ap-northeast-2

# Pulumi
PULUMI_CONFIG_PASSPHRASE=
PULUMI_BACKEND_URL=s3://qa-sdk-infra-state?endpoint=http://localhost:4566&disableSSL=true&s3ForcePathStyle=true

# SOPS — age 키 (로컬) 또는 KMS (LocalStack)
# SOPS_KMS_ARN=arn:aws:kms:ap-northeast-2:000000000000:alias/qa-sdk-sops
# SOPS_AGE_KEY_FILE=~/.sops/age/keys.txt

# K8s
KUBECONFIG_CONTEXT=k3d-qa-local
```

### Phase 2: pulumiDeployFn S3 백엔드 전환

#### 2-1. `PulumiDeployOptions` 확장

```typescript
export interface PulumiDeployOptions {
  env?: string;
  dryRun?: boolean;
  backendUrl?: string;      // 기본: file://~/.pulumi-local
  k8sContext?: string;       // 기본: k3d-qa-local
}
```

backendUrl 결정 로직:
```
process.env.PULUMI_BACKEND_URL            # 환경변수 최우선
  ?? options.backendUrl                   # 코드 옵션
  ?? "file://~/.pulumi-local"             # 기본값 (현재)
```

이렇게 하면:
- 로컬: `.env.infra` → `s3://...?endpoint=localhost:4566`
- CI/CD: 환경변수 → `s3://qa-sdk-infra-state`
- 테스트: 기본값 → `file://~/.pulumi-local`

#### 2-2. `createSopsLoader` endpoint 지원

```typescript
export function createSopsLoader(options?: { awsEndpoint?: string }): SopsLoader {
  return {
    async decrypt(configPath) {
      const { execa } = await import("execa");
      const env = options?.awsEndpoint
        ? { ...process.env, AWS_ENDPOINT_URL: options.awsEndpoint }
        : process.env;
      const { stdout } = await execa("sops", ["--decrypt", "--output-type", "json", configPath], { env });
      return JSON.parse(stdout);
    },
  };
}
```

### Phase 3: SOPS 실설정

#### 3-1. age 키 생성 (LocalStack KMS 대안)

```bash
brew install age sops
age-keygen -o ~/.sops/age/keys.txt
# 출력: public key: age1xxxxxxx...
```

#### 3-2. `sops.yaml` 업데이트

```yaml
creation_rules:
  - path_regex: config/.*\.yaml$
    encrypted_regex: "^(.*_key|.*_secret|.*_password|.*_url|.*_token)$"
    age: "age1xxxxxxx..."
```

#### 3-3. YAML 설정 파일 SOPS 암호화

기존 JSON → YAML 전환 + 시크릿 필드 암호화:
```bash
# JSON → YAML 변환
# config/dev.yaml 에 시크릿 필드 추가
# sops --encrypt --in-place config/dev.yaml
```

### Phase 4: CLI 통합

#### 4-1. `infra.ts` 서브커맨드 추가

```
infra env up        # docker compose up -d (LocalStack + 초기화)
infra env down      # docker compose down
infra env status    # LocalStack + k3d + 서비스 상태
infra env reset     # 전체 초기화 (volumes 삭제)
```

#### 4-2. 자동 환경 감지

```typescript
// infra.ts 시작 시
async function detectEnvironment() {
  // 1. LocalStack 실행 확인
  try {
    await fetch("http://localhost:4566/_localstack/health", { signal: AbortSignal.timeout(2000) });
    process.env.INFRA_AWS_ENDPOINT ??= "http://localhost:4566";
    console.log("[env] LocalStack 감지 → S3/DynamoDB/KMS 로컬 모드");
  } catch {
    console.log("[env] LocalStack 미실행 → 파일 백엔드 모드");
  }

  // 2. k3d 클러스터 확인
  try {
    const { execa } = await import("execa");
    await execa("kubectl", ["cluster-info", "--request-timeout=2s"]);
    console.log("[env] K8s 클러스터 감지");
  } catch {
    console.log("[env] K8s 미실행 — deploy 불가");
  }
}
```

## 사용 시나리오

### 처음 시작

```bash
cd packages/infra-engine

# 1. 인프라 환경 시작
infra env up
# → LocalStack 시작 (S3 + DynamoDB + KMS 자동 생성)
# → k3d 클러스터 확인 (없으면 생성 안내)

# 2. 서비스 배포
infra deploy nginx-test dev test-nginx.json
# → [env] LocalStack 감지 → S3/DynamoDB/KMS 로컬 모드
# → SOPS decrypt (LocalStack KMS 또는 age)
# → Pulumi up (state → LocalStack S3, lock → LocalStack DynamoDB)
# → K8s deploy (k3d)

# 3. 상태 확인
infra status dev
infra dashboard summary
```

### 일상 작업

```bash
# 환경 시작 (Docker 재시작 후)
infra env up

# 배포
infra deploy ingest-server dev

# 모니터링
infra monitor check

# 정리
infra destroy ingest-server dev --yes

# 환경 종료
infra env down
```

### prod 전환 시

```bash
# .env.infra 에서 INFRA_AWS_ENDPOINT 제거
# → 자동으로 AWS 실서비스 사용
# sops.yaml 에서 age → kms 전환
```

## 구현 순서

| 단계 | 작업 | 산출물 |
|------|------|--------|
| **1** | docker-compose.infra.yaml + init-localstack.sh | LocalStack 환경 |
| **2** | pulumiDeployFn backendUrl 옵션 + 환경 감지 | S3 백엔드 전환 |
| **3** | sops.yaml + age 키 + YAML 설정 | SOPS 실연동 |
| **4** | `infra env up/down/status/reset` CLI | 환경 관리 통합 |
| **5** | E2E 테스트: env up → deploy → verify → destroy → env down | 전체 플로우 |
