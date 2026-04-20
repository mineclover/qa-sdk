---
def:
  tier: component
  id: dkg-skill-catalog-types
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [structural, decision, data]
  links:
    - target: dkg-skill-catalog
      type: refines
    - target: dkg-node-types
      type: depends_on
---
# Skill 타입 정의


## 탐색 ^navigation

dkg-system > dkg-skills-system > dkg-skill-catalog > **dkg-skill-catalog-types**

형제: `dkg-skill-catalog-registry`

## 목적 ^purpose

SkillNode 타입, 4개 카테고리, 전문화(Specialization) 메커니즘, DKG 등록 체계를 정의한다.

## SkillNode 타입

소스 위치: `packages/spec-core/src/dkg/dkg.types.ts`

```typescript
interface SkillNode {
  readonly kind: "skill";
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: SkillCategory;         // "read" | "write" | "analysis" | "chain"
  readonly targetKinds: readonly string[];   // 대상 노드 종류
  readonly input: string;
  readonly output: string;
  readonly depends?: readonly string[];
  readonly specialization?: SkillSpecialization;
}
```

## 카테고리 분류

| 카테고리 | 설명 | 대표 skill |
|---------|------|-----------|
| `read` | 그래프에서 정보를 읽기만 함 | `traceNode`, `exploreService`, `explorePrefix`, `exploreDsl` |
| `write` | 그래프에 노드/엣지를 추가 | `recordDecision`, `recordObservation`, `transitionPrefix` |
| `analysis` | 데이터를 분석하여 결과를 반환 | `analyzeImpact`, `inferMigrator`, `auditCoverage`, `checkDomainHealth` |
| `chain` | 여러 skill을 순차 실행 | `entryAddChain`, `systemHealthChain`, `convergeChain` |

## 전문화 (Specialization)

SkillSpecialization은 skill이 특정 컨텍스트에 전문화되었음을 선언한다.

```typescript
interface SkillSpecialization {
  readonly domains?: readonly string[];
  readonly dslBundles?: readonly string[];
  readonly prefixes?: readonly string[];
  readonly intentLinks?: readonly string[];
  readonly constraints?: readonly string[];
  readonly invariants?: readonly string[];
  readonly metrics?: readonly string[];
  readonly api?: string | readonly string[];
  readonly autoObservation?: boolean;
  readonly observationTemplate?: string;
}
```

### 전문 skill vs 범용 skill

`traceNode()`에서 노드에 적용 가능한 skill을 탐색할 때:

1. **전문 skill**: specialization의 prefixes/domains/dslBundles/intentLinks/constraints에 해당 nodeId가 포함된 skill
2. **범용 skill**: specialization이 없고, targetKinds가 비어있거나 노드 kind와 일치하는 skill

### 자동 관측 (autoObservation)

`autoObservation: true`이면 skill 실행 결과에서 Observation을 자동 생성한다. `observationTemplate`으로 ID 패턴을 지정 가능.

## DKG 등록 체계

`bootstrapDkg()`에서 DkgConfig의 `skills` 배열을 순회하며 등록한다.

```typescript
// bootstrap.ts
for (const skill of config.skills) {
  graph.addNode(skill);
  if (skill.depends) {
    for (const depId of skill.depends) {
      graph.addEdge("depends-on", skill.id, depId);
    }
  }
}
```

- Skill 간 의존은 `depends-on` 엣지로 표현
- Skill은 DKG 노드이므로 `traceNode()`로 역추적 가능
