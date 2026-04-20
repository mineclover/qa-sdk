---
def:
  id: permission-model-composition
  level: leaf
  tier: component
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  layer: domain
  svc: permission-engine
  tags: [security]
  links:
    - target: permission-model
      type: refines
    - target: perm-migration-algorithm
      type: depends_on
    - target: permission-encoding
      type: depends_on
---
# 권한 모델 — 조합과 마이그레이션

## 목적 ^purpose

PermissionSet, TernaryMask, ScopedEngine이 최종 권한 상태를 어떻게 조합하는지와, PermissionSet shape migration이 어느 층에서 책임지는지를 정리한다.

## 구성 ^overview

- 3타입 조합 관계
- migration 경계
- 클라이언트 규칙

## 3타입 조합 관계

```text
PermissionSet   → 권한 공간 정의
TernaryMask     → 판정 논리
ScopedEngine    → 스코프 해소
```

이 셋을 합치면 다음 질문에 각각 답한다.

- 무엇이 가능한가? → PermissionSet
- 허용/거부/미설정은 무엇인가? → TernaryMask
- 어느 범위에서 적용되는가? → ScopedEngine

## 클라이언트 규칙

- 클라이언트는 role을 직접 확인하지 않는다.
- 서버가 role → flat permission mask로 resolve한다.
- 외부 서비스/리소스 식별자 규칙은 `perm-service-ref`, `perm-resource-model`이 소유한다.

## PermissionSet 마이그레이션

마이그레이션은 `perm-migration-algorithm` 계열이 담당한다.

- shape 변경
- entry 추가/비활성화
- 좌표 재배치
- backward compatibility 확인

권한 모델 문서는 migration의 상세 알고리즘이 아니라, migration이 필요한 이유와 조합 경계를 설명한다.
