---
def:
  id: ai-dlc-dspy-harness-01-schema
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: meta-semantic-system
  projection_plane: intent
status: draft
date: 2026-04-20
part_of: ai-dlc-dspy-harness
role: schema
supersedes: -
superseded_by: -
---

> **RFC / Proposal.** `docs/proposals/ai-dlc-dspy-harness/`의 일부로, 아직 정규 스펙이 아니다.

# DSPy Harness Schema — Binding / Artifact / Evaluation Contract

## 목적 ^purpose

DSPy 하네스가 생성하고 소비하는 binding manifest, compiled artifact, eval report, cost report의 최소 스키마를 정의한다. Phase 1에서는 definition frontmatter를 확장하지 않고, artifact manifest를 SSOT로 사용해 DSPy 도입과 제거를 쉽게 만든다.

## 구성 ^overview

- Binding manifest: 특정 `(ownerSystem, targetPort)`에 어떤 DSPy artifact를 붙일지 선언
- Compiled artifact: DSPy compile 결과와 fallback 정보를 보존
- Eval case/report: active 승격 전에 성능과 회귀를 판정
- Cost report: 판단 단위 비용과 예산 정책을 판정
- Validation rules: candidate/active 전환을 기계적으로 검증

---

## 1. SSOT 결정

Phase 1의 SSOT는 **artifact manifest JSON**이다.

```text
artifacts/dspy/<owner-system>/<target-port>/<version>/
  binding.json
  program.json
  eval-cases.json
  eval-report.json
  cost-report.json
```

definition 문서 frontmatter에는 `dspy_binding` 필드를 추가하지 않는다. 이유는 세 가지다.

- definition schema 변경 없이 pilot 가능
- DSPy 제거 시 문서 좌표/분류 체계에 잔여 필드가 남지 않음
- artifact/evidence lifecycle과 prompt optimization lifecycle을 분리 가능

정규 spec 승격 이후에도 frontmatter에는 “이 문서가 DSPy를 쓴다”가 아니라, 일반 `links`/`sources`/artifact evidence로만 연결하는 방식을 우선한다.

---

## 2. Binding Manifest

### 2.1 파일 위치

```text
artifacts/dspy/meta-semantic-system/ExtractionPort/v1/binding.json
```

### 2.2 Shape

```json
{
  "schemaVersion": "dspy-binding-v1",
  "bindingId": "dspy:meta-semantic-system:ExtractionPort:v1",
  "ownerSystem": "meta-semantic-system",
  "targetPort": "ExtractionPort",
  "targetKinds": [
    "testability",
    "branch-significance",
    "side-effects",
    "dependency-importance"
  ],
  "mode": "candidate",
  "fallback": {
    "kind": "prompt-template",
    "ref": "packages/core/src/meta-semantic/extraction-prompts.ts#PROMPT_TEMPLATES"
  },
  "artifacts": {
    "compiledProgram": "program.json",
    "evalCases": "eval-cases.json",
    "evalReport": "eval-report.json",
    "costReport": "cost-report.json"
  },
  "inputSpecRefs": [
    "meta-semantic-extraction",
    "ms-concept-verification-unit"
  ],
  "qualityGates": [
    {
      "kind": "eval-benchmark",
      "required": true,
      "reportRef": "eval-report.json"
    },
    {
      "kind": "cost-track",
      "required": true,
      "reportRef": "cost-report.json"
    }
  ],
  "activation": {
    "approvedBy": null,
    "approvedAt": null,
    "decisionRef": null
  },
  "hash": "sha256:<binding-content-hash>"
}
```

### 2.3 Field Rules

| field | rule |
|------|------|
| `schemaVersion` | `dspy-binding-v1` 고정 |
| `bindingId` | `dspy:<ownerSystem>:<targetPort>:<version>` |
| `ownerSystem` | definition 문서 ID여야 함 |
| `targetPort` | TypeScript interface 또는 adapter port 이름 |
| `targetKinds` | target port의 closed enum 값만 허용 |
| `mode` | `disabled`, `candidate`, `active`, `superseded`, `blocked` 중 하나 |
| `fallback.ref` | repo-relative source ref 또는 documented fallback ID |
| `qualityGates[].kind` | work-domain `GateKindId`여야 함 |
| `hash` | manifest canonical JSON의 sha256 |

---

## 3. Compiled Program Artifact

DSPy 내부 형식은 runtime마다 바뀔 수 있으므로, qa-sdk는 wrapper metadata만 요구한다.

```json
{
  "schemaVersion": "dspy-compiled-program-v1",
  "programId": "dspy-program:meta-semantic-extraction:v1",
  "bindingId": "dspy:meta-semantic-system:ExtractionPort:v1",
  "createdAt": "2026-04-20T00:00:00.000Z",
  "optimizer": {
    "name": "dspy",
    "version": "UNKNOWN",
    "strategy": "bootstrap-few-shot"
  },
  "model": {
    "provider": "UNKNOWN",
    "name": "UNKNOWN"
  },
  "targetKinds": {
    "testability": {
      "signature": "codeSnippet, context -> verdict, confidence, reasoning, extracted",
      "compiledRef": "embedded:testability"
    },
    "branch-significance": {
      "signature": "codeSnippet, context -> verdict, confidence, reasoning",
      "compiledRef": "embedded:branch-significance"
    }
  },
  "payload": {},
  "hash": "sha256:<program-content-hash>"
}
```

