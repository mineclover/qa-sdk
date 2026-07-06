---
status: draft
sources:
  - packages/taxonomy-engine/src/schema/ir.ts
  - packages/taxonomy-engine/src/parser/index.ts
  - packages/taxonomy-engine/src/validate/index.ts
  - packages/taxonomy-engine/src/indexer/index.ts
  - packages/taxonomy-engine/src/query/walk-by-coordinate.ts
  - packages/taxonomy-engine/src/query/walk-relation.ts
  - packages/taxonomy-engine/__tests__/dogfooding.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-def-catalog.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-lesson-builder.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-dkg.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-ingest.test.ts
  - docs/taxonomies/qa-sdk-coordinate-system.yaml
  - docs/taxonomies/qa-sdk-def-catalog.yaml
  - docs/taxonomies/lesson-builder-content.yaml
  - docs/taxonomies/dkg-schema.yaml
  - docs/taxonomies/ingest-coords.yaml
  - docs/specs/system/meta-taxonomy.spec.md
  - docs/specs/system/dual-coordinate-system.spec.md
---

# Links/Tags 재설계

## 목적

현재 `links`와 `tags`에 혼합된 세 가지 용도를 분리하여, 각각의 역할을 명확히 한다.

## 현재 상태

| 현재 | 실제 용도 | 문제 |
|------|----------|------|
| `links` (depends_on, refines...) | taxonomy 내 관계 + taxonomy 간 연결 혼합 | 같은 형식으로 다른 성격의 관계가 뒤섞임 |
| `tags` (cross-scope, structural...) | taxonomy 간 교차 표시 + 속성 태깅 혼합 | 교차 선언과 속성이 구분되지 않음 |

## 분리 대상

### 1. taxonomy 내 관계

같은 taxonomy 안에서의 상하·의존 관계.

- `contains` — 그룹이 멤버를 포함
- `refines` — 상위 개념을 구체화
- `depends_on` — 같은 taxonomy 내 의존

### 2. taxonomy 간 교차 선언

문서가 참여하는 다른 taxonomy의 좌표. 현재 암묵적으로만 존재.

- "이 definition 문서는 structural의 boundary:ingest에 속한다"
- "이 spec은 df의 DecisionUnit:수집방식결정에서 산출되었다"

### 3. 속성 태깅

관심사, 특성 등 분류 보조 (cross-cutting concerns).

- `security`, `performance`, `observability` 등 concern 태그
- `cross-scope`, `entry-point` 등 구조 태그

## 재설계 방향

taxonomy 간 교차 선언이 가장 큰 변화. 현재 links/tags로 간접 표현되는 것을 명시적 체계로 만들어야 한다.

좌표 행렬(`coordinate-matrix.memo.md`)의 결합 벡터가 이 교차 선언의 수학적 표현이 된다.

## 미해결 질문

1. 교차 선언의 표현 형식 — frontmatter에 각 taxonomy 좌표를 명시할지, 별도 매핑으로 둘지
2. 기존 links/tags와의 역호환 — 마이그레이션 경로
3. concern 전파 규칙의 위치 — taxonomy 내 관계에 속하는지 별도 체계인지
