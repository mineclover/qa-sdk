---
id: GOV-HISTORY-INDEX
type: HistoryIndexDocument
title: History Index
date: 2026-05-26
scope: SCOPE-GOVERNANCE
lifecycle:
  state: active
  created_at: 2026-05-26
  updated_at: 2026-05-26
  resolved_at: null
  archived_at: null
refs:
  - docs/governance/timeline.md
tags:
  - governance
  - history
---

# History Index

## v0.1 Foundation

### Summary

ADR 기반 아키텍처 다이어그램 정의 체계의 기본 구조를 확정했다.
Core System(Asset → Event → Flow → Action 루프)을 YAML DSL로 모델링하고,
Governance 문서 계층 7종을 정의했다.

### Key Decisions

- YAML DSL을 원본으로 둔다.
- Mermaid는 출력 포맷으로만 사용한다.
- BusinessLogicDocument와 MetadataDefinitionDocument를 분리한다.
- Governance 문서 계층을 추가한다.
- 구조는 폴더로, 시간은 파일명 suffix로 표현한다.
- current.md는 HEAD pointer 역할을 한다.
- Scope Unit 개념을 도입한다 (v0.2에서 구체화).

### Important Files

| Type | File |
|---|---|
| Model | model/archi-adr.yaml |
| Roadmap | docs/governance/roadmap/current.md |
| PRD | docs/governance/prd/current.md |
| Progress | docs/governance/progress/current.md |
| Handoff | docs/governance/handoff/current.md |
| Timeline | docs/governance/timeline.md |

### Scope Coverage

| Scope | Status |
|---|---|
| SCOPE-DSL | 모델 정의 완료 |
| SCOPE-GOVERNANCE | 문서 구조 확정 |
| SCOPE-VALIDATOR | 규칙 정의 완료 |
| SCOPE-RENDERER | v0.2 예정 |
| SCOPE-METADATA | v0.2 예정 |
