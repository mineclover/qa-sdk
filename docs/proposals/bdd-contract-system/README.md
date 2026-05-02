---
def:
  id: bdd-contract-system-readme
  type: knowledge
  knowledge_kind: proposal
  lifecycle: draft
  owner_system: meta-semantic-system
  projection_plane: intent
status: draft
date: 2026-04-20
part_of: bdd-contract-system
role: index
supersedes: ai-dlc-dspy-harness-04-bdd-contract-model
superseded_by: -
---

> **RFC / Proposal.** `docs/proposals/bdd-contract-system/`. 아직 정규 스펙 아님.

# BDD Contract System — AI-DLC 행동 계약 체계

## 배경

BDD는 DSPy harness의 하위 기능이 아니라 AI-DLC의 상위 행동 계약 체계다. `Given / When / Then`은 사람이 읽는 형식이면서 동시에 `BddContract`, `BddTestUnit`, `BddImplementationUnit`, `ScenarioSpec`, `PipeGraph`로 이어지는 결정론적 계약이다.

## 제안 요약

BDD를 독립 시스템으로 다루고, CLI와 adapter는 그 소비 표면으로 둔다.

1. **Core mental model**: Given/When/Then, contract id, test unit, implementation unit이 의미를 소유한다.
2. **Mechanical layer**: `.cases.md` / `.test.md`의 fenced `yaml bdd` block을 파싱해 `metadata.bdd`로 투영한다.
3. **Compile layer**: `BddContract → ScenarioSpec → PipeGraph`를 deterministic하게 만든다.
4. **Consumption surface**: `qa-sdk docs bdd ...`는 BDD를 조회/검증/컴파일/계획하는 첫 소비자다.
5. **AI/DSPy boundary**: LLM/DSPy는 BDD contract를 수정하지 못하며, 보조 생성/설명/최적화 후보만 제공한다.

## 구성 문서

| 문서 | 내용 |
|------|------|
| [00-design.md](./00-design.md) | BDD core model과 시스템 경계 |
| [01-mechanical-layer.md](./01-mechanical-layer.md) | 타입/스키마/parser/read-model 기계화 설계 |
| [02-cli-consumption.md](./02-cli-consumption.md) | `qa-sdk docs bdd` 소비 표면 |
| [03-implementation-status.md](./03-implementation-status.md) | 현재 구현 상태와 남은 작업 |

## 관계

- `ai-dlc-dspy-harness`는 본 제안을 `depends_on`하는 소비자다.
- `docs-control-plane`은 본 제안의 첫 read-model/CLI 소비 표면이다.
- `bdd-contract` skill은 본 제안의 authoring workflow 소비자다.
