[PRD]
# PRD: Decision Flow P4 — 학습·비교·DKG 통합

> **상태: ✅ 완료** — 21/21 US 구현 + 4/4 Quality Gate 통과 (2026-03-24 검증)

## Quality Gate 검증 결과 (2026-03-24)

| QG | 명령 | 결과 |
|----|------|------|
| QG-1 | `pnpm --filter decision-flow typecheck` | ✅ pass |
| QG-2 | `pnpm --filter decision-flow test` | ✅ 107 tests passed (5 files) |
| QG-3 | `pnpm --filter @qa-sdk/cli build` | ✅ ESM + DTS build success |
| QG-4 | `pnpm --filter demo-tests test` | ✅ 846 tests passed (52 files) |

## Overview

decision-flow 시스템의 네 가지 후속 과제를 의존성 순서로 통합한 에픽.

**의존성 그래프:**
```
Phase 1 ─ 기반 인프라
  US-001 InstanceStore          (Policy Learning + A/B 비교 공통 저장소)
  US-002 FlowSchemaNode 타입    (DKG 그래프 확장의 기초)
  US-003 DKG 엣지 확장          (← US-002)

Phase 2 ─ DKG 그래프 통합
  US-004 bootstrapDkg 자동 생성  (← US-002, US-003)
  US-005 GraphRegistry 질의 API  (← US-004)

Phase 3 ─ 패턴 분석
  US-006 PatternDetector         (← US-001)
  US-007 PolicyCandidate 생성    (← US-006)
  US-008 인간 승인 워크플로우     (← US-007)

Phase 4 ─ 경로 비교
  US-009 인스턴스 쌍 비교        (← US-001)
  US-010 Gate 분포 분석          (← US-001)
  US-011 시간 범위 비교          (← US-001)
  US-012 비교 보고서 생성        (← US-009, US-010, US-011)

Phase 5 ─ dkg decide ↔ flow 브릿지
  US-013 dkg decide → flow 브릿지  (← US-002, US-005)
  US-014 양방향 참조              (← US-013)
  US-015 코어 gate 영향 경고      (← US-013)
  US-016 Evidence 자동 수집       (← US-013)
  US-017 address_context 자동 생성 (← US-013)

Phase 6 ─ CLI + E2E
  US-018 flow policy CLI          (← US-008)
  US-019 flow compare CLI         (← US-012)
  US-020 dkg flow-schemas CLI     (← US-005)
  US-021 통합 E2E 테스트          (← US-013~017)
```

## Goals

- FlowInstance 이력 기반 반복 패턴 감지 → FlowPolicy 후보 자동 생성 → 인간 승인
- 인스턴스 쌍 비교, gate 분포, 시간 범위 비교로 결정 편향 분석
- DKG 노드 16종째(FlowSchemaNode) — bootstrapDkg 자동 생성 + 인과 엣지
- `dkg decide` ↔ `flow` 브릿지로 설계 결정에 인과 추적·코어 경고 자동 적용

## Quality Gates

모든 user story에 대해 다음 명령이 통과해야 한다:
- `pnpm --filter decision-flow typecheck` — 타입 체크
- `pnpm --filter decision-flow test` — 단위 테스트
- `pnpm --filter @qa-sdk/cli build` — CLI 빌드
- `pnpm --filter demo-tests test` — 통합 테스트

---

## Phase 1: 기반 인프라

### US-001: 결정 이력 저장소 (InstanceStore)

**Description:** 개발자로서, FlowInstance 실행 이력을 저장하고 조회할 수 있어야 한다. Policy Learning과 A/B 비교의 공통 기반.

**Acceptance Criteria:**
- [x] `InstanceStore` 인터페이스 정의 (save, findBySchema, findByContext, findByTimeRange)
- [x] 인메모리 구현 (`MemoryInstanceStore`)
- [x] FlowEngine에 `instanceStore` 옵션 추가 — 완료된 인스턴스 자동 저장
- [x] 스키마 ID + 컨텍스트 키 기반 조회 지원
- [x] 시간 범위 기반 조회 지원 (startedAt 기준)

### US-002: FlowSchemaNode 타입 정의

**Description:** 개발자로서, DKG 그래프에 FlowSchema를 노드로 등록할 수 있어야 한다.

