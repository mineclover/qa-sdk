---
def:
  id: deterministic-label-registry-fsm-todo
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: mediation
  svc: cli
  tags: [structural, contract, observability]
  links:
    - target: deterministic-label-registry-fsm-plan
      type: refines
    - target: docs-control-plane
      type: depends_on
    - target: docs-control-plane-rule
      type: depends_on
    - target: definition-state-model
      type: depends_on
---

# Deterministic Label Registry And FSM — TODO

## 목적 ^purpose

semantic coordinate, label registry, FSM state, transition controller를 `qa-sdk docs`/`qa-sdk def` control plane의 핵심 축으로 승격하기 위한 실행 항목을 추적한다. 목표는 PRD 관리나 TODO 체크리스트보다 낮은 계층에서 형상 단위의 식별, 참조 가능 상태, 전이 가능성을 결정론적으로 계산하는 기반을 만든다.

## Completed — 완료 기록

- [x] US-001~US-008 Read-Only Label/FSM Read Model — semantic coordinate candidate, label record projection, ontology pack/evidence projection, FSM readiness, transition dry-run, and shared inventory API를 구현했다.
- [x] US-009 Operating Documentation — `docs-control-plane.rule.md`와 plan에 read-only label projection, FSM readiness, transition dry-run, PRD/TODO evidence-only role, ECS reference model, persistence deferral, future write-mode controller boundary를 기록했다.
- [x] US-010 Operational Verification — quality gates, `def validate`, deterministic plan/todo status, docs-control-plane status, and two completed-PRD drift checks를 실행했다. Drift 결과는 info-level completed-record candidates만 보고했고, status/drift/validate commands는 파일 이동·archive·자동 rewrite를 수행하지 않았다.

## Actionable — 실행 가능

- [x] Semantic Coordinate Read Model
  - [x] definition doc, source file, ontology pack, artifact evidence, PRD markdown, ralph PRD JSON story에서 label candidate를 수집하는 입력 범위 정의
  - [x] `urn:def:*`, `urn:source:*`, `urn:pack:*`, `urn:artifact:*`, `urn:prd:*` label candidate format 초안 작성
  - [x] label collision, missing kind, invalid version, ambiguous physical ref diagnostics 정의
  - [x] 기존 `def.id`, `familyId`, `packId`, `source path`, `artifactId`, `story id`와 label candidate 매핑 작성

- [x] Label Record Projection
  - [x] read-only `DeterministicLabelRecord` shape 정의
  - [x] physical refs, dependency labels, source refs, evidence refs, diagnostics 필드 정의
  - [x] docs-control-plane adapters가 제공하는 `DocumentEnvelope`를 label record input으로 매핑
  - [x] ontology pack scaffold/validate 결과를 label record input으로 매핑
  - [x] completed record candidate와 archive/default active scope를 label metadata로 투영

- [x] FSM State Readiness
  - [x] `DRAFT`, `LINTED`, `RESOLVED`, `ACTIVE`, `DEPRECATED`, `ARCHIVED`, `BLOCKED` 상태 정의
  - [x] `DRAFT -> LINTED` gate에 `def validate`, frontmatter/schema syntax, doc type convention 연결
  - [x] `LINTED -> RESOLVED` gate에 link/source-map/dependency/evidence resolution 연결
  - [x] `RESOLVED -> ACTIVE` gate에 role quality, drift-free, pack runtime validation, required evidence 연결
  - [x] invalid transition은 current state 유지 + blocked diagnostic으로 표현

- [x] Transition Controller Dry-Run
  - [x] transition request shape 정의: target label, requested state, reason, evidence refs
  - [x] dry-run result shape 정의: accepted/rejected, current state, next state, blockers, gate evidence
  - [x] no hidden write 원칙 문서화
  - [x] append-only transition event schema 후보 작성
  - [x] write/persistence는 별도 PRD로 deferred 처리

- [x] Operating Documentation
  - [x] `docs-control-plane.rule.md`에서 Entity-like identity / Component-like label data / System-like transition controller 규칙 참조
  - [x] `definition-state-model`과 deterministic FSM state의 관계 정리
  - [x] `definition-harness`와 transition controller gate의 관계 정리
  - [x] `registry-system`/`index-meta-system`과 label registry persistence decision boundary 정리

## Deferred — 조건부 대기

- [ ] Append-only Label Registry Persistence
  - 조건: read-only label projection과 FSM dry-run이 안정된 뒤 저장소 필요성이 확인될 때 진행
  - 후보 저장소: definition-service SQLite, registry-service, index-meta, 별도 label-registry store

- [ ] Write-mode Transition Controller
  - 조건: dry-run transition result가 충분히 검증되고 append-only event schema가 결정된 뒤 진행
  - 비목표: 현재 PRD에서는 상태 전이를 실제로 persist하지 않음

- [ ] User-facing Label Command Surface
  - 조건: read-only inventory API를 operator command로 노출할 필요가 확인될 때 진행
  - 후보: `docs label inventory`, `docs label status`, `docs label transition --dry-run`
  - 비목표: command surface 추가만으로 persistence/write authority를 부여하지 않음

- [ ] URN Migration
  - 조건: label candidate format이 안정되고 기존 `def.id`/source path/packId와 충돌 없이 공존하는 것이 검증된 뒤 진행
  - 비목표: 기존 id를 즉시 교체하지 않음

## Parking Lot — 후보 보관

- [ ] Label Registry UI 또는 graph visualization
- [ ] Semantic coordinate signing 또는 provenance hash
- [ ] Cross-repository label federation
- [ ] SoA/index-meta storage optimization for high-volume label records
