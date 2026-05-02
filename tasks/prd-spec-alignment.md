[PRD]
# PRD: qa-sdk 스펙-구현 정합성 (Spec-Implementation Alignment)

## Overview

qa-sdk 모노레포의 스펙 문서와 구현 코드 사이의 불일치를 해소한다. **스펙을 정본(source of truth)**으로 삼되, 구현에서 유용하게 추가된 필드는 스펙에 먼저 반영한 뒤 정본으로 확정한다. 네이밍 컨벤션은 **snake_case**로 통일한다. 새 기능 graph_hint 구현과 미작성 테스트 추가를 포함한다.

## Goals

- 모든 스펙이 구현의 정확한 반영이 되도록 정합성 확보
- 스펙 기준으로 구현을 리팩토링하여 구조적 일관성 확보 (verdict step_matches, graph source/target, causal edge)
- snake_case 네이밍 컨벤션 통일
- 미문서화된 포트(ScenarioSpecStore, DlqStore) 스펙 작성
- graph_hint 기능 구현 (event-catalog)
- failing 테스트 수정 + 미작성 테스트 추가 (event-catalog, pino)

## Quality Gates

이 PRD의 모든 스토리는 해당 패키지의 다음 명령이 통과해야 한다:
- `pnpm --filter @qa-sdk/<pkg> run typecheck` — 타입 체크
- 해당 패키지에 테스트가 있는 경우: `pnpm --filter @qa-sdk/<pkg> run test` — 테스트 통과

## 주요 설계 결정 (스토리 실행 시 참조)

### 정본 규칙
- **구조/행동**: 스펙이 정본. 구현을 스펙에 맞게 수정
- **네이밍**: snake_case (구현 컨벤션). 스펙의 camelCase를 snake_case로 업데이트
- **구현 전용 추가 필드**: 유용하면 스펙에 먼저 반영 → 정본이 됨

### Verdict 구조 결정
- `step_matches: StepMatch[]` 배열 구조 유지 (spec 기준)
- `StepMatch.constraint_results: ConstraintResult[]` 상세 배열 유지 (spec 기준)
- `passed_steps/failed_steps/warning_steps` 분리 배열 → `step_matches` 로 통합
- 구현 추가 필드 스펙에 반영: `qa_session_id`, `summary`
- `computed_at`: VerdictReport에 유지 (spec 기준)

### Graph 구조 결정
- Edge 필드: `source/target` (spec 기준, `from/to` 대체)
- Edge 타입: `causal` 유지 (spec 기준, `derived` 대체)
- SpecNode: 경량 투영으로 변경하되 매칭/판정에 필요한 필드는 유지 (timeout_ms 포함)
- 구현 추가 필드 스펙에 반영: `log_id`, `payload_masking_applied`, `payload_masked_fields`

### SpecNode 경량화 결정
- `{ id, step: ScenarioStep }` → 매칭/판정 필드만 투영하는 구조로 변경
- `next`, `branches` 같은 그래프 네비게이션 필드는 SpecEdge로 이동 완료 상태이므로 SpecNode에서 제거
- `timeout_ms`는 SpecNode에 유지 (computeVerdict에서 latency 체크에 필요)

```typescript
interface SpecNode {
  step_id: string;
  event_key: string;
  event_version?: string;
  source?: string;
  record_kind?: "log" | "span";
  required: boolean;
  kind: StepKind;
  constraints?: StepConstraint[];
  timeout_ms?: number;
}
```

### Pipeline 시그니처 결정
- `reconstruct(trace_id, records, options?)` — trace_id 파라미터 스펙에 추가
- `computeVerdict(match_result, spec_graph, runtime_graph, qa_session_id?)` — 추가 파라미터 스펙에 추가
- `evaluateConstraints()` → `ConstraintResult[]` 상세 배열 반환 (spec 기준, boolean 대체)

### Record 확장 결정
- `payload_format`: 6개 값으로 스펙 확장 (`json | rpc | protobuf | text | binary | stream`)
- `payload_encoding`: 구현 값으로 스펙 수정 (`raw | base64 | gzip+base64`)

