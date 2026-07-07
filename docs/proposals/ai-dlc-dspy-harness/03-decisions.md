---
def:
  id: ai-dlc-dspy-harness-03-decisions
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: meta-semantic-system
  projection_plane: intent
status: draft
date: 2026-04-20
part_of: ai-dlc-dspy-harness
role: decisions
supersedes: -
superseded_by: -
sources:
  - docs/specs/bdd-system/bdd-contract-system.spec.md
  - docs/specs/bdd-system/bdd-contract-cli.spec.md
  - docs/specs/meta-semantic/algorithm/meta-semantic-extraction.spec.md
  - docs/specs/spec-verification/spec-analyzer-system.md
  - docs/specs/system/work-domain.spec.md
  - packages/core/src/meta-semantic/extraction-pipeline.ts
---

> **RFC / Proposal.** `docs/proposals/ai-dlc-dspy-harness/`의 일부로, 아직 정규 스펙이 아니다.

# DSPy Harness — 결정 기록

## 목적 ^purpose

AI-DLC DSPy 하네스 proposal의 Phase 0 결정을 기록한다. 목표는 Phase 1 pilot이 시작되기 전에 “무엇을 바꾸고, 무엇을 바꾸지 않는가”를 명확히 고정하는 것이다.

## 구성 ^overview

결정은 D-1부터 번호를 부여한다. 각 결정은 상태, 가역성, 근거, 영향을 함께 기록한다.

## 현재 증거 표면 ^evidence

- D-4와 D-10의 현재 구현 근거는 `meta-semantic-extraction` 포트와 `bdd-contract-system` spec/compile 경계다.
- D-5의 현재 근거는 `spec-analyzer` deterministic baseline spec이다.
- D-6부터 D-9까지의 DSPy event/cost/eval 활성화는 아직 draft 결정이며, runtime 승격 전까지 proposal evidence로만 둔다.

---

## D-1 — DSPy runtime은 sidecar harness로 둔다

| 항목 | 값 |
|------|----|
| status | accepted-for-pilot |
| reversibility | high |
| scope | runtime boundary |

DSPy/Python runtime은 definition-catalog, meta-semantic core, work-domain 내부로 들어오지 않는다. Phase 1에서는 `tools/dspy-harness` 또는 동등한 sidecar boundary가 DSPy 실행을 소유한다.

근거:

- core TypeScript package의 dependency 오염 방지
- 제거 시 기존 deterministic path 보존
- provider/API key/network concern 격리

영향:

- TypeScript core는 JSON artifact schema와 adapter만 소유
- DSPy compile/evaluate는 sidecar command가 소유

---

## D-2 — Binding SSOT는 frontmatter가 아니라 artifact manifest다

| 항목 | 값 |
|------|----|
| status | accepted-for-pilot |
| reversibility | high |
| scope | schema |

Phase 1에서는 `def:` frontmatter에 `dspy_binding`을 추가하지 않는다. Binding SSOT는 `artifacts/dspy/.../binding.json`이다.

근거:

- definition schema 변경 없이 pilot 가능
- DSPy 제거 시 문서 좌표 체계가 깨끗하게 남음
- compiled artifact/eval/cost evidence와 lifecycle을 같이 관리 가능

영향:

- `def validate`는 Phase 1에서 DSPy binding을 검사하지 않음
- 별도 `dspy validate` 또는 pilot script가 binding manifest를 검사
- 정규 spec 승격 이후에도 frontmatter 확장은 별도 결정으로 보류

---

## D-3 — 기본 mode는 candidate이며 production 판단에 쓰지 않는다

| 항목 | 값 |
|------|----|
| status | accepted-for-pilot |
| reversibility | high |
| scope | activation |

새 DSPy binding은 항상 `candidate`로 생성된다. Candidate output은 eval/shadow 비교에만 사용하고 production 판단을 대체하지 않는다.

active 전환 조건:

- eval-benchmark pass
- cost-track pass
- fallback 존재
- fallback regression 0
- human steering 승인

---

