---
def:
  id: permission-model
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  tags: [security]
---
# 권한 모델

## 목적 ^purpose

PermissionSet(권한 집합), TernaryMask(3진 마스크: allow/deny/unset), ScopedEngine(범위 해소)의 3개 코어 타입으로 구성된 권한 상태 모델.

## 구성 ^overview

PermissionSet: 닫힌 권한 공간의 bitmask 표현.
TernaryMask: allow/deny/unset 3진 논리.
ScopedEngine: 계층 상속 + 스코프 경계에서의 권한 해소.

## 상태 정의 ^state-def

- PermissionSet: 권한 ID 집합 → bitmask 압축
- TernaryMask: 각 비트에 allow(1)/deny(-1)/unset(0) 3진 값
- ScopedEngine: 상위 스코프 → 하위 스코프 상속, 하위에서 override 가능
