---
def:
  id: context-bounded-execution
  type: spec
  tier: system
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [architecture, context, contract, testing, observability]
  links:
    - target: context-bounded-execution-cases
      type: traces_to
    - target: context-bounded-execution-todo
      type: traces_to
    - target: platform-context-spec
      type: depends_on
    - target: work-lifecycle
      type: depends_on
    - target: responsibility-closure-harness
      type: depends_on
  sources:
    - packages/context-runtime/src/index.ts
    - packages/cli/src/commands/def.ts
    - packages/cli/src/lib/context-runtime/definition-document-context.ts
    - packages/cli/src/lib/context-runtime/provider-usage-adapters.ts
    - packages/cli/src/lib/context-runtime/task-handoff-store.ts
    - packages/provider-tokenizer-openai/src/index.ts
---

# Context-Bounded Execution — 최상위 실행 불변 원칙

## 목적 ^purpose

하나의 Task가 필요한 정보를 무한히 누적하거나 임의로 잘라 쓰지 않고, 탐색과 실제 작업을 분리된 컨텍스트·경로·예산으로 실행하도록 제약한다.

## 핵심 원칙 ^constraint

1. Task는 하나의 판단, 외부 Commit, 승인 또는 분석 경계 안에서 완결 가능한 크기로 정의한다.
2. Discovery Context는 필요한 정보의 위치·경로·비용을 찾는 데만 사용한다.
3. Working Context는 선택된 경로에서 해소된 authoritative Fact, Policy, Revision, Evidence만 사용한다.
4. Discovery 예산은 Working 예약량을 침범할 수 없다.
5. Discovery 결과 전체를 Working Context로 복사하지 않는다. 선택된 Route와 Manifest만 전달한다.
6. 필수 Fact의 ResolutionRoute, Authority, Freshness가 없으면 Working Closure를 닫지 않는다.
7. 예산 초과는 임의 삭제가 아니라 탐색 종료, Task 분해, 에스컬레이션 또는 fail-closed로 처리한다.
8. Task 간 연속성은 대화 기록이 아니라 Typed Handoff와 원본 Evidence Reference로 유지한다.
9. 분해된 child Task는 정확히 하나의 완료 Handoff가 모두 존재할 때만 parent Handoff로 집계한다.
10. parent Handoff는 child Task key와 Fact/Evidence reference만 보존하며 Fact value나 transcript를 포함하지 않는다.

## 두 컨텍스트 ^defines

| 항목      | Discovery Context                         | Working Context                           |
| --------- | ----------------------------------------- | ----------------------------------------- |
| 질문      | 무엇을 어디서 확인해야 하는가             | 지금 무엇을 판단·실행해야 하는가          |
| 허용 표현 | map, summary, pointer, candidate          | resolved fact, policy, revision, evidence |
| Route     | `DiscoveryRoute`                          | `ResolutionRoute`                         |
| 신뢰도    | 후보·요약·불확실성 허용                   | Authority/Freshness 충족 필수             |
| 기본 예산 | 최대 100K tokens                          | 최소 100K tokens 예약                     |
| 산출물    | 선택 Route, unresolved question, manifest | decision/commit/verification 입력         |

Discovery Context의 내용은 Working Context의 사실을 대체하지 않는다. 예를 들어 `order.inventory`가 후보 경로로 발견되었다는 사실은 재고가 확보되었다는 Fact가 아니다.

## 예산 규칙 ^budget

실행 프로파일은 최소 다음 정책을 선언한다.

```yaml
context_budget:
  discovery_max_tokens: 100000
  working_reserve_tokens: 100000
  system_reserve_tokens: <profile-defined>
  output_reserve_tokens: <profile-defined>
  borrow_work_reserve: false
```

Core contract는 tokens에 종속되지 않도록 현재 구현된 objects, relations, route expansions 지표를 함께 기록한다. usage event는 선택적으로 bytes·latency를 누적할 수 있으며, provider exact usage는 provider adapter가 측정한 total과 input/output breakdown을 보존한다. 실제 SDK나 tokenizer는 composition root가 adapter로 연결하고 context-runtime은 provider-independent contract만 소유한다. provider/model `ContextTokenCounter`가 주입되면 Discovery는 canonical candidate shape와 `phase=discovery` context를 선택 전에 측정하고, Working은 실제로 해소한 Fact payload와 `phase=working`·route/fact identity를 같은 counter에 전달해 측정한다. 외부 tokenizer module이 선언한 provider·model·tokenizerRevision은 bounded 결과와 해당 Discovery/Working usage event에 함께 보존한다. 주입이 없으면 Discovery route estimate와 JSON counter를 `estimated`로 유지한다. 같은 route가 두 phase에 나타날 수 있지만 phase별 합계와 예산이 분리되어 있으므로 이중 차감으로 취급하지 않는다. 이전 usage snapshot을 주입할 때는 선언된 phase 합계·total·measurement와 optional metrics가 event ledger와 일치해야 한다.