**Acceptance Criteria:**
- [x] `FlowSchemaNode` 인터페이스를 `spec-core/src/dkg/dkg.types.ts`에 정의
- [x] `kind: "flow-schema"` 필드
- [x] `gates: readonly { id, name, phase, weight }[]` — gate 요약
- [x] `totalPaths: number` — 전체 경로 수
- [x] `coreGateIds: readonly string[]` — 코어 gate 목록
- [x] DkgNode 유니온 타입에 FlowSchemaNode 추가 (15종 → 16종)

### US-003: DKG 엣지 타입 확장

**Description:** 시스템으로서, FlowSchemaNode와 기존 노드 간 관계를 엣지로 표현한다.

**Depends on:** US-002

**Acceptance Criteria:**
- [x] FlowSchemaNode → AxisNode: `composes` 엣지 (사용하는 관찰 축)
- [x] FlowSchemaNode → PrefixNode: `observes` 엣지 (관찰하는 prefix)
- [x] FlowSchemaNode → DomainNode: `contains` 엣지 (소속 도메인)
- [x] FlowSchemaNode → FlowSchemaNode: `references` 엣지 (subFlow 참조)
- [x] 기존 엣지 타입으로 충분한지 확인 — 새 엣지 타입 추가 최소화

---

## Phase 2: DKG 그래프 통합

### US-004: bootstrapDkg에서 FlowSchema 자동 생성

**Description:** 시스템으로서, bootstrapDkg 호출 시 DkgConfig의 flowSchemas에서 FlowSchemaNode를 자동 생성한다.

**Depends on:** US-002, US-003

**Acceptance Criteria:**
- [x] `DEMO_DKG_CONFIG`에 `flowSchemas` 필드 추가 (FlowSchema[] 또는 참조)
- [x] `bootstrapDkg({ catalog, config })` 시 flowSchemas → FlowSchemaNode 변환
- [x] 각 FlowSchemaNode의 coreGateIds를 analyzeGateStructure()로 자동 산출
- [x] 관련 엣지 (composes, observes, contains) 자동 생성
- [x] subFlow 참조가 있으면 references 엣지 자동 생성

### US-005: GraphRegistry 질의 API 확장

**Description:** 개발자로서, 기존 DKG 질의 API로 FlowSchemaNode를 조회할 수 있어야 한다.

**Depends on:** US-004

**Acceptance Criteria:**
- [x] `graph.getNodesByKind("flow-schema")` → FlowSchemaNode[] 반환
- [x] `graph.neighbors(flowSchemaId, "composes")` → 사용하는 AxisNode
- [x] `graph.neighbors(flowSchemaId, "observes")` → 관찰하는 PrefixNode
- [x] `graph.cascadeFromFlowSchema(flowSchemaId)` — 영향받는 prefix/axis 목록

---

## Phase 3: 패턴 분석 (Policy Learning)

### US-006: 패턴 감지기 (PatternDetector)

**Description:** 시스템으로서, 저장된 이력에서 반복 결정 패턴을 감지한다.

**Depends on:** US-001

**Acceptance Criteria:**
- [x] `detectPatterns(store, schemaId, options)` 함수 구현
- [x] 동일 컨텍스트 키 → 동일 gate 선택 경로가 N회(기본 5) 이상 반복되면 패턴으로 인식
- [x] 패턴별 빈도, 평균 confidence, 첫/마지막 발생 시각 산출
- [x] gate별 분기 분포 히스토그램 포함

### US-007: FlowPolicy 후보 자동 생성

**Description:** 시스템으로서, 감지된 패턴에서 FlowPolicy 후보를 자동 생성한다.

**Depends on:** US-006

**Acceptance Criteria:**
- [x] `generatePolicyCandidates(patterns, threshold)` 함수 구현
- [x] 임계값: 빈도 ≥ N회 AND 평균 confidence ≥ 0.8
- [x] 생성된 후보에 `status: "candidate"` 필드
- [x] 후보의 `rationale`에 근거 자동 기술 ("N회 반복, 평균 confidence X.XX")
- [x] conditions는 컨텍스트 키에서 자동 추출
- [x] 기존 등록 정책과 중복 검사

