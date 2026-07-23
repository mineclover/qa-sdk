---
def:
  id: context-bounded-execution-todo
  type: knowledge
  knowledge_kind: proposal
  tier: system
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: draft
  layer: operation
  tags: [architecture, context, contract, testing]
  links:
    - target: context-bounded-execution
      type: traces_to
    - target: context-bounded-execution-cases
      type: traces_to
---

# Context-Bounded Execution — 구현 TODO

## 목적 ^purpose

Discovery Context와 Working Context를 실제 `context-runtime` slice로 구현하기 위해, 현재 iteration에서 닫을 작업과 의도적으로 남겨둘 경계를 추적한다.

## 작업 기준 ^context

| 항목        | 결정                                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 변경 유형   | 신규 read-mostly runtime contract/design                                                                                          |
| owner       | `context-runtime`                                                                                                                 |
| 기존 소비자 | `@qa-sdk/context`, `decision-flow`, definition graph, federation query port                                                       |
| non-goal    | LLM adapter, 원본 데이터 저장, ERP/CRM 재구현, 외부 transaction                                                                   |
| baseline    | 2026-07-24, `context-runtime` 순수 runtime과 `def context --bounded` 첫 소비자 및 reference-only Handoff 로컬 저장 경로 구현 완료 |

## Phase 0 — 계약 고정

- [x] `ContextBudgetProfile`의 Discovery 100K 상한과 Working 100K 예약량을 구현 정책으로 확정
- [x] `DiscoveryRoute`와 `ResolutionRoute`의 입력·출력·신뢰도 차이 확정
- [x] `DiscoveryClosure`, `WorkingClosure`, `VerificationClosure` 상태 vocabulary 확정
- [x] BDD contract의 fixture shape와 error code를 승인
- [x] tokens와 표현 중립 budget metric의 adapter 경계 확정

## Phase 1 — 순수 타입과 검증

- [x] `ContextAnchor`, `ContextMap`, `DiscoveryRoute`, `ResolutionRoute` 타입 추가
- [x] `ContextBudgetProfile` 검증기 추가
- [x] maxDepth/maxFanOut/cyclePolicy와 authority/freshness 요구사항 검증
- [x] context-runtime은 `process.env`, fetch, DB, LLM SDK를 직접 참조하지 않도록 boundary test 추가

## Phase 2 — Discovery Plan

- [x] Task Intent에서 Discovery Plan을 생성하는 순수 planner 추가
- [x] candidate route의 cost/authority/freshness/estimated size projection 추가
- [x] Discovery cap 도달 시 silent eviction 금지 및 `discovery-capped` 결과 추가
- [x] `maxObjects`/`maxRelations`를 선택 단계에서 hard limit으로 적용하고 skip reason을 기록
- [x] `ContextTokenCounter`와 phase-separated usage ledger를 추가하고 usage snapshot을 observation metadata로 투영
- [x] Working usage가 reserved budget을 넘으면 Working Context를 blocked로 고정
- [x] Route Selection Freeze 결과에 manifest digest를 포함

## Phase 3 — Working Context Compile

- [x] freeze된 ResolutionRoute를 통해 required Fact 목록을 해소하는 compiler 추가
- [x] required Fact에 route가 없으면 `context-closure-incomplete` 반환
- [x] stale/unauthoritative Fact를 Working Context에서 제외
- [x] Working Context에 revision, evidence ref, allowed operation, output contract 포함

## Phase 4 — Handoff와 검증

- [x] `ContextManifest`를 deterministic JSON/hash로 생성
- [x] `TaskHandoff`에 source/result revision, evidence ref, unresolved question, next task를 저장
- [x] 대화 transcript가 Handoff schema에 들어가지 않음을 검증
- [x] 동일 snapshot + manifest 재생성 테스트 추가

## Phase 5 — 경계 어댑터

- [x] definition graph를 Discovery source로 읽는 adapter 설계
- [x] federation query port를 Resolution source로 소비하는 adapter 설계
- [x] decision-flow의 history/pattern/model hint를 Working Context의 optional hint로 투영
- [x] 관측은 별도 event mapping으로 연결하고 `address_context`를 본문 Fact로 사용하지 않음

## Phase 6 — Definition 문서 소비자 연결

- [x] `DefDataSource`의 문서/본문/바운더리 결과를 context-runtime 입력으로 투영
- [x] Discovery cap/route freeze 이전에 본문·바운더리 payload를 읽지 않도록 lazy resolution 적용
- [x] `qa-sdk def context --bounded`에서 Discovery Plan과 Working Context를 실행
- [x] bounded 출력에 deterministic Manifest와 observation mapping을 포함
- [x] bounded 결과에 EventRecord-compatible observation event를 함께 제공
- [x] observation을 persistence가 아닌 optional sink seam으로 명시
- [x] `context_runtime_observation`을 event-catalog core event와 payload guide에 등록
- [x] 기존 `qa-sdk def context <문서ID>` 출력과의 하위 호환성 검증
- [x] Definition source metadata(children/incoming/outgoing) 기반 bounded graph Discovery 후보 생성
- [x] 기본 Working Fact(document/boundary/body) 미해소 시 fail-closed 및 Manifest 미생성
- [x] local health gate의 non-zero 실패 전파와 registry readiness timeout 적용
- [x] initial usage snapshot의 선언 합계가 event ledger와 불일치하면 budget 계산 전에 거부
- [x] 외부 measured usage summary JSON을 `def context --bounded --initial-usage`로 runtime ledger에 연결
- [x] 닫힌 Definition Working Context에서 명시적 result revision을 가진 reference-only Handoff를 로컬 JSON store에 멱등 저장