## D-4 — 첫 pilot은 meta-semantic `ExtractionPort`다

| 항목 | 값 |
|------|----|
| status | accepted-for-pilot |
| reversibility | medium |
| scope | pilot target |

첫 pilot target은 `meta-semantic-system`의 `ExtractionPort`다.

근거:

- 이미 LLM 판단 포트가 분리돼 있음
- request kind가 closed enum으로 고정돼 있음
- `createMockLlm()`과 prompt template fallback이 존재
- 실패해도 production path에 영향이 적음

비대상:

- `spec-analyzer` drift truth
- work-domain gate FSM
- definition frontmatter validation

---

## D-5 — spec-analyzer는 deterministic baseline으로 유지한다

| 항목 | 값 |
|------|----|
| status | accepted |
| reversibility | medium |
| scope | drift analysis |

`spec-analyzer`의 `extractDeclarations`, `scanImplementations`, `analyzeDrift` 결과는 deterministic baseline으로 유지한다. DSPy는 보조 설명이나 candidate declaration 제안에는 사용할 수 있지만, `missing`, `coverage`, `undocumented` 판정의 truth가 될 수 없다.

근거:

- drift 분석은 repeatable해야 함
- LLM 판단이 truth가 되면 spec/code 정합성 gate가 흔들림
- 빠르고 의존성 없는 baseline이 이미 존재

---

## D-6 — Phase 1에서는 새 prefix/event catalog를 추가하지 않는다

| 항목 | 값 |
|------|----|
| status | accepted-for-pilot |
| reversibility | high |
| scope | observability |

`dspy.binding.created`, `dspy.eval.completed` 등 이벤트는 후보로만 기록한다. Phase 1에서는 DEMO_CATALOG나 event prefix를 추가하지 않는다.

근거:

- prefix 추가는 5Q Checklist와 decision-domain 등록이 필요
- pilot의 목적은 runtime boundary와 artifact shape 검증
- 새 관측 좌표 없이도 eval/cost report 파일로 충분히 검증 가능

후속:

- Phase 2에서 실제 gate event projection이 필요해지면 prefix 추가 여부를 별도 결정

---

## D-7 — Eval threshold는 false-positive 억제를 우선한다

| 항목 | 값 |
|------|----|
| status | accepted-for-pilot |
| reversibility | high |
| scope | evaluation |

초기 threshold:

| metric | threshold |
|--------|-----------|
| weighted accuracy | `>= 0.90` |
| structured output validity | `>= 0.98` |
| false positive rate | `<= 0.05` |
| fallback regressions | `0` |

false positive는 false negative보다 위험하게 본다. AI-DLC에서 과잉 채택된 실행 단위/분기는 시스템 계층을 무너뜨릴 수 있기 때문이다.

---

## D-8 — Active 전환은 사람 승인 전까지 금지한다

| 항목 | 값 |
|------|----|
| status | accepted |
| reversibility | medium |
| scope | governance |

eval/cost gate가 모두 통과해도 active 전환은 자동 수행하지 않는다. 사람이 eval fixture 품질, false positive, fallback, cost를 확인하고 승인해야 한다.

승인 기록 후보:

- `binding.json.activation.approvedBy`
- `binding.json.activation.approvedAt`
- `binding.json.activation.decisionRef`

Phase 1에서는 active 전환 자체를 수행하지 않으므로 승인 필드는 null로 남긴다.

---

## D-9 — Cost report는 값이 0이어도 필수다

| 항목 | 값 |
|------|----|
| status | accepted-for-pilot |
| reversibility | high |
| scope | cost governance |

로컬 stub 또는 mock provider를 쓰더라도 `cost-report.json`은 반드시 생성한다. 실제 비용이 0이면 0으로 기록하되, call count, token count, latency field는 남긴다.

근거:

- 비용 관측 surface를 pilot 이후에 붙이면 누락되기 쉬움
- active 전환 조건에 cost-track을 포함하려면 초기에 shape를 고정해야 함

---

## D-10 — BDD/Scenario/Pipe compile은 DSPy 대상이 아니다

