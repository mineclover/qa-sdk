---
def:
  id: context-runtime
  type: spec
  owner_system: context-runtime
  tier: system
  level: leaf
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: operation
  svc: context
  tags: [architecture, context, contract, testing]
  links:
    - target: context-bounded-execution
      type: implements
    - target: context-bounded-execution-test
      type: traces_to
    - target: platform-context-spec
      type: constrains
sources:
  - packages/context-runtime/src/index.ts
  - packages/context-runtime/src/types.ts
  - packages/context-runtime/src/budget.ts
  - packages/context-runtime/src/discovery.ts
  - packages/context-runtime/src/routes.ts
  - packages/context-runtime/src/working-context.ts
  - packages/context-runtime/src/handoff.ts
  - packages/context-runtime/src/adapters.ts
  - packages/context-runtime/src/closure.ts
  - packages/context-runtime/src/budget.test.ts
  - packages/context-runtime/src/discovery.test.ts
  - packages/context-runtime/src/routes.test.ts
  - packages/context-runtime/src/working-context.test.ts
  - packages/context-runtime/src/manifest.test.ts
  - packages/context-runtime/src/handoff.test.ts
  - packages/context-runtime/src/adapters.test.ts
  - packages/context-runtime/src/closure.test.ts
  - packages/context-runtime/src/boundary.test.ts
---

# Context Runtime — Phase 1–5 구현

## 목적 ^purpose

Discovery/Working Context 분리의 기반 타입·순수 검증·Discovery Plan·Working Context compiler·reference-only Handoff·외부 경계 adapter contract를 제공한다. 이 단계는 실제 source 조회나 LLM 실행·영속화를 하지 않고, composition root가 주입하는 port와 event mapping seam만 소유한다.

## 현재 구현 ^defines

- `ContextBudgetProfile` — Discovery 100K hard cap, Working 100K minimum reserve, system/output reserve
- `ContextAnchor` / `ContextMap` — 탐색 시작점과 후보 경로의 요약 구조
- `TaskIntent` / `DiscoveryPlan` — task 의도에서 후보 route를 결정론적으로 정렬·선택하는 순수 plan
- `DiscoveryRoute` / `ResolutionRoute` — 탐색 경로와 authoritative Fact 해소 경로의 분리
- `DiscoveryRouteProjection` — cost/authority/freshness/estimated size projection
- `validateRoute` / `validateRouteSet` — relation path, bounds, cycle policy, authority/freshness 검증
- `planDiscovery` — 100K cap, route expansion limit, no-silent-eviction 결과를 포함한 Discovery Plan 생성
- `WorkingContextCompileInput` / `WorkingContext` — frozen route, resolved Fact, allowed operation, output contract envelope
- `compileWorkingContext` / `assertWorkingContext` — closure 결과를 실행 가능한 Working Context로 제한하는 compiler/guard
- `validateWorkingClosure` — required Fact의 route, authority, freshness, revision, evidence 검증
- `freezeRouteSelection` — 선언된 route key만 선택하는 순수 freeze 연산
- `ContextManifest` / `createContextManifest` — canonical JSON, stable digest, Fact reference만 포함하는 실행 manifest
- `TaskHandoff` / `createTaskHandoff` — source/result revision, evidence, unresolved question, next task만 전달하는 reference-only handoff
- `createDefinitionGraphDiscoveryAdapter` — definition graph route node를 Discovery candidate로 투영
- `createFederatedResolutionAdapter` — federation query 결과를 Resolution Fact로 투영하고 미선언 Fact를 제거
- `createDecisionHintAdapter` — decision-flow hint를 optional provenance로 투영
- `mapContextObservation` — 별도 observation event와 address context metadata를 생성하며 Fact 값은 포함하지 않음

## 경계 ^boundary

- 외부 I/O, 네트워크, DB, LLM SDK, `process.env`를 참조하지 않는다.
- 원본 업무 데이터와 Fact authority를 소유하지 않는다.
- Discovery summary를 Working Fact로 승격하지 않는다.
- Handoff persistence와 실제 source port 구현은 composition root/후속 runtime의 책임이다.

## 검증 ^validation

`packages/context-runtime/src/{budget,routes,discovery,working-context,manifest,handoff,adapters,closure}.test.ts`가 100K 예산 분리, Discovery plan projection, cap/no-silent-eviction, Working Context envelope, deterministic Manifest, reference-only Handoff, boundary adapter projection, route bounds, route freeze, missing route, stale Fact, evidence 누락을 결정론적으로 검증하고, `boundary.test.ts`가 production source의 순수 라이브러리 경계를 점검한다.

검증 명령:

```bash
corepack pnpm --filter context-runtime typecheck
corepack pnpm --filter context-runtime test
corepack pnpm --filter context-runtime build
```
