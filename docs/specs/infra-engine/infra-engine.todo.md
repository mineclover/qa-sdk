---
def:
  id: infra-engine-todo
  level: leaf
  scope: system
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  links:
    - target: infra-engine-pipeline
      type: refines
---

# Infra Engine — TODO

## 목적 ^purpose

infra-engine 패키지의 구현 현황과 잔여 작업을 추적한다. 우선순위는 사용성(P0) → 기능(P1) → 아키텍처(P2) 순.

---

## 구현 완료

### 코어 (P0 이전)

- [x] 코어 파이프라인 (`createPipeline`, 순차실행+rollback) — `src/core/pipeline.ts`
- [x] 코어 타입 (`DeployContext`, `DeployResult`, `Stage`) — `src/core/types.ts`
- [x] 5단계 스테이지 (Config, Provision, Register, Verify, Observe) — `src/stages/`
- [x] 어댑터 6포트 (Registry, ServiceProfile, InfraProfile, Ingest, Coordinate, Gate) — `src/adapters/adapter.ts`
- [x] RegistryAdapter 실구현 (POST /api/services/:id/deployments/sync) — `src/adapters/registry.ts`
- [x] DefinitionAdapter (서비스 문서/테스트/prefix 조회) — `src/adapters/definition.ts`
- [x] GateAdapter (품질 게이트 평가) — `src/adapters/gate.ts`
- [x] InfraProfileAdapter — `src/adapters/infra-profile.ts`
- [x] ServiceProfileAdapter — `src/adapters/service-profile.ts`
- [x] Local K3s 프로바이더 + Pulumi 배포 함수 (port-forward 포함) — `src/providers/local.ts`, `src/providers/pulumi-deploy.ts`
- [x] 클라우드 프로바이더 스텁 5종 — `src/providers/cloudflare.ts`, `aws.ts`, `gcp.ts`, `railway.ts`, `vultr.ts`
- [x] 프로바이더 집합 + 레지스트리 — `src/providers/all.ts`, `src/providers/registry.ts`
- [x] DiscoveryClient (resolve, resolveAll, generateConnectCode) — `src/discovery/client.ts`
- [x] EnhancedDiscovery (registry + definition 통합) — `src/discovery/enhanced-client.ts`
- [x] FleetManager (status, tier별 그룹핑, 헬스체크 실행 감지) — `src/fleet/manager.ts`
- [x] Export 3종 (env, ts, compose) + docs 요약 — `src/export/`
- [x] 헬스체크 + 품질 게이트 정의 — `src/verify/health-check.ts`, `src/verify/gate-definitions.ts`, `src/verify/verify-stage.ts`
- [x] Config 스키마 + SOPS 로더 + env bridge — `src/config/config-schema.ts`, `sops-loader.ts`, `config-stage.ts`, `env-bridge.ts`
- [x] Skills 4종 (infra-discover, infra-deploy, infra-export, infra-status)
- [x] URL fallback 경고, 테스트 3-state, env 필터링
- [x] 6개 시나리오 검증 (재배포, 설정변경, 멀티env, CI, 디스커버리, fleet)
- [x] public export 관리 — `src/index.ts`

### P0 — 사용성

- [x] **0-1. destroy 명령** — `src/commands/destroy.ts`
  - Pulumi destroy (스택 삭제)
  - port-forward 프로세스 kill (PID 기반)
  - infra-profile에서 deployment + monitor 제거
  - `--yes` 플래그로 확인 프롬프트 스킵
- [x] **0-2. CLI 통합 (단일 진입점)** — `scripts/infra.ts` (15 서브커맨드)
  - `infra discover [--all|--list|--deep|--code] <service> <env>`
  - `infra deploy <service> <env> [config] [--dry-run]`
  - `infra deploy --all <env> [--continue-on-error]`
  - `infra destroy <service> <env> [--yes]`
  - `infra export [env|ts|compose|docs] <args> [--out <path>]`
  - `infra status <env>`
  - `infra history <service> [--json]`
  - `infra audit`
  - `infra monitor [start|check|status] [--interval N]`
  - `infra dashboard [summary|service <id>|export [path]]`
  - `infra pf [list|cleanup]`
  - 기존 discover.ts, deploy-local.ts, export.ts → infra.ts에서 import하여 위임
  - `--help` 자동 출력 (인자 없을 때)