### service_name 설계 노트
- `event_records` 테이블에 `service_name`이 없는 것은 **의도된 경량화**. 서비스 식별은 세션 단위로 한 번만 수집하므로 개별 이벤트에 중복 저장하지 않음
- `service_name`은 `transmissions`과 `traces` 테이블에 저장됨
- `RuntimeNode.service_name`은 현재 항상 undefined — reconstruction에서 trace-level 데이터로부터 채워야 하지만, service_ref 통합과 함께 **별도 스토리**에서 다룸
- graph-matcher의 `step.source` 필터는 현재 동작하지 않음 (service_name이 undefined이므로) — service_ref 통합 시 함께 해결

### JSONB 하위 호환성
- **v0.1.0 프리프로덕션** — 프로덕션 데이터 없음
- VerdictReport, RuntimeGraph 구조 변경 시 기존 데이터 걱정 불필요
- drizzle-kit으로 새 마이그레이션 생성하여 처리

## User Stories

### US-001: core 스펙 4개 현행화 (record, graph, verdict, utils)

**Description:** As a developer, I want core specs to accurately reflect the target design so that implementation work has a clear reference.

**Acceptance Criteria:**
- [x] `core/specs/record.spec.md` — payload_format 6개(`json | rpc | protobuf | text | binary | stream`), payload_encoding 3개(`raw | base64 | gzip+base64`), `_registry_warning` 필드 반영. 모든 필드명 snake_case 확인
- [x] `core/specs/graph.spec.md` — 전면 재작성: RuntimeNode에 `log_id`, `payload_masking_applied`, `payload_masked_fields` 추가. `service_name`은 optional로 유지하되 "reconstruction에서 trace-level에서 주입 예정" 명시. edge 필드 `source/target` 확정, edge 타입에 `causal` 확정. SpecNode를 경량 구조로 확정 (step_id, event_key, event_version?, source?, record_kind?, required, kind, constraints?, timeout_ms?). 모든 필드 snake_case
- [x] `core/specs/verdict.spec.md` — 전면 재작성: `step_matches: StepMatch[]` 구조 확정, `StepMatch.constraint_results: ConstraintResult[]` 확정, `qa_session_id`, `summary` 필드 추가, `computed_at` VerdictReport에 유지, VerdictStore에 `remove_by_scenario_and_trace()`, `find_by_trace_id()` 메서드 추가. 모든 필드 snake_case
- [x] `core/specs/utils.spec.md` — `newVerdictId()`, `newDlqId()` 함수 추가
- [x] 스펙 문서만 수정, 코드 변경 없음

### US-002: engine/pipeline.spec.md 재작성

**Description:** As a developer, I want the engine pipeline spec to match the confirmed function signatures so that refactoring has a clear target.

**Acceptance Criteria:**
- [x] `reconstruct(trace_id: string, records: EventRecord[], options?: ReconstructionOptions): RuntimeGraph` — trace_id 파라미터 문서화
- [x] `ReconstructionOptions.temporal_strategy: "span-local" | "global"` 문서화 (boolean flag 대체)
- [x] `evaluateConstraints()` 반환 타입을 `ConstraintResult[]` (`{ constraint: StepConstraint; passed: boolean; actual?: unknown }`)로 문서화
- [x] `computeVerdict(match_result, spec_graph, runtime_graph, qa_session_id?)` 시그니처 문서화
- [x] 비공개 헬퍼 `reconstructTrace()`, `computeTraceVerdict()` 존재 문서화
- [x] 스펙 문서만 수정, 코드 변경 없음

### US-003: sdk/logger.spec.md 확장 + 미문서화 포트 스펙 작성

**Description:** As a developer, I want all public interfaces to have specs so that the codebase has no documentation blind spots.

