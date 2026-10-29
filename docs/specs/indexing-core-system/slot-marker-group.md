---
def:
  id: slot-marker-group
  tier: system
  address: def_document:v2:342031
  scope: data
  aspect: domain_data
  depth: overview
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [structural, cross-scope]
  links:
    - target: slot-marker-concept
      type: contains
    - target: slot-marker-patterns
      type: contains
    - target: slot-marker-capacity
      type: contains
    - target: indexing-core-system
      type: depends_on
sources:
  - packages/index-meta/src/index-sdk.ts
  - packages/index-meta/src/table-def.ts
  - packages/index-meta/src/table-def.test.ts
  - packages/index-meta/src/compile-schema.ts
  - packages/index-meta/src/compile-schema.test.ts
  - packages/index-meta/src/invalid-ranges.ts
  - packages/index-meta/src/invalid-ranges.test.ts
  - packages/index-meta/src/gate-engine.ts
  - packages/index-meta/src/gate-engine.test.ts
  - packages/index-meta/src/version-lifecycle.ts
  - packages/index-meta-store/src/version-lifecycle.test.ts
  - packages/index-meta/src/migrate-address.ts
  - packages/index-meta/src/migrate-address.test.ts

---

# 슬롯 마커 시스템

## 목적 ^purpose

닫힌 축 패턴에서 열린 상황(미분류 항목)을 처리하는 슬롯 마커 시스템.

## 구성 ^overview

- `slot-marker-concept`: 슬롯 마커의 개념.
- `slot-marker-patterns`: 슬롯 마커의 실제 사용 패턴.
- `slot-marker-capacity`: 슬롯 마커가 용량(capacity)에 미치는 영향.

| 문서 | 핵심 |
|------|------|
| [slot-marker-concept](slot-marker-concept.spec.md) | 닫힌 축에서 '기타(other)' 항목을 명시적으로 표현하는 설계 패턴 |
| [slot-marker-patterns](slot-marker-patterns.spec.md) | 카테고리 외 항목 수집 전략과 테스트 패턴 |
| [slot-marker-capacity](slot-marker-capacity.spec.md) | headroom 계산과 reserved slot 규칙 |

## 관련 스펙

- [`weighted-index`](../indexing/weighted-index/README.md) — 수학 레이어 (마커를 일반 좌표로 처리)
- [`index-meta`](../indexing/index-meta/README.md) — 스키마 레이어 (마커를 일반 entry로 처리)
