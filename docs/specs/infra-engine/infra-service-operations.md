---
def:
  id: infra-service-operations
  type: knowledge
  knowledge_kind: guide
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [entry-point, runtime]
  links:
    - target: infra-engine-pipeline
      type: depends_on
---

# 서비스 운영 참조

## 목적 ^purpose

서비스 포트 할당, URL 관리(Service Profile), 스토어/인사이트 드라이버 선택, Protobuf 전송 포맷, 로컬 npm 배포 절차를 안내한다.

---

## 서비스 포트

| 서비스 | 포트 |
|--------|------|
| ingest-server | 3200 |
| registry-service | 3300 |
| gate-service | 3400 |
| query-service | 3500 |
| decode-service | 3600 |
| definition-service | 3700 |
| motion-workspace | 3710 |
| decision-service | 3800 |
| gRPC debug | 50051 (`GRPC_PORT` 설정 시) |

## Cloudflare Workers 배포

| 서비스 | URL | 번들 크기 |
|--------|-----|----------|
| decode-service | https://qa-decode-service.astralclover.workers.dev | 391 KiB (73 KiB gzip) |
| gate-service | https://qa-gate-service.astralclover.workers.dev | 292 KiB (53 KiB gzip) |
| query-service | https://qa-query-service.astralclover.workers.dev | 810 KiB (142 KiB gzip) |

- Workers 호환 패키지: `index-meta-workers` (Node.js 전용 드라이버 제외)
- 배포 후 endpoint가 `cloudflare-prod.json`에 자동 기록

## Service Profile (서비스 URL 중앙 관리)

- `~/.qa-sdk/service-profile.json` — 모든 CLI 명령의 서비스 URL 소스
- `qa-sdk service mode local|staging|prod` — 전체 URL 일괄 전환
- `qa-sdk service mode --set <serviceId>=<url>` — 개별 URL 커스텀
- URL 우선순위: **환경변수 > --flag > service-profile > local 기본값**
- `ingest mode`는 `service mode`의 alias (하위 호환)
- `service-profile.ts` (`cli/src/lib/`) — `getServiceUrl(serviceId)` 공용 유틸. 새 CLI 명령에서 URL 하드코딩 금지

## Ingest Store Driver (STORE_DRIVER)

| 드라이버 | 설정 | 비고 |
|---------|------|------|
| `memory` | (기본) | D1+`:memory:` 자동 업그레이드, insights 활성. 실패 시 InMemory fallback |
| `pg` | `TRACE_DATABASE_URL` 필수 | Drizzle + PostgreSQL (운영, `packages/store`) |
| `d1` | `SQLITE_PATH` | D1/SQLite via SqlDriver (CF Workers) |
| `clickhouse` | `CLICKHOUSE_URL` | ClickHouse RecordStore (대량 분석) |

- D1 store: 4개 core (Record, Trace, Session, Verdict) + 나머지 InMemory
- ClickHouse store: RecordStore만 구현, 나머지 InMemory
- `store-factory.ts`에서 드라이버 선택 + 생성
- 상세: `docs/specs/ingest/ingest-infra-system/ingest-store-drivers.todo.md`

## Insights Driver (INSIGHTS_DRIVER)

| 드라이버 | 설정 | 비고 |
|---------|------|------|
| `local` | (기본) | DrizzleInsightsStore (SQLite) |
| `app-hub` | `APP_HUB_ENDPOINT`, `APP_HUB_PROJECT_ID`, `APP_HUB_CREDENTIAL` | AppHubInsightsStore (Google App Hub) |

- `InsightsStore` 포트: `ingest-server/src/ports/insights-store.port.ts` — 읽기 12메서드 + `collect()` 쓰기
- local 모드: ingest pipeline이 같은 SQLite DB에 기록, `collect()` no-op
- app-hub 모드: `collect()`에서 App Hub API로 전달, 읽기도 App Hub
- 프로필: `~/.qa-sdk/service-profile.json` — CLI `qa-sdk service mode local|prod`로 전환
- fail-open: insights 수집 실패가 ingest 파이프라인을 차단하지 않음
- memory 모드에서 D1+`:memory:` 자동 업그레이드 — insights 기본 활성화
- D1 초기화 실패 시 순수 InMemory fallback (insights 비활성)
- 상세: `docs/specs/ingest/insights-api-spec.md`

## Protobuf 전송 (codec-proto)

### 전송 포맷

| 포맷 | Content-Type | 감지 |
|------|-------------|------|
| JSON (기본) | `application/json` | — |
| QAPB (레거시) | `application/x-protobuf` | QAPB magic header 있음 |
| 진짜 Protobuf | `application/x-protobuf` | QAPB magic 없음 |

- ingest-server가 자동 감지: QAPB magic 있으면 QAPB, 없으면 진짜 protobuf

### 패키지

- `@qa-sdk/codec-proto`: `encodeEnvelope(json) → Uint8Array`, `decodeEnvelope(binary) → json`

### 성능

| 지표 | JSON | Protobuf |
|------|------|----------|
| 크기 (per record) | 642B | 265B (55% 절감) |
| encode 속도 | — | 178K ops/s |
| decode 속도 | — | 102K ops/s |

### 선택 가이드

- 로컬 → JSON
- 인터넷 경유 → Proto
- 대량 아카이빙 → Proto

## Verdaccio 로컬 npm 배포

```bash
pnpm registry        # Verdaccio 시작 (localhost:4873)
pnpm publish:local   # 14개 패키지 배포
```

소비자:
```bash
echo "registry=http://localhost:4873" > .npmrc
pnpm install @qa-sdk/core
```
