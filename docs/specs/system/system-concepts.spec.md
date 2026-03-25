---
def:
  id: system-concepts
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  tags: [entry-point]
  links:
    - target: coord-foundation
      type: depends_on
---

# 핵심 개념

## 목적 ^purpose

이벤트, 좌표, 축(Axis), Prefix, prefix_ref — qa-sdk 좌표 시스템의 기본 개념을 정의한다.

## 구성 ^overview

overview: 총 5개 멤버.
- `이벤트`: 서비스에서 발생하는 모든 행위를 EventRecord로 기록하는 기본 단위를 정의한다.
- `좌표`: 이벤트의 위치를 정수 하나로 압축하는 주소 모델을 설명한다.
- `축`: role, env 같은 유한한 분류 차원을 Axis로 정의한다.
- `Prefix`: 여러 축의 조합으로 구성된 독립 주소 공간을 설명한다.
- `prefix_ref`: 다른 prefix 주소를 참조해 디코딩 시 차원을 펼치는 연결 방식을 정의한다.
좌표: 이벤트의 위치를 정수 하나로 압축.
축: 유한한 분류 차원(7값 role, 5값 env 등).
Prefix: 축의 조합으로 구성된 독립 주소 공간.
prefix_ref: prefix 간 참조(디코딩 시 참조된 차원이 펼쳐짐).