`payload`는 DSPy sidecar가 소유한다. TypeScript core는 `payload` 내부를 해석하지 않는다.

---

## 4. Eval Cases

Eval case는 사람이 승인한 기대값이다. DSPy optimizer가 이 값을 수정할 수 없다.

```json
{
  "schemaVersion": "dspy-eval-cases-v1",
  "caseSetId": "meta-semantic-extraction-v1",
  "ownerSystem": "meta-semantic-system",
  "targetPort": "ExtractionPort",
  "cases": [
    {
      "caseId": "branch.null-check.ignored",
      "requestKind": "branch-significance",
      "inputRef": "fixtures/meta-semantic/extraction/null-check.ts",
      "input": {
        "codeSnippet": "if (value == null) return undefined;",
        "context": {
          "branchCount": 2
        }
      },
      "expected": {
        "verdict": false
      },
      "weight": 1,
      "tags": ["branch", "negative", "false-positive-cap"]
    }
  ]
}
```

### 4.1 Case Categories

Phase 1 pilot는 최소 30개 case를 요구한다.

| category | count | 목적 |
|----------|------:|------|
| `testability-positive` | 5 | 독립 검증 가능한 함수 채택 |
| `testability-negative` | 5 | helper/getter/type guard 제외 |
| `branch-positive` | 5 | 비즈니스 분기 채택 |
| `branch-negative` | 7 | null/log/error 분기 제외 |
| `side-effect` | 5 | DB/event/file/http side effect 분류 |
| `dependency` | 3 | core vs auxiliary 의존 구분 |

---

## 5. Eval Report

```json
{
  "schemaVersion": "dspy-eval-report-v1",
  "bindingId": "dspy:meta-semantic-system:ExtractionPort:v1",
  "programId": "dspy-program:meta-semantic-extraction:v1",
  "caseSetId": "meta-semantic-extraction-v1",
  "generatedAt": "2026-04-20T00:00:00.000Z",
  "summary": {
    "totalCases": 30,
    "passedCases": 29,
    "weightedAccuracy": 0.967,
    "structuredOutputValidity": 1,
    "falsePositiveRate": 0.0,
    "fallbackRegressions": 0,
    "pass": true
  },
  "thresholds": {
    "weightedAccuracy": 0.9,
    "structuredOutputValidity": 0.98,
    "falsePositiveRateMax": 0.05,
    "fallbackRegressionsMax": 0
  },
  "results": [
    {
      "caseId": "branch.null-check.ignored",
      "passed": true,
      "expectedVerdict": false,
      "actualVerdict": false,
      "confidence": 0.82,
      "issues": []
    }
  ]
}
```

### 5.1 Pass Rule

`summary.pass`는 아래 조건을 모두 만족할 때만 true다.

- `weightedAccuracy >= thresholds.weightedAccuracy`
- `structuredOutputValidity >= thresholds.structuredOutputValidity`
- `falsePositiveRate <= thresholds.falsePositiveRateMax`
- `fallbackRegressions <= thresholds.fallbackRegressionsMax`
- parse error case 0건

---

## 6. Cost Report

```json
{
  "schemaVersion": "dspy-cost-report-v1",
  "bindingId": "dspy:meta-semantic-system:ExtractionPort:v1",
  "programId": "dspy-program:meta-semantic-extraction:v1",
  "generatedAt": "2026-04-20T00:00:00.000Z",
  "currency": "USD",
  "usage": {
    "totalCalls": 30,
    "totalInputTokens": 12000,
    "totalOutputTokens": 2400,
    "totalCost": 0.0,
    "averageCostPerJudgment": 0.0,
    "p95LatencyMs": 0
  },
  "budget": {
    "maxAverageCostPerJudgment": null,
    "maxP95LatencyMs": null
  },
  "pass": true
}
```

Phase 1에서는 실제 provider 비용이 없을 수 있으므로 `totalCost: 0.0`을 허용한다. 단 usage field 자체는 반드시 존재해야 한다.

---

## 7. Validation Rules

### 7.1 Candidate Validation

candidate manifest는 다음을 통과해야 한다.

- `ownerSystem` definition 문서 존재
- `targetPort` adapter 구현 또는 documented interface 존재
- fallback ref 존재
- eval cases 존재
- eval report shape valid
- cost report shape valid
- compiled program hash 존재

### 7.2 Active Validation

active manifest는 candidate 조건에 더해 다음을 요구한다.

- eval report `summary.pass === true`
- cost report `pass === true`
- `activation.approvedBy` not null
- `activation.approvedAt` valid ISO timestamp
- `activation.decisionRef` 또는 review evidence ref 존재
- `mode === "active"`인 같은 `(ownerSystem, targetPort)` manifest가 1개 이하

### 7.3 Block Conditions

다음 경우 manifest는 `blocked`로 전환해야 한다.

- eval report parse 실패
- false positive cap 초과
- fallback regression 발생
- compiled program hash와 manifest hash 불일치
- target spec/cases/test가 변경됐지만 eval report가 갱신되지 않음

---

## 8. Phase 1 비목표

- definition frontmatter schema 확장
- 새 prefix 추가
- DSPy provider/API key 표준화
- production active binding
- spec-analyzer drift truth 대체
