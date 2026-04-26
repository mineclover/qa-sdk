---
def:
  id: architecture-revealing-code-convention
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural, convention, architecture]
  links:
    - target: document-governance-guideline
      type: constrains
    - target: definition-mgmt-consistency-rules
      type: constrains
    - target: composition-hierarchy
      type: traces_to
    - target: test-md-convention
      type: traces_to
---

# Architecture-Revealing Code Convention — Responsibility Topology 코드 구조 규칙

## 목적 ^purpose

코드를 읽을 때 책임 토폴로지(Responsibility Topology)가 드러나도록 작성하고, 문서는 그 코드 책임을 definition 좌표와 source mapping으로 고정하는 코딩 컨벤션을 정의한다. 현행 vocabulary는 Entry/Identity, Component, Interface/DSL, System, Layout/Pack이지만, 구조가 바뀌어도 이 문서의 상위 개념은 책임 토폴로지로 유지한다.

## 원칙 ^defines

코드 구조는 아키텍처를 숨기지 않아야 한다. 파일명, export 이름, 폴더 배치, 테스트 파일은 "이 코드가 어떤 책임을 소유하는가"를 보여줘야 한다.

| 책임 | 코드에서 드러나는 형태 | 문서화 |
|------|----------------------|--------|
| Entry / Identity | stable id, enum value, finite registry, singleton constant | `tier: entry` 또는 identity Component 문서 |
| Component | type/schema/state/evidence shape, pure normalizer, data-only registry | `tier: component` |
| Interface / DSL | route/command/event descriptor, adapter port, public contract, parser boundary | `scope: interface` 또는 rule/spec contract |
| System | behavior core, state transition, projector, validator, writer, orchestrator | `tier: system` |
| Layout / Pack | `index.ts`, facade, pack manifest, module registry, docs inventory, barrel export | `tier: layout` + `refs` |

이름은 반드시 `entry`, `component`, `interface`, `system`, `layout` 단어를 포함할 필요는 없다. 다만 역할이 숨으면 안 된다. 예를 들어 `graph-types.ts`, `graph-traverse.ts`, `docs.commands.ts`, `index.ts`는 각각 Component, System behavior, Interface, Layout/Pack 역할을 이름으로 드러낸다.

## 코드 작성 규칙

### 1. Component는 데이터 vocabulary만 소유한다

Component 코드는 type, schema, enum, evidence shape, normalizer처럼 data contract를 고정한다. 외부 IO, mutation, workflow orchestration을 넣지 않는다.

```ts
export interface GraphNodeRecord { ... }
export const GRAPH_NODE_KINDS = ["document", "source", "task"] as const;
export function normalizeGraphNode(input: unknown): GraphNodeRecord { ... }
```

검증 함수가 단순 shape validation을 넘어서 graph traversal, persistence, side effect, policy decision을 수행하면 System behavior로 분리한다.

### 2. Interface는 소비 표면만 소유한다

Interface 코드는 command descriptor, route definition, event input, parser, adapter port처럼 System을 어떻게 호출할지 정의한다. System behavior를 직접 구현하지 않는다.

```ts
export const docsGraphCommand = defineCommand({
  name: "graph",
  flags: [...],
  handler: cmdGraph,
});
```

handler가 길어지면 parsing/dispatch만 남기고 behavior는 System module로 위임한다.

### 3. System은 behavior boundary를 소유한다

System 코드는 Component data와 Interface input을 받아 결정론적 behavior를 수행한다. traversal, projection, validation, sync, activation, state transition, writer, orchestration은 System 책임이다.

```ts
export function traverseDocumentGraph(input: GraphTraversalInput): GraphTraversalResult { ... }
export function rankGraphNodes(result: GraphTraversalResult, policy: RankPolicy): RankedGraph { ... }
```

System 파일은 `@def.boundary <system-doc-id>` 후보이며, BDD contract나 `.test.md`와 연결되어야 한다.

### 4. Layout / Pack은 조립만 한다

Layout/Pack 코드는 imports/exports, manifest, registry, package facade, bundle assembly만 소유한다. behavior/data ownership을 새로 만들지 않는다.

```ts
export * from "./graph-types.js";
export * from "./graph-traverse.js";
export * from "./graph-rank.js";
```

`index.ts`나 pack manifest에 실질 behavior가 생기면 System 파일로 이동한다.

### 4.5 Root index / routing convention

코드에도 문서 selector가 도착할 초기 진입점이 드러나야 한다.

- package facade (`index.ts`) 는 Layout/Pack root index 후보
- route/command registry (`commands.ts`, `routes.ts`, manifest) 는 Interface root index 후보
- service orchestrator / main pipeline file 은 System root index 후보

