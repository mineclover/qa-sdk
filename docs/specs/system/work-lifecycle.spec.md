---
def:
  id: work-lifecycle
  type: design
  tier: system
  owner_system: meta-semantic-system
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural, testing]
  links:
    - target: doc-type-convention
      type: depends_on
    - target: responsibility-closure-harness
      type: traces_to
    - target: bdd-contract-system
      type: depends_on
    - target: work-lifecycle-cases
      type: traces_to
    - target: work-topic-schema-plan
      type: traces_to
sources:
  - docs/specs/system/work-lifecycle.cases.md
  - docs/specs/definition-catalog/responsibility-closure-harness.rule.md
  - docs/specs/definition-catalog/responsibility-closure-harness.cases.md
  - packages/cli/src/lib/docs-control-plane/work-topic-extract.ts
  - packages/cli/src/lib/docs-control-plane/bdd-contract-extract.ts
  - packages/cli/src/lib/docs-control-plane/completed-record-review.ts
  - packages/cli/src/lib/docs-control-plane/docs-control-plane.test.ts
  - packages/cli/src/commands/docs.test.ts
---

# Work Lifecycle

## 목적 ^purpose

`plan / cases / todo / test / spec` 문서가 어떤 권한을 가지며 어떤 순서로 전이되는지 정의한다. 목표는 AI-DLC에서 artifact별 authority와 handoff를 분리해 문서 truth가 중복되거나 흔들리지 않게 하는 것이다.

이 lifecycle은 Responsibility Closure Harness의 delivery loop다. plan은 책임 폐쇄 의도, cases는 behavior truth, todo는 실행 slice, test는 검증 설계, implementation은 코드 책임 구현, spec은 현재 사실 assimilation을 소유한다.

## 정의 ^defines

표준 작업 루프:

```text
Plan
  -> Cases
    -> Todo extraction
      -> Test binding
        -> Implementation
          -> Spec assimilation
            -> Todo prune
```

Artifact authority:

| artifact | 소유 질문 | 권한 |
|---------|----------|------|
| `plan` | 왜 / 어디까지 / 어떤 단계로 갈 것인가 | 방향 |
| `cases` | 어떤 동작이 맞는가 | 행동 계약 |
| `todo` | 이번 루프에 무엇을 구현하는가 | 실행 순서 |
| `test` | 그 동작을 어떻게 증명하는가 | 증거 설계 |
| `spec` | 지금 시스템이 실제로 무엇인가 | 현재 사실 |

Responsibility closure 관점:

| artifact | closure 역할 |
|----------|--------------|
| `plan` | 닫아야 할 책임과 non-goal을 정한다 |
| `cases` | 책임의 behavior truth를 구체화한다 |
| `todo` | 이번 iteration에서 닫을 책임 slice를 정한다 |
| `test` | 폐쇄 증거를 어떻게 만들지 정한다 |
| `implementation` | 코드가 책임을 드러내고 구현한다 |
| `spec` | 구현된 사실과 source/test evidence를 흡수한다 |

전이 규칙:

- `plan -> cases`: plan은 behavior를 직접 확정하지 않고, cases가 목표를 behavior contract로 구체화한다.
- `cases -> todo`: todo는 cases/plan에서 뽑아낸 이번 iteration 실행 단위만 가진다.
- `cases -> test`: 각 contract는 최소 하나의 test unit을 가진다.
- `cases -> implementation`: 각 contract는 최소 하나의 implementation unit을 가지며 owner boundary를 넘지 않는다.
- `implementation/test -> spec`: 구현되고 검증된 사실만 spec에 흡수한다.
- `todo -> prune`: spec에 흡수된 완료 항목은 제거하고, 부분 완료면 잔여만 유지한다.

작업 토픽은 `work-topic-schema-plan`이 정의하는 `work_topic` shape를 사용한다. BDD contract는 behavior truth이고, `work_topic`은 delivery slice다.

## 현재 구현 경계 ^boundary

- docs-control-plane은 BDD block, work_topic block, completed-record cleanup review를 read-only로 투영한다.
- lifecycle은 artifact authority와 handoff 규칙을 소유한다. 자동 삭제, 자동 spec 승격, package quality gate 분류는 소유하지 않는다.
- `work-domain` package는 작업 종류와 gate mapping을 소유하고, 이 문서는 plan/cases/todo/test/spec loop를 소유한다.

## 소비 ^consumes

- `doc-type-convention` — 문서 유형별 owner와 reference-first compression 규칙
- `bdd-contract-system` — behavior contract, test unit, implementation unit
- `work-topic-schema-plan` — delivery slice shape와 split heuristic
- `work-lifecycle-cases` — 실제 사용 시나리오와 실패 시 수정 대상

## 검증 ^validation

```bash
corepack pnpm --filter @qa-sdk/cli test -- docs
node packages/cli/dist/index.js def validate
```
