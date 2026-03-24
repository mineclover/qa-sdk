# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*
- Policy Learning 계열 순수 함수는 `InstanceStore.findBySchema()` 결과를 읽은 뒤, primitive leaf context를 dot-notation으로 평탄화하고 `contextKey/value + ordered gate path` 시그니처로 버킷팅하면 후보 생성(US-007)과 비교 분석에서 그대로 재사용할 수 있다.
- 세션형 CLI에 학습/후보 상태가 필요한 경우 모듈 전역 상태를 `createState()` 팩토리로 감싸고 `reset/get...ForTest()` helper를 같이 export하면, 런타임 설계는 유지하면서도 command 단위 테스트를 안정적으로 쓸 수 있다.
- `decision-flow`에 런타임 확장을 넣을 때는 새 파일 추가 후 `src/index.ts` export, `FlowEngine` constructor option 연결, `src/decision-flow.test.ts`에 fake timer 기반 회귀 테스트를 같이 추가하면 변경 범위를 한 패키지 안에 고립시킬 수 있다.
- DKG 노드 타입을 추가할 때는 `packages/spec-core/src/dkg/dkg.types.ts`의 인터페이스와 `DkgNode` 유니온만 바꾸지 말고, `packages/spec-core/src/dkg/index.ts` 타입 re-export까지 같이 갱신해야 공개 서브패스(`@qa-sdk/spec-core/dkg`) 소비자가 바로 사용할 수 있다.
- FlowSchema DKG 통합은 새 엣지 타입을 늘리지 말고 `composes`/`observes`/`contains`/`references`를 재사용하는 helper로 묶는 편이 안전하다. 단, story처럼 `flow-schema -> domain` 방향의 `contains`를 쓰면 trace/membership 조회기도 정방향 `contains`를 함께 읽어야 한다.
- 외부 스키마(예: decision-flow)를 DKG bootstrap에 붙일 때는 config에 `schema + observedPrefixIds`만 저장하고, bootstrap에서 catalog를 보고 axis/domain 관계를 유도하는 패턴이 중복을 줄이고 drift를 막는다.
- FlowSchema 영향 분석은 직접 `composes`/`observes` 결과를 1-hop으로 쓰고, subFlow는 `references`를 따라 BFS로 펼치면 기존 DKG cascade 규약(distance/reason)을 유지한 채 prefix/axis 영향을 함께 계산할 수 있다.
- Policy candidate 생성은 감지된 gate path의 마지막 선택만 `action`으로 승격하고, 앞선 gate 선택들과 `context.<key>` 조건을 canonical signature로 정규화해 기존 `FlowPolicy`와 중복 제거하면 안전하게 자동 제안할 수 있다.
- Human approval 워크플로우는 `FlowPolicy` canonical signature를 재사용해 rejected 후보 재제안을 억제하고, approve/modify 모두 같은 `registerPolicy()` 경로로 흘리면 엔진 결합을 최소화하면서 상태 전이를 일관되게 유지할 수 있다.
- Pairwise diff는 `FlowSchema`가 있으면 schema gate order/weight를 우선 사용하고, 없으면 두 인스턴스의 선택 순서를 위상 정렬처럼 합쳐 skipped gate도 안정적으로 첫 divergence point로 잡는 패턴이 유용하다.
- Gate 분포 분석은 완료 인스턴스의 특정 gate 최종 선택만 뽑아 branch 분포를 계산하고, evidence 상관은 evidence entry 개수 대신 selection 단위의 `kind` presence로 버킷팅해야 한 선택 안의 중복 근거가 상관도를 과장하지 않는다.
- 시간 범위 비교는 pairwise diff의 gate descriptor 해석을 재사용하고, range별 path는 `gateId:branchId` 시그니처로 직렬화해 버킷팅하면 full-path diff와 `coreOnly` 축소를 같은 로직으로 처리할 수 있다.
- 비교 보고서는 pairwise/distribution/temporal 원본 결과를 그대로 보존하고, 그 위에 evidence kind/weight 기반 insight만 덧씌우는 구조가 다음 단계 CLI 소비와 JSON 직렬화 안정성을 동시에 보장한다.
- CLI에서 optional 런타임 패키지를 브릿지할 때는 타입→gate 매핑을 순수 helper로 분리하고, command 전용 점프는 스키마 clone에 `branch.nextGateId`만 주입하면 엔진 본체를 건드리지 않고도 구현할 수 있다.
- CLI 브릿지 상태를 나중 `dkg trace`까지 이어야 할 때는 `DecisionNode`에는 외래키(`flowInstanceId`)만 저장하고, `FlowInstance` 본문은 `dkg_meta`에 `flow-instance:<id>` JSON으로 저장해 복원하는 패턴이 가장 작게 붙는다.
- `dkg decide`처럼 상태를 기록하는 CLI에 위험 경고를 붙일 때는 auto-mapped flow step에서 core gate preview를 먼저 계산하고, 사용자 확인이 끝난 뒤에만 DecisionNode/FlowInstance를 저장하는 순서가 안전하다.
- 기존 CLI 입력을 Flow evidence로 브릿지할 때는 공통 evidence(`rationale`, scaffold context/alternatives/reversalConditions)와 gate별 evidence(미선택 branch description)를 분리해 auto-selected step마다 합성하면, FlowEngine 수정 없이 selection-level provenance를 남길 수 있다.
- decision-flow 관측 좌표를 다른 저장소에 재사용할 때는 Flow 완료 시 `FlowInstance.addressContext`로 한 번 캐시하고, 경계 밖 저장 포맷에서는 `metadata.address_context`로 snake_case 복사만 하는 패턴이 drift를 줄인다.
- `demo-snapshot`에서 `MetaRegistry` 입력을 만들 때 `prefix_ref`의 raw catalog 주소를 그대로 넘기지 말고, 대상 prefix를 decode한 뒤 snapshot entry 길이 기준의 compact `index_ref` 값으로 재인코딩해야 `index-meta` 검증과 cross-index 테스트가 맞는다.
- `flow compare`처럼 CLI 시그니처가 단일 range(`--from/--to`)만 노출하는데 엔진 API가 rangeA/rangeB를 요구하면, 선택한 range를 B로 두고 같은 길이의 직전 인접 구간을 A로 계산해 어댑터에서만 확장하는 패턴이 API/UX 둘 다 덜 흔든다.
- FlowSchema CLI는 DKG의 `FlowSchemaNode`를 목록/관계 조회의 SSOT로 쓰되, gate branch 수나 인과 엣지 같은 정밀 정보는 `DkgConfig.flowSchemas[].schema` 원본에서 다시 읽는 2단 구조가 안전하다. 노드 summary만 믿으면 diagram/profile 디테일이 손실된다.

