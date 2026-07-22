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

| 항목 | 결정 |
|------|------|
| 변경 유형 | 신규 read-mostly runtime contract/design |
| owner | `context-runtime` |
| 기존 소비자 | `@qa-sdk/context`, `decision-flow`, definition graph, federation query port |
| non-goal | LLM adapter, 원본 데이터 저장, ERP/CRM 재구현, 외부 transaction |
| baseline | 2026-07-23, `context-runtime` 순수 runtime과 `def context --bounded` 첫 소비자 구현 완료 |

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
- [x] `qa-sdk def context --bounded`에서 Discovery Plan과 Working Context를 실행
- [x] bounded 출력에 deterministic Manifest와 observation mapping을 포함
- [x] 기존 `qa-sdk def context <문서ID>` 출력과의 하위 호환성 검증

## 보류 항목 ^constraint

- [ ] 실제 LLM tokenizer별 token 계산
- [ ] HTTP/DB source adapter 구현
- [ ] Handoff 영속화 서비스
- [ ] `context-runtime` 전용 axis/prefix 추가
- [ ] 자동 Task decomposition 실행기

## 완료 조건 ^validation

- [x] `context-bounded-execution.cases.md`의 모든 contract에 test unit과 implementation unit이 연결됨
- [x] focused unit/contract test가 통과함
- [x] 구현된 사실만 새로운 `.spec.md`에 흡수됨
- [x] `def sync`와 `def validate`가 통과함
- [x] package boundary와 public surface 영향이 `arch:feedback`으로 검증됨

## Closure evidence ^evidence

- `corepack pnpm install --frozen-lockfile` — lockfile 고정 설치 통과
- `corepack pnpm --filter context-runtime typecheck` — 통과
- `corepack pnpm --filter context-runtime test` — 33 tests 통과
- `corepack pnpm --filter context-runtime build` — ESM/CJS/DTS build 통과
- `corepack pnpm --filter dkg test` — 126 tests 통과
- `corepack pnpm --filter dkg-enrichment test` — 27 tests 통과
- `corepack pnpm --filter @qa-sdk/cli exec vitest run src/commands/def.test.ts` — 27 tests 통과
- `corepack pnpm run def:check` — definition validate 경고 0건
- `corepack pnpm arch:feedback` — 6/6 단계 통과
- `corepack pnpm arch:check` — tier violation 0건

외부 upstream이 소유한 deprecated 전이 의존성 경고와 기존 CLI bundle unused-export 경고는 이번 범위에서 수정하지 않는다.
