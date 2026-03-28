---
def:
  id: dx-lifecycle-tooling
  address: def_document:v1:1065
  scope: flow
  aspect: user_scenario
  depth: specification
  lifecycle: approved
  layer: operation
  svc: index-meta
  tags: [tier-infra]
  links:
    - target: index-codec-spec
      type: refines
    - target: dx-lifecycle-spec
      type: refines
---

# Index Meta DX - 도구 동선

## 목적 ^purpose

index-meta 사용자가 문제를 인지하고 CLI와 codegen을 통해 해결하는 전체 도구 동선을 정리한다.

## DX 흐름

- 문제 정의는 "원시 주소 공간을 사람이 다룰 수 있는 형태로 바꾼다"는 요구에서 출발한다.
- CLI는 registry와 schema를 탐색하는 진입점이고, codegen은 그 결과를 애플리케이션 코드로 고정하는 단계다.
- 사용자는 메타데이터를 직접 조합하기보다, 일관된 도구 흐름을 따라 안전한 기본값을 얻어야 한다.

## 운영 포인트

- DX는 단일 명령의 편의보다 "같은 입력에서 같은 출력이 나오는가"를 우선한다.
- CLI와 codegen은 모두 `index-codec-spec`이 제공하는 해석 모델과 어긋나지 않아야 한다.
- 와이어 포맷과 타입 추론 같은 소비자 계약은 `dx-lifecycle-contract`에서 이어서 다룬다.
