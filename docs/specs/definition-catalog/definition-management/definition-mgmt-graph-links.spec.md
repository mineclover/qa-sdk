---
def:
  id: definition-mgmt-graph-links
  level: leaf
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

- 세로 구조: contains가 level 계층을 구성한다.
- 가로 구조: scope 간 상호작용은 횡방향 링크로 표현한다.
- 그래프 관측: 구조 변경은 graph_event 좌표로 관측된다.

## 세로 구조 (level 계층)

contains 링크는 역할 계층을 만든다.

```text
system-root (group)
  └── system-infra (group)
       └── ingest-system (module, scope: flow)
            ├── ingest-api (leaf, scope: interface)
            ├── ingest-data (leaf, scope: data)
            └── ingest-constraint (leaf, scope: constraint)
```

## 가로 교류 (scope 간 연결)

횡방향 링크는 관점 간 관계를 표현한다.

```text
leaf(interface) ──depends_on──→ leaf(data)
leaf(feature)   ──implements──→ leaf(interface)
leaf(constraint)──constrains──→ module(feature)
leaf(flow)      ──refines────→ leaf(flow)
```

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