### US-008: 인간 승인 워크플로우

**Description:** 개발자로서, 정책 후보를 검토하고 승인/거부/수정할 수 있어야 한다.

**Depends on:** US-007

**Acceptance Criteria:**
- [x] `PolicyCandidate` 타입에 `status: "candidate" | "approved" | "rejected" | "modified"` 필드
- [x] `approveCandidate(id)` → FlowPolicy로 변환 + 엔진 등록
- [x] `rejectCandidate(id, reason)` → 동일 패턴 재제안 억제
- [x] `modifyCandidate(id, changes)` → 조건/분기 수정 후 승인

---

## Phase 4: 경로 비교 (A/B Comparison)

### US-009: 인스턴스 쌍 비교 (Pairwise Diff)

**Description:** 개발자로서, 동일 스키마의 두 인스턴스를 비교하여 어디서 경로가 갈렸는지 알고 싶다.

**Depends on:** US-001

**Acceptance Criteria:**
- [x] `diffInstances(a, b)` 함수 구현
- [x] gate별 일치/불일치 표시 (match/diverge)
- [x] 첫 번째 분기점(divergence point) 식별
- [x] 코어 gate의 분기 차이 강조 (GateWeight 활용)
- [x] 각 분기점에서의 evidence 차이 비교

### US-010: Gate별 선택 분포 (Distribution Analysis)

**Description:** 개발자로서, 특정 gate에서 각 branch가 얼마나 선택되었는지 분포를 보고 싶다.

**Depends on:** US-001

**Acceptance Criteria:**
- [x] `gateDistribution(store, schemaId, gateId)` 함수 구현
- [x] branch별 선택 횟수, 비율, 평균 confidence
- [x] 지배적 branch(>70%) 식별 — Policy Learning 후보 힌트
- [x] evidence_kind별 선택 상관 분석 (어떤 근거가 어떤 선택과 연관되는가)

### US-011: 시간 범위 비교 (Temporal Comparison)

**Description:** 개발자로서, 기간 A와 기간 B의 결정 패턴 변화를 비교하고 싶다.

**Depends on:** US-001

**Acceptance Criteria:**
- [x] `compareTimeRanges(store, schemaId, rangeA, rangeB)` 함수 구현
- [x] gate별 분포 변화율 (shift percentage)
- [x] 새로 등장한 경로 / 사라진 경로 감지
- [x] 코어 gate의 변화만 필터링하는 옵션

### US-012: 비교 보고서 생성

**Description:** 개발자로서, 비교 분석 결과를 구조화된 보고서로 받고 싶다.

**Depends on:** US-009, US-010, US-011

**Acceptance Criteria:**
- [x] `ComparisonReport` 타입 정의 (pairwise diff, distributions, temporal shifts)
- [x] 보고서에 "왜 다른가" 추론 포함 (evidence 차이 기반)
- [x] JSON 직렬화 가능

---

## Phase 5: dkg decide ↔ flow 브릿지

### US-013: dkg decide → flow 자동 실행 브릿지

**Description:** 개발자로서, `dkg decide`를 실행하면 coordinate-design 플로우가 내부적으로 시작되어 각 단계를 안내받고 싶다.

**Depends on:** US-002, US-005

**Acceptance Criteria:**
- [x] `dkg decide` 실행 시 FlowEngine에 coordinate-design 플로우 자동 시작
- [x] 기존 `--type` 옵션이 플로우의 첫 gate 선택으로 매핑
  - `--type capacity` → axis-definition: reuse-existing, capacity-setting으로 점프
  - `--type new-axis` → axis-definition: new-axis
  - `--type new-prefix` → axis-definition: reuse-existing, prefix-design: new-prefix
  - `--type merge` → merge-split: merge
  - `--type deprecate` → merge-split: keep-separate (+ 별도 처리)
- [x] 매핑되지 않는 타입은 플로우의 순차 실행으로 안내
- [x] `--legacy` 옵션으로 기존 방식(플로우 없이 직접 DecisionNode 생성) 유지

### US-014: DecisionNode ↔ FlowInstance 양방향 참조

**Description:** 시스템으로서, 생성된 DecisionNode와 FlowInstance가 서로를 참조한다.