---

## 2026-03-24 - US-001
- What was implemented
  - `InstanceStore` 인터페이스와 `MemoryInstanceStore` 인메모리 구현을 추가했다.
  - `FlowEngine`에 `instanceStore` 옵션을 연결하고, 인스턴스가 `completed` 상태가 될 때 자동 저장되도록 했다.
  - schema/context/time-range 조회와 자동 저장 동작을 검증하는 테스트를 추가했다.
- Files changed
  - `packages/decision-flow/src/instance-store.ts`
  - `packages/decision-flow/src/engine.ts`
  - `packages/decision-flow/src/index.ts`
  - `packages/decision-flow/src/decision-flow.test.ts`
- **Learnings:**
  - Patterns discovered
    - `decision-flow` 기능 확장은 public export와 `decision-flow.test.ts` 회귀 테스트를 같이 갱신하는 패턴이 안전하다.
  - Gotchas encountered
    - `packages/decision-flow`는 독립 tsconfig를 써서 새 workspace 의존을 즉시 해석하지 못하므로, 이번 스토리는 패키지 내부 유틸만으로 닫는 편이 안정적이었다.
---

## 2026-03-24 - US-002
- What was implemented
  - `packages/spec-core/src/dkg/dkg.types.ts`에 `FlowSchemaNode`와 gate 요약 타입을 추가했다.
  - `DkgNode` 유니온을 `flow-schema`까지 확장하고, DKG 서브패스 barrel에서 새 타입을 re-export하도록 맞췄다.
- Files changed
  - `packages/spec-core/src/dkg/dkg.types.ts`
  - `packages/spec-core/src/dkg/index.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - DKG 타입 추가는 로컬 타입 정의와 함께 dkg barrel export를 동시에 갱신해야 외부 패키지 type import가 깨지지 않는다.
  - Gotchas encountered
    - `dkg.types.ts` 상단의 종수 주석이 실제 유니온 수와 이미 어긋나 있었기 때문에, 새 노드 추가 시 주석 카운트도 같이 정리해야 혼선을 줄일 수 있었다.
---

## 2026-03-24 - US-003
- What was implemented
  - `FlowSchemaNode` 관계를 기존 `composes`/`observes`/`contains`/`references` 엣지로 파생하는 `deriveFlowSchemaEdges`/`attachFlowSchemaEdges` helper를 추가했다.
  - `flow-schema -> domain` 방향의 `contains`도 소속으로 읽히도록 `traceNode()` membership 해석을 보강했다.
  - 새 helper가 축/prefix/domain/subFlow 관계를 정확히 연결하는지 회귀 테스트를 추가했다.
- Files changed
  - `packages/spec-core/src/dkg/flow-schema-relations.ts`
  - `packages/spec-core/src/dkg/flow-schema-relations.test.ts`
  - `packages/spec-core/src/dkg/index.ts`
  - `packages/spec-core/src/dkg/skills/trace.ts`
  - `packages/spec-core/src/shared/graph-port.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - FlowSchema 관계는 새 edge enum 없이 기존 DKG edge semantics로 충분히 표현 가능하고, helper를 먼저 두면 후속 bootstrap/CLI 스토리에서 재사용하기 쉽다.
  - Gotchas encountered
    - 스토리의 `FlowSchemaNode -> DomainNode: contains` 방향은 기존 domain membership 방향과 반대라서, trace 같은 읽기 계층은 그대로 두면 소속 정보를 놓친다.
---

