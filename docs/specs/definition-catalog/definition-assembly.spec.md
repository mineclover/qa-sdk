---
def:
  id: definition-assembly
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: definition-service
  tags: [structural]
  links:
    - target: definition-catalog-spec
      type: refines
    - target: definition-extraction
      type: depends_on
sources:
  - packages/definition-catalog/src/assemble.ts
  - packages/definition-catalog/src/assemble.test.ts
  - packages/definition-catalog/src/extract.ts
  - packages/definition-catalog/src/concern.ts
  - packages/definition-catalog/src/frontmatter.ts
  - packages/definition-catalog/src/registry.ts
---
# Definition Assembly — 문서 조립

## 목적 ^purpose

그룹의 contains 멤버를 purpose/overview 수준으로 조립한다. 그룹 문서의 목적 + 멤버별 scope/purpose를 scope 순서로 정렬하여 하나의 컨텍스트로 결합한다.

## 정의 ^defines

- assembleFeature() — 그룹 조립 함수
- assembleBoundary() — 바운더리 직접 구조/결합 조립 함수
- scope 정렬 순서 (constraint→state→data→feature→flow→interface→ui)
- 구조 멤버 링크: `contains`, `refs`
- 직접 결합 링크: `depends_on`, `constrains`, `refines`

## 소비 ^consumes

- extraction (extract.ts) — 마커 기반 섹션 추출
- registry (registry.ts) — contains 링크 탐색

## API ^api-surface

```typescript
const assembled = assembleFeature("gate-system", getEntry, getLinks, getBody, "purpose");
// → 그룹 purpose + 멤버별 { scope, purpose } (scope 순서 정렬)
```

## scope 정렬 순서 ^constraint

constraint → state → data → feature → flow → interface → ui
(제약이 뭐고 → 상태가 뭐고 → 기능이 뭐고 → 어떻게 접근하는가)

정렬 순서에 없는 scope는 뒤로 밀린다.

## 관련 소스

- `packages/definition-catalog/src/assemble.ts` — assembleFeature, assembleBoundary
- `packages/definition-catalog/src/assemble.test.ts` — gate-system 조립, boundary direct coupling 검증
- `packages/definition-catalog/src/extract.ts` — 마커 추출 (의존)