- [x] **0-3. PULUMI_CONFIG_PASSPHRASE 자동 처리** — infra.ts 진입점에서 자동 설정
- [x] **0-4. port-forward 프로세스 관리** — `infra pf list`, `infra pf cleanup`

### P1 — 기능 확장

- [x] **1-1. 배포 이력** — infra-profile `history` 필드 + `infra history <service> [--json]`
- [x] **1-2. dry-run** — `infra deploy <service> <env> --dry-run` (Pulumi `stack.preview()`)
- [x] **1-3. fleet 일괄 배포** — `infra deploy --all <env> [--continue-on-error]`
- [x] **1-4. export 경로 지정** — `infra export ts <env> --out <path>`
- [x] **1-5. registry 데이터 감사** — `infra audit` (`src/commands/audit.ts`)

### P2 — 아키텍처

- [x] **2-1. SyncLoop 모니터링** — `src/monitor/sync-loop.ts`
  - infra-profile monitors 순회 → 주기적 헬스체크
  - 상태 전이 (Synced / OutOfSync / Degraded / Unknown)
  - `infra monitor start`, `infra monitor check`, `infra monitor status`
- [x] **2-2. 클라우드 프로바이더 스텁** — `src/providers/` (cloudflare, aws, gcp, railway, vultr)
- [x] **2-4. DashboardData API** — `src/monitor/dashboard.ts`
  - FleetStatus 집계
  - 배포 이력 타임라인
  - 서비스별 uptime 계산
  - `infra dashboard [summary|service <id>|export [path]]`
- [x] **2-5. 자동 복구 + SLA** — `src/monitor/auto-recovery.ts`, `src/monitor/sla.ts`
  - OutOfSync 감지 → 자동 재배포 트리거
  - SLA 추적 (uptime 계산)

### 현재 규모

- **40 소스 파일**, **19 테스트 파일**, **81 테스트**
- **15 CLI 서브커맨드** (scripts/infra.ts)
- **4 스크립트** (infra.ts, deploy-local.ts, discover.ts, export.ts)
- **6 환경 설정** (config/test.json, dev.json, stage.json, prod.json, test-nginx.json, test-nginx-v2.json)

---

## 잔여 작업

### 1-6. IngestAdapter 실구현

- [ ] `src/adapters/ingest.ts` — TransmissionEnvelope 구성 + POST /v1/ingest
- [ ] CoordinateAdapter 실구현 — demo-catalog service prefix 좌표 인코딩
- [ ] deploy_event 좌표: svc_ref × deploy_action × actor
- [ ] fail-open: 좌표 해석 실패 → 빈 address_context

### 1-7. ingest-server Docker 빌드

- [ ] @qa-sdk/pino tsc 빌드 에러 수정
- [ ] `docker build -t qa-sdk/ingest-server:latest -f Dockerfile.ingest-server .` 성공
- [ ] `k3d image import` → K3s 실배포 검증

### 2-3. CI/CD 통합

- [ ] `.github/workflows/infra-deploy.yaml`
  - OIDC 인증 → SOPS 복호화 → Pulumi 배포 → 헬스체크
  - `triggeredBy: "ci"` 자동 설정
  - push to main → config/*.yaml 변경 감지 → 자동 배포
- [ ] SOPS 설정 파일
  - `sops.yaml` 암호화 규칙 (KMS ARN + encrypted_regex)
  - `config/{env}.yaml` → SOPS 암호화 후 커밋
  - `createSopsLoader()` 실사용
- [ ] S3 + DynamoDB State Backend
  - `s3://qa-sdk-infra-state?dynamoTable=qa-sdk-infra-lock`
  - `file://~/.pulumi-local` → S3 전환
  - DynamoDB TTL 30분 (크래시 lock 자동 해제)
- [ ] 키 교체: `scripts/rotate-keys.ts`
  - KMS 키 교체 + SOPS 파일 재암호화

### 기타

- [ ] webhook 알림 (Slack/Discord) — `config.monitoring.webhooks` 설정 기반 OutOfSync/Unknown 시 POST
- [ ] Grafana 데이터소스 연동 가능한 형식으로 dashboard export
- [ ] 클라우드 프로바이더 실구현 (현재 스텁 — Pulumi Program per provider)