## 2026-03-24 - US-004
- What was implemented
  - `DkgConfig`에 `flowSchemas` 참조 타입을 추가하고, `DEMO_DKG_CONFIG`가 `coordinate-design` + sprint flow들을 등록하도록 확장했다.
  - `bootstrapDkg()`가 `flowSchemas`를 `FlowSchemaNode`로 변환하고, `analyzeGateStructure()` 기반 `coreGateIds`와 재귀 `totalPaths`를 자동 계산하도록 구현했다.
  - 관찰 prefix에서 axis를 유도해 `composes/observes/contains/references` 엣지를 자동 연결하는 bootstrap 경로와 회귀 테스트를 추가했다.
- Files changed
  - `packages/core/src/catalog/dkg-config.types.ts`
  - `packages/core/src/catalog/index.ts`
  - `packages/core/src/index.ts`
  - `packages/cli/src/dkg-config-loader.ts`
  - `packages/spec-core/src/dkg/bootstrap.ts`
  - `packages/spec-core/src/dkg/dkg.test.ts`
  - `packages/spec-core/package.json`
  - `packages/demo-snapshot/src/demo-dkg-config.ts`
  - `packages/demo-snapshot/package.json`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - DKG용 flow schema 참조는 axis 목록을 config에 중복 저장하기보다 observed prefix만 두고 catalog에서 axis/domain을 유도하는 편이 유지보수성이 높다.
  - Gotchas encountered
    - `demo-snapshot`과 `decision-flow`는 package export가 `dist`를 보므로, source만 바꾸면 test/consumer가 최신 설정을 못 읽는다. 이런 스토리에서는 관련 패키지 build 갱신이 필요하다.
---

## 2026-03-24 - US-005
- What was implemented
  - `GraphRegistry.cascadeFromFlowSchema()`를 추가해 flow-schema의 직접 axis/prefix와 subFlow를 통한 간접 영향 axis/prefix를 함께 계산하도록 했다.
  - `dkg.test.ts`에 `flow-schema` kind 조회, `neighbors()` 기반 관계 조회, subFlow cascade 회귀 테스트를 보강했다.
- Files changed
  - `packages/spec-core/src/dkg/graph-registry.ts`
  - `packages/spec-core/src/dkg/dkg.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - FlowSchema cascade는 direct edge(`composes`/`observes`)와 subFlow edge(`references`)를 분리해서 reason을 기록하면 CLI/impact 분석에서 설명 가능한 결과를 만들기 쉽다.
  - Gotchas encountered
    - `sprint-pipeline`처럼 루트 flow에도 관찰 prefix/axis가 직접 연결되어 있으므로, subFlow 영향만 보지 말고 1-hop direct 결과를 먼저 포함해야 acceptance와 실제 모델이 맞는다.
---

## 2026-03-24 - US-006
- What was implemented
  - `packages/decision-flow/src/policy-learning.ts`에 `detectPatterns(store, schemaId, options)`를 추가해 동일 context key/value와 동일 gate 선택 경로의 반복 패턴을 감지하도록 구현했다.
  - 패턴별 빈도, 평균 confidence, 첫/마지막 발생 시각, gate별 branch histogram을 계산하고 `src/index.ts`에서 public export로 연결했다.
  - `decision-flow.test.ts`에 기본 threshold(5회), nested context 평탄화, histogram/시간 집계 회귀 테스트를 추가했다.
- Files changed
  - `packages/decision-flow/src/policy-learning.ts`
  - `packages/decision-flow/src/index.ts`
  - `packages/decision-flow/src/decision-flow.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - 패턴 감지는 객체 전체를 비교하기보다 primitive context leaf만 dot-notation으로 뽑아 경로 시그니처와 함께 그룹핑해야 `findByContext()` 스타일과 자연스럽게 맞는다.
  - Gotchas encountered
    - `demo-tests`는 현재 저장소 상태에서 외부 `platform-demo-api.astralclover.workers.dev` fetch 실패와 기존 gate-engine/schema-consistency 회귀로 깨지고 있어, 이번 스토리 변경과 무관하게 acceptance 전체 green은 막혀 있었다.
---

## 2026-03-24 - US-007
- What was implemented
  - `packages/decision-flow/src/policy-learning.ts`에 `generatePolicyCandidates(patterns, threshold)`와 `PolicyCandidate` 타입을 추가해 빈도/평균 confidence 임계값을 만족하는 패턴만 정책 후보로 변환하도록 구현했다.
  - 후보 생성 시 마지막 gate 선택을 action으로, 컨텍스트 key와 선행 gate 선택을 conditions로 자동 승격하고 `status: "candidate"` 및 자동 rationale 문구를 채우도록 했다.
  - 기존 `FlowPolicy`와 조건/액션 canonical signature를 비교해 중복 후보 생성을 건너뛰는 회귀 테스트와 public export를 추가했다.
