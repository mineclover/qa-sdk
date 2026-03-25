---
def:
  id: rlsc-integration
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  tags: [tier-frontend]
  links:
    - target: rlsc-spec
      type: refines
---

# RLSC 통합 경로

## 목적 ^purpose

RLSC를 context engineering, 기존 좌표계, API 요약, 패키지 구조와 연결하는 통합 경로를 정리한다.

## 통합 원칙

- context engineering은 시각 DSL이 생성/수정 워크플로에 어떻게 쓰이는지 설명하는 레이어다.
- 기존 좌표계 통합은 RLSC가 별도 저장소를 갖는 대신 qa-sdk 좌표 인프라를 재사용하는 방향을 따른다.
- API와 패키지 구조는 모델 계층과 런타임 계층을 섞지 않고, 사용 지점을 명확히 나눈다.
