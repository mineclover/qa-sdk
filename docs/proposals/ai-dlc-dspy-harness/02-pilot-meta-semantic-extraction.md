---
def:
  id: ai-dlc-dspy-harness-02-pilot-meta-semantic-extraction
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: meta-semantic-system
  projection_plane: intent
status: draft
date: 2026-04-20
part_of: ai-dlc-dspy-harness
role: pilot-plan
supersedes: -
superseded_by: -
---

> **RFC / Proposal.** `docs/proposals/ai-dlc-dspy-harness/`의 일부로, 아직 정규 스펙이 아니다.

# Pilot — meta-semantic ExtractionPort Shadow Harness

## 목적 ^purpose

`meta-semantic-extraction`의 `ExtractionPort`를 대상으로 DSPy 하네스가 실제로 탈부착 가능한지 검증한다. 본 pilot은 **shadow mode**만 수행하며, production 판단은 기존 prompt template/mock/fallback 경로를 유지한다.

## 구성 ^overview

- 대상 시스템: `meta-semantic-system`
- 대상 포트: `ExtractionPort`
- 대상 요청: `testability`, `branch-significance`, `side-effects`, `dependency-importance`
- 실행 모드: `candidate`
- active 전환: Phase 1 범위 밖
- 성공 기준: eval/cost report 산출 + fallback regression 0 + disabled 상태에서 기존 test suite 통과

---

## 1. Target Boundary

### 1.1 Current Port

현재 `ExtractionPort`는 아래 형태다.

```ts
interface ExtractionPort {
  judge(request: LlmJudgmentRequest): Promise<LlmJudgmentResponse>;
}
```

하네스는 이 포트 바깥에서 동작한다. `runExtractionPipeline()`의 입력으로 들어가는 `llm` 인자를 바꿔 shadow 비교한다.

### 1.2 Adapter Layout

Phase 1 구현 후보:

```text
packages/core/src/meta-semantic/
  extraction-optimization.ts      # artifact schema type + loader
  dspy-extraction-port.ts         # artifact-backed ExtractionPort
  extraction-optimization.test.ts

tools/dspy-harness/
  pyproject.toml
  dspy_harness/
    optimize.py
    evaluate.py
    extraction_port.py
    schemas.py
```

`packages/core`는 Python을 실행하지 않는다. core adapter는 이미 생성된 `program.json`과 `binding.json`을 읽어 판단 포트로 노출하거나, disabled/candidate 상태에 따라 fallback을 호출한다.

구현 PRD: [tasks/prd-ai-dlc-dspy-harness-phase-1.md](../../../tasks/prd-ai-dlc-dspy-harness-phase-1.md)

### 1.3 CLI Layout

Phase 1 CLI 후보:

```bash
qa-sdk dspy extraction eval \
  --binding artifacts/dspy/meta-semantic-system/ExtractionPort/v1/binding.json \
  --json

qa-sdk dspy extraction compare \
  --binding artifacts/dspy/meta-semantic-system/ExtractionPort/v1/binding.json \
  --fallback prompt-template-v1 \
  --json
```

초기에는 `qa-sdk` 정식 command가 아니라 script로 시작할 수 있다.

```bash
node packages/cli/dist/index.js dspy extraction eval ...
```

정식 command 편입은 eval/cost report shape가 안정된 뒤 진행한다.

---

## 2. Fixture Set

### 2.1 Directory

```text
fixtures/dspy/meta-semantic-extraction/
  README.md
  binding.sample.json
  eval-cases.v1.sample.json
  eval-report.sample.json
  cost-report.sample.json
```

### 2.2 Minimum Cases

| group | examples | expected |
|-------|----------|----------|
| testability positive | public pure function, typed transform, stateful operation with explicit port | `verdict: true` |
| testability negative | getter, type guard, private helper, pass-through wrapper | `verdict: false` |
| branch positive | domain state branch, permission policy branch, lifecycle transition branch | `verdict: true` |
| branch negative | null check, logging flag, try/catch, defensive default | `verdict: false` |
| side-effects | db write, event emit, file write, HTTP call | extracted sideEffects not empty |
| dependency importance | core repository, logger, metrics, cache | core dependency true, auxiliary false |

### 2.3 Fixture Rule

