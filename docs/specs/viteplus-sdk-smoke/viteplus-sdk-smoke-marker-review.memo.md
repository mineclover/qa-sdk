---
def:
  tier: component
  id: viteplus-sdk-smoke-marker-review
  type: knowledge
  knowledge_kind: narrative
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: viteplus-sdk-smoke
  links:
    - target: viteplus-sdk-smoke-system
      type: traces_to
sources:
  - packages/core/src/scope-nesting.test.ts
  - packages/core/src/scope-nesting-mount.test.ts
  - packages/core/src/scope-nesting-timing.test.ts
  - packages/core/src/scope-nesting-state.test.ts
  - packages/core/src/scope-nesting-simulate.test.ts
  - packages/viteplus-sdk-smoke/src/context-action-contract.test.ts
  - packages/definition-catalog/src/assemble.test.ts
---

# Vite+ SDK Smoke 스펙 리뷰 — 결정 기록

## 목적 ^purpose

viteplus-sdk-smoke 문서군을 리뷰하면서 어떤 마커를 보강했고 어떤 구조적 결정을 내렸는지 기록한다. 구현 완료 후 남은 설계 맥락과 리뷰 근거를 memo/knowledge 문서로 보존하는 것이 목적이다.

## 마커 정비 (2026-04-04)

- [x] leaf 문서 6건 `^defines`/`^consumes` 마커 보충
- [x] provider-stack `traces_to` 양방향 링크 제거, `^constraint` 비표준 마커 제거
- [x] incident-escalation-validation `^preconditions` 추가
- [x] incident-escalation-implementation `actions/*`, `hooks/*` 추가

## 결정 기록

### OQ-1: scope-nesting = contract descent의 런타임 구현체

PipeFlow 31번째 유형 탈락. contract descent 체계를 확장하여 scope-nesting 검증 포함.
구현: `scope-nesting.ts` (validateScopeNesting, resolveContracts, buildProviderMap)

### OQ-2: svc 필드 — 패키지 식별자로 확장

`svc` = 문서가 소속된 패키지 식별자. 서비스 한정 아님.

### OQ-3: 두 feature 간 구조 대칭 강제

canonical-review와 incident-escalation은 동일 계층 구조.

### OQ-4: module `^method` — 5계층 시뮬레이션 기반

5개 boundary를 contract descent 순서로 중첩. handlers에서만 PipeSpec transformer.

### OQ-5: doc lifecycle — L0 guard 제외

외부 요인이 코드 검증 안정성 저하. 향후 C방향(런타임 영향 경로 특정 시 별도 스펙).

## 코드 리뷰 (4회, 23건)

- 1차: ContractRef.readyAfter 추가, duplicate-provider 첫 provider 유지, isViolation 강화 등 9건
- 2차: timing override 반영, mount optional, edge case 테스트 5건
- 3차: timing ScopeContractRef 정규화, verifyInvariants 반환 통일, pipeId optional 3건
- 4차: 스펙↔코드 drift 6건

## 구현 현황 (2026-04-05)

| 모듈 | 파일 | 테스트 |
|------|------|--------|
| L0+L1 | `scope-nesting.ts` | 32건 |
| L1.5 마운트 | `scope-nesting-mount.ts` | 9건 |
| L1.5↔L3 시점 | `scope-nesting-timing.ts` | 6건 |
| L2 전이 | `scope-nesting-state.ts` | 21건 |
| 통합 | `scope-nesting-simulate.test.ts` | 17건 |
| **합계** | | **85건** |
