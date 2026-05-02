---
def:
  tier: component
  id: coord-states-versioning
  address: def_document:v2:206978
  scope: state
  aspect: system_state
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [runtime, versioning, structural]
  links:
    - target: coord-foundation
      type: depends_on
    - target: coord-states-group
      type: refines
---

# 좌표 상태 - 버전과 합성 규칙

## 목적 ^purpose

좌표 상태의 버전 스냅샷, diff, composite 주소 규칙과 불변식을 정리해 상태 변경이 주소 안정성을 깨지 않도록 안내한다.

## 버전 스냅샷과 diff

- 버전은 특정 시점의 활성 영역과 엔트리 구성을 고정한 스냅샷이다.
- diff는 단순 텍스트 비교가 아니라 어떤 축/엔트리가 활성 상태를 바꿨는지 계산하는 운영 도구다.
- 버전 비교 결과는 migration과 decode 호환성 판단의 직접 입력이 된다.

## composite 주소 규칙

- composite 주소는 여러 상태 축의 결합 결과이므로, 한 축의 차단이나 미완성 상태가 전체 주소 가용성에 전파된다.
- 상태 합성은 "현재 활성인 조합만 encode한다"는 보수적 규칙을 따른다.
- 미완성 계층은 문서 밖 책임으로 남기되, 현재 레이어에서 reserved/invalid를 명확히 구분해야 한다.

## 불변식

- 상태 변경은 기존 stable address를 되도록 보존하고, 불가피한 경우 버전 경계에서만 일어난다.
- 운영자는 상태 선언과 버전 선언을 분리하되, 둘 사이의 관계를 추적 가능하게 남겨야 한다.
- 분류 체계와 활성 영역 정의는 `coord-states-taxonomy`를 따른다.
