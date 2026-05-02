---
def:
  tier: component
  id: dec-svc-state-model
  address: def_document:v2:205953
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  layer: operation
  svc: decision-service
  tags: [ decision]
  links:
    - target: decision-service-system
      type: refines
---
# Decision Service — 상태 모델

## 목적 ^purpose

FlowInstance의 상태 전이와 FlowSchema의 버전 관리 규칙을 정의한다.

## 구성 ^overview

### FlowInstance 상태 전이

```
(없음) → active → completed
                → abandoned (타임아웃/취소)
```

| 상태 | 의미 | gate 선택 가능 |
|------|------|---------------|
| active | 진행 중 — gate 순차 선택 | ✓ |
| completed | 모든 gate 선택 완료 | ✗ |
| abandoned | 타임아웃 또는 명시적 취소 | ✗ |

### 좌표 주소 계산

completed 시 selections 배열 → WeightedIndex 인코딩 → address 필드:

```
scope-expansion:
  gate[0] existing → exists (branch 0)
  gate[1] decision → expand (branch 0)
  → address = 0 × 2 + 0 = 0

  gate[0] existing → none (branch 1)
  gate[1] decision → defer (branch 1)
  → address = 1 × 2 + 1 = 3
```

### FlowSchema 버전

- version 필드 (v1, v2, ...)
- gate 추가/변경 시 새 버전 등록 (기존 버전 유지)
- instance는 특정 schema_version에 고정 (실행 중 스키마 변경 영향 없음)
