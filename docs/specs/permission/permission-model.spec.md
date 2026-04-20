---
def:
  id: permission-model
  tier: system
  scope: state
  aspect: domain_state
  depth: overview
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [security, structural]
  links:
    - target: perm-resource-model
      type: contains
    - target: perm-service-ref
      type: contains
    - target: permission-model-permission-set
      type: contains
    - target: permission-model-ternary-mask
      type: contains
    - target: permission-model-scoped-engine
      type: contains
    - target: permission-model-composition
      type: contains
---
# 권한 모델

## 목적 ^purpose

PermissionSet, TernaryMask, ScopedEngine의 3개 코어 타입과 그 조합 관계를 한 모듈로 정리한다. 닫힌 권한 공간, 3진 판정, 스코프 해소가 어떻게 결합되어 최종 권한 상태를 이루는지 설명한다.

## 구성 ^overview

- `permission-model-permission-set`: 닫힌 권한 공간을 bitmask로 압축하는 `PermissionSet` 모델.
- `permission-model-ternary-mask`: allow/deny/unset 3상태를 표현하는 `TernaryMask` 모델.
- `permission-model-scoped-engine`: env/region 같은 외부 컨텍스트에서 독립 scope를 관리하는 `ScopedEngine`.
- `permission-model-composition`: 세 타입의 조합 관계와 PermissionSet migration의 경계.

## 모델 요약

```text
PermissionSet   → 권한 공간 정의
TernaryMask     → allow/deny/unset 판정 논리
ScopedEngine    → scope 계층에서의 해소
```

이 3개를 조합하면 “권한 공간을 어떻게 표현하고, 어떻게 해석하며, 어떤 범위에서 적용하는가”를 분리할 수 있다.

## 상태 정의 ^state-def

- PermissionSet: 권한 ID 집합 → bitmask 압축
- TernaryMask: 각 비트에 allow(1)/deny(-1)/unset(0) 3진 값
- ScopedEngine: 상위 스코프 → 하위 스코프 상속, 하위에서 override 가능

## 관련 문서

| 문서 | 역할 |
|------|------|
| `permission-model-permission-set` | bitmask 기반 권한 공간 |
| `permission-model-ternary-mask` | 3상태 판정 모델 |
| `permission-model-scoped-engine` | 스코프 해소 엔진 |
| `permission-model-composition` | 조합 관계 + migration |
