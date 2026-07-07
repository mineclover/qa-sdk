---
def:
  id: ai-dlc-dspy-harness-00-design
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: meta-semantic-system
  projection_plane: intent
status: draft
date: 2026-04-20
part_of: ai-dlc-dspy-harness
role: overview
supersedes: -
superseded_by: -
sources:
  - docs/specs/bdd-system/bdd-contract-system.spec.md
  - docs/specs/bdd-system/bdd-contract-schema.spec.md
  - docs/specs/meta-semantic/algorithm/meta-semantic-extraction.spec.md
  - docs/specs/spec-verification/spec-analyzer-system.md
  - packages/core/src/meta-semantic/extraction-pipeline.ts
  - packages/core/src/meta-semantic/extraction-prompts.ts
---

> **RFC / Proposal.** `docs/proposals/ai-dlc-dspy-harness/`의 일부로, 아직 정규 스펙이 아니다.
> 본 제안이 accepted 상태로 승격되면 정규 spec / rule / cases 문서로 분리 이식한다.

# AI-DLC DSPy Harness — 설계 개요

## 목적 ^purpose

AI-DLC 워크플로우에서 DSPy 같은 prompt optimization 도구를 도입하되, [BDD Contract System](../bdd-contract-system/) / Scenario / Pipe 명세의 단일 계약 소스와 결정론적 검증 경계를 훼손하지 않는 **시스템 단위 탈부착 하네스**를 정의한다. DSPy는 명세를 대체하지 않고, 특정 시스템 포트의 모델 판단 품질을 최적화하는 sidecar로 동작한다.

## 구성 ^overview

본 제안은 다음 결정을 고정한다.

- DSPy runtime은 definition-catalog나 meta-semantic core에 직접 편입하지 않는다.
- definition 문서는 DSPy binding의 계약, 대상 포트, fallback, gate surface만 선언한다.
- compiled prompt/program과 eval 결과는 artifact/evidence로 관리한다.
- work-domain harness는 `eval-benchmark`와 `cost-track` gate로 DSPy 품질을 관측한다.
- 첫 pilot은 `meta-semantic-extraction`의 `ExtractionPort`를 대상으로 한다.

## 현재 증거 표면 ^evidence

- BDD 계약의 정규 소유권은 `bdd-contract-system` spec과 `packages/core`의 deterministic compile/schema 구현이 가진다.
- `meta-semantic-extraction` pilot 후보는 현재 `ExtractionPort`, prompt template, mock fallback 경계가 구현된 표면에 붙는다.
- `spec-analyzer`는 deterministic drift baseline으로 남기며, DSPy가 truth 판정을 대체하지 않는다.
- 이 proposal 자체는 여전히 draft이며, DSPy sidecar 구현과 active 전환은 아직 승인된 runtime surface가 아니다.

---

## 1. 핵심 원칙 ^defines

### 1.1 명세는 SSOT, DSPy는 최적화기

BDD, ScenarioSpec, PipeGraph, PipeTransitionScope가 행동 계약을 소유한다. BDD의 `Given / When / Then` 정규 의미는 [bdd-contract-system](../bdd-contract-system/) proposal이 정의한다. DSPy는 이 계약을 더 잘 번역하거나 판단하도록 prompt/program을 최적화할 뿐, 계약 자체를 생성하거나 수정하는 authority를 갖지 않는다.

```
approved spec / cases / test
        ↓
normalized IR (ScenarioSpec / PipeGraph / TransitionScope)
        ↓
DSPy harness (optional optimizer)
        ↓
compiled prompt/program artifact
        ↓
eval + cost gates
```

### 1.2 시스템 단위 binding

DSPy 적용 단위는 repo 전체가 아니라 `(owner_system, target_port)`다. 예를 들어 `meta-semantic-system`의 `ExtractionPort`에는 DSPy binding을 붙일 수 있지만, `spec-analyzer`의 deterministic regex extractor에는 기본적으로 붙이지 않는다.

