---
def:
  id: qa-bridge-runtime
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  tags: [tier-frontend]
  links:
    - target: qa-bridge-spec
      type: refines
---

# QA Bridge 런타임

## 목적 ^purpose

roleplay-web의 사용자 폼 상호작용을 QA 이벤트로 변환하고 템플릿 렌더링과 오케스트레이션에 연결하는 런타임 계약을 정리한다.

## 이벤트 연결

- bridge는 UI 이벤트를 QA SDK가 이해하는 payload로 변환해 ingest 경로에 넘긴다.
- EventEmitter는 폼 컴포넌트와 QA 기록 계층 사이의 느슨한 결합 지점이다.
- 템플릿 렌더링과 main 통합은 이벤트를 만들 뿐 상태 저장을 소유하지 않는다.
