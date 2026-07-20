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
    - target: markdown-navigation-health
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

## 표준 실행 방법 ^workflow

artifact 전이만 지키는 것으로는 작업 결과를 재현할 수 없다. 모든 작업은 아래 실행 순서를 따르며, 변경 종류에 따라 필요한 검증 게이트만 추가한다.

| 단계 | 작업자 행동 | 남겨야 하는 결과 | 중단 기준 |
|---|---|---|---|
| 0. 범위 판정 | 변경을 source behavior, definition semantic, Markdown navigation, refactor/cleanup 중 하나로 분류하고 owner와 non-goal을 정한다 | 작업 유형, owner, non-goal | owner가 두 시스템에 걸치는데 경계가 정해지지 않음 |
| 1. 기준선 수집 | 기존 working tree, 관련 source/consumer/test, 현재 검증 수치를 확인한다 | baseline과 기존 실패 목록 | 기존 실패를 새 변경의 결과처럼 해석하거나 무시함 |
| 2. 계약 고정 | behavior 변경은 cases/test를 먼저 만들고, 문서 정리는 변경 불변식과 rollback 단위를 기록한다 | cases, todo, 기대 결과 | 기대 결과 없이 구현 또는 대량 수정 시작 |
| 3. 최소 변경 | 한 책임 단위만 reversible하게 변경한다. 구현된 타입/API는 source를 authority로 두고 문서는 참조로 축소한다 | 구현/문서 diff | fuzzy 자동 수정, 대량 이동, unrelated refactor가 섞임 |
| 4. focused 검증 | 변경 파일과 직접 소비자부터 검증한다. 문서 navigation은 source-relative link와 Hyalo, semantic graph는 `def sync/validate`로 확인한다 | focused test와 명령 결과 | focused 결과 없이 전체 green만 근거로 판단 |
| 5. 영향 검증 | 변경 유형에 맞춰 L1 Data, L2 Validator, L3 Workflow, L4 Tooling과 package/API gate를 확인하고 baseline 대비 차이를 판정한다 | 결과 diff, 예상/비예상 경고 구분 | 설명되지 않은 error, silent empty, API 영향이 남음 |
| 6. 종료 | diff 범위, 잔여 todo, blocker, rollback 경로를 확인한다. 사용자가 요청한 경우에만 저장소 경계별로 커밋한다 | closure 기록과 커밋 범위 | 미해결 항목을 숨긴 채 완료 선언 |

### 변경 유형별 최소 게이트 ^constraint

| 변경 유형 | 최소 게이트 |
|---|---|
| source/package behavior | 관련 package test와 typecheck/build. public API나 계층 경계를 건드리면 `arch:feedback` 또는 해당 영향도 분석을 추가한다 |
| definition semantic | `def sync` → `def validate` → `def scan-audit` → 필요 시 workflow smoke. aspect, tier, link 의미 변경은 `semantic-change` playbook과 simulation-first 규칙을 적용한다 |
| Markdown navigation | `docs/specs/**`의 source-relative 링크 확인 → Hyalo exact/fixable 후보 dry-run → 파일 이동이 있으면 `def sync` → `def validate`. Hyalo는 `def.links`, `sources`, owner를 판정하지 않는다 |
| refactor/cleanup | consumer와 test를 먼저 확인하고, 삭제·격리는 별도 decision 단위로 분리한다. usefulness 결과만으로 자동 삭제하지 않는다 |
| mixed root/submodule closure | root와 각 submodule 상태를 별도로 확인하고, submodule commit → root pointer commit 순서를 지킨다 |

정의 문서 변경의 구체적인 명령 순서는 `definition-mgmt-verification-loop`가 소유한다. 이 문서는 언제 그 루프를 선택하는지와 작업 종료 조건만 소유한다.

### 기준선과 결과 판정 ^constraint

- 기존 baseline error/warning은 새 결과와 분리해 기록한다. 수치가 줄었다는 이유만으로 의미가 보존됐다고 판정하지 않는다.
- validator green은 구조적 필요 조건이다. 사용자 진입점의 non-empty 결과, source round-trip, CLI/API 소비자 검증이 끝나야 작업이 닫힌다.
- warning은 예상된 category와 새로 생긴 category를 분리한다. 새 category의 원인이 설명되지 않으면 commit 대상에서 제외한다.
- 문서 본문 링크와 definition graph 링크는 서로 다른 좌표다. 물리 링크를 고칠 때 `def.links[].target`의 semantic type이나 owner를 추론해 바꾸지 않는다.
- 정규 문서 내부 링크는 source 파일 기준 상대경로를 사용한다. repo 외부 근거를 가리키는 경로는 repo-relative로 유지하되 정규 docs navigation 결과와 semantic source 검증을 섞지 않는다.

### 작업 종료 기록 ^validation

작업 종료 시 다음 항목을 짧게 남긴다.

```text
작업 유형 / owner:
범위 / non-goal:
기준선:
변경 요약:
검증 명령과 결과:
예상된 잔여 / blocker:
커밋 또는 미커밋 사유:
```

이 기록은 새로운 truth 문서가 아니다. `plan`, `cases`, `todo`, `test`, `spec`의 현재 권한과 검증 결과를 연결하는 closure evidence다.

## 현재 구현 경계 ^boundary

- docs-control-plane은 BDD block, work_topic block, completed-record cleanup review를 read-only로 투영한다.
- lifecycle은 artifact authority와 handoff 규칙을 소유한다. 자동 삭제, 자동 spec 승격, package quality gate 분류는 소유하지 않는다.
- `work-domain` package는 작업 종류와 gate mapping을 소유하고, 이 문서는 plan/cases/todo/test/spec loop를 소유한다.

## 소비 ^consumes

- `doc-type-convention` — 문서 유형별 owner와 reference-first compression 규칙
- `bdd-contract-system` — behavior contract, test unit, implementation unit
- `work-topic-schema-plan` — delivery slice shape와 split heuristic
- `work-lifecycle-cases` — 실제 사용 시나리오와 실패 시 수정 대상
- `definition-mgmt-verification-loop` — definition 문서 변경의 세부 검증 순서
- `markdown-navigation-health` — 정규 Markdown navigation과 semantic graph의 책임 경계

## 검증 ^validation

```bash
corepack pnpm --filter @qa-sdk/cli test -- docs
node packages/cli/dist/index.js def validate
```
