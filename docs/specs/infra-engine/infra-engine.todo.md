---
def:
  id: infra-engine-todo
  level: leaf
  scope: system
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: operation
  links:
    - target: infra-engine-pipeline
      type: refines
---

# Infra Engine — 구현 TODO

## 목적 ^purpose

infra-engine 패키지의 구현 완료 현황과 잔여 작업을 추적한다.

---

## 구현 완료 (implemented)

### 코어 파이프라인
- [x] `core/types.ts` — DeployContext, DeployResult, Stage, DeployPipeline 등 전체 타입
- [x] `core/pipeline.ts` — createPipeline(), 순차 실행 + 역순 rollback + duration
- [x] 40 tests PASS

### 5단계 스테이지
- [x] ConfigStage — SOPS CLI (createSopsLoader) + 평문 JSON (createPlainLoader) + zod 검증
- [x] ProvisionStage — DeployProvider 검증 + deployFn 호출 + rollback(destroy)
- [x] RegisterStage — registry-service sync + service-profile URL + infra-profile 메타 + rollback
- [x] VerifyStage — httpProbe + 내장 게이트 4종 + retry + gate verdict
- [x] ObserveStage — deploy_event emit + 모니터 등록 (fail-open)

### 어댑터 6개 포트
- [x] RegistryAdapter — `createRegistryAdapter(baseUrl)` HTTP 실연동
- [x] ServiceProfileAdapter — `createServiceProfileAdapter(dir)` + rollback 파일
- [x] InfraProfileAdapter — `createInfraProfileAdapter(dir)` deployments + monitors
- [x] IngestAdapter — 인터페이스 (실구현은 mock)
- [x] CoordinateAdapter — 인터페이스 (실구현은 mock)
- [x] GateAdapter — `createGateAdapter()` pass/warn/fail 판정

### 프로바이더
- [x] DeployProvider 인터페이스 + 프로바이더 레지스트리 (register/get/list)
- [x] Local K3s 프로바이더 — `createLocalProvider(options)` + K8s Deployment/Service
- [x] Pulumi 배포 함수 — `createPulumiDeployFn({ env })` + port-forward + env→ns 매핑

### 디스커버리 + Fleet + Export
- [x] DiscoveryClient — resolve/resolveAll/listServices/generateConnectCode
- [x] FleetManager — status() tier별 서비스 상태 조회
- [x] export env — `.env.{service}.{env}` 파일 생성
- [x] export ts — `service-connections.{env}.ts` 타입드 모듈 생성
- [x] export compose — `docker-compose.override.{env}.yml` 생성

### CLI 스크립트
- [x] `scripts/deploy-local.ts` — 로컬 K3s 배포 (nginx 검증 완료)
- [x] `scripts/discover.ts` — 디스커버리 CLI (--all, --list, --code)
- [x] `scripts/export.ts` — export CLI (status, env, ts, compose)

### 검증 완료 시나리오
- [x] 동일 서비스 재배포 (Pulumi 멱등성)
- [x] 설정 변경 재배포 (Pulumi diff update)
- [x] dev/stage 멀티 환경 동시 배포
- [x] registry-service 실연동
- [x] 디스커버리 + 연결 코드 생성

---

## 잔여 작업 (TODO)

### P0 — 운영 필수

- [ ] **IngestAdapter 실구현** — TransmissionEnvelope 구성 + POST /v1/ingest 실호출
  - `src/adapters/ingest.ts` 생성
  - svc_ref 좌표 인코딩 → CoordinateAdapter 실구현 필요
  - spec: infra-observe-stage.spec.md §TransmissionEnvelope 구성

- [ ] **CoordinateAdapter 실구현** — demo-catalog service prefix 좌표 인코딩
  - `src/adapters/coordinate.ts` 생성
  - `_INFRA_SVC` → service prefix 4차원 인코딩 (env × region × svc_name × namespace)
  - fail-open: 해석 실패 시 null → 빈 address_context

- [ ] **SyncLoop 모니터링** — ArgoCD 스타일 주기적 헬스체크
  - `src/monitor/sync-loop.ts` 구현
  - infra-profile.json monitors 순회 → 헬스체크 → 상태 변화 시 health_event emit
  - webhook 알림 (Slack/Discord)
  - spec: infra-monitoring.spec.md (lifecycle: draft)

- [ ] **ingest-server Docker 빌드 수정** — @qa-sdk/pino tsc 에러 해소
  - `Dockerfile.ingest-server` → `pnpm --filter @qa-sdk/ingest-server... run build` 실패
  - pino 패키지 빌드 에러 수정 후 K3s 실배포 가능

### P1 — 프로바이더 확장

- [ ] **Cloudflare 프로바이더** — `@pulumi/cloudflare` Workers/Pages 배포
  - `src/providers/cloudflare.ts`
  - 기존 wrangler.toml 기반 배포를 Pulumi로 래핑

- [ ] **Railway 프로바이더** — `@pulumi/command` + Railway CLI
  - `src/providers/railway.ts`
  - `railway up --service {id} --environment {env}`

- [ ] **AWS 프로바이더** — `@pulumi/aws` ECS/Lambda
  - `src/providers/aws.ts`
  - OIDC STS 임시 토큰

- [ ] **GCP 프로바이더** — `@pulumi/gcp` Cloud Run
  - `src/providers/gcp.ts`

- [ ] **Vultr 프로바이더** — `@ediri/vultr` K3s 컨테이너
  - `src/providers/vultr.ts`

### P2 — CI/CD 통합

- [ ] **GitHub Actions 워크플로우** — `.github/workflows/infra-deploy.yaml`
  - OIDC 인증 → SOPS 복호화 → Pulumi 배포 → 레지스트리 등록 → 헬스체크
  - `triggeredBy: "ci"` 자동 설정

- [ ] **SOPS 설정 파일** — 환경별 YAML 암호화
  - `sops.yaml` 규칙 + KMS ARN 설정
  - `config/{env}.yaml` → SOPS 암호화 후 커밋

- [ ] **S3 + DynamoDB State Backend** — 운영 Pulumi 상태 관리
  - S3 버저닝 + DynamoDB lock
  - `file://~/.pulumi-local` → `s3://qa-sdk-infra-state?dynamoTable=...` 전환

- [ ] **키 교체 스크립트** — `scripts/rotate-keys.ts`
  - KMS 키 교체 + SOPS 파일 재암호화 자동화

### P3 — 고도화

- [ ] **DashboardData API** — 서비스별 상태 집계 엔드포인트
  - `src/monitor/dashboard.ts` 구현
  - FleetStatus + 배포 이력 + 헬스 이력

- [ ] **FleetManager.deployAll 실구현** — 현재 dry-run만
  - 파이프라인 실행 체인 + 순차/병렬 옵션

- [ ] **Pulumi destroy CLI** — 배포된 리소스 정리
  - `scripts/destroy.ts` — 스택 선택 → destroy → 프로필 정리

- [ ] **자동 복구** — OutOfSync 감지 → 자동 재배포
- [ ] **SLA 추적** — uptime 기반 계산 + 리포트
- [ ] **Grafana 연동** — DashboardData → Grafana 데이터소스
