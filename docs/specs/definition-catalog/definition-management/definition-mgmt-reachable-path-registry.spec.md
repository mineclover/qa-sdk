---
def:
  id: definition-mgmt-reachable-path-registry
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [observability, runtime]
  links:
    - target: definition-mgmt-observability-model
      type: refines
    - target: definition-mgmt-feedback-loop
      type: depends_on
---
# Definition Management — Reachable Path Registry

## 목적 ^purpose

definition 관리에서 전체 상태공간이 아니라 실제로 도달 가능한 path만 sparse하게 좌표화하는 규칙을 정의한다. family-local path id, path lifecycle FSM, family별 branch point를 이 문서가 고정한다.

## 핵심 원칙 ^intent

전체 변수의 전곱을 좌표화하지 않는다. 좌표화 대상은 이벤트 family에서 실제로 도달 가능한 path signature다.

```text
Axis Space A_e
  = family e가 사용할 수 있는 개별 branch/choice 집합

Reachable Path Space R_e
  = A_e 위에서 실제로 도달 가능한 path signature의 집합

Registry ρ_e
  = R_e의 각 path에 sparse path id를 부여하는 매핑
```

## Reachable Path Record

```ts
type PathSource = "observed" | "inferred" | "spec-derived";
type PathStatus = "candidate" | "observed" | "stable" | "retired" | "invalid";
```

필수 필드:
- `family_id`
- `path_id`
- `signature_hash`
- `signature`
- `status`
- `source`
- `hit_count`

## Path Lifecycle FSM

```text
candidate -> observed -> stable -> retired
candidate -> invalid
observed  -> invalid
stable    -> invalid
```

## 초기 family

- `def.authoring`
- `def.validation`
- `def.boundary-decision`

## family별 핵심 branch point

### def.authoring
- `doc-lifecycle`
- `code-mapping`
- `db-sync`
- `convention`
- `approval`

### def.validation
- `sync-result`
- `validate-result`
- `audit-result`
- `gate-result`
- `bundle-state`
- `test-result`

### def.boundary-decision
- `observation`
- `framing`
- `decision`
- `application`
- `stabilization`

## 사용 규칙

- path id는 family-local identifier다. 전역 정수 곱공간 주소로 해석하지 않는다.
- local audit event와 central ingest event가 모두 존재하더라도, 동일 family의 path semantics는 하나여야 한다.
