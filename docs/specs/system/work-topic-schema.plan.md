---
def:
  id: work-topic-schema-plan
  type: spec
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [structural, roadmap, testing]
  links:
    - target: work-lifecycle
      type: traces_to
    - target: bdd-contract-system
      type: traces_to
    - target: doc-type-convention
      type: traces_to
---

# Work Topic Schema — 토픽 분할 계획

## 목적 ^purpose

작업 토픽을 어떤 기준으로 분할하고, 하나의 토픽이 어떤 필드와 경계를 가져야 하는지 `work_topic` schema 초안을 정의한다. 목표는 `plan / cases / todo / test / spec` 라이프사이클 안에서 토픽이 너무 크거나 작아지지 않도록, owner system·behavior·proof surface·assimilation target을 기계적으로 표현하는 것이다.

## 현재 목표 ^overview

- 토픽을 “최소 delivery slice”로 정의
- `owner_system`, primary behavior, source target cluster, proof surface를 schema로 고정
- BDD contract와 test/implementation unit과의 연결 필드를 명시
- 향후 read-only projection이나 validation으로 확장 가능한 shape를 만든다

---

## 1. work_topic의 정의

**작업 토픽**은 다음 조건을 만족하는 최소 delivery slice다.

1. 하나의 `owner_system` 안에서
2. 하나의 primary behavior 또는 primary `When`을 중심으로
3. 하나의 source target cluster를 수정하고
4. 하나의 proof surface로 닫을 수 있으며
5. 최종적으로 하나의 assimilation target(spec/rule/test/cases family)으로 수렴한다

즉 토픽은 “무슨 기능”보다 **어떤 계약을 어떤 범위에서 닫을 수 있는가**를 기준으로 나눈다.

---

## 2. work_topic 초안 필드

```yaml work-topic
work_topic:
  id: bdd-system.cli.read-surface.v1
  owner_system: bdd-contract-system
  goal: expose bdd read-only surfaces under qa-sdk docs
  topic_kind: feature-delivery

  contracts:
    - docs-control-plane.bdd.cli.list-contracts.v1
    - docs-control-plane.bdd.cli.validate-contracts.v1

  source_targets:
    - packages/cli/src/commands/docs.ts
    - packages/cli/src/command-groups/docs.commands.ts

  proof_surface:
    - packages/cli/src/commands/docs.test.ts

  assimilation_target:
    - docs/specs/bdd-system/bdd-contract-cli.spec.md

  boundaries:
    read:
      - docs-control-plane
      - bdd-contract-system
    write:
      - bdd-contract-system
    forbidden:
      - unrelated-owner-system
```

### 필드 설명

| 필드 | 의미 |
|------|------|
| `id` | 토픽 고유 식별자 |
| `owner_system` | 최종 책임 시스템 |
| `goal` | 이번 토픽이 닫아야 할 결과 |
| `topic_kind` | feature-delivery, refactor, guardrail, migration 같은 운영 분류 |
| `contracts` | 연결되는 BDD contract id 또는 동등한 계약 식별자 |
| `source_targets` | 직접 수정하는 구현 파일 군 |
| `proof_surface` | 이 토픽을 닫는 테스트/검증 파일 군 |
| `assimilation_target` | 완료 후 사실을 흡수할 spec/rule/test/cases 문서 |
| `boundaries` | 읽기/쓰기/금지 경계 |

---

## 3. topic_kind 초안

| kind | 질문 | 특징 |
|------|------|------|
| `feature-delivery` | 새 behavior를 닫는가 | contract + impl + proof 모두 필요 |
| `bug-fix` | 깨진 behavior를 복구하는가 | failure contract가 주도 |
| `guardrail` | validation/gate/constraint를 강화하는가 | proof surface가 중요 |
| `refactor` | behavior 유지 하에 구조를 바꾸는가 | contracts 재사용, todo는 source target 중심 |
| `migration` | old → new 체계를 전이하는가 | old/new contracts, dual proof 필요 |
| `docs-alignment` | 문서/계약/증거를 다시 정렬하는가 | source target이 문서 위주 |

초기에는 위 enum을 hardcode하지 않고 plan 단계에서만 사용한다.

---

## 4. 분할 기준

### split이 필요한 조건

다음이면 하나의 토픽을 둘 이상으로 나눈다.

1. `owner_system`이 둘 이상
2. primary `When`이 둘 이상
3. `source_targets` cluster가 둘 이상
4. read behavior와 write behavior가 강하게 다름
5. proof surface가 서로 다른 수준(unit vs integration vs e2e)으로 갈라짐
6. assimilation target이 둘 이상으로 분산됨

### 적정 크기 heuristic

| 항목 | 적정 범위 |
|------|-----------|
| contracts | 1~3 |
| implementation units | 1~3 |
| test units | 1~5 |
| source targets | 1~3 |
| proof surface | 1~3 files |

범위를 넘으면 split 후보로 본다.

---

## 5. Artifact와의 연결

artifact authority 자체는 `work-lifecycle`이 owner다. 여기서는 `work_topic` 필드가 각 artifact와 어떻게 접속하는지만 기록한다.

| artifact | `work_topic`과의 연결 |
|----------|-----------------------|
| `plan` | topic list와 순서를 가진다 |
| `cases` | `contracts`를 소유한다 |
| `todo` | 이번 iteration의 `source_targets`, `proof_surface`, `assimilation_target`을 실행 slice로 가진다 |
| `test` | `proof_surface`의 세부 증거를 소유한다 |
| `spec` | `assimilation_target`이 된다 |

---

## 6. work_topic와 BDD의 관계

`work_topic`은 BDD contract를 대체하지 않는다.

- BDD contract는 behavior truth
- work_topic은 delivery slice
- `contracts[]` resolution은 현재 status family에만 한정하지 않고 docs control-plane이 수집한 BDD contract id 전체를 대상으로 하는 read-only lookup이다.
- 따라서 cross-family delivery slice는 허용되지만, 새 contract id를 만들거나 provider behavior를 소유하지 않는다.

관계는 다음과 같다.

```text
BddContract
  ├─ test_unit
  ├─ implementation_unit
  └─ belongs to work_topic

work_topic
  ├─ source_targets
  ├─ proof_surface
  └─ assimilation_target
```

즉, contract는 “무엇이 맞는가”를 말하고, topic은 “이번에 무엇을 닫는가”를 말한다.

---

## 7. 후속 확장

### Phase 1

- plan 문서로만 운영
- 사람이 `todo`/`cases`/`spec`에서 수동 정렬

### Phase 2

- `work_topic` read-only projection 추가
- docs-control-plane에서 topic별 collect/view 제공

### Phase 3

- topic validation
  - owner boundary
  - assimilation target 존재
  - proof surface 존재

### Phase 4

- quality / review / PRD JSON export와 연결

---

## 경계

- 이 문서는 `work_topic`의 shape와 분할 기준을 다룬다.
- PM taxonomy 전체를 설계하지 않는다.
- work queue, assignee, due date 같은 운영 필드는 후속 PM taxonomy와 정렬한다.
