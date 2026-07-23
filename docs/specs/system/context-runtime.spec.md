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
  - packages/context-runtime/src/decomposition.ts
  - packages/context-runtime/src/routes.ts
  - packages/context-runtime/src/working-context.ts
  - packages/context-runtime/src/handoff.ts
  - packages/context-runtime/src/handoff-execution.test.ts
  - packages/context-runtime/src/adapters.ts
  - packages/context-runtime/src/closure.ts
  - packages/context-runtime/src/usage.ts
  - packages/context-runtime/src/budget.test.ts
  - packages/context-runtime/src/discovery.test.ts
  - packages/context-runtime/src/decomposition.test.ts
  - packages/context-runtime/src/routes.test.ts
  - packages/context-runtime/src/working-context.test.ts
  - packages/context-runtime/src/manifest.test.ts
  - packages/context-runtime/src/handoff.test.ts
  - packages/context-runtime/src/adapters.test.ts
  - packages/context-runtime/src/closure.test.ts
  - packages/context-runtime/src/boundary.test.ts
  - packages/context-runtime/src/usage.test.ts
---

# Context Runtime — Phase 1–5 구현

## 목적 ^purpose

Discovery/Working Context 분리의 기반 타입·순수 검증·Discovery Plan·Working Context compiler·reference-only Handoff·외부 경계 adapter contract를 제공한다. 이 단계는 실제 source 조회나 LLM 실행·영속화를 하지 않고, composition root가 주입하는 port와 event mapping seam만 소유한다.

## 현재 구현 ^defines

- `ContextBudgetProfile` — Discovery 100K hard cap, Working 100K minimum reserve, system/output reserve
- `ContextAnchor` / `ContextMap` — 탐색 시작점과 후보 경로의 요약 구조
- `TaskIntent` / `DiscoveryPlan` — task 의도에서 후보 route를 결정론적으로 정렬·선택하고 cap 시 child Task decomposition을 산출하는 순수 plan
- `DiscoveryRoute` / `ResolutionRoute` — 탐색 경로와 authoritative Fact 해소 경로의 분리
- `DiscoveryRouteProjection` — cost/authority/freshness/estimated size projection
- `validateRoute` / `validateRouteSet` — relation path, bounds, cycle policy, authority/freshness 검증
- `planDiscovery` — 100K cap, route expansion/object/relation limit, no-silent-eviction 결과를 포함한 Discovery Plan 생성
- `WorkingContextCompileInput` / `WorkingContext` — frozen route, resolved Fact, allowed operation, output contract envelope
- `compileWorkingContext` / `assertWorkingContext` — closure 결과를 실행 가능한 Working Context로 제한하는 compiler/guard
- `validateWorkingClosure` — required Fact의 route, authority, freshness, revision, evidence 검증
- `freezeRouteSelection` — 선언된 route key만 선택하는 순수 freeze 연산
- `ContextManifest` / `createContextManifest` — canonical JSON, stable digest, Fact reference만 포함하는 실행 manifest
- `TaskHandoff` / `createTaskHandoff` — source/result revision, evidence, unresolved question, next task만 전달하는 reference-only handoff
- `aggregateTaskHandoffs` — 모든 child Handoff의 존재·revision 정합성을 확인한 뒤 parent reference-only Handoff를 결정론적으로 생성
- `executeAndAggregateTaskHandoffs` — child Handoff executor를 순차 실행하고 모두 완료된 경우에만 parent를 생성
- `TaskHandoffStore` — Handoff를 저장·조회하기 위한 비동기 port만 선언하며, 저장 방식과 수명은 composition root가 결정한다.
- `createDefinitionGraphDiscoveryAdapter` — definition graph route node를 Discovery candidate로 투영
- `createFederatedResolutionAdapter` — federation query 결과를 Resolution Fact로 투영하고 미선언 Fact를 제거
- `createDecisionHintAdapter` — decision-flow hint를 optional provenance로 투영
- `mapContextObservation` — 별도 observation event와 address context metadata를 생성하며 Fact 값은 포함하지 않음
- `ContextTokenCounter` / `createContextUsageLedger` — provider tokenizer를 주입할 수 있는 phase-separated usage ledger
- `ContextTokenCountContext` — tokenizer가 Discovery/Working serialization 경계를 구분하도록 phase와 route/fact identity를 전달한다.
- `planDiscovery`의 선택적 `ContextTokenCounter` — canonical Discovery candidate를 budget selection 전에 측정하고 cost measurement를 projection/skip/decomposition에 보존한다. Definition consumer는 provider/model/tokenizerRevision identity와 phase context를 usage event에 보존한다.
- provider tokenizer module은 composition root가 등록·선택하며, context-runtime은 외부 ESM module이나 SDK를 import하지 않는다.
- `createProviderUsageEvent` — provider가 보고한 input/output/total token과 선택적 bytes·latency를 provider-independent usage event로 정규화
- usage event와 observation metadata는 phase, measurement, token 합계, route/source reference, optional metrics를 런타임에서도 검증한다.

