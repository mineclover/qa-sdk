---
id: GOV-PRD-20260526
type: PRDDocument
title: Archi-ADR DSL PRD
date: 2026-05-26
scope: SCOPE-DSL
lifecycle:
  state: draft
  created_at: 2026-05-26
  updated_at: 2026-05-26
  resolved_at: null
  archived_at: null
refs:
  - model/archi-adr.yaml
  - docs/governance/roadmap/current.md
tags:
  - governance
  - prd
---

# PRD

## Problem

아키텍처 설계 결정이 산발적인 문서, 구두 합의, 코드 주석에 분산되어 있어 추적과 검증이 불가능하다.

## Goal

YAML DSL을 원본으로 하는 아키텍처 정의 시스템을 구축하여, Element / Relation / View / Validation Rule을 체계적으로 관리한다.

## Requirements

| ID | Requirement | Priority | Status |
|---|---|---|---|
| REQ-001 | YAML DSL로 Element 정의 | P0 | done |
| REQ-002 | Relation 타입 정의 및 검증 | P0 | done |
| REQ-003 | View 정의 및 Mermaid 출력 | P0 | done |
| REQ-004 | Governance 문서 계층 정의 | P0 | done |
| REQ-005 | Lifecycle 상태 관리 | P1 | done |
| REQ-006 | Semantic Validation Rules | P1 | done |
| REQ-007 | Scope Unit 기반 분류 | P2 | planned |

## Non-Requirements

- GUI 편집기
- 실시간 협업
- 버전 관리 자동화 (Git으로 대체)

## Validation Criteria

- archi-adr.yaml이 정의된 스키마를 통과할 것
- 모든 Relation의 source/target이 유효한 Element ID일 것
- View가 참조하는 모든 Element/Relation이 존재할 것

## Deliverables

- model/archi-adr.yaml
- validation/schema.json
- validation/semantic-rules.yaml
- Governance 문서 템플릿 7종

## Related ADR

- (향후 ADR 연결)

## Related Roadmap

- GOV-ROADMAP-20260526