**Acceptance Criteria:**
- [x] `sdk/specs/logger.spec.md` — LogParams 타입 정의 추가: `{ event_key, event_version, payload?, payload_format?, payload_encoding?, qa_session_id? }`. SpanParams 타입 정의 추가: LogParams + `span_name` 필수. SpanHandle.end() 파라미터 문서화
- [x] `core/specs/scenario-spec-store.spec.md` 신규 작성 — `upsert()`, `findById()`, `findAll()`, `findByDomain()`, `remove()` 메서드 문서화 (현재 구현 기반)
- [x] `core/specs/dlq-store.spec.md` 신규 작성 — `DlqPhase`, `DlqInsert`, `StoredDlqItem` 타입 + `insert()`, `findPending()`, `markAttempted()`, `markResolved()` 메서드 문서화 (현재 구현 기반)
- [x] 각 패키지의 `specs/README.md` 인덱스 업데이트
- [x] 스펙 문서만 수정/생성, 코드 변경 없음

### US-004: Failing 테스트 수정 (store + registry-server)

**Description:** As a developer, I want all existing tests to pass so that the test suite is trustworthy before refactoring.

**Acceptance Criteria:**
- [x] `store` session.adapter.test.ts 수정 — `upsert()` 반환값이 void이므로 테스트에서 반환값 검증 대신 `findById()`로 확인하는 패턴으로 변경
- [x] `store` trace.adapter.test.ts 수정 — 동일 패턴으로 변경
- [x] `registry-server` env.test.ts 수정 — 모듈 레벨 `parseEnv(process.env)` 실행 시점 문제 해결 (테스트에서 env 주입 방식 수정)
- [x] `pnpm --filter @qa-sdk/store run test` 전체 통과
- [x] `pnpm --filter @qa-sdk/registry-server run test` 전체 통과

### US-005: Verdict 리팩토링 — core 타입 + engine 전체

**Description:** As a developer, I want VerdictReport to use the step_matches structure defined in spec so that constraint-level debugging info is available.

**Acceptance Criteria:**
- [x] `core/types` — `VerdictReport` 타입 변경: `passed_steps/failed_steps/warning_steps/missing_steps/unexpected_nodes` → `step_matches: StepMatch[]`로 대체. `qa_session_id`, `summary`, `computed_at` 필드 유지/추가
- [x] `core/types` — `StepMatch` 타입 변경: `reason?: string` → `constraint_results: ConstraintResult[]`로 대체. `ConstraintResult = { constraint: StepConstraint; passed: boolean; actual?: unknown }`
- [x] `engine` — `evaluateConstraints()` 반환 타입을 `ConstraintResult[]`로 변경 (boolean AND 결과 대신 상세 배열)
- [x] `engine` — `graph-matcher` 업데이트: evaluateConstraints 결과를 StepMatch.constraint_results에 수집
- [x] `engine` — `computeVerdict()` 업데이트: step_matches 배열에서 overall_verdict 계산, summary 생성
- [x] 모든 engine 테스트 업데이트: constraint-evaluator (26개), graph-matcher (12개), verdict compute (11개), pipeline integration (18개)
- [x] `pnpm --filter @qa-sdk/core run typecheck` 통과
- [x] `pnpm --filter @qa-sdk/engine run test` 전체 통과

### US-006: Verdict 리팩토링 — store + ingest-server

**Description:** As a developer, I want store adapters and API routes to use the new VerdictReport structure.

**Acceptance Criteria:**
- [x] `store` — verdict memory adapter 업데이트: 새 VerdictReport 구조 저장/조회
- [x] `store` — verdict drizzle adapter 업데이트 (verdict_reports 테이블의 JSONB 구조)
- [x] `ingest-server` — verdict 라우트 응답 형식이 새 VerdictReport 구조 반영
- [x] `ingest-server` — verdict recompute 라우트가 새 구조로 동작
- [x] `pnpm --filter @qa-sdk/store run test` 통과
- [x] `pnpm --filter @qa-sdk/ingest-server run test` 통과

### US-007: Graph 리팩토링 — core 타입 + engine 전체

**Description:** As a developer, I want graph types to match spec so that edge semantics (source/target, causal) are consistent.

