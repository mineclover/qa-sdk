---
def:
  id: browser-capture-contract
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [tier-frontend]
  links:
    - target: auto-capture-spec
      type: refines
---

# 브라우저 자동 수집 계약

## 목적 ^purpose

opt-in DOM 이벤트 자동 수집의 함수 시그니처, 수집 모드, cleanup 규칙을 분리해 브라우저 SDK의 수집 경계를 명확히 한다.

## 수집 모드

- 자동 수집은 명시적으로 켠 이벤트만 기록해 예기치 않은 데이터 폭증을 막아야 한다.
- 함수 시그니처는 대상 이벤트, 필터, cleanup 핸들을 함께 노출해야 한다.
- cleanup은 페이지 전환과 언마운트 경계에서 중복 등록을 막는 필수 단계다.
