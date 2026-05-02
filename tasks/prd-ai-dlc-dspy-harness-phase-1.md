# PRD: AI-DLC DSPy Harness Phase 1

## Overview

Implement the first shadow pilot for the AI-DLC DSPy harness. The pilot targets `meta-semantic-system`'s `ExtractionPort` and proves that a DSPy-style optimization layer can be attached at a system port boundary without changing production judgment, definition frontmatter, or deterministic validation.

This is a shadow-mode implementation. It creates schema validation, fixture/eval input surfaces, report generation contracts, and a candidate adapter boundary. It does not activate DSPy output in production.

## Why

The proposal in `docs/proposals/ai-dlc-dspy-harness/` identifies a real gap: qa-sdk has strong deterministic documentation, Scenario/Pipe, drift, and gate systems, but it does not yet have a governed lifecycle for prompt/program optimization artifacts. Without a sidecar harness, prompt optimization can leak into core code, replace deterministic truth, or become impossible to roll back.

Phase 1 closes the smallest useful part of that gap by using the existing `ExtractionPort` seam in `meta-semantic-extraction`.

## Scope

### In Scope

- Add artifact-only schemas for DSPy binding, compiled program metadata, eval cases, eval report, and cost report.
- Add a fixture/eval case set for `ExtractionPort` request kinds.
- Add a shadow comparison path that evaluates fallback and candidate outputs without replacing production behavior.
- Add candidate adapter types for an artifact-backed `ExtractionPort`.
- Keep Python/DSPy runtime outside `packages/core`.
- Produce tracked sample fixture files under `fixtures/dspy/meta-semantic-extraction/`.
- Document commands and verification evidence for the pilot.

### Out of Scope

- No active production binding.
- No definition frontmatter field such as `dspy_binding`.
- No new event prefix or DEMO_CATALOG entry.
- No changes to `spec-analyzer` drift truth.
- No BDD compile changes.
- No real provider/API key standardization.

## Goals

- Prove the DSPy harness can be attached and removed at `(ownerSystem, targetPort)`.
- Keep `packages/core` free of Python/DSPy dependencies.
- Make eval/cost evidence mandatory before any future active mode.
- Preserve existing `createMockLlm()` and prompt template fallback paths.
- Provide a concrete pilot path for later BDD/test-generation prompt optimization.

## User Stories

### US-001: Add artifact-only schema validation

**Description:** As a maintainer, I want TypeScript schema validation for DSPy binding artifacts so that candidate output can be checked without importing Python/DSPy runtime.

**Acceptance Criteria:**

- `packages/core/src/meta-semantic/extraction-optimization.ts` defines schema/types for `binding.json`, `program.json`, `eval-cases.json`, `eval-report.json`, and `cost-report.json`.
- The schema matches `docs/proposals/ai-dlc-dspy-harness/01-schema.md`.
- Validation rejects unknown `mode`, missing fallback, invalid target kind, and missing report refs.
- Active validation requires approval fields, while candidate validation does not.
- Unit tests cover valid candidate, invalid target kind, active missing approval, and blocked hash mismatch.
- `pnpm --filter @qa-sdk/core test -- meta-semantic` passes.

### US-002: Add ExtractionPort eval fixtures

**Description:** As a maintainer, I want a tracked fixture set for `ExtractionPort` judgments so that candidate optimizers can be measured against stable expectations.

**Acceptance Criteria:**

- `fixtures/dspy/meta-semantic-extraction/eval-cases.v1.sample.json` contains at least 30 cases.
- Cases cover `testability`, `branch-significance`, `side-effects`, and `dependency-importance`.
- At least 10 cases are derived from current qa-sdk source behavior or current source boundaries.
- Negative branch cases include null checks, logging/debug flags, try/catch, and defensive default.
- False-positive cap cases are tagged with `false-positive-cap`.
- The fixture README explains that runtime reports are generated under ignored `artifacts/dspy/...`.

### US-003: Generate fallback baseline report

