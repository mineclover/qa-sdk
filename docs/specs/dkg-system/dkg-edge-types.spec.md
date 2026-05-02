---
def:
  tier: component
  id: dkg-edge-types
  address: def_document:v2:342167
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: spec-core
  tags: [structural, observability, data]
  links:
    - target: dkg-node-types
      type: depends_on
---
# DKG 엣지 유형


## 탐색 ^navigation

dkg-system > **dkg-edge-types**

형제: `dkg-node-types` · `dkg-queries` · `dkg-constraint` · `dkg-growth-spiral` · `dkg-skills-system` · `dkg-service-topology` · `dkg-state-store`

## 목적 ^purpose

DKG 노드 간 관계를 표현하는 18종 엣지 타입. 각 엣지는 설계 요소 간의 구조적 관계를 나타낸다.

## 구성 ^overview

18종 엣지는 5개 그룹으로 분류된다.

| 그룹 | 엣지 타입 | 수 |
|------|-----------|---|
| spec-engine 승계 | `satisfies`, `implements`, `tests`, `traces-to`, `depends-on` | 5 |
| 설계 순방향 | `composes`, `references`, `governs`, `justifies`, `constrains` | 5 |
| 도메인/소비/연결 | `contains`, `bridges`, `consumes`, `binds` | 4 |
| 운영 역방향 | `observes`, `prompts` | 2 |
| 진화 추적 | `evolves-from`, `supersedes` | 2 |

## spec-engine 승계 (5종)

### satisfies

`TransitionSpec → DslBundle`. 전이 명세가 DSL 번들의 요구사항을 충족함을 나타낸다. `deriveDslSatisfiesEdges()`에서 자동 생성.

### implements

명세(Spec)를 구현하는 관계. `SpecNode.governs`로부터 대상 연결.

### tests

테스트가 대상을 검증하는 관계.

### traces-to

추적 관계. 요구사항에서 구현으로의 추적.

### depends-on

의존 관계. Skill 간 의존(`skill.depends`)을 표현. `bootstrapDkg()`에서 Skill 등록 시 자동 생성.

## 설계 순방향 (5종)

### composes

**구성 관계.** DKG에서 가장 핵심적인 엣지.

- `prefix → axis`: prefix가 이 축을 차원으로 사용. meta: `{ dimKind: "axis", label }`
- `prefix → prefix`: prefix_ref 차원. meta: `{ dimKind: "prefix_ref", label }`
- `prefix → table`: table_ref 차원. meta: `{ dimKind: "table_ref", label }`
- `table → axis`: 컬럼이 축 값을 저장. meta: `{ dimKind: "column_axis", column }`
- `flow-schema → axis`: FlowSchema가 참조하는 축

`deriveFromCatalog()`에서 카탈로그 구조를 기반으로 자동 생성된다.

### references

**참조 관계.** composes의 보완.

- `prefix → prefix`: prefix_ref 차원이 참조하는 대상. meta: `{ label }`
- `table → prefix`: 컬럼이 prefix 주소를 저장. meta: `{ column }`
- `table → table`: FK 관계. meta: `{ column, fk: true }`
- `flow-schema → flow-schema`: subFlow 참조

### governs

**지배 관계.** Decision이나 Spec이 대상을 지배.

- `decision → prefix`: 의사결정이 prefix의 행동을 지배
- `decision → axis`: 축의 capacity/entry 변경 결정
- `spec → *`: 명세가 대상을 지배 (`spec.governs` 필드에서 파생)

### justifies

**정당화 관계.** Decision이 대상의 존재/상태를 정당화.

- `decision → axis`: 축 신설 근거 (`DEC-NEW-AXIS-{axisId}` 패턴)
- `decision → prefix`: prefix 분리 유지 근거
- `decision → dsl-bundle`: DSL 버전 스큐 수용 근거

### constrains

**제약 관계.** Constraint가 대상에 불변조건을 부과.

- `constraint → axis/prefix/transition-spec`: scope에 명시된 대상

## 도메인/소비/연결 (4종)

### contains

**포함 관계.** 컨테이너와 멤버.

- `domain → prefix`: 도메인에 소속된 prefix
- `dsl-bundle → prefix`: DSL 번들의 멤버 prefix
- `flow-schema → domain`: FlowSchema가 소속된 도메인

### bridges

**브릿지 관계.** 도메인 간 공유 축/prefix를 연결.

### consumes

**소비 관계.**

- `consumer → domain`: 소비자가 도메인을 소비
- `consumer → prefix`: 소비자가 도메인 밖에서 직접 prefix 소비
- `transition-spec → axis/prefix`: 전이 명세가 슬롯 참조 (`slotRefs`)

### binds

**바인딩 관계.**

- `intent-link → prefix`: IntentLink의 endpoint prefix
- `dsl-bundle → prefix`: DSL의 서비스 바인딩 prefix

## 운영 역방향 (2종)

### observes

**관측 관계.** Observation이 대상을 관측.

- `observation → prefix/axis/dsl-bundle/intent-link`: 관측 대상
- `flow-schema → prefix`: FlowSchema가 관측하는 prefix

`traceFlows()`, `auditCoverage()`, `convergeChain()` 등에서 자동 생성.

### prompts

**촉발 관계.** Observation이 Decision을 촉발. 관측 루프의 핵심 엣지.

- `observation → decision`: 관측이 의사결정을 촉발

## 진화 추적 (2종)

### evolves-from

**진화 관계.** VersionEvent가 이전 상태로부터 진화.

- `version-event → prefix/axis`: lifecycle 전이 이력 기록

`transitionPrefix()`, `transitionDecision()`에서 자동 생성.

### supersedes

**대체 관계.** 새 노드가 이전 노드를 대체.

- `new-prefix → old-prefix`: deprecated 시 대체 prefix
- `new-decision → old-decision`: 의사결정 교체

## 엣지 구조

소스 위치: `packages/spec-core/src/dkg/dkg.types.ts`

```typescript
interface DkgEdge {
  readonly type: DkgEdgeType;
  readonly from: string;
  readonly to: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}
```

## 질의 방향

`GraphRegistry`는 순방향(`forward`)과 역방향(`reverse`) 인접 리스트를 모두 유지한다.

- `edgesFrom(id, type)`: 순방향 — id에서 출발하는 엣지
- `edgesTo(id, type)`: 역방향 — id로 도착하는 엣지
- `neighbors(id, type)`: 순방향 이웃 노드 ID
- `reverseNeighbors(id, type)`: 역방향 이웃 노드 ID
- `transitiveNeighbors(id, type, direction)`: BFS 순회 (깊이 제한 10)
