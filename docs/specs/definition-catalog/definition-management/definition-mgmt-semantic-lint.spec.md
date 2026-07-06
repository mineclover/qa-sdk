---
def:
  id: definition-mgmt-semantic-lint
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [observability, structural]
  sources:
    - packages/definition-catalog/src/semantic-lint.ts
    - packages/definition-catalog/src/validate-semantic.test.ts
    - packages/definition-catalog/src/taxonomy.ts
    - packages/definition-catalog/src/taxonomy.test.ts
  links:
    - target: definition-management
      type: refines
    - target: definition-mgmt-verification-loop
      type: depends_on
    - target: ms-concept-boundary
      type: depends_on
    - target: ms-concept-data-facets
      type: depends_on
    - target: ms-concept-verification-unit
      type: depends_on
    - target: scope-nesting-provider-patterns
      type: depends_on
---
# Definition Management — Semantic Lint Override

## 목적 ^purpose

구조 validator 위에 meta-semantic 기반 2층 lint를 얹는 규칙을 고정한다. 구조 규칙은 유지하되, 바운더리/패싯 분할 철학과 충돌하는 multi-parent와 contains-depth만 semantic override로 완화한다.

## 2층 모델

### 1층: structural graph lint

- broken-link
- circular-ref
- self-ref
- level-violation
- orphan
- multi-parent
- contains-depth

### 2층: semantic override

- concept link로 semantic family를 식별한다.
- 식별된 family 문서는 `multi-parent`와 `contains-depth`에서만 예외를 받을 수 있다.
- `level-violation`은 아직 structural error로 유지한다.

## family 식별 규칙

semantic family는 이름이나 경로가 아니라 graph traversal로 판정하며, seed와 traversal 규칙은 `taxonomy.ts`의 설정을 따른다.

- seed concept:
  - `meta-semantic-concepts`
  - `ms-concept-boundary`
  - `ms-concept-data-facets`
  - `ms-concept-verification-unit`
  - `ms-concept-contract-descent`
- allowed traversal:
  - `contains`
  - `depends_on`
  - `implements`
  - `refines`

즉 문서가 이 seed concept들에 graph로 연결돼 있으면 semantic override 대상이다.

## 현재 override 규칙

### multi-parent

- 부모 scope가 서로 다르고
- child 또는 parent들이 같은 semantic family에 연결돼 있으면
- warning을 생략할 수 있다

### contains-depth

- 기본 한도: 4
- semantic family overview/module 한도: 6

## 제외 규칙

- `cross-scope` 태그는 여전히 즉시 허용 신호다.
- `level-violation`은 semantic override를 아직 적용하지 않는다.
- 이름/경로 prefix만으로는 semantic family로 판정하지 않는다.

## 관련 소스

- `packages/definition-catalog/src/taxonomy.ts`
- `packages/definition-catalog/src/semantic-lint.ts`
- `packages/definition-catalog/src/validate.ts`
- `packages/definition-catalog/src/validate-semantic.test.ts`
