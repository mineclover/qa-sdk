---
def:
  id: document-addressing-contract
  level: leaf
  tier: component
  scope: data
  aspect: domain_data
  depth: specification
  layer: operation
  tags: [cross-scope, structural]
  links:
    - target: definition-taxonomy
      type: depends_on
    - target: doc-type-convention
      type: depends_on
    - target: taxonomy-boundaries
      type: depends_on
---

# Document Addressing Contract — 메모

## 목적 ^purpose

문서를 여러 taxonomy의 교차점으로 다루고, 비즈니스 분해 좌표계를 중심으로 taxonomy 간 해석을 통합하는 청사진의 원본 메모.

상세 내용은 개념 단위로 분할하여 `docs/plan/taxonomy-coordinate-system/`에서 관리한다.

## 청사진 문서 ^overview

| 문서 | 개념 |
|------|------|
| [purpose.md](../../plan/taxonomy-coordinate-system/purpose.md) | 전체 청사진 목적과 구조 |
| [meta-taxonomy.memo.md](../../plan/taxonomy-coordinate-system/meta-taxonomy.memo.md) | taxonomy 분류군 (topological/functional/bridge) |
| [taxonomy-interpretation-model.memo.md](../../plan/taxonomy-coordinate-system/taxonomy-interpretation-model.memo.md) | taxonomy 고유 기여: 입력 → 관점 → 산출 |
| [business-decomposition-coordinate.memo.md](../../plan/taxonomy-coordinate-system/business-decomposition-coordinate.memo.md) | 비즈니스 분해 좌표계, fold/algebra 패턴 |
| [coordinate-matrix.memo.md](../../plan/taxonomy-coordinate-system/coordinate-matrix.memo.md) | 좌표 행렬, taxonomy 흐름의 수학적 표현 |
| [document-addressing-contract.memo.md](../../plan/taxonomy-coordinate-system/document-addressing-contract.memo.md) | 문서 주소 계약, family/role, identity/path 분리 |
| [link-tag-redesign.memo.md](../../plan/taxonomy-coordinate-system/link-tag-redesign.memo.md) | links/tags 재설계 방향 |

## 관련 spec

- `docs/specs/system/meta-taxonomy.spec.md` — taxonomy 분류군 정의 (코드 반영 완료)