```yaml
dspy_binding:
  owner_system: meta-semantic-system
  target_port: ExtractionPort
  mode: candidate
  compiled_artifact: artifacts/dspy/meta-semantic/extraction/v1.json
  fallback: prompt-template-v1
  gates:
    - eval-benchmark
    - cost-track
```

### 1.3 제거 가능성이 설계 제약

DSPy를 제거해도 다음 경로는 유지되어야 한다.

- 정적 문서 검증: `def validate`, `def audit`
- deterministic extractor / scanner / compiler
- 기존 prompt template 또는 mock LLM
- ScenarioSpec / PipeGraph 변환
- work-domain quality gate FSM

따라서 core TypeScript 패키지는 Python/DSPy 런타임을 직접 import하지 않는다. 연결은 JSON artifact 또는 CLI runner boundary로 제한한다.

### 1.4 Evidence-first activation

DSPy binding은 사람이 승인한 eval evidence 없이 active가 될 수 없다. candidate mode에서는 output을 생성하되 production 판단에 사용하지 않고, eval/cost evidence가 gate를 통과한 뒤에만 active mode로 승격한다.

---

## 2. 기존 시스템 대체 후보 검토

### 2.1 meta-semantic-extraction — 1순위 pilot

`meta-semantic-extraction`은 이미 LLM 의존부를 `ExtractionPort`로 분리한다.

현재 구조:

- `ExtractionPort.judge(request)` — LLM 판단 포트
- `LlmJudgmentRequest.kind` — `testability`, `branch-significance`, `side-effects`, `dependency-importance`
- `PROMPT_TEMPLATES` — deterministic prompt template
- `createMockLlm()` — 테스트용 fallback
- `runExtractionPipeline()` — parser + LLM + path 계산 orchestration

판정: **DSPy sidecar를 붙이기에 가장 적합하다.**

추가할 경계:

```ts
interface OptimizedExtractionPort extends ExtractionPort {
  readonly bindingId: string;
  readonly artifactRef: string;
}
```

`DspyExtractionPort`는 compiled artifact를 읽어 `ExtractionPort`를 구현한다. 실패하거나 disabled면 기존 `PROMPT_TEMPLATES` 또는 `createMockLlm()`으로 fallback한다.

### 2.2 spec-analyzer — 대체 금지, 보조 후보만 허용

`spec-analyzer`는 regex 기반으로 선언/구현 drift를 빠르게 찾는다.

- `extractDeclarations()` — 마크다운 계약 마커에서 선언 추출
- `scanImplementations()` — TypeScript export/route surface 스캔
- `analyzeDrift()` — declared vs implemented gap 분석

판정: **DSPy로 대체하면 안 된다.** 이 시스템은 deterministic drift baseline이어야 한다.

허용되는 DSPy 사용:

- 선언 추출 실패 시 candidate declaration 제안
- undocumented symbol 설명 후보 생성
- drift report 요약

금지:

- `missing`/`coverage` 판정을 DSPy 판단으로 대체
- regex/AST scanner보다 LLM 판단을 우선 truth로 쓰기

### 2.3 work-domain harness — 실행 대상이 아니라 관측 surface

`work-domain`은 이미 AI gate kind를 갖는다.

- `eval-benchmark`
- `cost-track`

판정: **DSPy를 work-domain 내부에 넣지 않는다.** DSPy 하네스 실행 결과를 gate event로 관측한다.

권장 연결:

```
DSPy eval report
  → eval-benchmark gate passed/failed
DSPy usage/cost report
  → cost-track gate passed/failed
BundleState complete
  → definition harness convention-compliance
```

### 2.4 operational-ontology prompt artifact — artifact/evidence plane

`operational-ontology`는 prompt artifact, quality evaluation, governance closure를 이미 모델링한다. DSPy compiled prompt/program은 이 체계의 artifact로 편입하는 것이 자연스럽다.

판정: **artifact/evidence 관리 surface로 사용한다.**

편입 대상:

