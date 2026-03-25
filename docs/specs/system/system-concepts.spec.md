---
def:
  id: system-concepts
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  tags: [entry-point]
---
# 핵심 개념

## 목적 ^purpose

이벤트, 좌표, 축(Axis), Prefix, prefix_ref — qa-sdk 좌표 시스템의 기본 개념을 정의한다.

## 구성 ^overview

이벤트: 서비스에서 발생하는 모든 행위의 기록(EventRecord).
좌표: 이벤트의 위치를 정수 하나로 압축.
축: 유한한 분류 차원(7값 role, 5값 env 등).
Prefix: 축의 조합으로 구성된 독립 주소 공간.
prefix_ref: prefix 간 참조(디코딩 시 참조된 차원이 펼쳐짐).
