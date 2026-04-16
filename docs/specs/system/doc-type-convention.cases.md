---
def:
  id: doc-type-convention-cases
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  tags: [structural, scenario, governance]
  links:
    - target: doc-type-convention
      type: refines
    - target: docs-control-plane
      type: depends_on
    - target: df-system
      type: depends_on
---

# Document Type Convention — Use Cases

## 목적 ^purpose

새 이슈, 미확정 토론, 실행 후보, 확정된 구조, 사용 규칙, 검증 문서가 어떤 문서 타입으로 전이되는지 사용 시나리오로 정의한다. 목표는 `doc-type-convention`의 확장자 규칙을 실제 문서 운영 흐름에서 일관되게 적용하는 것이다.

## UC-001: 새 이슈가 아직 결정되지 않은 경우 ^overview

### 상황

사용자가 "source-map coverage를 모든 CLI module에 강제할까?"처럼 아직 정책이 확정되지 않은 질문을 제기한다.

### 판단

이것은 확정된 현재 구조가 아니므로 `.spec.md`가 아니다. 실행 가능한 작업도 아직 아니므로 `.todo.md`가 아니다.

### 문서화

- 선택지와 판단 기준은 `.plan.md` 또는 `type: knowledge`, `knowledge_kind: adr` 문서로 둔다.
- decision-flow gate가 필요하면 decision 문서나 ADR로 연결한다.
- 실행 가능해지면 `.todo.md`로 추출한다.

### 기대 결과

- parent module의 `contains`에는 바로 넣지 않는다.
- `depends_on`, `traces_to`, `refines`로 느슨하게 연결한다.
- 확정된 뒤에만 parent module의 `contains` 후보가 된다.

## UC-002: 논의가 실행 가능한 작업으로 바뀐 경우

### 상황

"docs-control-plane source-map coverage를 넓힌다"가 결정됐고, 대상 source family와 검증 명령이 정해졌다.

### 문서화

- `.todo.md`에 실행 항목을 추가한다.
- PRD 작성 시 `qa-sdk docs prd context`로 관련 spec/todo/plan/rule/test/memo/evidence를 수집한다.
- PRD markdown을 검토한 뒤 ralph JSON으로 변환한다.

### 기대 결과

- todo가 작업 상태를 추적한다.
- plan은 왜 이 순서인지 유지한다.
- spec은 구현된 현재 상태만 담는다.

## UC-003: 사용 규칙이 필요한 경우

### 상황

"PRD JSON은 topic/todo/spec을 직접 합쳐 만들지 않는다"처럼 소비자가 반복해서 확인해야 하는 규칙이 생긴다.

### 문서화

- `.rule.md`로 분리하거나 관련 rule 섹션에 기록한다.
- spec에는 현재 구조만 유지한다.
- docs graph의 `constraint` axis에서 rule이 드러나야 한다.

### 기대 결과

- 작성자는 rule을 보고 소비 조건을 확인한다.
- rule은 종속 spec 없이 단독으로 존재하지 않는다.

## UC-004: 현재 동작이 구현으로 확정된 경우

### 상황

`qa-sdk docs graph`가 source path target을 `source` node로 resolve하고, source-map coverage가 없을 때 full repository fallback 대신 `source-map-missing`을 반환한다.

### 문서화

- 현재 동작은 `.spec.md`로 승격한다.
- 검증 시나리오는 `.test.md` 또는 관련 test refs로 연결한다.
- 사용자가 알아야 하는 제한은 `.rule.md` 또는 spec의 constraint 섹션에 둔다.

### 기대 결과

- spec은 구현된 사실을 말한다.
- todo에는 남은 gap만 남는다.
- plan은 다음 방향을 유지한다.

## UC-005: PRD JSON 실행 포맷이 필요한 경우

### 상황

ralph-tui 실행을 위해 PRD JSON이 필요하다.

### 문서화

PRD JSON은 topic/todo/spec/plan/rule/test/memo/evidence를 직접 합쳐 만들지 않는다. 먼저 docs control plane으로 PRD authoring context를 만들고, PRD markdown을 작성/검토한 뒤, 실행 호환 포맷으로 변환한다.

```text
spec / todo / plan / rule / test / memo / evidence
        ↓
docs prd context / scaffold
        ↓
PRD markdown
        ↓
docs prd to-ralph-json
        ↓
ralph PRD JSON
```

### 기대 결과

- PRD markdown이 의사결정, non-goal, 품질 게이트, 실행 범위를 명시한다.
- ralph JSON은 실행 호환 adapter output으로만 취급한다.
