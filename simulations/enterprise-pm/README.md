# Enterprise PM 시뮬레이션

> qa-sdk 5축(권한·이벤트·관측·로직·로깅)을 PM + Approval Workflow 도메인에서 end-to-end 검증하는 test harness.

## 위치 및 범위

- 위치: `simulations/enterprise-pm/` (qa-sdk 모노레포 내부)
- 패키지명: `@qa-sdk-sim/enterprise-pm` (workspace member)
- 9 NestJS 서비스 + Hono gateway + 1 Redis + qa-sdk 본체 인프라(qa-sdk-db, ingest-server) 외부 참조
- CLI scenario runner only (UI 없음)

## 디자인·계획 문서

| 문서 | 내용 |
|---|---|
| [`docs/proposals/auth-model-implementation-backlog/sim-erp-pm-design.md`](../../docs/proposals/auth-model-implementation-backlog/sim-erp-pm-design.md) | 전체 아키텍처 — 토폴로지/도메인/8 시나리오/19 plan 분해 |
| Plan 09a (본 폴더) | workspace 부트스트랩 (현재 plan) |
| Plan 09b | qa-sdk-db init.sql `sim` schema + `sim_app` role + SERVICE_PORTS 9 entry |
| Plan 09c | docker-compose.sim.yaml + Dockerfile.service + sim-up/down 스크립트 |
| Plan 09d | .env.sim + sops + seed 데이터 (7 부서, 50 사용자, 7 역할) |
| Plan 10 | 9 NestJS 서비스 스캐폴딩 (10a/b/c) |
| Plan 11 | 도메인 모델 + DB schema (11a/b/c) |
| Plan 12 | Cross-service 통신 + 권한 통합 (12a/b/c) |
| Plan 13 | 8 시나리오 구현 (13a/b/c/d) |
| Plan 14 | §5 marginal density + 통합 회귀 (14a/b) |

## 부팅 절차 (Plan 09 완료 후)

1. **qa-sdk 본체 인프라 부팅** (다른 터미널)
   ```bash
   cd packages/infra-engine && docker compose -f docker-compose.infra.yaml up -d qa-sdk-db
   pnpm --filter @qa-sdk/ingest-server dev
   ```

2. **시뮬 환경 변수 설정**
   ```bash
   cd simulations/enterprise-pm
   sops decrypt .env.sim.enc > .env.sim   # Plan 09d로 추가될 sops 파일
   ```

3. **시뮬 컨테이너 부팅**
   ```bash
   pnpm sim:up      # docker compose -f docker-compose.sim.yaml up -d
   pnpm sim:ps      # 9 서비스 + sim-redis healthy 확인
   ```

4. **seed 데이터 적용**
   ```bash
   pnpm sim:seed    # 7 부서, 50 사용자, 7 역할, role_assignments
   ```

5. **시나리오 실행** (Plan 13 완료 후)
   ```bash
   pnpm sim:scenario -- 1   # 시나리오 1: 로그인 → bitmap 발행 → 프로젝트 list
   ```

6. **종료**
   ```bash
   pnpm sim:down
   ```

## 서비스 토폴로지 + 포트

| 서비스 | 포트 | 역할 |
|---|---|---|
| sim-gateway | 8888 | Hono — JWT bitmap embed + traceparent 주입 |
| sim-auth-api | 4400 | User/Role/Department + bitmap 발행 |
| sim-pm-api | 4500 | Project/Task/Member |
| sim-approval-api | 4600 | Budget/Resource/Time-off/Expense workflow |
| sim-notification-api | 4700 | 알림·구독 |
| sim-reporting-api | 4800 | 분석·대시보드 (marginal density) |
| sim-document-api | 4900 | 첨부·코멘트·버전 |
| sim-audit-browser-api | 5100 | audit trace explorer API |
| sim-metrics-collector | 5200 | Prometheus exporter |
| sim-redis | 6379 | bitmap pub/sub + event broadcast |

자세한 포트 할당: `docs/specs/infra-engine/infra-port-allocation.spec.md` (Plan 09b로 갱신).

## 외부 의존 (qa-sdk 본체 컨테이너)

- `qa-sdk-db` (5434) — `sim` schema (Plan 09b로 추가)
- `ingest-server` (3200) — IngestForwarder 수신
- `host.docker.internal:4318` — OTEL collector (Tempo/Jaeger)

## 라이선스 / 정책

본 시뮬은 qa-sdk 검증용 test harness이며 실제 제품이 아니다. 진짜 ERP의 HR·재무·인벤토리 모듈은 의도적으로 제외한다.
