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

# Infra Engine — TODO

## 목적 ^purpose

infra-engine 패키지의 구현 현황과 잔여 작업을 추적한다. 우선순위는 사용성(P0) → 기능(P1) → 아키텍처(P2) 순.

---

## 구현 완료

- [x] 코어 파이프라인 (createPipeline, 순차실행+rollback)
- [x] 5단계 스테이지 (Config, Provision, Register, Verify, Observe)
- [x] 어댑터 6포트 (Registry, ServiceProfile, InfraProfile, Ingest, Coordinate, Gate)
- [x] RegistryAdapter 실구현 (POST /api/services/:id/deployments/sync)
- [x] Local K3s 프로바이더 + Pulumi 배포 함수 (port-forward 포함)
- [x] DiscoveryClient (resolve, resolveAll, generateConnectCode)
- [x] EnhancedDiscovery (registry + definition 통합)
- [x] DefinitionAdapter (서비스 문서/테스트/prefix 조회)
- [x] FleetManager (status, tier별 그룹핑, 헬스체크 실행 감지)
- [x] Export 3종 (env, ts, compose) + docs 요약
- [x] CLI 3종 (discover.ts, deploy-local.ts, export.ts)
- [x] Skills 4종 (infra-discover, infra-deploy, infra-export, infra-status)
- [x] URL fallback 경고, 테스트 3-state, env 필터링
- [x] 6개 시나리오 검증 (재배포, 설정변경, 멀티env, CI, 디스커버리, fleet)
- [x] 58 tests, 26 소스 파일

---

## P0 — 사용성 (즉시)

### 0-1. destroy 명령

배포된 리소스를 한 번에 정리하는 명령.

- [ ] `scripts/infra.ts destroy <service> <env>` 서브커맨드
  - Pulumi destroy (스택 삭제)
  - port-forward 프로세스 kill (PID 기반)
  - infra-profile에서 deployment + monitor 제거
  - service-profile URL 복원 (rollback 파일)
- [ ] `--all` 플래그: 환경 내 전체 서비스 destroy
- [ ] destroy 전 확인 프롬프트 (--yes로 스킵 가능)

### 0-2. CLI 통합 (단일 진입점)

scripts/ 분산을 `infra.ts` 서브커맨드로 통합.

- [ ] `scripts/infra.ts` — 단일 진입점
  ```
  infra discover [--all|--list|--deep|--code] <service> <env>
  infra deploy <service> <env> [config]
  infra destroy <service> <env>
  infra export [env|ts|compose|docs] <args>
  infra status <env>
  infra history <service>
  infra audit
  ```
- [ ] package.json scripts 추가: `"infra": "tsx scripts/infra.ts"`
- [ ] 기존 discover.ts, deploy-local.ts, export.ts → infra.ts에서 import하여 위임
- [ ] `--help` 자동 출력 (인자 없을 때)

### 0-3. PULUMI_CONFIG_PASSPHRASE 자동 처리

- [ ] infra.ts 진입점에서 `process.env.PULUMI_CONFIG_PASSPHRASE ??= ""`
- [ ] 또는 `packages/infra-engine/.env.local`에 `PULUMI_CONFIG_PASSPHRASE=` 설정
- [ ] deploy/destroy 실행 시 passphrase 프롬프트 방지

### 0-4. port-forward 프로세스 관리

- [ ] `~/.qa-sdk/infra-pf.json` — PID + service + port 매핑
  ```json
  { "nginx-test-dev": { "pid": 12345, "localPort": 20080, "service": "svc/xxx" } }
  ```
- [ ] deploy 시: 기존 PID kill → 새 port-forward 시작 → PID 기록
- [ ] destroy 시: PID kill → 기록 제거
- [ ] `infra pf list` — 현재 활성 port-forward 목록
- [ ] `infra pf cleanup` — 죽은 PID 정리

---

## P1 — 기능 확장 (중기)

### 1-1. 배포 이력

- [ ] infra-profile에 `history: DeployHistoryEntry[]` 추가
  ```typescript
  interface DeployHistoryEntry {
    deployedAt: string;
    version: string;
    env: string;
    provider: string;
    duration: number;
    success: boolean;
    triggeredBy: "ci" | "manual";
  }
  ```
- [ ] deploy 성공 시 history에 push (최대 50건 보존)
- [ ] `infra history <service>` — 배포 이력 테이블 출력
- [ ] `infra history <service> --json` — JSON 출력