## Phase 7 — Definition audit baseline closure

- [x] layout/pack의 incoming `refs`를 유효한 graph 연결로 판정하도록 `def audit-db` 보정
- [x] data-structure-profile index/fixture 문서에 `^purpose` 추가

## 보류 항목 ^constraint

- [x] OpenAI `gpt-4o` 실제 tokenizer module을 `@qa-sdk/provider-tokenizer-openai`로 등록하고 registry bounded smoke를 통과시킴
- [ ] 추가 provider SDK/tokenizer module 등록 (provider/model 선택 필요)
- [x] 외부 tokenizer ESM module 등록·provider/model 선택 검증 및 bounded CLI runtime 연결
- [x] provider/model tokenizer registry JSON 등록·선택 및 bounded CLI runtime 연결
- [x] Discovery/Working phase·route/fact context를 tokenizer callback에 전달
- [x] provider/model tokenizer counter seam을 Discovery candidate와 Working Fact 양쪽에 연결
- [x] OpenAI/Anthropic/generic response envelope별 exact usage adapter를 composition root에 연결 (direct/batch/stream JSON 포함)
- [x] provider response(OpenAI/Anthropic/generic envelope)를 measured usage event로 정규화하는 composition-root adapter 연결
- [x] bytes·latency 추가 표현 중립 usage metric을 공통 계약과 observation에 연결
- [x] HTTP/DB source adapter — 기존 `DefDataSource` local(SQLite)/server(HTTP) adapter를 bounded consumer에서 검증
- [x] Handoff 영속화 서비스 — `context-runtime` port + CLI composition-root JSON adapter 범위로 구현
- [ ] `context-runtime` 전용 axis/prefix 추가
- [x] Discovery cap에서 deterministic child Task decomposition plan 생성
- [x] child Task를 실제로 순차 실행하고 성공/부분/실패/skip 결과를 명시하는 executor port 구현
- [x] child 결과를 parent Handoff로 합치는 reference-only aggregation 정책과 Definition CLI consumer 경로
- [x] child Handoff executor와 parent aggregation을 결합하는 순수 runtime/Definition composition-root seam
- [x] Definition graph의 discovery-only child 결과와 resolution child Handoff를 분리·결합하는 consumer-specific aggregation 정책

### 보류 항목 판정

- **provider SDK/tokenizer**: composition root의 `provider + model + count(value, context)` seam은 Discovery의 canonical candidate shape와 `phase=discovery` route context, Working Fact와 `phase=working` route/fact context 양쪽에 적용되며, 측정된 cost가 budget selection 전에 사용된다. OpenAI `gpt-4o` module은 `js-tiktoken@1.0.21`의 model-specific encoding과 결정론적 canonical JSON serialization으로 구현했다. `--tokenizer-module`과 `--tokenizer-registry`는 계속 외부 module을 선택할 수 있고 provider/model/tokenizerRevision을 usage event에 보존한다. 추가 provider의 SDK·모델별 serialization은 별도 선택이 필요하다. tokenizer를 선택하지 않으면 기본 route estimate와 JSON counter의 `estimated` 상태를 유지한다.
- **context-runtime 전용 axis/prefix**: 후보 `context_stage = discovery|working|verification`는 Q1(유한)과 Q4(안정), Q5(`nextPowerOf2(3×2)=8`)는 통과한다. 그러나 Q2는 현재 closure 제어용 분기라는 수준이고, Q3는 현재 `context_runtime_observation`의 metadata 한 곳에서만 소비되어 공유 prefix 근거가 없다. `stage`는 당분간 runtime/event payload로 유지하며, 두 개 이상의 좌표 소비자 또는 query/impact 요구가 생길 때에만 `dkg decide --type new-axis|new-prefix`와 catalog 변경을 별도 진행한다.

## 완료 조건 ^validation

- [x] `context-bounded-execution-cases-*` family의 모든 contract에 test unit과 implementation unit이 연결됨
- [x] focused unit/contract test가 통과함
- [x] 구현된 사실만 새로운 `.spec.md`에 흡수됨
- [x] `def sync`와 `def validate`가 통과함
- [x] package boundary와 public surface 영향이 `arch:feedback`으로 검증됨

## Closure evidence ^evidence

