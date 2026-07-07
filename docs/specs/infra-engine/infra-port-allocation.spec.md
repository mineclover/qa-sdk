---
def:
  id: infra-port-allocation
  scope: constraint
  aspect: infra_constraint
  depth: specification
  tier: component
  lifecycle: approved
  layer: operation
  tags: [infra, port, k3s, cf-workers]
  links:
    - target: infra-service-operations
      type: refines
sources:
  - packages/core/src/lib/service-ports.ts
  - packages/infra-engine/config/dev.json
  - packages/infra-engine/config/local.json
  - packages/infra-engine/src/export/pg-env-builder.ts
  - packages/infra-engine/src/export/pg-env-builder.test.ts
  - simulations/enterprise-pm/docker-compose.sim.yaml
---
# 서비스 포트 할당

## 목적 ^purpose

QA-SDK 마이크로서비스 및 인프라 도구의 포트 할당 규칙을 정의한다. 인프라 팀이 중앙에서 관리하며, 서비스는 실행 시 환경 변수를 통해 할당받는다.

## 관리 원칙 ^principle

- **SSOT**: `@qa-sdk/core`의 `SERVICE_PORTS` 상수가 포트 할당의 유일한 진실 공급원이다.
- **주입 방식**: `infra-engine export env` 명령이 중앙 정의를 바탕으로 `.env` 파일을 자동 생성하며, 서비스는 이를 주입받아 실행된다.
- **Strict Enforcement**: 각 서비스의 `env.ts`는 하드코딩된 fallback 포트를 가질 수 없으며, 중앙 레지스트리에 등록되지 않은 서비스는 실행이 차단된다.
- **인프라 DB**: `zitadel-postgres`, `qa-sdk-postgres`처럼 PG 인스턴스도 SERVICE_PORTS에 등록한다. 서비스의 `QA_PG_PORT`는 service-profile/.env에서 주입받으며 SERVICE_PORTS는 충돌 검출 단일 진입점 역할.
- **시뮬레이션 격리**: `sim-*` 서비스(Phase 4 enterprise-pm)는 `simulations/enterprise-pm/docker-compose.sim.yaml`에서 부팅. 실제 비즈니스 서비스(`shopping-backend`, `auth`, `payment`)와 포트 대역 분리 (4400~ vs 4100~). 충돌 검출은 SERVICE_PORTS가 일원 처리.

## 포트 테이블 ^overview

| 레이어 | 서비스 | 포트 | 비고 |
|--------|--------|------|------|
| **Infra** | Grafana | 3000 | 시각화 대시보드 |
| **Infra** | Loki | 3100 | 로그 집계 (과거 registry-server 포트) |
| **Infra** | Prometheus | 9090 | 메트릭 수집 |
| **Infra** | zitadel-postgres | 5433 | Zitadel 인증 DB 컨테이너 |
| **Infra** | qa-sdk-postgres | 5434 | qa-sdk 메인 PG 컨테이너 (auth/audit/ingest/decision/definition schema) |
| **Engine** | ingest-server | 3200 | 이벤트 수집 |
| **Engine** | registry-service | 3300 | 정의 및 주소 스키마 관리 |
| **Engine** | gate-service | 3400 | 주소 상태 게이트 |
| **Engine** | query-service | 3500 | 정책 규칙 질의 |
| **Engine** | decode-service | 3600 | 좌표 디코더 캐시 |
| **Engine** | definition-service | 3700 | 문서/prefix 정의 관리 |
| **Engine** | motion-workspace | 3710 | 모션 워크스페이스 |
| **Engine** | decision-service | 3800 | 의사결정 관리 |
| **Sim** | sim-auth-api | 4400 | 시뮬: 사용자/role/department + bitmap 발행 |
| **Sim** | sim-pm-api | 4500 | 시뮬: Project/Task/Member |
| **Sim** | sim-approval-api | 4600 | 시뮬: Budget/Resource/Time-off/Expense workflow |
| **Sim** | sim-notification-api | 4700 | 시뮬: 알림·구독 |
| **Sim** | sim-reporting-api | 4800 | 시뮬: 분석·대시보드 (marginal density) |
| **Sim** | sim-document-api | 4900 | 시뮬: 첨부·코멘트·버전 |
| **Sim** | sim-audit-browser-api | 5100 | 시뮬: audit trace explorer |
| **Sim** | sim-metrics-collector | 5200 | 시뮬: Prometheus exporter |
| **Sim** | sim-gateway | 8888 | 시뮬: Hono gateway (JWT + traceparent) |
| **Sim** | sim-redis | 6379 | 시뮬: bitmap pub/sub + event broadcast (`docker-compose.sim.yaml`) |
| **Debug** | gRPC debug | 50051 | `GRPC_PORT` 설정 시 활성 |
