---
def:
  id: def-svc-state-model
  level: leaf
  tier: component
  address: def_document:v2:205956
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  layer: operation
  svc: definition-service
  tags: [runtime, structural, observability]
  links:
    - target: definition-service-system
      type: refines
---
# Definition Service — 상태 모델

## 목적 ^purpose

문서 메타데이터의 생명주기(lifecycle)와 버전 관리 규칙을 정의한다.

## 구성 ^overview

### Lifecycle 상태 전이

```
draft → review → approved → deprecated → archived
  ↑                  │
  └──────────────────┘  (승인 취소 시 draft로 복귀)
```

| 상태 | 의미 | 문서 소비 가능 | 검증 대상 |
|------|------|---------------|----------|
| draft | 작성 중 | ✗ | ✗ |
| review | 검토 중 | △ (참고만) | ✗ |
| approved | 승인됨 | ✓ | ✓ (validate 대상) |
| deprecated | 폐기 예정 | ✓ (레거시) | ✗ (validate 제외) |
| archived | 보관 | ✗ | ✗ |

### 버전 관리

| 변경 유형 | changeType | version 변화 |
|----------|-----------|-------------|
| 신규 등록 | created | 1 |
| 본문 변경 | updated | +1 |
| 마커만 변경 | marker_edit | +1 |
| 메타데이터만 변경 | metadata_edit | +1 |
| 변경 없음 | unchanged | 유지 |

### Address 재계산

메타데이터 변경(scope, aspect, depth) 시 address가 자동 재계산된다:

```
PATCH /docs/gate-state-model { scope: "state", aspect: "domain_state", depth: "specification" }
  → computeDocumentAddress("state", "domain_state", "specification")
  → def_document:v1:2185
  → DB address 컬럼 갱신 + POST /sync/to-files에서 frontmatter에 반영
```