| 항목 | 값 |
|------|----|
| status | accepted |
| reversibility | medium |
| scope | AI-DLC contract |

BDD `.cases.md`에서 ScenarioSpec/PipeGraph로 변환하는 compile 단계는 deterministic이어야 한다. BDD의 계약 정규형은 [04-bdd-contract-model.md](./04-bdd-contract-model.md)를 따른다. DSPy는 compile 결과를 최적화하거나 수정하지 않는다.

허용:

- BDD 작성 보조 후보
- 테스트 skeleton 생성 후보
- drift explanation 후보

금지:

- approved BDD contract 자동 수정
- ScenarioSpec/PipeGraph truth 생성
- production code patch를 DSPy output만으로 승인

---

## D-11 — BDD 기계화의 첫 CLI 표면은 `qa-sdk docs bdd`다

| 항목 | 값 |
|------|----|
| status | accepted-for-pilot |
| reversibility | high |
| scope | CLI / read model |

BDD block의 source는 `.cases.md` / `.test.md` 문서다. Phase 1에서는 새 top-level `qa-sdk bdd`를 만들지 않고, 기존 docs-control-plane 아래에 `qa-sdk docs bdd list|validate|units`를 추가한다.

근거:

- BDD는 아직 독립 런타임이나 저장소가 아니라 source-owned document block
- `definition-markdown` adapter가 이미 `.cases.md` / `.test.md`를 수집
- 기존 `docs status` / `docs collect` / `docs graph` read model과 호환됨
- ScenarioSpec/PipeGraph compile 전에는 `qa-sdk spec`으로 노출하면 역할이 섞임

Phase 1 interface:

```bash
qa-sdk docs bdd list <doc-id|path> [--family-only] [--json]
qa-sdk docs bdd validate <doc-id|path> [--family-only] [--json]
qa-sdk docs bdd units <doc-id|path> [--family-only] [--json]
```

금지:

- Phase 1에서 top-level `qa-sdk bdd` 생성
- Phase 1에서 `qa-sdk spec` 하위 command로 BDD 노출
- Phase 1에서 `def validate` hard error로 BDD 미작성 문서 차단

상세: [06-bdd-cli-impact.md](./06-bdd-cli-impact.md)

---

## D-12 — BDD 기계화는 additive read-model update로 시작한다

| 항목 | 값 |
|------|----|
| status | accepted-for-pilot |
| reversibility | high |
| scope | compatibility |

BDD 기계화 구현은 기존 문서/CLI JSON shape를 깨지 않는 additive update로 시작한다.

Phase 1 변경:

- `@qa-sdk/core`: BDD 타입/Zod schema export 추가
- `docs-control-plane`: fenced YAML `bdd` block parser 추가
- `DocumentEnvelope.metadata.bdd`: optional interpreter namespace 추가
- `qa-sdk docs`: `bdd` 하위 command 추가

Phase 1 비변경:

- `doc-envelope` public shape 직접 확장 없음 (`DocumentMetadata` generic 사용)
- `qa-sdk def` hard validation 없음
- `qa-sdk spec` command 변경 없음
- `work-domain` gate 변경 없음
- ScenarioSpec/PipeGraph compile 없음

상세: [05-bdd-mechanical-design.md](./05-bdd-mechanical-design.md), [06-bdd-cli-impact.md](./06-bdd-cli-impact.md)

---

## Open Decisions

### OD-1 — Phase 2 prefix 추가 여부

실제 `dspy.*` 이벤트를 ingest pipeline으로 보내려면 prefix/event catalog 추가가 필요하다. Phase 1 완료 후 5Q Checklist로 판단한다.

### OD-2 — artifact registry 편입 방식

Phase 1은 repo-local JSON을 사용한다. Phase 2에서 programming artifact registry record로 편입할지 결정한다.

### OD-3 — sidecar 위치

기본안은 `tools/dspy-harness`다. Python packaging과 CI 편의성이 확인되면 별도 package로 승격할 수 있다.
