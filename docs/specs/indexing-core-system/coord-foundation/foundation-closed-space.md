---
def:
  tier: component
  id: coord-closed-space
  address: def_document:v2:414853
  scope: data
  aspect: domain_data
  depth: specification
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [data, structural, runtime]
  links:
    - target: coord-foundation
      type: refines
---

# 닫힌 조합 공간

## 목적 ^purpose

WeightedIndex가 적용되는 **유한 차원의 판단 기준**과, 모든 인코딩이 겹침·빈 값 없이 전단사(bijection)를 보장하는 원리를 정의한다.

## 유한 차원 적합성

WeightedIndex는 **설계 시점에 상한이 고정된 유한 차원**에만 적용한다.

| 차원 종류 | 적합 | 이유 |
|---|---|---|
| 역할 수, 액션 수, 환경 수 | ✅ | 설계 시 고정된 유한 집합 |
| API 리소스 × 테넌트 조합 | ✅ | 차원 수가 사전에 확정됨 |
| 타임스텝 t (무한 증가) | ❌ | 상한 불명. 외부 Map으로 관리 |
| UUID, 레코드 ID | ❌ | 상한이 2^128 → size 초과 |

> **판단 기준**: 차원의 최댓값이 코드 작성 시점에 확정되지 않으면 WeightedIndex 차원이 아니다. 확정되지 않는 값은 외부에서 키로 관리하고, 그 키마다 독립된 WeightedIndex 공간을 운용한다.

## 전단사(bijection) 보장

모든 인코딩은 겹침 없고 빈 값 없는 전단사다. `[0, size-1]` 범위의 정수가 가능한 모든 조합에 1:1로 대응한다.

이것이 가능하게 하는 것:
- 역변환이 항상 가능하다 — 정수만 있으면 원래 좌표를 복원할 수 있다
- 비트마스크와 호환된다 — 조합 집합을 Uint8Array로 표현할 수 있다
- 범위 쿼리가 가능하다 — 특정 차원을 고정하면 나머지 차원의 조합을 계산할 수 있다
