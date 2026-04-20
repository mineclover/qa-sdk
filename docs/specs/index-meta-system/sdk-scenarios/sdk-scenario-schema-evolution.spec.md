---
def:
  id: sdk-scenario-schema-evolution
  level: leaf
  tier: component
  scope: feature
  aspect: scenario
  depth: validation
  svc: index-meta
  lifecycle: approved
  layer: domain
  tags: [testing, migration]
  links:
    - target: sdk-scenarios
      type: refines
    - target: dx-lifecycle-group
      type: traces_to
---
# SDK 시나리오 — 스키마 진화

## 목적 ^purpose

entry 추가, headroom 변화, 새 SDK 재생성, 구버전→신버전 마이그레이션이 전체 라이프사이클에서 일관되게 동작함을 검증한다.

## 구성 ^overview

- headroom 변화 감지
- capacity 유지/확장 구분
- immutable SDK 스냅샷
- 구버전 decode → 신버전 re-encode

## 검증 포인트

- headroom 내 entry 추가 시 capacity 유지
- 새 SDK를 생성해야 최신 상태가 반영됨
- 구버전 payload는 decode 후 재인코딩으로 migration 가능
- constants와 entries가 버전별로 다르게 보임