**Depends on:** US-013

**Acceptance Criteria:**
- [x] DecisionNode에 `flowInstanceId?: string` 필드 추가 (기존 DecisionNode 하위 호환)
- [x] FlowInstance.context에 `dkgDecisionId` 자동 기록
- [x] DKG 그래프에 `justifies` 엣지 생성: FlowSchemaNode → DecisionNode
- [x] `qa-sdk dkg trace <decision-id>` 실행 시 연결된 FlowInstance의 코어 추적 표시

### US-015: 코어 gate 영향 경고 통합

**Description:** 개발자로서, axis-definition이나 merge-split 같은 코어 결정을 할 때 영향 범위 경고를 자동으로 받고 싶다.

**Depends on:** US-013

**Acceptance Criteria:**
- [x] 코어 gate(weight="core") 선택 시 analyzeImpact() 자동 실행
- [x] 영향받는 gate 목록과 무효화 cascade를 dkg decide 출력에 포함
- [x] `invalidatesCore: true`이면 `⚠ 코어 gate 무효화 — 전체 재설계 필요` 경고
- [x] 경고 후 계속 진행 여부 확인 (--force로 경고 무시 가능)

### US-016: Evidence 자동 수집

**Description:** 시스템으로서, dkg decide의 기존 입력을 FlowInstance의 Evidence로 자동 변환한다.

**Depends on:** US-013

**Acceptance Criteria:**
- [x] `--rationale` → Evidence { kind: "rule", source: "dkg-decide", content: rationale }
- [x] `--alternatives` → 사용하지 않은 branch의 description으로 기록
- [x] scaffoldDecision()의 자동 생성 필드도 Evidence로 캡처
- [x] confidence는 사용자 명시 또는 evidence weight에서 자동 산출

### US-017: address_context 자동 생성

**Description:** 시스템으로서, dkg decide 완료 시 decision prefix address_context를 자동 생성하여 DKG 이벤트에 첨부한다.

**Depends on:** US-013

**Acceptance Criteria:**
- [x] FlowInstance 완료 시 buildFlowCompletionContext() 자동 호출
- [x] 생성된 address_context를 DKG VersionEvent/DecisionNode의 메타데이터에 저장
- [x] convergence pipeline이 decision prefix 사용량을 집계할 수 있는 형태로 저장

---

## Phase 6: CLI + E2E 테스트

### US-018: flow policy CLI

**Description:** 개발자로서, CLI에서 정책 후보를 관리할 수 있어야 한다.

**Depends on:** US-008

**Acceptance Criteria:**
- [x] `qa-sdk flow policy candidates` — 후보 목록 (빈도, confidence 표시)
- [x] `qa-sdk flow policy approve <id>` — 승인 + 등록
- [x] `qa-sdk flow policy reject <id>` — 거부
- [x] `qa-sdk flow policy list` — 등록된 정책 목록
- [x] `qa-sdk flow policy learn <schema-id>` — 패턴 감지 + 후보 생성 실행

### US-019: flow compare CLI

**Description:** 개발자로서, CLI에서 비교 분석을 실행할 수 있어야 한다.

**Depends on:** US-012

**Acceptance Criteria:**
- [x] `qa-sdk flow compare <instance-a> <instance-b>` — 쌍 비교
- [x] `qa-sdk flow compare --gate <gate-id> --schema <schema-id>` — gate 분포
- [x] `qa-sdk flow compare --from <date> --to <date> --schema <schema-id>` — 시간 비교
- [x] 코어 gate 차이에 ★ 표시

### US-020: dkg flow-schemas CLI

**Description:** 개발자로서, DKG에 등록된 FlowSchema를 CLI로 조회할 수 있어야 한다.

**Depends on:** US-005

**Acceptance Criteria:**
- [x] `qa-sdk dkg flow-schemas` — 등록된 FlowSchemaNode 목록
- [x] `qa-sdk dkg flow-schema <id>` — 개별 프로파일 (gates, core gates, 관련 prefix/axis)
- [x] `qa-sdk dkg diagram flow-schema <id>` — Mermaid 다이어그램 (gate 인과 그래프)

### US-021: 통합 E2E 테스트