- compiled prompt/program artifact
- eval report
- cost report
- quality-status sidecar
- governance closure warning

### 2.5 docs-control-plane — read model

`docs-control-plane`은 `.spec.md`, `.cases.md`, `.test.md`, artifact, evidence, PRD를 source-owned read model로 모은다.

판정: **DSPy binding 상태를 읽어 보여주는 surface로 사용한다.** write authority를 부여하지 않는다.

---

## 3. 설계 상세

### 3.1 하네스 경계

DSPy 하네스는 별도 runtime boundary를 가진다.

```
TypeScript core
  ├─ ExtractionPort / PromptOptimizationPort 타입
  ├─ JSON schema validation
  ├─ fallback runner
  └─ gate/event emit

DSPy sidecar
  ├─ train / compile
  ├─ evaluate
  ├─ cost tracking
  └─ artifact materialization
```

초기 구현 후보:

```
tools/dspy-harness/
  README.md
  pyproject.toml
  dspy_harness/
    optimize.py
    evaluate.py
    schemas.py
```

TypeScript CLI는 sidecar를 subprocess로 호출하거나, 이미 생성된 artifact JSON만 읽는다. 네트워크 호출과 Python dependency는 sidecar 내부에 격리한다.

### 3.2 Binding 상태 모델

```text
disabled
  ↓ create candidate
candidate
  ↓ eval passed + cost accepted + human steering
active
  ↓ new candidate supersedes
superseded
  ↓ disable
disabled
```

| 상태 | 의미 | production 사용 |
|------|------|----------------|
| `disabled` | DSPy 미사용. fallback만 사용 | 아니오 |
| `candidate` | 최적화 결과를 생성하지만 shadow 비교만 수행 | 아니오 |
| `active` | frozen artifact를 target port에 사용 | 예 |
| `superseded` | 새 artifact로 대체됨. 재현용 보존 | 아니오 |
| `blocked` | eval/cost/contract drift로 사용 금지 | 아니오 |

active 전이 조건:

- target spec/cases/test가 approved 또는 review 상태
- eval-benchmark gate passed
- cost-track gate passed
- fallback이 존재함
- compiled artifact hash가 기록됨
- human steering 승인

### 3.3 Artifact shape

```json
{
  "artifactId": "dspy:meta-semantic-extraction:v1",
  "ownerSystem": "meta-semantic-system",
  "targetPort": "ExtractionPort",
  "targetKinds": [
    "testability",
    "branch-significance",
    "side-effects",
    "dependency-importance"
  ],
  "mode": "candidate",
  "compiledProgramRef": "artifacts/dspy/meta-semantic/extraction/v1/program.json",
  "promptTemplateFallback": "prompt-template-v1",
  "evalReportRef": "artifacts/dspy/meta-semantic/extraction/v1/eval.json",
  "costReportRef": "artifacts/dspy/meta-semantic/extraction/v1/cost.json",
  "inputSpecRefs": [
    "meta-semantic-extraction",
    "ms-concept-verification-unit"
  ],
  "hash": "sha256:..."
}
```

Artifact는 source of truth가 아니다. 재현과 activation evidence다.

### 3.4 Eval contract

최소 eval row:

```json
{
  "caseId": "meta-extraction.branch.null-check.ignored",
  "inputRef": "fixtures/meta-semantic/extraction/null-check.ts",
  "requestKind": "branch-significance",
  "expectedVerdict": false,
  "expectedExtracted": {},
  "weight": 1,
  "tags": ["branch", "negative"]
}
```

최소 metric:

| metric | 의미 | 초기 threshold |
|--------|------|----------------|
| exact verdict accuracy | expected verdict 일치율 | >= 0.90 |
| structured output validity | JSON schema parse + required fields | >= 0.98 |
| false positive cap | 제외해야 할 helper/null/log 분기 채택률 | <= 0.05 |
| fallback parity | fallback 대비 regression 없음 | required |
| average cost per judgment | 판단 1건당 평균 비용 | pilot에서 측정 후 고정 |

