---
name: ingest-insights
description: "인사이트 수집/조회 관리. 모드 전환(dev/prod), 데모 이벤트 전송, prefix 사용률/convergence 메트릭/공출현 분석 조회. 트리거: 'ingest insights', '인사이트 조회', '사용률 측정', 'prefix 사용률', '모드 전환', 'ingest mode', 'insights 확인', '수집 설정', '데모 이벤트'"
---

# Ingest Insights

인사이트 수집 파이프라인을 관리한다. 모드 전환, 데모 이벤트 전송, 사용률 측정 결과를 조회한다.

## 1. 모드 확인/전환

```bash
# 현재 프로필 확인
node packages/cli/dist/index.js ingest mode

# 개발 모드 (local SQLite)
node packages/cli/dist/index.js ingest mode dev

# 프로덕션 모드 (App Hub)
node packages/cli/dist/index.js ingest mode prod

# 개별 설정 변경
node packages/cli/dist/index.js ingest mode --set appHub.projectId=my-project
node packages/cli/dist/index.js ingest mode --set insightsDriver=app-hub
```

**프로필 구조** (`~/.qa-sdk/ingest-profile.json`):
- `mode`: dev | staging | prod
- `insightsDriver`: local | app-hub
- `registry`, `ingest`: 서비스 URL
- `appHub`: endpoint, projectId, credential

서버는 시작 시 프로필 파일을 읽어 `INSIGHTS_DRIVER` 기본값으로 사용한다. 환경변수가 명시 설정된 경우 프로필보다 우선.

## 2. 인사이트 조회

```bash
# 종합 인사이트 (요약 + 서비스별 prefix + 공출현)
node packages/cli/dist/index.js ingest insights

# 서버 직접 조회 (curl)
curl http://localhost:3200/v1/insights/summary
curl http://localhost:3200/v1/insights/service-prefixes
curl http://localhost:3200/v1/insights/correlations
curl http://localhost:3200/v1/insights/prefixes
curl http://localhost:3200/v1/insights/coverage
curl http://localhost:3200/v1/insights/flows
curl http://localhost:3200/v1/insights/timeline
curl http://localhost:3200/v1/insights/errors
```

## 3. 데모 이벤트 전송

```bash
# 단일 이벤트
node packages/cli/dist/index.js ingest send page_view --dim page_view=page_view:v1:42

# 서비스 지정
node packages/cli/dist/index.js ingest send order.created --service shopping-backend

# 서버 상태 확인
node packages/cli/dist/index.js ingest health
node packages/cli/dist/index.js ingest status
```

## 4. 인사이트 항목 해석

| 항목 | 의미 | 핵심 지표 |
|------|------|----------|
| **summary** | 전체 수집 현황 | traces, records, sessions, services |
| **service-prefixes** | 서비스별 prefix 사용 | ownedPrefixes 대비 실제 관측 gap |
| **correlations** | prefix 공출현 (Jaccard) | >= 0.5이면 IntentLink 후보 |
| **coverage** | 이벤트 카테고리별 커버리지 | navigation, outcome, session 등 |
| **flows** | trace별 이벤트 시퀀스 | 사용자 행동 패턴 |
| **errors** | 에러 이벤트 히스토리 | 서비스별/코드별 분포 |

## 5. InsightsStore 아키텍처

```
INSIGHTS_DRIVER=local
  쓰기: ingest pipeline → RecordStore/TraceStore → SQLite
  읽기: InsightsStore.get*() → DrizzleInsightsStore → 같은 SQLite
  collect(): no-op

INSIGHTS_DRIVER=app-hub
  쓰기: ingest pipeline → local stores + InsightsStore.collect() → App Hub API
  읽기: InsightsStore.get*() → AppHubInsightsStore → App Hub API
  collect(): 외부 전달 (fail-open)
```

**핵심 파일:**
- `packages/ingest-server/src/ports/insights-store.port.ts` — 포트 인터페이스
- `packages/ingest-server/src/stores/drizzle-insights-store.ts` — SQLite 구현체
- `packages/ingest-server/src/stores/app-hub-insights-store.ts` — App Hub 스텁
- `packages/ingest-server/src/routes/insights.ts` — 라우트 (store 위임)
- `packages/ingest-server/src/config/env.ts` — INSIGHTS_DRIVER + 프로필 로딩

## 문제 해결

```bash
# insights 라우트가 404 → insightsStore가 미초기화
# SQLITE_PATH 또는 STORE_DRIVER=d1 설정 필요
SQLITE_PATH=:memory: node packages/ingest-server/dist/server.js

# App Hub 연결 실패 → fail-open이므로 수집은 계속됨
# 로그에서 "insights collect failed" 확인 후 credential/endpoint 검증
```