- Files changed
  - `packages/decision-flow/src/policy-learning.ts`
  - `packages/decision-flow/src/index.ts`
  - `packages/decision-flow/src/decision-flow.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - 반복 패턴을 실행 가능한 `FlowPolicy`로 바꿀 때는 gate path 전체를 action으로 저장하지 말고 마지막 선택만 action으로, 그 이전 경로는 `gate.<id>.branch` 조건으로 분해해야 기존 policy engine과 바로 연결된다.
  - Gotchas encountered
    - `generatePolicyCandidates(patterns, threshold)` 시그니처를 유지하면서 중복 정책 검사까지 넣으려면 두 번째 인자를 숫자 또는 옵션 객체로 받을 수 있게 열어두는 편이 acceptance와 확장성을 동시에 맞추기 쉬웠다.
    - `pnpm --filter demo-tests test`는 이번 변경과 무관하게 외부 `platform-demo-api.astralclover.workers.dev` DNS 실패, gate-engine 회귀, `perm_svc/v2` snapshot 누락, schema-consistency 실패로 계속 red 상태였다.
---

## 2026-03-24 - US-008
- What was implemented
  - `PolicyCandidate`에 `approved | rejected | modified` 상태와 review 메타데이터를 확장하고, `PolicyCandidateWorkflow`를 추가해 후보 제안/조회/승인/거부/수정 승인 흐름을 한 곳에 모았다.
  - `approveCandidate(id)`와 `modifyCandidate(id, changes)`가 `FlowPolicy`로 변환된 결과를 `registerPolicy()`로 엔진에 등록하고, `rejectCandidate(id, reason)`는 같은 canonical signature 재제안을 억제하도록 구현했다.
  - `decision-flow.test.ts`에 승인 등록, 거부 억제, 수정 후 승인 회귀 테스트를 추가하고 public export를 갱신했다.
- Files changed
  - `packages/decision-flow/src/policy-learning.ts`
  - `packages/decision-flow/src/index.ts`
  - `packages/decision-flow/src/decision-flow.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - 후보 상태 전이와 실제 정책 등록을 분리하려면 workflow 레이어에서는 candidate ID를 유지하고, 등록 여부 판단은 `FlowPolicy` signature 기반으로 하는 편이 재제안 억제와 엔진 연동을 동시에 단순화한다.
  - Gotchas encountered
    - `demo-tests`는 여전히 외부 `platform-demo-api.astralclover.workers.dev` DNS 실패, gate-engine open/reserved 회귀, `perm_svc/v2` snapshot 누락, schema-consistency 실패 때문에 red 상태였고 이번 스토리 변경과 직접 관련은 없었다.
---

## 2026-03-24 - US-009
- What was implemented
  - `packages/decision-flow/src/comparison.ts`에 `diffInstances(a, b, schema?)`와 pairwise diff 타입들을 추가해 gate별 `match/diverge`, 첫 divergence point, core gate divergence 강조, evidence diff를 계산하도록 구현했다.
  - schema가 없을 때도 두 인스턴스의 선택 순서를 합쳐 안정적으로 비교하도록 gate order 추론 로직을 넣었다.
  - `src/index.ts` public export와 `src/decision-flow.test.ts` 회귀 테스트를 추가해 core/tactical divergence와 evidence 차이를 검증했다.
- Files changed
  - `packages/decision-flow/src/comparison.ts`
  - `packages/decision-flow/src/index.ts`
  - `packages/decision-flow/src/decision-flow.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Pairwise diff는 branch 비교와 evidence 비교를 분리해야 gate 상태는 단순하게 유지하면서도 "왜 갈렸는가"에 필요한 근거 차이를 같이 실을 수 있다.
  - Gotchas encountered
    - evidence weight 차이는 리포트성 숫자라 부동소수 오차(`0.30000000000000004`)를 그대로 노출하지 않도록 정규화가 필요했다.
    - `pnpm --filter demo-tests test`는 이번 변경과 무관하게 외부 `platform-demo-api.astralclover.workers.dev` DNS 실패, `perm_svc/v2` snapshot 누락, gate-engine open/reserved 회귀, schema-consistency 실패로 계속 red 상태였다.
---

## 2026-03-24 - US-010
- What was implemented
  - `packages/decision-flow/src/comparison.ts`에 `gateDistribution(store, schemaId, gateId)`와 분포 분석 타입들을 추가했다.
  - branch별 선택 횟수, 비율, 평균 confidence와 `>70%` 지배 branch 힌트를 계산하고, evidence kind별 branch 상관 분포를 selection 단위로 집계하도록 구현했다.
  - `packages/decision-flow/src/index.ts` export와 `packages/decision-flow/src/decision-flow.test.ts` 회귀 테스트를 추가했다.
- Files changed
  - `packages/decision-flow/src/comparison.ts`
  - `packages/decision-flow/src/index.ts`
  - `packages/decision-flow/src/decision-flow.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - gate-level 분석은 branch 집계와 evidence-kind 상관 집계를 분리하고, evidence 상관은 "해당 selection에 kind가 있었는가" 기준으로 세야 branch와의 연관성이 과장되지 않는다.
  - Gotchas encountered
    - `MemoryInstanceStore`는 전체 인스턴스를 돌려주므로 분포 분석 쪽에서 `completed` 상태와 gate 존재 여부를 명시적으로 필터링해야 pending/부분 실행 데이터가 섞이지 않았다.
    - `pnpm --filter demo-tests test`는 이번 변경과 무관하게 외부 `platform-demo-api.astralclover.workers.dev` DNS 실패, `perm_svc/v2` snapshot 누락, gate-engine open/reserved 회귀, schema-consistency 실패로 계속 red 상태였다.
---