**Acceptance Criteria:**
- [x] `core/types` — RuntimeEdge: `from/to` → `source/target` 변경
- [x] `core/types` — SpecEdge: `from/to` → `source/target` 변경
- [x] `core/types` — EdgeType: `derived` → `causal` 변경
- [x] `core/types` — SpecNode: `{ id, step: ScenarioStep }` → 경량 투영 `{ step_id, event_key, event_version?, source?, record_kind?, required, kind, constraints?, timeout_ms? }` 변경
- [x] `engine` — spec-compiler: 새 SpecNode 경량 구조 생성 (ScenarioStep에서 필요 필드만 투영)
- [x] `engine` — reconstruction: 새 edge 필드명(source/target) + causal edge 로직 사용
- [x] `engine` — graph-matcher: 새 edge/node 타입으로 매칭. SpecNode에서 직접 필드 접근 (`specNode.event_key` 등, `specNode.step.event_key` 대신)
- [x] `engine` — computeVerdict: `specNode.timeout_ms` 로 latency 체크 (기존 `specNode.step.timeout_ms` 대체)
- [x] 모든 engine 테스트 업데이트: spec-compiler (8개), reconstruction (10개), graph-matcher (12개), pipeline (18개)
- [x] `pnpm --filter @qa-sdk/core run typecheck` 통과
- [x] `pnpm --filter @qa-sdk/engine run test` 전체 통과

### US-008: Graph 리팩토링 — store + ingest-server

**Description:** As a developer, I want store adapters and API routes to use the new graph types.

**Acceptance Criteria:**
- [x] `store` — graph memory adapter: 새 RuntimeGraph 구조 저장/조회 (source/target edges)
- [x] `store` — graph drizzle adapter: JSONB 구조 업데이트
- [x] `ingest-server` — graph query 라우트(`/traces/:traceId/graph`) 응답 형식 업데이트
- [x] `ingest-server` — reconstruction 호출부 업데이트
- [x] drizzle-kit으로 새 마이그레이션 생성 (필요 시)
- [x] `pnpm --filter @qa-sdk/store run test` 통과
- [x] `pnpm --filter @qa-sdk/ingest-server run test` 통과

### US-009: GraphHint 타입 + 60개 이벤트 데이터 구현

**Description:** As a developer, I want core events to include graph_hint metadata so that engine can use role/goal/loop hints for smarter graph analysis.

**Acceptance Criteria:**
- [x] `event-catalog/src/types.ts` — `GraphRole` 타입 추가: `"entry" | "transition" | "terminal" | "observation"`
- [x] `event-catalog/src/types.ts` — `GraphHint` 인터페이스 추가: `{ role: GraphRole; goal_eligible: boolean; loopable: boolean }`
- [x] `event-catalog/src/types.ts` — `CoreEventDef`에 `graph_hint: GraphHint` 필드 추가
- [x] 8개 카테고리 파일 전체 — 60개 이벤트에 `graph-hint.spec.md` 매핑표 기준으로 graph_hint 값 추가
- [x] graph-hint.spec.md 상태를 `draft` → `implemented` 로 변경
- [x] `pnpm --filter @qa-sdk/event-catalog run typecheck` 통과

### US-010: event-catalog 테스트 스위트 작성

**Description:** As a developer, I want event-catalog to have a test suite so that data integrity is verified.

**Acceptance Criteria:**
- [x] vitest 설정 추가 (package.json scripts + vitest.config.ts)
- [x] 전체 60개 이벤트 등록 확인 (allCoreEvents.length === 60)
- [x] 카테고리별 이벤트 수 검증 (navigation 7, interaction 10, form 5, session 6, network 8, execution 9, outcome 7, quality 8)
- [x] v1 minimal set 20개 검증 (v1MinimalSet.length === 20, 각 키 존재 확인)
- [x] coreEventMap에서 키로 조회 가능 확인
- [x] isCoreEvent / isV1MinimalEvent 함수 동작 검증
- [x] payload guide 20개 존재 확인 + required 필드가 실제로 required: true인지 검증
- [x] graph_hint 검증: 모든 60개 이벤트에 graph_hint 존재, role이 유효값, goal_eligible true인 이벤트가 정확히 4개 (success, complete, conversion, form_submit_success)
- [x] `pnpm --filter @qa-sdk/event-catalog run test` 전체 통과

