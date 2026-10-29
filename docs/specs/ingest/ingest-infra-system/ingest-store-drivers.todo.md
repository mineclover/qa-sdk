---
def:
  id: ingest-store-drivers-todo
  tier: component
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: draft
  layer: operation
  links:
    - target: ingest-runtime-operations
      type: traces_to
  sources:
    - packages/ingest-server/src/stores/app-hub-insights-store.ts
    - packages/ingest-server/src/stores/runtime-stores.ts
    - packages/ingest-server/src/config/env.ts
---

# Ingest Store Drivers — 구현 TODO

## 목적 ^purpose

ingest-server의 미구현 store driver 현황을 추적한다.

## App Hub Insights Store — 보류 (2026-04-06)

infra-engine이 주력 인프라 관측 파이프라인. App Hub은 현재 미사용.
향후 App Hub 도입 시 infra-engine 하위 통합 또는 호환 레이어로 검토. 대체는 하지 않음.
기존 stub 코드(app-hub-insights-store.ts)는 유지.

### App Hub 직접 연동 (infra-engine 대체 불가 시에만)

- [ ] `collect()` — App Hub API 배치 전송
- [ ] 읽기 메서드 12종 — App Hub API 쿼리
- [ ] `APP_HUB_ENDPOINT`, `APP_HUB_PROJECT_ID`, `APP_HUB_CREDENTIAL` 환경변수 연동
- [ ] App Hub SDK/API 클라이언트 구현

## ClickHouse Adapter — 삭제됨

2026-10-29 삭제 — 런타임 미배선·server 모드 미지원 상태로 남아 있던 ClickHouse 어댑터를 핵심 기능 정리에서 제거. 구현은 git 이력 참고. `STORE_DRIVER=clickhouse`는 호환을 위해 값만 받고 경고 후 SQLite로 처리한다(`stores/runtime-stores.ts`). OLAP 분석 저장소가 다시 필요해지면 C baseline 이후 새 spec으로 시작한다.

## 비고

- App Hub은 운영 모드(`INSIGHTS_DRIVER=app-hub`) 전환 시 필요
- 운영 저장소는 local SQLite/D1 또는 PostgreSQL (ClickHouse 어댑터는 2026-10-29 삭제)
- 둘 다 fail-open 원칙 적용 (insights 실패가 ingest 차단 금지)