**Description:** 개발자로서, 전체 파이프라인(dkg decide → flow → DecisionNode → 영향 경고)이 검증되어야 한다.

**Depends on:** US-013, US-014, US-015, US-016, US-017

**Acceptance Criteria:**
- [x] E2E: `dkg decide --type new-axis` → FlowInstance 완료 + DecisionNode 생성
- [x] E2E: `dkg decide --type merge` → 코어 gate 경고 출력 확인
- [x] E2E: `dkg trace <id>` → FlowInstance 코어 추적 표시 확인
- [x] 하위 호환: `dkg decide --legacy` → 기존 동작과 동일

---

## Functional Requirements

- FR-1: InstanceStore, PatternDetector, 비교 함수는 모두 순수 함수 (store 읽기만)
- FR-2: 정책 후보 생성은 기존 등록 정책과 중복 검사
- FR-3: 거부된 패턴은 동일 조건으로 재제안하지 않음
- FR-4: FlowSchemaNode는 bootstrapDkg에서 자동 생성이 기본, CLI로도 수동 추가 가능
- FR-5: coreGateIds는 analyzeGateStructure() + identifyCoreGates()에서 파생
- FR-6: 기존 DKG 노드(15종)의 동작을 변경하지 않음
- FR-7: dkg decide의 기존 인터페이스를 변경하지 않음 (추가 옵션만)
- FR-8: FlowEngine은 dkg 명령 내에서 인메모리 실행 (별도 서버 불필요)
- FR-9: spec-core에서 decision-flow는 optional peer dependency (동적 import)
- FR-10: 인스턴스 쌍 비교 시 스키마 버전 불일치는 경고 + 공통 gate만 비교
- FR-11: 시간 범위 비교는 각 범위에 최소 2건 이상 인스턴스 필요
- FR-12: 분포 분석에서 표본 크기 < 5이면 "불충분" 표시

## Non-Goals

- 실시간 스트리밍 학습 / 강화학습 / 외부 ML 모델
- 통계적 유의성 검정 (t-test 등)
- FlowInstance, FlowPolicy를 DKG 노드로 등록
- dkg observe/resolve/link를 flow로 전환
- 실시간 비교 대시보드
- DKG UI에서 FlowSchema 편집

## Technical Considerations

| 모듈 | 패키지 | 위치 |
|------|--------|------|
| InstanceStore | decision-flow | `src/instance-store.ts` |
| PatternDetector | decision-flow | `src/policy-learning.ts` |
| PolicyCandidate | decision-flow | `src/policy-learning.ts` |
| Comparison | decision-flow | `src/comparison.ts` |
| FlowSchemaNode | spec-core | `src/dkg/dkg.types.ts` |
| bootstrap 확장 | spec-core | `src/dkg/bootstrap.ts` |
| GraphRegistry 확장 | spec-core | `src/dkg/graph-registry.ts` |
| dkg decide 브릿지 | cli | `src/commands/dkg.ts` |
| flow policy/compare CLI | cli | `src/commands/flow.ts` |
| dkg flow-schemas CLI | cli | `src/commands/dkg.ts` |
| DkgConfig 확장 | demo-snapshot | `src/demo-dkg-config.ts` |

## Success Metrics

- 반복 패턴 5회 이상 경로에서 후보가 정확히 생성됨
- 승인된 정책이 engine.autoSelect()에서 정상 작동
- divergence point 식별이 정확함
- bootstrapDkg 후 FlowSchemaNode가 생성됨 + 기존 15종 테스트 미파괴
- `dkg decide` 실행 시 FlowInstance 자동 생성 + 코어 경고 정확 출력
- `--legacy` 모드 100% 하위 호환

## Open Questions

- 컨텍스트 키 매칭 시 부분 일치를 허용할 것인가?
- 정책 후보의 유효기간(TTL)이 필요한가?
- CLI 분포 시각화를 ASCII 히스토그램으로 표현할 것인가?
- 비교 결과를 DKG observation으로 자동 기록할 것인가?
- FlowSchemaNode의 version 관리는 FlowSchema.version 그대로?
- dkg decide가 대화형일 때 flow gate를 하나씩 물어볼 것인가?
- dkg claim/release도 flow로 래핑할 가치가 있는가?
[/PRD]
