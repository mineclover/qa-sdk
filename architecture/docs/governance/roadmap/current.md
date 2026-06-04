---
id: GOV-ROADMAP-20260526
type: RoadmapDocument
title: v0.1 Roadmap
date: 2026-05-26
scope: SCOPE-GOVERNANCE
lifecycle:
  state: active
  created_at: 2026-05-26
  updated_at: 2026-05-27
  resolved_at: null
  archived_at: null
refs:
  - model/archi-adr.yaml
tags:
  - governance
  - roadmap
---

# Roadmap

## Goal

Archi-ADR DSL 기반 아키텍처 정의 시스템의 v0.1 기반 구조를 확정한다.

## Scope

- YAML DSL 모델 정의
- Governance 문서 계층 정의
- 검증 규칙 정의
- Mermaid 출력 구조 정의

## Non-Scope

- CLI 도구 구현
- 자동화 파이프라인 구현
- History Compression 엔진

## Milestones

| ID | Milestone | Status | Notes |
|---|---|---|---|
| M-001 | DSL 모델 정의 | done | archi-adr.yaml |
| M-002 | Governance 문서 구조 정의 | done | 7개 문서 타입 |
| M-003 | 검증 규칙 정의 | done | 12개 규칙 |
| M-004 | 초기 파일 생성 | done | 19개 파일 생성 완료 |

## Dependencies

- 없음 (v0.1은 자체 완결)

## Risks

- 문서 폭증 리스크 → Compression Layer 필요 (v0.2)
- 수동 운영 한계 → LLM-assisted governance 필요 (장기)

## Exit Criteria

- [x] architecture/ 디렉토리 전체 생성 완료
- [x] archi-adr.yaml에 Core System + Governance 모델 포함
- [x] 모든 current.md 초기화 완료
- [x] validation 스키마 및 규칙 정의 완료
