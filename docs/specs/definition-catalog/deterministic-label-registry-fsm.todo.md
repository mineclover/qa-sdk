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
    - target: deterministic-label-architecture
      type: traces_to
    - target: deterministic-label-stability-boundary
      type: traces_to
---

# Deterministic Label Registry And FSM — TODO

## 목적 ^purpose

Read-only label + FSM read model 구현은 완료되었다 (2026-04-18). 본 todo는 그 위에 얹힐 수 있지만 **현재 실제 소비자 요구가 없어 대기 중인 항목**만 추적한다. 완료된 구현 세부는 `deterministic-label-architecture.spec.md`와 두 stability spec이 SSOT.

## 구현 완료 상태

- Read-only label model (semantic coordinate candidate / label record / FSM readiness / transition dry-run / inventory API): `packages/deterministic-label-registry/`에 구현됨
- Stability 계약 (URN v1 frozen + byte-identical 재실행): `deterministic-label-*-stability.spec.md` + live rerun test
- 아키텍처 경계 (5계층 + 의존 방향): `deterministic-label-architecture.spec.md` + boundary test
- 상세 실행 이력은 git log (PRD 2건은 `tasks/archive/`로 이관됨)

## Deferred — 대기 (실 소비자 요구 시 재개)

- [ ] **User-facing Label Command Surface**
  - 조건: operator가 `docs label inventory` / `docs label status <URN>` / `docs label transition --dry-run` 같은 명령을 요구할 때
  - 구현 재료: `buildDeterministicLabelInventory()`, `dryRunDeterministicLabelTransition()` 이미 존재
  - 필요 작업: CLI wrapper + 출력 포맷

- [ ] **URN Migration / Rename 계약**
  - 조건: `def.id` rename 시 과거 URN으로 발행된 외부 링크가 끊기는 실 사례 발생
  - 현재 정책: 1A(content-derived)에 따라 rename = 새 URN + 기존 URN 폐기 (외부 링크 추적은 별도 문제)

## Dropped — 구상 제거 (2026-04-18)

아래 항목은 단순화 리뷰에서 **명시적으로 드롭**되었다. 이익 없음 + 현재 수요 없음 근거는 `deterministic-label-stability-boundary.memo.md`.

- ~~Append-only Label Registry Persistence~~ — axis entry 승격 / persistence store 설계. 해결할 운영 문제 없음. 재개 시 plan부터.
- ~~Write-mode Transition Controller~~ — FSM gate를 실제 전이 실행에 사용. dry-run internal API만 유지.
- ~~Commit real-repo snapshot~~ — git이 역사 SSOT.

## Parking Lot — 후보 보관

실 수요가 생기지 않으면 무기한 대기.

- [ ] Label Registry UI 또는 graph visualization
- [ ] Semantic coordinate signing 또는 provenance hash
- [ ] Cross-repository label federation
- [ ] Cross-machine / cross-locale 결정론 검증