### Composition-root tokenizer module 계약

외부 ESM module은 provider SDK와 모델별 serialization을 소유하고 다음 shape를 default export한다.

```ts
export default {
  provider: 'generic',
  model: 'provider-model-id',
  tokenizerRevision: 'implementation-or-model-revision',
  count(value, context) {
    const serialized = serializeForProvider(value, context);
    return providerTokenizer.encode(serialized).length;
  },
};
```

`value`는 Discovery candidate 또는 Working Fact의 canonical 입력이며, `context.phase`와
`context.routeKey`/`context.factKey`를 이용해 두 경로의 provider request serialization을
구분해야 한다. `count`는 음이 아닌 정수를 반환해야 한다. CLI는 다음과 같이 module을
직접 선택하거나 registry의 provider/model entry를 선택하고, 선언값과 선택값이 다르면
실행 전에 거부한다.

```bash
qa-sdk def context <doc-id> --bounded \
  --tokenizer-module ./tokenizers/provider-model.mjs \
  --tokenizer-provider generic \
  --tokenizer-model provider-model-id \
  --json
```

registry를 사용할 때는 registry 파일 기준의 상대 module 경로와 provider/model 선택을
선언한다.

```bash
qa-sdk def context <doc-id> --bounded \
  --tokenizer-registry ./tokenizers/registry.json \
  --tokenizer-provider generic \
  --tokenizer-model provider-model-id \
  --json
```

특정 provider SDK나 모델은 이 core spec에서 선택하지 않으며, composition root의 외부
module로만 연결한다. module 또는 registry를 지정하지 않으면 JSON counter의 `estimated`
측정이 사용된다.

## 경계 ^boundary

- 외부 I/O, 네트워크, DB, LLM SDK, `process.env`를 참조하지 않는다.
- 원본 업무 데이터와 Fact authority를 소유하지 않는다.
- Discovery summary를 Working Fact로 승격하지 않는다.
- Handoff persistence와 실제 source port 구현은 composition root/후속 runtime의 책임이다. `context-runtime`은 port를 제공할 뿐 파일·DB·네트워크를 직접 참조하지 않는다.

## 검증 ^validation

`packages/context-runtime/src/{budget,routes,discovery,working-context,manifest,handoff,handoff-execution,adapters,closure,usage}.test.ts`가 100K 예산 분리, Discovery plan projection, deterministic child decomposition, token·route expansion·object·relation cap/no-silent-eviction, provider usage와 bytes·latency metrics, phase-separated usage와 malformed usage rejection, Working budget overrun, Working Context envelope, deterministic Manifest, reference-only/aggregated Handoff와 partial execution 차단, boundary adapter projection, route bounds, route freeze, missing route, stale Fact, evidence 누락을 결정론적으로 검증하고, `boundary.test.ts`가 production source의 순수 라이브러리 경계를 점검한다.

검증 명령:

```bash
corepack pnpm --filter context-runtime typecheck
corepack pnpm --filter context-runtime test
corepack pnpm --filter context-runtime build
```
