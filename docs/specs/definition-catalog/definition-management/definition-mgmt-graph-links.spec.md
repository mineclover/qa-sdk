---
def:
  id: definition-mgmt-graph-links
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: flow
  aspect: relation
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural]
  links:
    - target: definition-management
      type: refines
    - target: definition-assembly
      type: depends_on
    - target: definition-concern
      type: depends_on
---

# Definition Management — 그래프 연결

## 목적 ^purpose

definition 문서들이 `contains`, `depends_on`, `implements`, `refines`, `constrains`로 어떻게 연결되어 하나의 관리 그래프를 이루는지 정리한다.

## 구성 ^overview

- 세로 구조: contains/refs가 E/C/I/S + L/P 책임 문서의 소유/조망 관계를 구성한다.
- 가로 구조: scope 간 상호작용은 횡방향 링크로 표현한다.
- 그래프 관측: 구조 변경은 graph_event 좌표로 관측된다.

## 세로 구조 (E/C/I/S + L/P 관계)

contains 링크는 같은 System boundary 안에서 Interface, Component, Entry, System behavior 문서의 소유 관계를 만든다.
refs 링크는 Layout/Pack이 여러 System 또는 Interface 조각을 조망할 때 사용한다.

```text
ingest-system (tier: system)
  ├── ingest-interface (scope: interface, aspect: api_contract)
  ├── ingest-record-component (tier: component, scope: data)
  ├── ingest-state-component (tier: component, scope: state)
  └── ingest-rule (scope: constraint)

ingest-pack-or-layout (tier: layout)
  ├── refs -> ingest-system
  └── refs -> ingest-observability-system
```

## 가로 교류 (scope 간 연결)

횡방향 링크는 관점 간 관계를 표현한다.

```text
interface(api_contract) ──depends_on──→ component(data)
system(feature/flow)     ──implements──→ interface(api_contract)
rule(constraint)         ──constrains──→ system(feature/flow)
specialized contract     ──refines────→ base contract
```

## 행동/이벤트 연결

BDD contract와 event taxonomy는 별도 authority다.

```text
bdd_contract.when.operation ──depends_on──→ interface operation
bdd_contract.when.event_key ──depends_on──→ event vocabulary or mapping pack
bdd_contract.then.emits     ──depends_on──→ event vocabulary or mapping pack
bdd_contract.then.state     ──depends_on──→ component(state)
system behavior             ──implements──→ interface contract
```

이벤트는 behavior 자체가 아니라 관측 가능한 fact key다. Behavior semantics는 `bdd_contract`가, event key vocabulary는 event catalog/mapping pack이 소유한다.

## 링크 사용 원칙 ^constraint

- `contains`는 역할 계층을 표현한다.
- `depends_on`은 소비 의존을 표현한다.
- `implements`는 구현 책임을 표현한다.
- `refines`는 더 구체적인 설명 관계를 표현한다.
- `constrains`는 규칙/제약이 적용되는 대상을 표현한다.
- `traces_to`는 추적 관계로 쓰되, 구조 전파의 주 경로로 남용하지 않는다.

## 그래프 관측

구조 변경은 `graph_event` prefix로 좌표화한다.

```text
graph_event: svc_ref × def_level × graph_action × link_type
```

graph_action:
- link_add
- link_remove
- promote
- demote
- split
- merge
