---
def:
  id: ai-dlc-dspy-harness-readme
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: meta-semantic-system
  projection_plane: intent
status: draft
date: 2026-04-20
part_of: ai-dlc-dspy-harness
role: index
supersedes: -
superseded_by: -
---

> **RFC / Proposal.** `docs/proposals/ai-dlc-dspy-harness/`. 아직 정규 스펙 아님.

# AI-DLC DSPy Harness — 시스템 단위 프롬프트 최적화 하네스

## 목적 ^purpose

이 문서는 AI-DLC DSPy Harness — 시스템 단위 프롬프트 최적화 하네스에 대한 제안·검토 기록을 보존하고, 관련 설계 판단과 후속 작업의 근거를 제공한다.

## 배경

AI-DLC 전환에서 [BDD Contract System](../bdd-contract-system/) / Scenario / Pipe 명세를 SSOT로 쓰려면 AI 출력 최적화 도구가 명세 체계를 흔들면 안 된다. DSPy는 유용하지만, 문서 검증이나 meta-semantic 실행 의미론에 직접 섞이면 제거가 어려워지고 결정론적 검증 경계가 흐려진다.

## 제안 요약

DSPy를 코어 시스템 내부 구현이 아니라 **시스템 단위로 탈부착 가능한 sidecar harness**로 둔다.

1. **Runtime 분리**: DSPy 실행기는 별도 하네스가 소유한다.
2. **Contract 편입**: 어떤 시스템 포트를 최적화하는지는 definition 문서가 선언한다.
3. **Evidence 편입**: compiled prompt/program, eval report, cost report는 artifact/evidence로 관리한다.
4. **Gate 편입**: `work-domain`의 `eval-benchmark`, `cost-track` gate로 품질 상태를 관측한다.
5. **Fallback 필수**: DSPy binding을 꺼도 기존 deterministic/template/mock 경로가 계속 동작해야 한다.

## 구성 문서

| 문서 | 내용 |
|------|------|
| [00-design.md](./00-design.md) | 설계 개요, 기존 시스템 대체 후보, 하네스 구조, pilot 계획 |
| [01-schema.md](./01-schema.md) | binding manifest, compiled artifact, eval/cost report 스키마 |
| [02-pilot-meta-semantic-extraction.md](./02-pilot-meta-semantic-extraction.md) | `meta-semantic` `ExtractionPort` shadow pilot 계획 |
| [03-decisions.md](./03-decisions.md) | Phase 0 결정 기록 |
| [04-bdd-contract-model.md](./04-bdd-contract-model.md) | moved note — BDD core는 `bdd-contract-system`으로 분리 |
| [05-bdd-mechanical-design.md](./05-bdd-mechanical-design.md) | moved note — BDD 기계화는 `bdd-contract-system`으로 분리 |
| [06-bdd-cli-impact.md](./06-bdd-cli-impact.md) | moved note — BDD CLI 소비 표면은 `bdd-contract-system`으로 분리 |

## 상태

- 2026-04-20: draft 작성
- 2026-04-20: Phase 1 구현 PRD + tracked fixture samples 작성
- 2026-04-20: BDD 기계화 영향 범위 + `qa-sdk docs bdd` CLI 표면 결정 반영
- 2026-04-20: BDD core/model/mechanical/CLI 설계를 [bdd-contract-system](../bdd-contract-system/) proposal로 분리
- 다음: `packages/core/src/meta-semantic/extraction-optimization.ts` schema loader 구현

## 실행 문서

| 문서 | 내용 |
|------|------|
| [tasks/prd-ai-dlc-dspy-harness-phase-1.md](../../../tasks/prd-ai-dlc-dspy-harness-phase-1.md) | Phase 1 구현 PRD |
| [tasks/prd-bdd-contract-mechanical-layer.md](../../../tasks/prd-bdd-contract-mechanical-layer.md) | BDD 기계화 구현 PRD |
| [fixtures/dspy/meta-semantic-extraction/](../../../fixtures/dspy/meta-semantic-extraction/) | binding/eval/cost sample fixtures |