### 3.5 Target port adapter

core 쪽은 DSPy를 모르는 port만 정의한다.

```ts
interface PromptOptimizationArtifact {
  artifactId: string;
  ownerSystem: string;
  targetPort: string;
  targetKinds: readonly string[];
  mode: "disabled" | "candidate" | "active" | "superseded" | "blocked";
  compiledProgramRef: string;
  promptTemplateFallback: string;
  evalReportRef?: string;
  costReportRef?: string;
  hash: string;
}

interface PromptOptimizationRuntime<TRequest, TResponse> {
  run(request: TRequest): Promise<TResponse>;
  fallback(request: TRequest): Promise<TResponse>;
}
```

`DspyExtractionPort`는 `PromptOptimizationRuntime<LlmJudgmentRequest, LlmJudgmentResponse>`를 감싸는 thin adapter다.

---

## 4. AI-DLC / BDD 파이프라인과의 연결

BDD 도입 후 DSPy는 다음 단계에만 관여한다.

```
BDD .cases.md
  ↓ deterministic compile
ScenarioSpec / PipeGraph
  ↓ deterministic test generation
unit / integration tests
  ↓ production implementation
green
  ↓ optional
DSPy optimization for LLM judgment ports
```

즉, DSPy는 BDD 명세를 통과시키기 위한 production code를 직접 쓰거나 수정하지 않는다. 대신 다음 같은 “AI 판단 포트”의 품질을 개선한다.

- 코드 실행 단위 판정
- 분기 의미 판정
- side-effect / lineage facet 분류
- prompt artifact quality summary
- drift report explanation

---

## 5. 거버넌스

### 5.1 Human steering 위치

사람 개입은 active 전환 직전에 둔다.

```
candidate artifact 생성
  → eval/cost gate 실행
  → drift/fallback parity 확인
  → human steering
  → active binding 전환
```

사람이 확인할 항목:

- eval fixture가 target system의 실제 failure mode를 덮는가
- false positive가 시스템 계층을 무너뜨리지 않는가
- fallback이 명확히 존재하는가
- cost가 허용 가능한가
- compiled artifact가 approved spec/cases/test에서 벗어나지 않는가

### 5.2 금지 규칙

- DSPy output을 승인된 spec/cases/test의 자동 수정 근거로 쓰지 않는다.
- active artifact가 없을 때 production 판단을 candidate output으로 대체하지 않는다.
- eval fixture 없이 prompt/program을 active로 승격하지 않는다.
- deterministic scanner/drift baseline을 LLM 판단으로 대체하지 않는다.

### 5.3 관측 이벤트

후속 구현 시 event catalog 후보:

| event | 의미 |
|------|------|
| `dspy.binding.created` | candidate binding 생성 |
| `dspy.eval.completed` | eval 결과 산출 |
| `dspy.cost.reported` | 비용 리포트 산출 |
| `dspy.binding.activated` | active 전환 |
| `dspy.binding.blocked` | gate 실패 또는 drift로 차단 |

prefix 추가가 필요하면 5Q Checklist와 decision-domain 등록을 별도 PRD에서 다룬다. 본 draft에서는 새 prefix를 추가하지 않는다.

---

## 6. 마이그레이션 / 구현 단계

### Phase 0 — 설계 고정

- [x] 기존 대체 후보 조사
- [x] 별도 하네스 vs 문서 시스템 편입 방향 결정
- [x] binding manifest 최소 schema 확정 ([01-schema.md](./01-schema.md))
- [x] `PromptOptimizationArtifact` JSON schema 초안 작성 ([01-schema.md](./01-schema.md))
- [x] Phase 0 결정 기록 ([03-decisions.md](./03-decisions.md))

### Phase 1 — meta-semantic ExtractionPort shadow pilot