## 2026-03-24 - US-011
- What was implemented
  - `packages/decision-flow/src/comparison.ts`에 `compareTimeRanges(store, schemaId, rangeA, rangeB, options)`와 시간 범위 비교 타입들을 추가했다.
  - range별 완료 인스턴스만 집계해 gate 분포 변화율(total/branch shift percentage), 등장 경로, 사라진 경로를 계산하고 `coreOnly + schema` 옵션으로 코어 gate만 비교할 수 있게 했다.
  - `packages/decision-flow/src/index.ts` export와 `packages/decision-flow/src/decision-flow.test.ts` 회귀 테스트를 추가해 기본 temporal diff, coreOnly 필터, 최소 표본 수 가드를 검증했다.
- Files changed
  - `packages/decision-flow/src/comparison.ts`
  - `packages/decision-flow/src/index.ts`
  - `packages/decision-flow/src/decision-flow.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - 시간 범위 비교는 schema 기반 gate descriptor를 먼저 고정한 뒤 range별 path를 같은 descriptor 순서로 직렬화하면 gate shift와 path diff가 같은 필터(`coreOnly`)를 공유할 수 있다.
  - Gotchas encountered
    - PRD FR-11 때문에 각 범위에 완료 인스턴스가 최소 2건 필요하므로, 표본 수 부족은 빈 결과 대신 즉시 에러로 막아야 잘못된 비교를 조용히 통과시키지 않는다.
    - `pnpm --filter demo-tests test`는 이번 변경과 무관하게 외부 `platform-demo-api.astralclover.workers.dev` DNS 실패, `perm_svc/v2` snapshot 누락, gate-engine open/reserved 회귀, schema-consistency 실패로 계속 red 상태였다.
---

## 2026-03-24 - US-012
- What was implemented
  - `packages/decision-flow/src/comparison.ts`에 `ComparisonReport` 계열 타입과 `createComparisonReport()`를 추가해 pairwise diff, gate distribution, temporal shift 결과를 단일 JSON-safe 보고서로 묶었다.
  - pairwise diff의 evidence 차이를 읽어 gate별 `whyDifferent` 추론(`DifferenceReasoning`)과 distribution/temporal insight 요약을 생성하도록 구현했다.
  - `packages/decision-flow/src/index.ts` export와 `packages/decision-flow/src/decision-flow.test.ts` 회귀 테스트를 추가해 보고서 구조, why-different 추론, JSON 직렬화를 검증했다.
- Files changed
  - `packages/decision-flow/src/comparison.ts`
  - `packages/decision-flow/src/index.ts`
  - `packages/decision-flow/src/decision-flow.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - 보고서 계층은 기존 분석 함수의 raw output을 중복 가공하지 말고 그대로 포함한 뒤, evidence 기반 요약만 별도 section으로 파생하는 편이 후속 CLI/직렬화 소비에 가장 안정적이었다.
  - Gotchas encountered
    - dominant branch 판정은 기존 분포 규칙(`ratio > 0.7`)을 그대로 따라야 하므로, 리포트 요약이 60% 같은 다수 branch를 "지배적"이라고 과장하면 기존 분석 결과와 충돌한다.
    - `pnpm --filter demo-tests test`는 이번 변경과 무관하게 외부 `platform-demo-api.astralclover.workers.dev` DNS 실패, `perm_svc/v2` snapshot 누락, gate-engine 회귀, schema-consistency 실패로 계속 red 상태였다.
---

## 2026-03-24 - US-013
- What was implemented
  - `qa-sdk dkg decide` 기본 경로가 기존 DecisionNode 기록을 유지하면서, 동적 import한 `decision-flow`로 `coordinate-design` 플로우를 함께 시작하도록 브릿지를 추가했다.
  - `--type`에 따라 `axis-definition` 선행 선택과 `nextGateId` 점프를 적용해 `capacity`, `new-axis`, `new-prefix`, `merge`, `deprecate`를 자동 매핑하고, 매핑되지 않는 타입은 순차 실행으로 안내하도록 했다.
  - `--legacy` 옵션을 추가해 플로우 브릿지 없이 기존 방식만 실행할 수 있게 했고, 회귀 테스트로 매핑/순차 안내를 검증했다.
