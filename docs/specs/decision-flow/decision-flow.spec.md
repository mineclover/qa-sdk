# Decision Flow — 의사결정 분기 관리

> 의사결정 과정을 좌표 공간으로 모델링하여 관찰 가능하게 만든다.

관련 스펙: [coordinate-query.spec.md](../indexing/coordinate-query.spec.md)
구현: `packages/decision-flow/src/`
레퍼런스: [garrytan/gstack](https://github.com/garrytan/gstack) — 스프린트 파이프라인, 인지 프레임워크

## 상태

implemented (v0.1.0) — 코어 타입 + 엔진 + 관찰 레이어 + 계층/바운더리

---

## 설계 원칙

| 원칙 | 설명 |
|------|------|
| **좌표 동형** | 의사결정 구조 ≡ 좌표 구조. Gate=Axis, Branch=Entry, Path=Address |
| **코어 식별** | 모든 gate가 동등하지 않다. `GateWeight`로 구조적 영향도를 명시 |
| **인과 추적** | 좌표는 스냅샷, 인과는 그래프. `GateDependency`로 "왜 이 결정이 저 결정을 바꾸는가" 기록 |
| **계층 하향** | 전략 결정은 전술을 제약한다. 역방향은 에스컬레이션 |
| **경계 명시** | 컨텍스트 바운더리 횡단은 import/export 프로토콜로만 |

---

## 용어

| 한국어 | 영문 | 정의 |
|--------|------|------|
| 분기점 | Gate | 하나의 의사결정 지점. Catalog의 Axis에 대응 |
| 선택지 | Branch | 분기점에서의 선택 옵션. Axis Entry에 대응 |
| 결정 경로 | Path | 분기점 선택의 전체 시퀀스. 1D Address로 인코딩 |
| 근거 | Evidence | 선택의 이유. kind(data/rule/precedent/intuition/external) + weight |
| 코어 게이트 | Core Gate | weight="core". 변경 시 전체 재실행이 필요한 구조적 분기점 |
| 인지 단계 | Cognitive Phase | perceive→interpret→evaluate→decide→plan→execute→reflect |
| 인지 모델 | Mental Model | 의사결정에 적용하는 사고 도구 (Bezos Doors, Munger Inversion 등) |
| 에스컬레이션 | Escalation | 자동 판정 불가 → 인간 결정 요청. 또는 하위→상위 계층 변경 요청 |
| 컨텍스트 | Context | 관련 결정들의 경계 (DDD Bounded Context) |

---

## 좌표 매핑

```
FlowSchema          ≡  PrefixDef      (N차원 주소 공간)
GateSchema           ≡  DimRef/Axis    (차원)
BranchSchema         ≡  Entry          (차원 내 값)
GateSchema.subFlowId ≡  prefix_ref     (다른 prefix 참조)
FlowInstance.coordinateAddress ≡ 1D Address (정수)
```

### 인코딩 예시

```
FlowSchema: "ceo-review"
  Gate 0: premise      → [right-problem, reframe, defer]    capacity: 3
  Gate 1: code-leverage → [extend, refactor, rebuild]        capacity: 3
  Gate 2: alternatives  → [minimal, ideal, pragmatic]        capacity: 3
  Gate 3: scope-mode    → [expansion, selective, hold, reduction]  capacity: 4
  Gate 4: risk          → [low, medium, high, critical]      capacity: 4
  Gate 5: timeline      → [within-sprint, multi-sprint, epic]  capacity: 3

Shape: [3, 3, 3, 4, 4, 3] → 1,296 경로
선택: premise=right-problem, code-leverage=extend, alternatives=ideal,
      scope-mode=expansion, risk=medium, timeline=multi-sprint
→ encode → 1D 정수 주소
→ "ceo-review:v1:{address}"
```

---

## Prefix 정의 (관찰 좌표)

의사결정의 관찰 가능한 이벤트 5종.

### decision_event — 분기 선택 이벤트

```
"어떤 플로우의 어떤 인지 단계에서, 어떤 근거로, 얼마나 확신하여 선택했는가"

dims: flow_type(16) × cognitive_phase(16) × evidence_kind(16) × confidence_band(8)
totalSpace: 32,768
meta: { category: "event", layer: 1 }
```

가장 기본적인 관찰 단위. 모든 `engine.selectBranch()` 호출이 이 좌표를 생성.

### decision_path — 완료된 의사결정 경로

```
"어떤 유형의 플로우가 어떤 스코프 모드에서 어떤 결과로 끝났는가"

dims: flow_type(16) × decision_outcome(16) × scope_mode(8)
totalSpace: 2,048
meta: { category: "observation", layer: 1 }
```

FlowInstance 완료 시 1건. 전체 결정 경로의 요약.

### escalation_event — 에스컬레이션 이벤트

```
"자동 판정이 왜 실패하여 어떤 인지 단계에서 인간에게 물어야 했는가"

dims: flow_type(16) × escalation_type(16) × cognitive_phase(16)
totalSpace: 4,096
meta: { category: "event", layer: 2 }
```

자동→수동 전환 지점. 패턴 분석으로 자동화 가능 영역 식별.

### model_apply — 인지 모델 적용 이벤트

```
"어떤 인지 모델로, 가역성과 영향을 어떻게 분류했는가"

dims: mental_model(32) × reversibility(4) × magnitude(8)
totalSpace: 1,024
meta: { category: "observation", layer: 1 }
```

어떤 사고 도구가 실제로 사용되었는지 추적. 모델 효과성 분석.

### forcing_response — Forcing Question 응답

```
"어떤 강제 질문에, 어떤 근거로, 어떤 확신으로 답했는가"

dims: forcing_question(16) × evidence_kind(16) × confidence_band(8)
totalSpace: 2,048
meta: { category: "event", layer: 1 }
```

Office Hours 6 Forcing Questions에 대한 응답 기록.

### 총 좌표 공간

| prefix | totalSpace | 관찰 빈도 |
|--------|-----------|----------|
| decision_event | 32,768 | 높음 (gate 선택마다) |
| decision_path | 2,048 | 보통 (플로우 완료마다) |
| escalation_event | 4,096 | 낮음 (자동 실패 시만) |
| model_apply | 1,024 | 보통 (모델 적용 시) |
| forcing_response | 2,048 | 낮음 (office-hours 시만) |
| **합계** | **41,984** | |

---

## 축 (Vocabulary)

11개 축. 5Q Checklist 통과.

| 축 | entries | capacity | headroom | 공유 prefix |
|---|---|---|---|---|
| cognitive_phase | 7 | 16 | 9 | decision_event, escalation_event |
| flow_type | 8 | 16 | 8 | decision_event, decision_path, escalation_event |
| evidence_kind | 5 | 16 | 11 | decision_event, forcing_response |
| mental_model | 13 | 32 | 19 | model_apply |
| escalation_type | 6 | 16 | 10 | escalation_event |
| decision_outcome | 5 | 16 | 11 | decision_path |
| scope_mode | 4 | 8 | 4 | decision_path |
| reversibility | 2 | 4 | 2 | model_apply |
| magnitude | 4 | 8 | 4 | model_apply |
| confidence_band | 4 | 8 | 4 | decision_event, forcing_response |
| forcing_question | 6 | 16 | 10 | forcing_response |

---

## 계층 (Decision Layers)

```
Level 0: strategic   ← "무엇을 만들 것인가"
  office-hours, ceo-review

Level 1: tactical    ← "어떻게 만들 것인가"
  eng-review, design-review, coordinate-design

Level 2: operational ← "올바르게 만들고 있는가"
  code-review, investigation

Level 3: execution   ← "출시한다"
  ship
```

### 계층 규칙

| 규칙 | 허용 | 위반 시 |
|------|------|--------|
| 하향 제약 | strategic → tactical constrains | — |
| 상향 변경 | — | `upward-mutation` 위반 → 에스컬레이션 필요 |
| 계층 건너뛰기 | — | `skip-layer` 위반 → 중간 계층 경유 필요 |
| 스코프 상속 | 상위 결정 → 하위 context 자동 주입 | — |

---

## 컨텍스트 바운더리

qa-sdk의 4개 의사결정 컨텍스트.

```
coordinate-design (루트)
  exports: axis_decision, prefix_decision, capacity_decision
  imports: (없음)
     │
     ├──▶ sprint-execution
     │      exports: scope_mode
     │      imports: coordinate_structure ← coordinate-design
     │      owns: office-hours, ceo/eng/design-review, code-review, ship
     │
     ├──▶ dkg-governance
     │      imports: axis_structure ← coordinate-design
     │      owns: (DKG 전용 플로우 후속 정의)
     │
     └──▶ platform-runtime
            exports: incident_finding
            imports: encoding_constraint ← coordinate-design
            owns: investigation
```

### 경계 프로토콜

- **export**: 다른 컨텍스트가 읽을 수 있는 결정. `kind: "value"` (선택값) 또는 `"constraint"` (제약)
- **import**: 외부 결정을 수신. `effect: "constrains" | "blocks" | "informs"`
- **경계 횡단**: import 없이 다른 컨텍스트의 결정을 참조하면 `boundary-crossing` 위반

---

## 코어 게이트 분석

`coordinate-design` 플로우의 구조적 프로파일 (coreScore 내림차순):

| gate | weight | directImpact | transitiveImpact | coreScore | 의미 |
|------|--------|-------------|-----------------|-----------|------|
| axis-definition | core | 3 | 5+ | 22+ | **모든 것의 근본**. 축 결정이 전 시스템 구조를 결정 |
| prefix-design | core | 3 | 3+ | 19+ | **인코딩 구조 결정**. 주소 공간 형태를 확정 |
| merge-split | core | 2 | 2+ | 16+ | **구조적 분기**. invalidates로 prefix/capacity 무효화 |
| capacity-setting | structural | 1 | 1 | 8 | 버전 전략에 영향. stride-break 위험 |
| version-strategy | structural | 0 | 0 | 5 | 호환성 결정. 하위 영향 없음 |
| service-binding | tactical | 0 | 0 | 1 | 국소적. 독립적으로 변경 가능 |

### 영향 분석: merge-split 변경 시

```
merge-split ──invalidates──▶ prefix-design (core!)
             ──invalidates──▶ capacity-setting (structural)
                                   └──▶ version-strategy (cascade)
```

**결론**: merge-split을 변경하면 코어 gate(prefix-design)가 무효화 → **전체 재설계 필요**.

---

## 인프라 목표

### P0: 현재 완료

| 목표 | 상태 | 구현 |
|------|------|------|
| 코어 타입 시스템 | ✅ | `types.ts` — FlowSchema, GateSchema, Evidence, GateWeight, GateDependency |
| 플로우 엔진 | ✅ | `engine.ts` — 스키마 등록, 인스턴스 실행, 좌표 인코딩 |
| 스키마 빌더 + 검증 | ✅ | `schema.ts` — FlowSchemaBuilder, validateFlowSchema |
| 좌표 매핑 | ✅ | `coordinate.ts` — WeightedIndex 연동, 라운드트립 검증 |
| 정책 엔진 | ✅ | `policy.ts` — 조건 평가, 자동 선택, 충돌 해소 |
| 관찰 좌표 (5 prefix) | ✅ | `vocabulary.ts` + `catalog.ts` + `observe.ts` |
| 인지 프레임워크 | ✅ | `mental-model.ts` — 13 모델, 에스컬레이션, 6 Forcing Questions |
| 스프린트 파이프라인 | ✅ | `sprint.ts` — 7 FlowSchema, 4 autoplan 정책 |
| 코어 분석 | ✅ | `core-analysis.ts` — 구조적 프로파일, 인과 그래프, 영향 분석 |
| 계층 + 바운더리 | ✅ | `boundary.ts` — 4 계층, 4 컨텍스트, 스코프 상속, 에스컬레이션 |
| 자기참조 검증 | ✅ | `self-analysis.ts` — qa-sdk 설계 결정 3건 기록 + 분석 |

### P1: DEMO_CATALOG 통합 — ✅ 완료

| 목표 | 상태 | 구현 |
|------|------|------|
| DEMO_CATALOG에 decision 도메인 추가 | ✅ | `demo-catalog.ts` — 11축 + 5 prefix 병합 |
| DKG decision 도메인 | ✅ | `demo-dkg-config.ts` — decision-domain (5 prefix, 11 sharedAxes) |
| codegen 연동 | 후속 | `qa-sdk codegen` 재실행 시 자동 생성 |
| DKG FlowSchemaNode | 후속 | spec-core DKG 타입 확장 (P3과 함께) |

### P2: 수집 파이프라인 연동 — 핵심 완료

| 목표 | 상태 | 구현 |
|------|------|------|
| ingest 연동 어댑터 | ✅ | `ingest-adapter.ts` — buildSelectionContext → address_context |
| address_context 형식 | ✅ | `{ decision_event: "decision_event:v1:1234" }` (SemanticAddress) |
| convergence 연동 | 후속 | decision prefix가 DEMO_CATALOG에 있으므로 기존 파이프라인 자동 수집 |
| 패턴 분류 확장 | 후속 | PatternRule 확장으로 결정 경로 분류 |
| GateEngine 연동 | 후속 | decision prefix에 gate 4-state 적용 |

### P3: 런타임 자동화 — 핵심 완료

| 목표 | 상태 | 구현 |
|------|------|------|
| CLI 통합 (`qa-sdk flow`) | ✅ | `cli/src/commands/flow.ts` — list, start, select, status, trace, analyze |
| 경고 시스템 | ✅ | `flow analyze --impact <gate>` — 코어 무효화 시 `⚠` 경고 |
| Policy Learning | 후속 | 반복 결정 패턴에서 자동 정책 생성 |
| A/B Path Comparison | 후속 | 동일 컨텍스트, 다른 경로 → 결과 비교 |
| DKG FlowSchemaNode | 후속 | DKG 노드 타입에 FlowSchemaNode 추가 |

---

## 패키지 구조

```
packages/decision-flow/       # unscoped, tsup dual format (ESM+CJS)
├── src/
│   ├── types.ts              # 핵심 타입 (FlowSchema, GateWeight, GateDependency)
│   ├── schema.ts             # FlowSchemaBuilder + 검증
│   ├── coordinate.ts         # FlowSchema ↔ WeightedIndex 좌표 매핑
│   ├── policy.ts             # 조건 평가, 자동 선택, 충돌 해소
│   ├── engine.ts             # FlowEngine (실행 엔진)
│   ├── mental-model.ts       # 13 인지 모델 + 에스컬레이션 + 6 Forcing Questions
│   ├── vocabulary.ts         # 11개 축 정의 (도메인 단어)
│   ├── catalog.ts            # 5개 prefix 정의 (관찰 좌표)
│   ├── observe.ts            # 관찰 레이어 (인코딩/디코딩/직렬화)
│   ├── core-analysis.ts      # 코어 분석 (구조적 프로파일, 인과, 영향)
│   ├── boundary.ts           # 계층 + 컨텍스트 바운더리
│   ├── ingest-adapter.ts     # ingest 파이프라인 연동 (address_context 빌더)
│   ├── sprint.ts             # gstack 스프린트 파이프라인 (7 flow, 4 policy)
│   ├── self-analysis.ts      # 자기참조 검증 (qa-sdk 설계 결정 기록)
│   └── index.ts              # barrel export
├── package.json              # weighted-index 의존
├── tsconfig.json
└── tsup.config.ts
```

의존 방향:

```
decision-flow
  └── weighted-index  (좌표 인코딩)
  └── @qa-sdk/core    (P1에서 optional peer로 추가 예정)
```

---

## CLI (`qa-sdk flow`)

기존 CLI 바이너리 안에 `flow` 서브커맨드 그룹으로 병합. `qa-sdk dkg decide`(설계 결정 기록)와 독립.

```bash
# 스키마 목록
qa-sdk flow list

# 구조적 분석 (코어 gate, 인과 그래프)
qa-sdk flow analyze coordinate-design
qa-sdk flow analyze coordinate-design --impact merge-split

# 플로우 실행
qa-sdk flow start coordinate-design
qa-sdk flow select new-axis --evidence '[{"kind":"rule","source":"5Q","content":"통과","weight":0.9}]'
qa-sdk flow status
qa-sdk flow trace <instance-id>
```

### 명령 요약

| 명령 | 설명 |
|------|------|
| `flow list` | 등록된 FlowSchema 목록 (9개: 7 sprint + coordinate-design + sprint-pipeline) |
| `flow start <id>` | 플로우 인스턴스 시작. `--context '{...}'`로 컨텍스트 전달 |
| `flow select <branch>` | 현재 gate에서 분기 선택. `--evidence`, `--confidence` 옵션 |
| `flow status [id]` | 인스턴스 상태 조회. ID 없으면 전체 목록 |
| `flow trace <id>` | 코어 결정 추적 — pivot points, 인과 체인, 배제된 대안 |
| `flow analyze <id>` | 구조적 분석 — coreScore, 인과 그래프, `--impact`로 영향 분석 |

### `dkg decide`와의 관계

- `qa-sdk dkg decide`: DKG DecisionNode 생성 (좌표계 설계 결정 기록, 기존)
- `qa-sdk flow`: 범용 의사결정 엔진 (스프린트, 인지 모델, 에스컬레이션)
- 통합 경로: `dkg decide` 실행 시 내부적으로 `coordinate-design` 플로우를 실행하여 인과 추적 가능 (후속)

---

## 직렬화 형식

기존 qa-sdk SemanticAddress와 동일:

```
"decision_event:v1:1234"
"decision_path:v1:42"
"model_apply:v1:7"
```

`parseAndDecodeAddress("decision_event:v1:1234")`로 역방향 해석:

```json
{
  "prefix": "decision_event",
  "version": "v1",
  "address": 1234,
  "decoded": {
    "flow_type": "ceo_review",
    "cognitive_phase": "evaluate",
    "evidence_kind": "data",
    "confidence_band": "high"
  }
}
```

---

## 테스트

87개 테스트, 5개 파일.

| 파일 | 테스트 수 | 검증 대상 |
|------|----------|----------|
| decision-flow.test.ts | 22 | 스키마 검증, 좌표 라운드트립, 엔진, 정책 |
| sprint.test.ts | 20 | gstack 파이프라인, 인지 모델, Forcing Questions |
| observe.test.ts | 15 | 5 prefix 인코딩/디코딩 라운드트립, 직렬화 |
| core-analysis.test.ts | 14 | 코어 식별, 인과 그래프, 영향 분석, 자기참조 |
| boundary.test.ts | 16 | 계층 제약, 컨텍스트 검증, 스코프 상속, 에스컬레이션 |