- `corepack pnpm install --frozen-lockfile` — lockfile 고정 설치 통과
- `corepack pnpm --filter context-runtime typecheck` — 통과
- `corepack pnpm --filter context-runtime test` — 55 tests 통과
- `corepack pnpm --filter context-runtime build` — ESM/CJS/DTS build 통과
- `corepack pnpm --filter dkg test` — 126 tests 통과
- `corepack pnpm --filter dkg-enrichment test` — 27 tests 통과
- `corepack pnpm --filter @qa-sdk/cli exec vitest run src/commands/def.test.ts` — 39 tests 통과
- `corepack pnpm --filter @qa-sdk/cli exec vitest run src/lib/context-runtime/definition-document-context.test.ts` — 13 tests 통과
- `corepack pnpm --filter @qa-sdk/cli exec vitest run src/lib/context-runtime/task-handoff-store.test.ts` — 3 tests 통과
- `corepack pnpm --filter @qa-sdk/cli exec vitest run src/lib/context-runtime/provider-usage-adapters.test.ts` — 17 tests 통과
- `corepack pnpm --filter @qa-sdk/provider-tokenizer-openai build` — ESM build diagnostics 0건
- `corepack pnpm --filter @qa-sdk/provider-tokenizer-openai typecheck` — 통과
- `corepack pnpm --filter @qa-sdk/provider-tokenizer-openai test` — 3 tests 통과
- `corepack pnpm --filter @qa-sdk/cli exec vitest run src/commands/def.test.ts src/lib/context-runtime/definition-document-context.test.ts src/lib/context-runtime/task-handoff-store.test.ts src/lib/context-runtime/provider-usage-adapters.test.ts` — 72 tests 통과
- `corepack pnpm --filter @qa-sdk/cli test` — 64 test files 통과, 663 tests 통과, 2 skipped
- `corepack pnpm --filter definition-catalog test` — 47 test files 통과, 661 tests 통과
- `node packages/cli/dist/index.js docs bdd validate context-bounded-execution-cases --family-only --json` — issues 0건
- `node packages/cli/dist/index.js docs bdd validate context-bounded-execution-test --family-only --json` — issues 0건
- `node packages/cli/dist/index.js def context definition-addressing --bounded --tokenizer-registry packages/provider-tokenizer-openai/fixtures/gpt-4o.registry.json --tokenizer-provider openai --tokenizer-model gpt-4o --json` — `workingContext=closed`, `measurement=measured`, `tokenCounter=openai/gpt-4o` smoke 통과
- `corepack pnpm --filter @qa-sdk/event-catalog test` — 58 tests 통과
- `corepack pnpm run def:check` — definition validate 경고 0건, audit high/medium 0건
- `corepack pnpm arch:feedback` — 6/6 단계 통과
- `corepack pnpm arch:check` — tier violation 0건
- `corepack pnpm run format:check` — 전체 tracked source format 통과
- `node packages/cli/dist/index.js def context definition-addressing --bounded --local --json` — local bounded context closed/manifest present
- `node packages/cli/dist/index.js def context definition-addressing --bounded --server --server-url http://localhost:3700 --json` — HTTP bounded context closed/manifest present

외부 upstream이 소유한 deprecated 전이 의존성 경고는 이번 범위에서 수정하지 않는다. 로컬 CLI bundle unused-export 경고는 정리되어 build diagnostics 0건이다.

## 현재 잔여 baseline ^baseline

- `def validate`: 경고 0건.
- `def audit-db`: high 0건, medium 0건.
- `svc` 미부여 155건은 현재 fail 조건이 아닌 참고 지표로 남아 있다.

## Closure review ^closure-review

- **diff 범위**: `context-runtime` 순수 runtime, Definition bounded consumer/CLI, provider tokenizer composition-root adapter와 OpenAI `gpt-4o` module/registry, `context_runtime_observation` event contract, BDD/spec 문서 및 focused/full test를 포함한다.
- **문서 분할**: 150줄 초과가 된 bounded execution cases/test 문서를 overview group과 역할별 leaf family로 분리했다. contract ID와 unit ID는 유지하고, `contains` 및 공통 family ID로 `--family-only` 수집 범위를 보존했다. rule/client 문서는 중복 설명을 압축해 각각 150줄 미만으로 정리했다.
- **잔여 blocker**: 추가 provider SDK/model tokenizer는 provider와 모델 선택이 필요하다. `context-runtime` 전용 axis/prefix는 Q3 공유 소비자 근거 부족으로 보류한다.
- **provider discovery**: managed workspace에는 OpenAI API SDK나 Anthropic SDK는 없고, 첫 실제 tokenizer module은 별도 `@qa-sdk/provider-tokenizer-openai` package의 `js-tiktoken@1.0.21` dependency로 격리했다. upstream `vendor/headroom` provider references는 사용하지 않는다.
- **submodule 상태**: `packages/rlsc-analysis`, `vendor/headroom`, `vendor/projectvisbug` 모두 clean이며 pointer 변경 없음.
- **root 커밋 상태**: 미커밋. root에는 이번 context 작업과 무관한 로컬 서버/Cloudflare 설정, upstream tooling, lockfile 및 기타 소비자 변경이 함께 있어 context 범위만 분리한 뒤 커밋해야 한다.
- **검증 상태**: package build/typecheck, context-runtime 55 tests, CLI 663 tests(2 skipped), BDD, `def:check`, lint, `arch:feedback`, `arch:check`, 전체 format check 통과.