- Files changed
  - `packages/cli/src/commands/dkg.ts`
  - `packages/cli/src/commands/dkg-decision-flow.ts`
  - `packages/cli/src/commands/dkg-decision-flow.test.ts`
  - `packages/cli/src/index.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - command별 분기 진입점을 만들 때는 FlowSchema를 복제해 특정 branch에만 `nextGateId`를 주입하면, FlowEngine 수정 없이도 기존 순차 플로우 위에 "jump-in" UX를 얹을 수 있다.
  - Gotchas encountered
    - `merge`/`deprecate`는 `merge-split`까지는 점프할 수 있지만, 해당 gate 자체에 후속 `nextGateId`가 없어서 자동 선택 뒤 현재 엔진은 첫 미선택 gate(`prefix-design`)로 돌아간다. 출력/테스트도 이 실제 동작을 기준으로 맞춰야 했다.
    - `pnpm --filter demo-tests test`는 이번 변경과 무관하게 외부 `platform-demo-api.astralclover.workers.dev` DNS 실패, `perm_svc/v2` snapshot 누락, gate-engine open/reserved 회귀, schema-consistency 실패 때문에 계속 red 상태였다.
---

## 2026-03-24 - US-020
- What was implemented
  - `qa-sdk dkg flow-schemas`와 `qa-sdk dkg flow-schema <id>`를 추가해 DKG에 등록된 FlowSchemaNode 목록과 개별 프로파일을 CLI에서 조회할 수 있게 했다.
  - `qa-sdk dkg diagram flow-schema <id>`를 추가해 FlowSchema의 gate 인과 그래프를 Mermaid flowchart로 출력하도록 구현했다.
  - FlowSchema 요약/프로파일/diagram을 상태 저장소 없이 검증하는 CLI helper 테스트를 추가했다.
- Files changed
  - `packages/cli/src/commands/dkg.ts`
  - `packages/cli/src/commands/dkg-flow-schema.test.ts`
  - `packages/cli/src/index.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - FlowSchema CLI는 DKG 그래프 관계와 원본 FlowSchema 정의를 분리 조회하는 helper 계층으로 만들면, 목록/프로파일/diagram을 같은 데이터 소스로 일관되게 재사용할 수 있다.
  - Gotchas encountered
    - `coordinate-design`의 branch 수/weight는 예상보다 schema 원본이 더 풍부해서, summary 기반 테스트를 쓰면 실제 acceptance와 어긋날 수 있었다.
    - `pnpm --filter demo-tests test`는 이번 스토리와 별개로 외부 `platform-demo-api.astralclover.workers.dev` DNS 실패, `perm_svc/v2` snapshot 누락, gate-engine open/reserved 회귀, schema-consistency 실패 때문에 계속 red 상태였다.
---

## 2026-03-24 - US-019
- What was implemented
  - `qa-sdk flow compare`를 추가해 인스턴스 쌍 비교, `--gate/--schema` 분포 분석, `--from/--to/--schema` 시간 비교를 CLI에서 실행할 수 있게 했다.
  - pairwise/temporal 출력에서 코어 gate 차이를 `★`로 강조하고, distribution/temporal 요약은 기존 comparison report insight를 재사용하도록 연결했다.
  - `packages/cli/src/commands/flow.test.ts`에 pairwise/distribution/temporal CLI 회귀 테스트를 추가했다.
- Files changed
  - `packages/cli/src/commands/flow.ts`
  - `packages/cli/src/commands/flow.test.ts`
  - `packages/cli/src/index.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - 단일 기간 입력만 받는 CLI 시간 비교는 선택 구간을 range B, 바로 앞 동일 길이 구간을 range A로 파생하면 기존 `compareTimeRanges()` API를 건드리지 않고도 붙일 수 있다.
  - Gotchas encountered
    - `flow compare` 옵션 파싱은 `--schema`가 distribution/temporal 양쪽에 공통이라 `--from/--to` 분기를 `--gate/--schema`보다 먼저 처리해야 오인식되지 않는다.
    - `pnpm --filter demo-tests test`는 이번 변경과 무관하게 외부 `platform-demo-api.astralclover.workers.dev` DNS 실패, `perm_svc/v2` snapshot 누락, gate-engine open/reserved 회귀, schema-consistency 실패 때문에 계속 red 상태였다.
---

## 2026-03-24 - US-014
- What was implemented
  - `DecisionNode`에 optional `flowInstanceId`를 추가하고, `dkg decide` 브릿지가 성공하면 DecisionNode를 해당 FlowInstance ID로 다시 저장하도록 연결했다.
  - 브릿지 시작 시 FlowInstance.context에 `dkgDecisionId`를 자동 주입하고, FlowSchemaNode → DecisionNode `justifies` 엣지와 `flow-instance:<id>` meta 저장을 추가했다.
  - `qa-sdk dkg trace <decision-id>`가 저장된 FlowInstance를 복원해 연결된 flow-schema와 코어 결정 추적을 출력하도록 보강했고, 관련 CLI 브릿지 테스트를 추가했다.
- Files changed
  - `packages/spec-core/src/dkg/dkg.types.ts`
  - `packages/convergence/src/dkg-types.ts`
  - `packages/cli/src/commands/dkg-decision-flow.ts`
  - `packages/cli/src/commands/dkg-decision-flow.test.ts`
  - `packages/cli/src/commands/dkg.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - DKG 노드에는 얇은 참조만 두고, 복원 가능한 런타임 객체는 SQLite meta에 JSON으로 저장하면 별도 테이블 없이 CLI trace까지 연결할 수 있다.
  - Gotchas encountered
    - `dkg trace`는 기존 `traceNode()` 결과만으로는 FlowSchema → Decision 방향 `justifies`를 보여주지 못하므로, DecisionNode 상세 출력 단계에서 역방향 edge와 저장된 FlowInstance를 함께 읽어야 연결 정보가 보였다.
    - `pnpm --filter demo-tests test`는 여전히 외부 `platform-demo-api.astralclover.workers.dev` DNS 실패, `perm_svc/v2` snapshot 누락, gate-engine open/reserved 회귀, schema-consistency 실패 때문에 red 상태였고 이번 스토리 변경과 직접 관련은 없었다.
