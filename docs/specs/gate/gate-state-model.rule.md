---
def:
  id: gate-state-model-rule
  tier: component
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  layer: domain
  svc: gate-service
  tags: [security]
  links:
    - target: gate-state-model
      type: refines
---

# Gate State Model — 소비 규칙

## 목적 ^purpose

GateEngine 4-state 모델과 getPrefixProfile을 소비할 때 확인해야 하는 상태 전이 규칙, composite 규칙, capacity 프로파일 해석법을 정의한다.

---

## 1. 4-state 모델

| 상태 | encode | decode |
|------|--------|--------|
| `active` | ✓ | ✓ |
| `inactive` | ✗ | ✓ |
| `open` | ✓ | ✗ |
| `reserved` | ✗ | ✗ |

## 2. 소비 규칙

- composite AND: 어느 dim이라도 차단 → composite도 차단
- `inactive ∩ open → reserved` 자동 승격
- CON-006: prefix_ref refEntries 미정의 → unfilled positions = reserved
- deactivation 모드: strict(release 시만 recompute) / flexible(setFlag 시도 recompute)
- gate-service = 읽�� 전용 캐시. GateEngine 인스턴스 없음
- query-service = gate-service HTTP 클라이언트로 gate 상태 소비

## 3. getPrefixProfile API

```typescript
getPrefixProfile(catalog, prefixId, version?) → PrefixDimProfile
```

- 각 dim: `DimCapacityInfo { entries, capacity, headroom, stride }`
- prefix_ref: refEntries 있으면 `values.length`, 없으면 `undefined` (CON-006: 미완성 상태)
- `safePrecision`: totalSpace ≤ `MAX_SAFE_INTEGER`이면 true (CON-007)
- 타입명: `PrefixDimProfile` / `DimCapacityInfo` (spec-core `PrefixProfile`과 별개)