문서는 이 초기 진입점에서 시작해 하위 Interface/Component/System behavior로 내려갈 수 있어야 한다. selector 기반 탐색이 가능한 이유는 코드와 문서 양쪽이 같은 root-index convention을 따르기 때문이다.

### 4.6 Canonical Nest service tree

Nest 기반 modular-monolith baseline은 다음처럼 책임이 드러나게 둔다.

```text
src/
  main.ts                       # System root index / bootstrap ownership
  app.module.ts                 # Layout / module assembly
  config/env.ts                 # Component env vocabulary
  health/                       # Interface + simple runtime probe
  domains/<domain>/
    api/                        # Interface / port / DTO
    application/                # System orchestration
    domain/                     # pure business rules
    infrastructure/             # adapter implementation
```

`qa-sdk init --nest-service`와 `@qa-sdk/nest-service-kit`은 이 baseline을 생성/지원한다. 중요한 것은 폴더 이름보다도 `main.ts`, `api`, `application`, `domain`, `infrastructure`가 어떤 책임을 소유하는지가 코드에서 숨지 않는 것이다.

### 5. Entry는 안정 식별자만 둔다

Entry 코드는 stable id, singleton, closed value만 둔다. shape가 커지면 Component, behavior가 생기면 System으로 승격한다.

## 문서 매핑 규칙

코드가 이미 모듈화되어 있어도 문서를 자동으로 파일 수만큼 나누지 않는다. 문서 분할 기준은 독립 책임이다.

| 코드 상태 | 문서 처리 |
|----------|-----------|
| 여러 파일이 하나의 System behavior를 함께 구현 | System 문서 1개 + `sources` 여러 개 |
| 파일별로 public command/API/event 계약이 다름 | Interface 문서 분리 |
| 파일이 data/state/evidence shape authority | Component 문서 분리 |
| 파일이 state transition/projector/writer/orchestrator | System 문서 분리 |
| 파일이 barrel/facade/pack manifest | Layout/Pack 문서 또는 root overview의 `refs` |
| 파일이 내부 helper/util | 별도 문서 없이 owner 문서의 source topology에 기록 |

문서에는 코드 내용을 복제하지 않는다. 문서는 책임, 의도, 경계, 검증 surface를 소유하고, 타입/함수/상수 세부는 source reference로 연결한다.

## Source Mapping 규칙

- `@def.boundary`는 System 또는 Layout/Pack 코드 경계에 붙인다.
- `@def.doc`는 구체 책임 문서나 symbol-level mapping에 붙인다.
- 하나의 source file이 서로 다른 책임 토폴로지 문서 3개 이상을 소유하면 code split 후보로 본다.
- code split이 과하면 `file.ts:symbol` 단위로 좁힌다.
- 같은 System 문서가 여러 source file을 갖는 것은 정상이다. 단, 각 source file의 역할이 topology로 설명되어야 한다.

예시:

```ts
// @def.boundary docs-control-plane-graph
// @def.doc docs-control-plane-graph
export function traverseDocumentGraph(...) { ... }

// @def.doc docs-control-plane-graph-types
export interface DocumentGraphNode { ... }
```

## 테스트 매핑 규칙

테스트는 source boundary 또는 BDD contract 경계를 따른다.

- Component 테스트: shape, parser, normalizer, invalid input.
- Interface 테스트: command/route/event input parsing과 output contract.
- System 테스트: behavior, state transition, traversal, projector, writer.
- Layout/Pack 테스트: refs 대상이 모두 export/registered 되는지, behavior를 직접 테스트하지 않는다.
- 통합 테스트: 여러 책임을 의도적으로 묶으면 `.test.md`나 describe title에 integration scope를 명시한다.

## Drift 신호

다음 신호가 있으면 코드 또는 문서 중 하나가 책임을 숨기고 있다.

- Interface 파일에 business decision, traversal, persistence write가 있다.
- Component 파일에 runtime orchestration이나 external IO가 있다.
- Layout/Pack 파일에 조건 분기 많은 behavior가 있다.
- System 문서가 data shape를 새로 정의한다.
- Layout/Pack 문서가 source file 전체를 자기 구현으로 소유한다.
- 문서가 책임 토폴로지로 나뉘었는데 code/test boundary는 하나의 거대 파일로 남아 있다.

## 검증 ^consumes

최소 검증 루프:

```bash
qa-sdk def sync
qa-sdk def find-by-file <source-file[:symbol]>
qa-sdk def validate
pnpm --filter <pkg> test
```

구조 변경이면 `skills/semantic-change/SKILL.md`의 L1-L4 검증을 추가로 따른다.
