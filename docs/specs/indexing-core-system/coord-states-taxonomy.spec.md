---
def:
  id: coord-states-taxonomy
  scope: state
  aspect: system_state
  depth: specification
  lifecycle: approved
  tags: [tier-infra]
  links:
    - target: coord-foundation
      type: depends_on
    - target: coordinate-states-spec
      type: refines
---

# 좌표 상태 - 분류와 활성 영역

## 목적 ^purpose

좌표 상태를 CORE/EXTENSION/PERIPHERAL, 데이터 출처, 활성 영역 선언으로 분류해 어떤 상태가 주소 공간을 실제로 점유하는지 설명한다.

## 상태 분류

- CORE는 주소 안정성과 계약을 직접 바꾸는 축과 엔트리다.
- EXTENSION은 핵심 구조를 깨지 않고 기능이나 해석 범위를 넓히는 층이다.
- PERIPHERAL은 관측, 디버그, 보조 도구처럼 핵심 공간 바깥에서 읽기 중심으로 붙는 상태다.

## 활성 영역 선언

- 데이터 출처별 축 분류는 운영자가 "어느 축이 언제 활성인지"를 명시하는 입력으로 쓰인다.
- 활성 영역은 현재 배포/버전에서 실제로 encode 가능한 상태 집합을 뜻한다.
- 이 선언이 있어야 query, decode, migration이 미완성 축을 정상 상태와 혼동하지 않는다.

## 책임 경계

- 이 문서는 상태가 무엇인지와 어떤 축이 현재 살아 있는지를 설명한다.
- 버전 스냅샷, diff, composite 규칙은 `coord-states-versioning`에서 다룬다.
