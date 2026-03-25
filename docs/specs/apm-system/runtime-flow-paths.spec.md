---
def:
  id: runtime-flow-paths
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: runtime-flows-spec
      type: refines
---

# 런타임 흐름 경로

## 목적 ^purpose

운영 시나리오를 동기 처리, 비동기 수집/집계, 실시간 디버깅 경로로 나눠 각 단계의 책임과 참여 모듈을 정리한다.

## 경로 분리

- 동기 처리 경로는 호출 응답에 필요한 최소 저장과 확인 단계를 책임진다.
- 비동기 경로는 수집 후 집계, 재구성, 후처리처럼 시간이 걸리는 작업을 분리한다.
- 실시간 디버깅 경로는 운영자 관찰성과 문제 재현을 위해 별도 심볼과 스트림을 유지한다.

## 참여 모듈

- 각 경로는 같은 이벤트를 다루더라도 필요한 저장소, 집계기, 디버거 UI가 다르므로 모듈 참여 맵을 따로 둔다.
- 데이터 유형별 흐름 매핑은 경로를 바꾸지 않고 어떤 모듈을 거치는지만 추가 설명한다.