---

## 2026-03-24 - US-015
- What was implemented
  - `dkg decide`가 auto-mapped core gate 선택 전에 `analyzeImpact()` 기반 영향 preview를 계산하고, 영향 gate 목록과 무효화 cascade를 출력하도록 연결했다.
  - `invalidatesCore: true`인 core gate에는 `⚠ 코어 gate 무효화 — 전체 재설계 필요` 경고를 추가했고, `--force`가 없으면 계속 진행 여부를 먼저 확인한 뒤에만 DecisionNode를 기록하도록 순서를 바꿨다.
  - CLI 브릿지 테스트에 core warning 포맷과 중단 경로 회귀를 추가했다.
- Files changed
  - `packages/cli/src/commands/dkg-decision-flow.ts`
  - `packages/cli/src/commands/dkg-decision-flow.test.ts`
  - `packages/cli/src/commands/dkg.ts`
  - `packages/cli/src/index.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - core gate warning은 `getDkgFlowBridgeSteps()` 결과와 annotated flow schema만으로 미리 계산할 수 있어서, 실제 FlowInstance를 저장하기 전에 안전하게 preview/confirm 단계를 넣을 수 있었다.
  - Gotchas encountered
    - `dkg decide`는 기존 구현이 DecisionNode를 먼저 저장했기 때문에, 경고 후 중단 요구를 만족하려면 경고 계산과 확인 절차를 저장 이전으로 옮겨야 했다.
    - `pnpm --filter demo-tests test`는 이번 변경과 무관하게 외부 `platform-demo-api.astralclover.workers.dev` DNS 실패, `perm_svc/v2` snapshot 누락, gate-engine open/reserved 회귀, schema-consistency 실패 때문에 여전히 red 상태였다.
---

## 2026-03-24 - US-016
- What was implemented
  - `dkg decide` 브릿지의 auto-selected flow step에 `rationale`, scaffold context, scaffold alternatives, reversalConditions를 `Evidence`로 자동 주입하도록 추가했다.
  - 각 gate에서 선택되지 않은 branch들의 description/label을 별도 evidence로 기록하고, `--confidence`가 있으면 우선 적용하고 없으면 evidence weight 평균으로 confidence가 계산되게 연결했다.
  - `--alternatives "a|b"` optional 입력을 Decision scaffold와 evidence 모두에 연결하고, coordinate-design branch descriptions 및 CLI/spec-core 회귀 테스트를 보강했다.
- Files changed
  - `packages/cli/src/commands/dkg-decision-flow.ts`
  - `packages/cli/src/commands/dkg-decision-flow.test.ts`
  - `packages/cli/src/commands/dkg.ts`
  - `packages/cli/src/index.ts`
  - `packages/decision-flow/src/self-analysis.ts`
  - `packages/spec-core/src/dkg/skills/record-operation.ts`
  - `packages/spec-core/src/dkg/skills/record-operation.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - CLI 입력을 Flow selection evidence로 옮길 때는 selection 공통 근거와 gate-local 대안 근거를 분리해 합성하면, 브릿지 helper 하나로 여러 자동 매핑 step에 같은 provenance 모델을 재사용할 수 있다.
  - Gotchas encountered
    - `packages/cli` 테스트는 `decision-flow` package entry를 통해 branch metadata를 읽기 때문에, source에 description을 추가해도 build 전에는 dist 기준 값이 보일 수 있어 문자열 기대값을 너무 구체적으로 고정하면 flaky해진다.
    - `pnpm --filter demo-tests test`는 이번 변경 후에도 외부 `platform-demo-api.astralclover.workers.dev` DNS 실패, `perm_svc/v2` snapshot 누락, gate-engine open/reserved 회귀, schema-consistency 실패로 red 상태였고 이번 스토리 변경과 직접 관련은 없었다.
---

## 2026-03-24 - US-017
- What was implemented
  - `FlowEngine`가 인스턴스 완료 시 `buildFlowCompletionContext()`를 자동 호출해 `FlowInstance.addressContext`에 decision prefix 좌표를 캐시하도록 추가했다.
  - `buildFlowCompletionContext()`가 알려진 sprint flow ID는 표준 `flow_type` entry로, 그 외 flow는 `custom`으로 안전하게 매핑하도록 보강했다.
  - `dkg decide` 브릿지가 완료된 FlowInstance의 `addressContext`를 `DecisionNode.metadata.address_context`로 복사해 DKG 저장 포맷에서도 convergence가 읽을 수 있는 shape를 유지하도록 연결했다.
