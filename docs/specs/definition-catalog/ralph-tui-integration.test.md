---
def:
  id: ralph-tui-integration-test
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  type: spec
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: mediation
  svc: ralph-tui-integration
  links:
    - target: ralph-tui-integration
      type: verifies
    - target: deterministic-label-architecture
      type: traces_to
sources:
  - packages/ralph-tui-integration/src/ralph-session.ts
  - packages/ralph-tui-integration/src/ralph-session.test.ts
  - packages/ralph-tui-integration/src/ralph-prd-json.ts
  - packages/ralph-tui-integration/src/ralph-prd-json.test.ts
  - packages/ralph-tui-integration/src/completed-ralph-prd.ts
  - packages/ralph-tui-integration/src/completed-ralph-prd.test.ts
---

# ralph-tui-integration — 테스트 명세

## 목적 ^purpose

`ralph-tui-integration` 패키지의 세션 어댑터, PRD JSON 파싱, 완료 감지 기능이 ralph-tui의 요구사항과 호환되는지 검증한다.

## 테스트 시나리오 ^overview

### 1. Ralph 세션 연동 (ralph-session)
- `.ralph-tui/session-meta.json` 파일의 올바른 로딩 및 Envelope 변환
- 세션 메타데이터의 transient 스탬프 부여 검증

### 2. Ralph PRD JSON (ralph-prd-json)
- Flat-root JSON 포맷의 PRD 파싱 및 Task 투영
- 유효하지 않은 JSON 스키마에 대한 방어 로직

### 3. 완료 감지 (completed-ralph-prd)
- Ralph 특화 완료 마커 및 PRD JSON 상태 결합 감지
- Markdown PRD와 JSON 실행 기록 간의 정합성 확인
