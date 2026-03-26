---
def:
  id: dkg-node-types
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  svc: spec-core
  tags: [tier-system]
  links:
    - target: system-concepts
      type: depends_on
---
# DKG 노드 유형

## 목적 ^purpose

DKG 그래프를 구성하는 16종 노드 타입. 각 노드는 좌표 시스템의 하나의 설계 요소(축, prefix, 도메인, 서비스 등)를 나타낸다.

## 구성 ^overview

16종 노드는 4개 계층으로 분류된다.

| 계층 | 노드 | 설명 |
|------|------|------|
| 카탈로그 승계 (4종) | `axis`, `prefix`, `spec`, `schema` | DEMO_CATALOG에서 `deriveFromCatalog()`로 자동 파생 |
| 설계+운영 (4종) | `decision`, `version-event`, `constraint`, `observation` | 의사결정·관측·제약·진화 추적 |
| 외부/구조 (4종) | `domain`, `consumer`, `intent-link`, `dsl-bundle` | 도메인 경계·소비자·의도 링크·DSL 번들 |
| 확장 (4종) | `skill`, `transition-spec`, `table`, `flow-schema` | 스킬·전이 명세·테이블·의사결정 플로우 |

## 카탈로그 승계 노드 (4종)

### AxisNode

좌표 축. `id`, `name`, `currentVersions` 필드. 카탈로그의 각 axis에서 1:1 파생된다.

### PrefixNode

좌표 접두사. `dimLabels`로 차원 목록, `category`로 스키마 분류(entity/event/relation/state/policy/observation), `lifecycle`으로 생명주기(draft→active→deprecated→archived)를 추적한다.

### SpecNode

요구사항/기능/유즈케이스/이벤트/ADR 등 문서화된 명세. `type` 필드로 req/feat/uc/evt/ls/adr 구분. `governs` 필드로 지배 대상 노드를 참조한다.

### SchemaNode

이벤트 스키마. `category`와 `version`으로 스키마 카탈로그 내 위치를 식별한다.

## 설계+운영 노드 (4종)

### DecisionNode

의사결정 기록. `context`, `rationale`, `alternatives`, `reversalConditions`를 구조화. `lifecycle`은 active/superseded/reversed. `flowInstanceId`로 FlowInstance와 역참조 가능.

### VersionEventNode

축/prefix 버전 전이 이벤트. `subjectId`/`subjectKind`로 대상, `fromVersion`/`toVersion`으로 전이, `changes[]`에 변경 종류(entry-added, entry-deactivated, capacity-changed, dim-added, ref-changed)를 기록한다.

### ConstraintNode

구조적 불변조건. `rule`(자연어), `formal`(기계 검증 가능 표현식), `scope`(적용 대상), `lifecycle`(active/suspended/retired).

### ObservationNode

관측 기록. `source`(runtime/review/metric/manual), `subjects`(대상 노드 목록), `finding`(발견 내용). `intent`로 action-needed/monitoring/completed 분류. `resolution`이 설정되면 루프가 닫힌다.

## 외부/구조 노드 (4종)

### DomainNode

도메인 경계. `prefixes`(소속 prefix), `sharedAxes`(공유 축), `boundary`(exports/internal 구분).

### ConsumerNode

소비자. `type`(service/client/tool/external), `intendedPrefixes`(사용 의도 prefix 목록).

### IntentLinkNode

의도 링크. `endpoints`(참여 prefix 목록), `via`(연결 경로), `intent`(의도), `invariant`(불변조건 텍스트).

### DslBundleNode

DSL 번들. `memberPrefixes`(멤버 prefix), `serviceBindingPrefix`(서비스 바인딩), `fixedDims`(고정 차원), `invariants`(불변조건), `lifecycle`.

## 확장 노드 (4종)

### SkillNode

DKG 스킬. `category`(read/write/analysis/chain), `targetKinds`(대상 노드 종류), `input`/`output`(설명), `depends`(의존 스킬), `specialization`(전문화 컨텍스트 — domains, dslBundles, prefixes, intentLinks, constraints, metrics, autoObservation).

### TransitionSpecNode

전이 명세. TransitionSpec이 SSOT, DKG 노드는 `toTransitionSpecNode()`로 파생.

- `transition`: 도메인.엔터티.오퍼레이션 형식 (예: `cart.checkout`)
- `matchMode`: single/ordered/unordered/windowed
- `coordinateCount`: 좌표 패턴 수
- `effectKind`: create/update/move/consume/open/close
- **축 역할 분리** (전이 간 상태 의존성 분석의 기반):
  - `matchAxes`: match.coordinates에서 수집 (어떤 축으로 이벤트를 매칭하는가)
  - `inputAxes`: input.all에서 수집 (어떤 축의 전제조건을 요구하는가)
  - `outputAxes`: output.set에서 수집 (어떤 축을 변경하는가)
  - `slotRefs`: 전체 합집합 (matchAxes ∪ inputAxes ∪ outputAxes)
- ID 형식: `TSPEC-{transition의 . → - 변환}` (예: `TSPEC-cart-checkout`)

DKG 엣지: `depends-on` (A.outputAxes ∩ B.inputAxes), `satisfies` (slotRefs ∩ DSL 축 ≥ 2).

### TableNode

테이블. `columns`(컬럼 이름 목록). 컬럼-레벨 엣지로 축/prefix/FK 참조를 추적한다.

### FlowSchemaNode

의사결정 플로우 스키마. `gates`(게이트 요약 목록), `totalPaths`(총 경로 수), `coreGateIds`(핵심 게이트).

## 노드 유니온 타입

소스 위치: `packages/spec-core/src/dkg/dkg.types.ts`

```typescript
type DkgNode =
  | AxisNode | PrefixNode | SpecNode | SchemaNode
  | DecisionNode | VersionEventNode | ConstraintNode | ObservationNode
  | DomainNode | ConsumerNode | IntentLinkNode | DslBundleNode
  | SkillNode | TransitionSpecNode | TableNode | FlowSchemaNode;
```

## 파생 규칙

- `bootstrapDkg()`가 카탈로그에서 Axis/Prefix/Table을 자동 파생하고, DkgConfig의 나머지 노드를 등록한다.
- 카탈로그 변경 시 `deriveFromCatalog()`가 결정론적으로 노드를 재생성한다.
- Headroom Decision, DSL 버전 스큐 Observation 등은 bootstrap 과정에서 자동 생성된다.