**Description:** As a maintainer, I want a fallback baseline report from existing prompt-template/mock behavior so that candidate DSPy output can be compared without changing production paths.

**Acceptance Criteria:**

- A script or test helper loads eval cases and runs the existing fallback `ExtractionPort`.
- The output conforms to `dspy-eval-report-v1`.
- The report includes `fallback` result details for each case.
- The report records parse/schema issues separately from semantic failures.
- Running the baseline does not require Python, DSPy, network access, or API keys.

### US-004: Add candidate adapter boundary

**Description:** As a maintainer, I want a candidate `DspyExtractionPort` adapter that reads artifacts but stays out of production unless explicitly injected.

**Acceptance Criteria:**

- Adapter implements `ExtractionPort`.
- Adapter accepts `binding.json` and `program.json` paths or parsed objects.
- Adapter refuses `active` mode unless active validation passes.
- In `candidate` mode, adapter can be used only by explicit shadow comparison code.
- Adapter falls back to the provided fallback port when candidate output is missing, invalid, or disabled.
- No call site in `runExtractionPipeline()` is changed to use candidate output by default.

### US-005: Produce eval and cost reports

**Description:** As a maintainer, I want eval and cost reports for candidate runs so that work-domain gates can later consume the results.

**Acceptance Criteria:**

- Eval report computes weighted accuracy, structured output validity, false positive rate, fallback regressions, and pass/fail.
- Cost report includes call count, token fields, average cost per judgment, p95 latency, and pass/fail.
- Zero-cost local stub runs are valid but still populate usage fields.
- Eval pass rule requires accuracy, schema validity, false-positive cap, and fallback regression thresholds.
- Sample reports under `fixtures/dspy/meta-semantic-extraction/` match the schema.

### US-006: Document the Phase 1 verification workflow

**Description:** As a reviewer, I want a clear workflow for running and reviewing the shadow pilot so that candidate evidence can be checked consistently.

**Acceptance Criteria:**

- `docs/proposals/ai-dlc-dspy-harness/02-pilot-meta-semantic-extraction.md` links to this PRD and fixture samples.
- The workflow distinguishes tracked fixture samples from ignored runtime artifacts.
- The workflow states that active mode is forbidden in Phase 1.
- The workflow includes verification commands for core tests and definition validation.
- `qa-sdk def validate` passes after documentation changes.

## Functional Requirements

- FR-1: DSPy harness Phase 1 must not add Python/DSPy dependencies to `@qa-sdk/core`.
- FR-2: Candidate artifacts must be validateable without executing the optimizer.
- FR-3: Production extraction behavior must be unchanged unless a caller explicitly injects a candidate adapter.
- FR-4: Fallback path must remain available and tested.
- FR-5: Candidate output must never modify approved specs, cases, tests, ScenarioSpec, PipeGraph, or production code.
- FR-6: Eval/cost reports must be stable JSON artifacts that later gates can consume.

## Quality Gates

- `pnpm --filter @qa-sdk/core test -- meta-semantic`
- `pnpm --filter @qa-sdk/core typecheck`
- `pnpm --filter @qa-sdk/core build`
- `qa-sdk def validate`

## Non-Goals

- No active DSPy production usage.
- No remote model provider integration.
- No prompt optimization for BDD compile or test generation yet.
- No artifact registry persistence beyond local JSON shape.
- No new catalog prefix.

## Implementation Notes

- Prefer `zod` because `@qa-sdk/core` already depends on it.
- Keep fixture samples under `fixtures/dspy/...`; keep generated reports under ignored `artifacts/dspy/...`.
- The first implementation can use deterministic stub candidate output to validate report shape before real DSPy is introduced.
- Treat false positives as more severe than false negatives for this pilot.

## Open Questions

- Should Phase 1 expose a `qa-sdk dspy extraction eval` command immediately, or start with package-level test helpers?
- Should candidate output be stored as full per-case JSON or only aggregate reports?
- Should runtime artifacts be copied into programming-artifact registry records during Phase 2, or remain local files?
