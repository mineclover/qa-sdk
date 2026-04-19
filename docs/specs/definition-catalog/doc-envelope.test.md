---
def:
  id: doc-envelope-test
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  type: spec
  scope: data
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: doc-envelope
  links:
    - target: doc-envelope
      type: verifies
    - target: deterministic-label-architecture
      type: contains
---

# doc-envelope — 테스트 명세

## 목적 ^purpose

`doc-envelope` 패키지의 핵심 로직인 완료 레코드 감지, family/scope 판정, TODO 라이프사이클 파싱 기능이 의도한 시나리오대로 동작하는지 검증한다.

## 테스트 시나리오 ^overview

### 1. 완료 레코드 감지 (completed-records)
- 유효한 완료 마커가 있는 문서 감지
- 중복된 완료 레코드 제거 로직 검증

### 2. Family/Scope 판정 (family-scope)
- 문서 경로 및 메타데이터 기반의 family ID 추출 정확도
- Scope 가시성 및 필터링 규칙 검증

### 3. TODO 라이프사이클 (todo-lifecycle)
- 마커 기반의 TODO 헤딩 분류 (Completed, Actionable, Deferred, Parking Lot)
- 체크박스 상태 카운팅 및 후속 작업 추출 로직