## 경로 규칙 ^route

DiscoveryRoute는 anchor에서 문서·노드·서비스의 요약, 후보 Relation Path, authority/freshness/cost, Fact 식별자와 원본 pointer를 찾는다. 이는 실행 Fact가 아니다.

ResolutionRoute는 선언된 Relation Path에서 정확한 Fact를 해소하며 maxDepth·maxFanOut·cyclePolicy, source authority·revision·freshness를 보존한다. cross-domain 조회는 query port와 anti-corruption adapter를 사용하고, 임의 graph search는 허용하지 않는다.

## 실행 전이 ^workflow

```text
Task Intent
  → Discovery Plan
  → Route Selection Freeze
  → Working Context Compile
  → Decision / Commit
  → Verification Context Rebuild
  → Typed Handoff
```

Discovery가 종료되면 선택된 Route를 freeze한다. Working Context는 Discovery Context를 복사하지 않고 freeze된 Route에서 다시 해소한다.

## Definition 문서 소비자 ^consumer

`qa-sdk def context --bounded`는 definition graph metadata로 Discovery 후보를 결정론적으로 정렬하고, freeze된 resolution route에서만 본문·boundary payload를 읽는다. 기본 출력은 유지하며 bounded 모드만 100K Discovery cap·100K Working reserve를 적용한다.

- `DefDataSource`의 local(SQLite)·server(HTTP)는 같은 source contract를 사용하고 runtime은 transport를 모른다.
- 최소 Working Fact의 route가 없거나 해소되지 않으면 `blocked`이며 Manifest를 만들지 않는다. usage snapshot은 ledger가 phase·total·measurement를 검증한다.
- provider usage와 tokenizer module/registry는 composition root adapter로 연결하고 provider·model·revision을 보존한다. 선택 불일치·복수 registry·잘못된 count/export는 실행 전에 거부한다.
- cap 시 source payload를 자동으로 읽지 않고 decomposition을 반환한다. child가 모두 완료된 경우에만 reference-only parent Handoff를 만들며 discovery 결과는 별도 read model로 유지한다.
- `address_context`와 observation event는 metadata만 포함한다. runtime은 provider SDK와 persistence를 직접 소유하지 않는다.

## Closure 판정 ^closure

- `discovery-closed`: 작업에 필요한 정보를 찾을 수 있는 Route와 비용이 확보됨
- `working-closed`: 판단·실행에 필요한 Fact, Policy, Revision, Evidence가 해소됨
- `verification-closed`: 예상 상태 변화와 실제 결과 Evidence를 대조할 수 있음

세 상태는 하나의 boolean으로 합치지 않는다. `discovery-closed`여도 `working-closed`가 아니면 실행할 수 없다.

## 소유권 경계 ^boundary

- source system은 업무 상태·payload·local ID의 authority다.
- federation layer는 SourceRef, ConnectionRef, mapping, cross-domain query seam을 소유한다.
- definition-catalog은 문서 구조와 책임 지도를 소유한다.
- decision-flow는 결정 경로와 결정 이력을 소유한다.
- context-runtime은 선택·해소 계획과 envelope/manifest/handoff를 소유한다.
- `address_context`는 관측 의미 좌표이며 Working Context 본문이 아니다.

## 구현 참조 ^source

- `packages/context-runtime/src/index.ts` — budget, discovery, route, working context, manifest, handoff 계약
- `packages/cli/src/lib/context-runtime/definition-document-context.ts` — `DefDataSource` adapter와 bounded consumer
- `packages/cli/src/lib/context-runtime/task-handoff-store.ts` — local JSON Handoff store
- `packages/cli/src/commands/def.ts` — bounded context, handoff 조회·집계 CLI
- `packages/cli/src/commands/def.test.ts` — bounded 정상/blocked contract 검증

## Release checklist ^validation

- [x] Discovery/Working 예산과 borrow 금지가 분리되어 있다
- [x] ResolutionRoute가 depth/fan-out/cycle, authority/revision/freshness를 보존한다
- [x] Discovery summary가 Fact로 승격되지 않고 snapshot/manifest가 재현 가능하다
- [x] overflow는 decomposition·중단·에스컬레이션으로 처리한다
- [x] Handoff는 typed reference이며 Definition graph는 metadata만으로 bounded 후보를 만든다
- [x] 최소 Working Fact 미해소 시 fail-closed하고 Manifest를 만들지 않는다
