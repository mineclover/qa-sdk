---
def:
  id: ingest-store-drivers-todo
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: operation
  links:
    - target: ingest-runtime-operations
      type: depends_on
---

# Ingest Store Drivers — 구현 TODO

## 목적 ^purpose

ingest-server의 미구현 store driver 현황을 추적한다.

## App Hub Insights Store — 방향 전환 (2026-04-05)

기존 계획: App Hub SDK 직접 연동 (collect, 읽기 12종, 환경변수)
→ **재검토**: infra-engine이 인프라 관측 파이프라인을 통합 관리하므로, App Hub 연동은 infra-engine을 소비하는 형태로 전환 검토.

- [ ] infra-engine의 IngestAdapter가 App Hub 경로를 대체하는지 평가
- [ ] 대체 가능 시: app-hub-insights-store.ts stub → infra-engine 클라이언트로 교체
- [ ] 대체 불가 시: 기존 App Hub SDK 직접 연동 진행 (아래 항목)

### App Hub 직접 연동 (infra-engine 대체 불가 시에만)

- [ ] `collect()` — App Hub API 배치 전송
- [ ] 읽기 메서드 12종 — App Hub API 쿼리
- [ ] `APP_HUB_ENDPOINT`, `APP_HUB_PROJECT_ID`, `APP_HUB_CREDENTIAL` 환경변수 연동
- [ ] App Hub SDK/API 클라이언트 구현

## ClickHouse Adapter — 미구현

코드: `packages/ingest-server/src/stores/store-factory.ts`

- [ ] ClickHouse RecordStore 외 나머지 store 구현
- [ ] `CLICKHOUSE_URL` 기반 연결 관리
- [ ] 대량 분석 쿼리 최적화

## 비고

- App Hub은 운영 모드(`INSIGHTS_DRIVER=app-hub`) 전환 시 필요
- ClickHouse는 대량 분석용 — 현재 local SQLite + D1으로 운영 가능
- 둘 다 fail-open 원칙 적용 (insights 실패가 ingest 차단 금지)