- [ ] `meta-semantic-extraction-dspy.cases.md` 작성
- [ ] eval fixture 20~30건 작성
- [ ] `DspyExtractionPort` candidate adapter 구현
- [ ] 기존 `createMockLlm()` / prompt template fallback 유지
- [ ] candidate vs fallback parity report 산출

상세: [02-pilot-meta-semantic-extraction.md](./02-pilot-meta-semantic-extraction.md)

### Phase 2 — gate/evidence 편입

- [ ] `eval-benchmark` gate command 연결
- [ ] `cost-track` gate command 연결
- [ ] compiled artifact + eval/cost report를 artifact registry 또는 local evidence로 materialize
- [ ] docs-control-plane에서 binding/evidence read model 노출

### Phase 3 — BDD pipeline 확장

- [ ] BDD 기계화 read model 도입 — `metadata.bdd` + `qa-sdk docs bdd list|validate|units` ([05-bdd-mechanical-design.md](./05-bdd-mechanical-design.md), [06-bdd-cli-impact.md](./06-bdd-cli-impact.md))
- [ ] BDD `.cases.md` → ScenarioSpec/PipeGraph compile surface와 DSPy eval을 연결
- [ ] test generation prompt 후보를 candidate mode로 최적화
- [ ] generated tests가 approved BDD contract를 벗어나면 gate fail 처리

---

## 7. 기존 체계와의 관계

| 기존 체계 | 관계 |
|----------|------|
| STC / tier-redesign | DSPy binding 문서는 System/Component 분류 대상. 상태 전이는 meta-semantic/하네스에 위임 |
| meta-semantic | 첫 pilot 대상. `ExtractionPort`를 sidecar adapter로 감싼다 |
| spec-analyzer | deterministic drift baseline 유지. DSPy는 보조 제안만 가능 |
| work-domain | `eval-benchmark`, `cost-track` gate로 DSPy 품질을 관측 |
| operational-ontology | compiled artifact와 quality evidence 관리 surface |
| bdd-contract-system | DSPy보다 상위의 행동 계약 체계. DSPy harness는 이 체계를 `depends_on`한다 |
| docs-control-plane | read-only inventory / status / evidence traversal surface. BDD 기계화의 첫 CLI 표면은 `qa-sdk docs bdd` |
| domain-hierarchy | `depends_on` 의미는 `.cases.md`/`.test.md`로 검증. DSPy는 이를 대체하지 않음 |

---

## 8. 미결 사항

### P1 — schema

- `dspy_binding`은 Phase 1에서 frontmatter가 아니라 artifact manifest로 둔다 ([03-decisions.md D-2](./03-decisions.md))
- compiled artifact hash와 model/provider metadata의 최소 필드는 [01-schema.md](./01-schema.md)를 기준으로 한다
- eval fixture 문서 확장자를 `.cases.md`로 둘지 별도 `.test.md`와 쌍으로 둘지 결정 필요

### P2 — runtime

- Python sidecar 기본 위치는 `tools/dspy-harness/`로 둔다 ([03-decisions.md D-1](./03-decisions.md))
- Node CLI에서 sidecar를 subprocess로 호출할지, artifact-only reader로 시작할지 결정 필요
- 네트워크/API key 관리는 하네스 외부 환경 변수로 둘지, CLI config로 둘지 결정 필요

### P3 — governance

- active 전환 승인 주체와 기록 위치 결정 필요
- `dspy.binding.*` 이벤트 prefix를 실제 catalog에 추가할지 판단 필요
- candidate artifact retention 기간과 superseded artifact 정리 정책 필요

### P4 — empirical validation

본 proposal이 accepted되기 전, `meta-semantic-extraction`의 `ExtractionPort`를 대상으로 shadow pilot 1건을 수행해야 한다. 성공 기준은 다음과 같다.

- candidate artifact가 fallback보다 낮은 eval 성능을 보이지 않음
- false positive cap 통과
- cost report 산출
- DSPy disabled 상태에서 기존 test suite가 그대로 통과
- active 전환 없이도 candidate evidence가 docs-control-plane에서 조회 가능
