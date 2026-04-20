---
def:
  tier: component
  id: operational-ontology-junction
  type: knowledge
  knowledge_kind: concept
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: domain
  tags: [cross-scope, structural]
  links:
    - target: operational-ontology-branch-handling
      type: depends_on
    - target: operational-ontology-control-flow
      type: depends_on
    - target: operational-ontology-simulation
      type: refines
sources:
  - packages/operational-ontology/src/internal/junction-core.ts
---

# Operational Ontology Junction — 갈림길과 합류 지점 정의

## 목적 ^purpose

`operational-ontology`에서 분기, 합류, 재시도, 피드백 같은 제어 지점을 **junction**으로 정의한다. 목표는 branch를 구현 디테일이 아니라, corridor 위에서 경로 선택이 발생하는 구조적 지점으로 다루는 것이다.

## 구성 ^overview

현재 구현에서 junction는 `BranchDefinition`과 `BranchDecision`으로 표현한다.

- `BranchDefinition`
  - 갈림길의 가능한 경로 목록
- `BranchDecision`
  - 실제 관측/시뮬레이션에서 어떤 경로가 선택되었는지

코드에서는 아래 alias를 둔다.

- `JunctionDefinition = BranchDefinition`
- `RouteDecision = BranchDecision`

또한 `JunctionTemplateRegistry`를 통해 junction materialization 방식과 allowed mode를 조절할 수 있다.
현재 template는 최소한 다음 shape contract를 가질 수 있다.

- `allowedModes`
- `minPaths`
- `maxPaths`
- `requireConditionOnPaths`

runtime snapshot에서 `RouteDecision`은 추가로 아래 참조를 가질 수 있다.

- `junctionId`
- `corridorId`
- `traversalKey`

## 정의 ^defines

### junction의 역할

junction는 아래 질문에 답한다.

- 어디에서 길이 갈라지는가
- 어떤 조건이 경로 선택을 유도하는가
- 어떤 경로가 선택되었고 어떤 경로가 버려졌는가
- branch 결과가 transmission과 lineage에 어떤 영향을 주는가

### 범위

junction는 branch만 뜻하지 않는다. 현재 vocabulary로는:

- branch
- optional
- join
- retry / feedback

도 같은 계열의 제어 지점으로 읽을 수 있다. 다만 현재 baseline projector는 우선 `conditional` connection을 중심으로 `BranchDefinition`을 생성한다.

## 검증 참조

- 테스트: `packages/operational-ontology/src/projectors-pipe.test.ts`, `packages/operational-ontology/src/projectors-path.test.ts`
