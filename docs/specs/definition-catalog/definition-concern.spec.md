---
def:
  id: definition-concern
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: definition-service
  tags: [structural]
  links:
    - target: definition-catalog-spec
      type: refines
sources:
  - packages/definition-catalog/src/concern.ts
  - packages/definition-catalog/src/concern.test.ts
  - packages/definition-catalog/src/taxonomy.ts
  - packages/definition-catalog/src/real-docs.test.ts
  - packages/definition-catalog/src/gate-docs.test.ts
---
# Definition Concern — concern 전파 규칙

## 목적 ^purpose

concern이 link 그래프를 타고 전파되는 구조적 제약을 정의한다. concern은 단순 태그가 아니라 BFS로 전이적 전파되는 횡단 관심사이다.

## 정의 ^defines

- 7종 concern 전파 규칙 (CONCERN_DEFS)
- computeEffectiveConcerns() — BFS 전이적 전파
- EffectiveConcerns (direct + inherited + all)

## 소비 ^consumes

- DefinitionEntry, LinkType (types.ts) — 문서/링크 데이터
- DefinitionRegistry (registry.ts) — link 그래프 접근

## 전파 규칙 ^constraint

| concern | 전파 경로 |
|---------|----------|
| security | refines↓, implements↓, depends_on↑, constrains↓, **contains↓** |
| performance | refines↓, implements↓, depends_on↑, **contains↓** |
| accessibility | refines↓, implements↓, constrains↓, **contains↓** |
| observability | refines↓, implements↓, **contains↓** |
| testing | refines↓, implements↓, **contains↓** |
| migration | depends_on↑, refines↓, **contains↓** |
| deprecation | refines↓, implements↓, depends_on↑, **contains↓** |

↓ = downstream (상위→하위), ↑ = upstream (의존대상→의존자)
`contains↓` = 그룹→멤버 전파. `traces_to`는 전파하지 않는다.

## API ^api-surface

```typescript
const concerns = computeEffectiveConcerns(docId, getEntry, getLinks);
// concerns.direct: ["security"]         — 직접 부여
// concerns.inherited: [{ concern, from, via, path }]
// concerns.all: ["security"]            — 합집합
```

다단계 전이적 전파(BFS), 순환 참조 안전.

## 관련 소스

- `packages/definition-catalog/src/concern.ts` — 전파 엔진 (computeEffectiveConcerns, extractDirectConcerns)
- `packages/definition-catalog/src/concern.test.ts` — concern 7종, 직접 추출, BFS 전파, 순환 안전성 검증
- `packages/definition-catalog/src/taxonomy.ts` — CONCERN_TAGS