### US-011: pino 테스트 스위트 작성

**Description:** As a developer, I want the pino logger to have tests so that logging behavior is verified.

**Acceptance Criteria:**
- [x] vitest 설정 추가 (package.json scripts + vitest.config.ts)
- [x] 레벨 필터링 테스트: info 레벨에서 debug 로그가 출력되지 않음
- [x] 구조화 출력 테스트: JSON 형식으로 출력, `level`, `time`, `msg` 필드 포함
- [x] child logger 테스트: 부모 bindings 상속 + 자체 bindings 병합
- [x] error 직렬화 테스트: Error 객체가 `type`, `message`, `stack` 필드로 직렬화
- [x] silent 레벨 테스트: 아무것도 출력하지 않음
- [x] `pnpm --filter @qa-sdk/pino run test` 전체 통과

## Functional Requirements

- FR-1: 모든 스펙 문서는 현재 구현의 정확한 반영이어야 한다 (aspirational 금지)
- FR-2: 모든 타입 정의는 snake_case를 사용한다
- FR-3: VerdictReport는 step_matches 배열로 개별 step의 constraint 결과를 추적한다
- FR-4: Graph edge는 source/target 필드명과 causal edge 타입을 사용한다
- FR-5: SpecNode는 ScenarioStep 참조 대신 경량 투영을 사용하되 매칭/판정 필드(timeout_ms 포함)는 유지한다
- FR-6: evaluateConstraints()는 constraint별 상세 결과를 반환한다
- FR-7: 모든 CoreEventDef는 graph_hint 메타데이터를 포함한다
- FR-8: event-catalog와 pino 패키지는 vitest 테스트 스위트를 가진다
- FR-9: event_records에 service_name이 없는 것은 의도된 경량화이며, service 식별은 세션/trace 단위에서 관리한다

## Non-Goals

- 새 비즈니스 기능 추가 (이건 정합성 + 기술 부채 해소)
- Drizzle integration 테스트 활성화 (DB 의존 테스트는 별도)
- registry-server에 graph_hint 필드 seed 로직 추가 (별도 스토리)
- engine에서 graph_hint를 활용하는 로직 구현 (별도 스토리)
- service_ref 통합 및 RuntimeNode.service_name 주입 (별도 스토리 — 세션 단위 서비스 식별 체계 확립 후)
- 새 패키지나 서비스 추가

## Technical Considerations

- US-005 (verdict 리팩토링)는 core 타입 변경 + engine 4개 모듈 + 67개 테스트 수정을 포함하는 가장 큰 스토리. core + engine 패키지만 건드리므로 store/ingest-server는 영향 없음
- US-007 (graph 리팩토링)도 유사한 규모. SpecNode 경량화가 spec-compiler + graph-matcher + computeVerdict에 영향
- US-005 → US-006, US-007 → US-008 의존 관계가 있으므로 순서 준수 필수
- verdict_reports.report, runtime_graphs.graph 컬럼은 JSONB이므로 스키마 마이그레이션 없이 구조 변경 가능 (프리프로덕션)
- RuntimeNode.service_name 필드는 타입에 optional로 유지하되, 현재 populate 되지 않음을 스펙에 명시. service_ref 통합 시 trace-level에서 주입 예정

## Success Metrics

- 모든 스펙 파일이 "implemented" 상태이고 구현과 1:1 대응
- 전체 테스트 스위트 통과 (현재 failing 3개 수정 + 신규 테스트 추가)
- event-catalog, pino 패키지에 테스트 커버리지 추가
- 60개 core event 모두 graph_hint 메타데이터 보유
[/PRD]