Fixture는 실제 qa-sdk 코드에서 최소 10건을 가져오고, synthetic case는 false-positive boundary를 보강하는 데만 사용한다.

우선 후보:

- `packages/core/src/meta-semantic/extraction-pipeline.ts`
- `packages/core/src/meta-semantic/extraction-prompts.ts`
- `packages/spec-analyzer/src/extractor.ts`
- `packages/spec-analyzer/src/drift.ts`
- `packages/work-domain/src/classify.ts`

Tracked sample fixture: [eval-cases.v1.sample.json](../../../fixtures/dspy/meta-semantic-extraction/eval-cases.v1.sample.json)

---

## 3. Shadow Execution Flow

```text
eval-cases.json
  ↓
fallback ExtractionPort 실행
  ↓
candidate DspyExtractionPort 실행
  ↓
schema validation
  ↓
case-level comparison
  ↓
eval-report.json + cost-report.json
  ↓
work-domain gate event 후보 생성
```

Shadow mode에서는 `runExtractionPipeline()`의 production 결과를 candidate 결과로 대체하지 않는다.

---

## 4. Required Reports

### 4.1 Compare Report

`eval-report.json`에는 candidate와 fallback 결과를 함께 기록한다.

```json
{
  "caseId": "branch.null-check.ignored",
  "expectedVerdict": false,
  "candidate": {
    "verdict": false,
    "confidence": 0.82
  },
  "fallback": {
    "verdict": false,
    "confidence": 0.2
  },
  "passed": true,
  "regression": false
}
```

Regression 정의:

- fallback passed, candidate failed
- candidate output schema invalid
- false-positive tagged case에서 candidate가 `verdict: true`

### 4.2 Gate Projection

eval report는 `eval-benchmark` gate로 투영된다.

```json
{
  "gateKind": "eval-benchmark",
  "gateScope": "ai",
  "state": "passed",
  "contractDocId": "ai-dlc-dspy-harness-02-pilot-meta-semantic-extraction",
  "reportRef": "artifacts/dspy/meta-semantic-system/ExtractionPort/v1/eval-report.json"
}
```

cost report는 `cost-track` gate로 투영된다.

---

## 5. Implementation Steps

### Step 1 — artifact-only schema loader

- `binding.json`, `program.json`, `eval-report.json`, `cost-report.json` Zod schema 작성
- canonical hash 계산
- active/candidate validation 함수 작성
- Python/DSPy 호출 없음

### Step 2 — fixture and fallback baseline

- eval cases 30건 작성
- 기존 `createMockLlm()` 또는 prompt-template-backed fallback으로 baseline report 산출
- fallback baseline을 artifact로 저장

### Step 3 — sidecar runner

- `tools/dspy-harness` 생성
- eval cases를 읽어 DSPy candidate output 생성
- provider가 없으면 deterministic stub mode로 report shape만 검증

### Step 4 — candidate adapter

- `DspyExtractionPort`는 candidate mode에서 shadow output을 읽을 수 있음
- production pipeline에는 주입하지 않음
- test에서 fallback parity만 확인

### Step 5 — gate/evidence projection

- eval/cost report를 work-domain gate event 후보로 변환
- docs-control-plane에서 artifact path를 source/evidence 후보로 조회 가능하게 함

---

## 6. Acceptance Criteria

Pilot 완료 조건:

- `binding.json` schema validation 통과
- eval cases 30건 이상
- eval report `summary.pass === true`
- cost report shape valid
- fallback regressions 0
- DSPy disabled 상태에서 `pnpm --filter @qa-sdk/core test -- meta-semantic` 통과
- candidate artifact가 production judgment를 대체하지 않음

Rollback 조건:

- core package가 Python/DSPy dependency를 직접 갖게 됨
- eval report 없이 candidate output이 production 경로에 주입됨
- fallback 경로가 제거되거나 깨짐
- false positive cap 초과

---

## 7. Phase 1 이후 확장 후보

Pilot이 성공하면 다음 순서로 확장한다.

1. BDD `.cases.md` → ScenarioSpec/PipeGraph 변환 prompt 후보
2. generated test skeleton prompt 후보
3. spec-analyzer drift explanation 후보
4. prompt artifact quality summary 후보

각 확장은 새로운 `(ownerSystem, targetPort)` binding으로 별도 관리한다.