### 1-2. dry-run (변경 사항 미리보기)

- [ ] `infra deploy <service> <env> --dry-run`
- [ ] Pulumi `stack.preview()` 호출 → 변경 사항 diff 출력
- [ ] 실제 배포 없음, register/verify/observe 스킵
- [ ] 출력: `+ 2 to create, ~ 1 to update, - 0 to delete`

### 1-3. fleet 일괄 배포

- [ ] `infra deploy --all <env>` — 환경 내 전체 서비스 순차 배포
- [ ] 설정 파일 기반으로 배포 대상 결정 (`config/{env}.json`의 services 키)
- [ ] 실패 시 중단 or 계속 옵션 (`--continue-on-error`)
- [ ] 결과 요약 출력

### 1-4. export 경로 지정

- [ ] `infra export ts <env> --out <path>` — 출력 경로 지정
- [ ] 서비스별 자동 배치: `--service-dir` → `packages/{service}/src/generated/`
- [ ] `.gitignore`에 generated/ 자동 추가 여부 확인

### 1-5. registry 데이터 감사

- [ ] `infra audit` — registry 데이터 품질 점검
  - URL 미등록 서비스 (env별)
  - ownedPrefixes가 빈 서비스
  - consumedPrefixes에 선언되었지만 어디에도 소유되지 않은 prefix
  - 중복 URL (두 서비스가 같은 URL)
- [ ] 결과: warning/error 분류, 수정 제안

### 1-6. IngestAdapter 실구현

- [ ] `src/adapters/ingest.ts` — TransmissionEnvelope 구성 + POST /v1/ingest
- [ ] CoordinateAdapter 실구현 — demo-catalog service prefix 좌표 인코딩
- [ ] deploy_event 좌표: svc_ref × deploy_action × actor
- [ ] fail-open: 좌표 해석 실패 → 빈 address_context

### 1-7. ingest-server Docker 빌드

- [ ] @qa-sdk/pino tsc 빌드 에러 수정
- [ ] `docker build -t qa-sdk/ingest-server:latest -f Dockerfile.ingest-server .` 성공
- [ ] `k3d image import` → K3s 실배포 검증

---

## P2 — 아키텍처 (장기)

### 2-1. SyncLoop 모니터링

- [ ] `src/monitor/sync-loop.ts` 구현
  - infra-profile monitors 순회 → 주기적 헬스체크
  - 상태 변화 시 health_event → ingest-server emit
  - Synced → OutOfSync / Degraded / Unknown 전이
- [ ] webhook 알림 (Slack/Discord)
  - `config.monitoring.webhooks` 설정 기반
  - OutOfSync/Unknown 시 POST
- [ ] `infra monitor start` — 백그라운드 실행
- [ ] `infra monitor stop`
- [ ] `infra monitor status` — 마지막 체크 결과

### 2-2. 클라우드 프로바이더

- [ ] Cloudflare — `@pulumi/cloudflare ^6.14.0`
  - Workers, Pages, D1 배포
  - 기존 wrangler.toml 기반 래핑
- [ ] Railway — `@pulumi/command ^1.2.1` + Railway CLI
  - `railway up --service {id} --environment {env}`
- [ ] AWS — `@pulumi/aws ^7.24.0`
  - ECS / Lambda / App Runner
  - OIDC STS 임시 토큰
- [ ] GCP — `@pulumi/gcp ^9.18.0`
  - Cloud Run / App Engine
  - Workload Identity
- [ ] Vultr — `@ediri/vultr ^2.27.1`
  - K3s 컨테이너 배포

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

### 2-4. DashboardData API

- [ ] `src/monitor/dashboard.ts` 구현
  - FleetStatus 집계
  - 배포 이력 타임라인
  - 서비스별 uptime 계산
- [ ] HTTP 엔드포인트 (또는 JSON 파일 export)
- [ ] Grafana 데이터소스 연동 가능한 형식

### 2-5. 자동 복구 + SLA

- [ ] OutOfSync 감지 → 자동 재배포 트리거
  - 최대 재시도 횟수 제한
  - 연속 실패 시 알림 에스컬레이션
- [ ] SLA 추적
  - uptime 계산 (Synced 시간 / 전체 시간)
  - 월별 리포트 생성