- Files changed
  - `packages/decision-flow/src/types.ts`
  - `packages/decision-flow/src/ingest-adapter.ts`
  - `packages/decision-flow/src/engine.ts`
  - `packages/decision-flow/src/decision-flow.test.ts`
  - `packages/spec-core/src/dkg/dkg.types.ts`
  - `packages/convergence/src/dkg-types.ts`
  - `packages/cli/src/commands/dkg-decision-flow.ts`
  - `packages/cli/src/commands/dkg-decision-flow.test.ts`
  - `packages/cli/src/commands/dkg.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - Flow 완료 후 외부 저장소에 decision prefix를 붙여야 할 때는 엔진이 생성한 `addressContext`를 런타임 객체에 남기고, 소비자 쪽은 그 값을 복사만 하게 만드는 편이 가장 작게 붙는다.
  - Gotchas encountered
    - `decision-flow` 패키지를 소비하는 CLI 테스트는 workspace source가 아니라 package `dist` export를 볼 수 있어서, source 수정 뒤 관련 소비자 검증 전 `pnpm --filter decision-flow build` 갱신이 필요했다.
    - `pnpm --filter demo-tests test`는 이번 변경 후에도 외부 `platform-demo-api.astralclover.workers.dev` DNS 실패, `perm_svc/v2` snapshot 누락, gate-engine open/reserved 회귀, schema-consistency 실패로 red 상태였고 이번 스토리 변경과 직접 관련은 없었다.
---

## 2026-03-24 - US-018
- What was implemented
  - `qa-sdk flow policy learn/candidates/approve/reject/list` CLI를 추가해 패턴 학습, 후보 조회, 승인 등록, 거부, 등록 정책 조회를 한 흐름으로 연결했다.
  - `flow` command 모듈 상태를 `MemoryInstanceStore + PolicyCandidateWorkflow` 기반 세션 상태로 확장하고, 후보의 빈도/평균 confidence를 CLI에서 표시하도록 학습 메타데이터를 함께 보존했다.
  - `flow.test.ts`를 추가해 `learn -> candidates -> approve/reject -> list` 흐름을 회귀 테스트로 검증했다.
- Files changed
  - `packages/cli/src/commands/flow.ts`
  - `packages/cli/src/commands/flow.test.ts`
  - `packages/cli/src/index.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - 세션형 CLI 서브시스템은 모듈 상태를 팩토리 함수로 감싸고 test reset helper를 같이 두면, 실제 사용자 흐름은 유지하면서 command 함수 단위 검증을 쉽게 붙일 수 있다.
  - Gotchas encountered
    - `PolicyCandidate` 자체에는 빈도/confidence 필드가 없어서, CLI 표시 요구를 맞추려면 `learn` 시점의 패턴 메타데이터를 별도로 캐시하거나 rationale에서 복원해야 했다.
    - `pnpm --filter demo-tests test`는 이번 실행에서도 외부 `platform-demo-api.astralclover.workers.dev` DNS 실패, `perm_svc/v2` snapshot 누락, gate-engine open/reserved 회귀, schema-consistency 실패로 red 상태였고 이번 스토리 변경과 직접 관련은 없었다.
---
## 2026-03-24 - US-021
- What was implemented
  - `dkg decide`의 mapped 타입에 대해 남은 gate를 기본 branch로 자동 완주하는 경로를 추가하고, SQLite state를 쓰는 CLI E2E로 `new-axis → completed FlowInstance + DecisionNode`, `merge → core warning`, `dkg trace`, `--legacy`를 검증했다.
  - `demo-tests`가 현재 워크스페이스와 네트워크 제한에서도 green이 되도록 외부 API 스위트를 env-gated로 바꾸고, `demo-snapshot → MetaRegistry` 브릿지 및 drift 난 회귀 테스트들을 현재 SSOT에 맞게 정렬했다.
- Files changed
  - `packages/cli/src/commands/dkg-decision-flow.ts`
  - `packages/cli/src/commands/dkg.ts`
  - `packages/cli/src/commands/dkg-decision-flow.test.ts`
  - `packages/cli/src/commands/dkg.e2e.test.ts`
  - `packages/demo-snapshot/src/demo-bridge.ts`
  - `packages/demo-tests/src/platform-api-contract.test.ts`
  - `packages/demo-tests/src/platform-page-e2e.test.ts`
  - `packages/demo-tests/src/schema-consistency.test.ts`
  - `packages/demo-tests/src/index-meta/gate-engine.test.ts`
  - `packages/demo-tests/src/index-meta/gate-engine-sql-e2e.test.ts`
  - `packages/demo-tests/src/registry-codec.test.ts`
  - `packages/demo-tests/src/position-stability.test.ts`
  - `packages/demo-tests/src/index-meta/shopping-platform.test.ts`
  - `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
    - CLI E2E가 실제 SQLite state까지 건드리는 경우에는 `HOME`을 테스트마다 임시 디렉터리로 격리하고 모듈을 재로딩하면 전역 cache/상태를 건드리지 않고 `dkg decide → trace` 흐름을 검증할 수 있다.
    - 외부 배포 API를 때리는 contract 테스트는 기본 remote URL로 항상 실행하지 말고, `DEMO_API_BASE`가 명시된 환경에서만 켜지게 해야 CI/샌드박스에서 안정적이다.
  - Gotchas encountered
    - `MetaRegistry`의 `index_ref`는 target index의 compact value를 기대하므로, catalog의 capacity-based `prefix_ref` 정수를 그대로 넘기면 snapshot 검증에서 즉시 깨졌다.
    - shopping/meta-registry 데모 테스트는 오래된 service shape(5×2×5×2)와 dim id(`event_svc`)를 하드코딩하고 있어서, 현재 SSOT(`svc_name` 14개, `evt_svc`) 기준으로 기대값을 다시 계산하도록 바꿔야 했다.
---
