---
def:
  id: structural-taxonomy
  type: spec
  tier: system
  scope: data
  aspect: taxonomy_data
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [cross-scope, structural, entry-point]
  links:
    - target: meta-semantic-concepts
      type: depends_on
    - target: scope-nesting-system
      type: traces_to
    - target: concept-hierarchy-grid
      type: traces_to
    - target: definition-taxonomy
      type: depends_on
  sources:
    - packages/core/src/meta-semantic/ir-types.ts
    - packages/core/src/pipe/data-contract.ts
    - packages/definition-catalog/src/types.ts
    - docs/specs/meta-semantic/meta-semantic-concepts.spec.md
    - docs/specs/scope-nesting/scope-nesting-system.md
    - docs/specs/viz-system/viz-surface-system/concept-hierarchy-grid.spec.md
    - docs/specs/definition-catalog/definition-taxonomy.spec.md
---

# Structural Taxonomy — 실제 단위와 배열의 분류 체계

## 목적 ^purpose

qa-sdk의 실제 작업 단위를 형성하는 구조 축을 정의한다. 이 taxonomy는 무엇이 존재하는지(facet/boundary)와 그 단위가 어떻게 계약적으로 배열되는지(runtime scope/nesting)를 다룬다.

## 방법 ^method

structural taxonomy는 두 단계로 읽는다.

1. **형성 축**
   데이터 패싯이 역할을 분리하고, boundary가 패싯 일부를 가진 검증 가능한 기능 단위로 형성된다.
2. **배열 축**
   형성된 boundary를 runtime scope로 투영하고, contract descent와 nesting 순서로 상위 → 하위 배열을 만든다.

즉 structural taxonomy는 `형성(facet/boundary) → 배열(scope-nesting)`의 구조를 소유한다.

## 정의 ^defines

- `facet` — 데이터 역할 분리 규칙
- `boundary` — 패싯 일부를 가진 검증 가능한 기능 단위
- `runtime scope` — 계약을 소유하는 boundary의 배열 단위
- `contract descent` — 상위에서 하위로 계약이 내려가는 규칙
- `nesting` — scope의 중첩 순서

## 소비 ^consumes

- `meta-semantic-concepts` — facet/boundary/contract descent 개념
- `scope-nesting-system` — runtime scope와 nesting 검증
- `definition-taxonomy` — structural unit를 어떤 인지 관점으로 기록할지 분리할 때 사용

## 구성 ^overview

| 층 | 질문 | 핵심 문서 |
|---|---|---|
| 형성 | 어떤 단위가 실제로 존재하는가 | `meta-semantic-concepts` |
| 배열 | 그 단위가 어떻게 계약적으로 중첩되는가 | `scope-nesting-system` |
| 문서화 브리지 | 그 단위를 어떤 관점에서 기록하는가 | `definition-taxonomy` |

## 경계 규칙 ^constraint

- structural taxonomy는 문서 진입점 분류를 소유하지 않는다. 그것은 definition taxonomy의 책임이다.
- structural taxonomy는 owner, due date, priority, milestone을 소유하지 않는다. 그것은 PM taxonomy의 책임이다.
- structural taxonomy는 판단의 인지 단계, 근거 종류, mental model을 소유하지 않는다. 그것은 decision-flow taxonomy의 책임이다.
- `runtime scope`와 `definition scope`는 같은 단어를 쓰지만 같은 축이 아니다.
- structural taxonomy는 package surface manifest를 직접 소유하지 않는다. surface 배정은 `package-surface-separation-rule`과 `scripts/package-surfaces.mjs`가 검증한다.

## 관련 소스

- `docs/specs/meta-semantic/meta-semantic-concepts.spec.md`
- `docs/specs/scope-nesting/scope-nesting-system.md`
- `docs/specs/viz-system/viz-surface-system/concept-hierarchy-grid.spec.md`

## 검증 ^validation

```bash
node packages/cli/dist/index.js def validate
corepack pnpm arch:verify
```
