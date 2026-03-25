---
def:
  id: decision-flow-spec
  scope: state
  aspect: domain_state
  depth: specification
  lifecycle: approved
  tags: [decision]
---
# Decision Flow — 의사결정 좌표계

## 목적 ^purpose

인간의 복잡한 결정 과정을 사전 설계된 직교 축으로 투영하여, "왜 이 결정을 했는가"를 좌표 주소로 증명하는 다차원 벡터 공간 모델.

관련 스펙: [coordinate-query.spec.md](../indexing/coordinate-query.spec.md)
서사 문서: [narrative.md](./narrative.md) — 질문 → 증명 → 결론이 쌓이는 문서
증명 코드: `packages/decision-flow/src/proof.test.ts`
구현: `packages/decision-flow/src/`
레퍼런스: [garrytan/gstack](https://github.com/garrytan/gstack) — 스프린트 파이프라인, 인지 프레임워크

## 상태

implemented (v0.1.0) — P0~P9 완료 (2026-03-25 전체 QG 통과, 188 tests / 12 files + CLI 141 tests)

---

## 1. 모델 정체성

### 왜 좌표계인가

의사결정에 관여하는 변수는 무한하다 — 맥락, 감정, 정보량, 시간 압박, 조직 역학.
이 중 **설명력이 높은 소수의 축**만 골라 공간을 구성하면, 결정의 "왜"를 **주소 하나**로 압축할 수 있다.

이것이 qa-sdk의 좌표 인코딩(Catalog → Prefix → 1D Address)과 동형인 이유:
데이터 이벤트의 "어디서"를 좌표로 표현하듯, 의사결정의 "왜"를 좌표로 표현한다.

### 네 가지 원리

| 원리 | 통계학 대응 | 이 시스템에서의 의미 |
|------|-----------|-------------------|
| **차원 축소** | PCA (주성분 분석) | 복잡한 결정 변수를 Layer·Phase·Evidence 등 **핵심 축으로 압축**. 각 축이 결정의 분산을 가장 잘 설명하는 주성분 |
| **직교성** | CCA 정준 변수 | 각 축은 서로 간섭하지 않는 **독립 차원**. cognitive_phase와 evidence_kind는 서로의 값을 예측하지 못한다 |
| **X↔Y 매핑** | CCA (정준상관분석) | 비즈니스 요구(X)와 기술 구현(Y)을 **의사결정 좌표**로 연결. "이 코드가 왜 이렇게 작성되었는가"를 좌표로 증명 |
| **사전 할당** | — (차별점) | 일반 CCA는 데이터에서 사후적으로 축을 발견. 이 시스템은 아키텍트가 도메인 지식으로 **축을 사전 설계하고 데이터를 그 틀에 맞춰 생성을 강제** |

### 서사 구조

개별 결정이 모여서 결정 공간의 한 점에 도달하고, 그 여정이 서사로 기록된다.

```
배경(context)   왜 이 결정이 필요했는가
  ↓
여정(journey)   각 gate에서 무엇을 선택하고 왜 그랬는가 (결정의 축적)
  ↓
도달(destination)  결정 공간에서의 최종 위치 (정수 주소로 압축)
  ↓
산출(outcome)   이 결정이 만들어낸 것
  ↓
회고(reflection)  이 서사에서 배운 것 (나중에 추가 가능)
```

서사는 지워지지 않는다. 결정이 바뀌면 새 서사가 쌓인다.
서사가 쌓이면 패턴이 되고, 패턴이 검증되면 정책이 되고, 정책이 자동화된다.

```
결정 → 서사 → 패턴 → 정책 → 자동화
              ↑                    │
              └────── 회고 ────────┘
```

### 좌표 동형

```
FlowSchema          ≡  PrefixDef      (N차원 주소 공간)
GateSchema           ≡  DimRef/Axis    (차원)
BranchSchema         ≡  Entry          (차원 내 값)
GateSchema.subFlowId ≡  prefix_ref     (다른 prefix 참조)
FlowInstance.coordinateAddress ≡ 1D Address (정수)
```

이벤트 좌표: **"어디서"** 발생했는가 → `tracking:v2:42`
의사결정 좌표: **"왜"** 그렇게 결정했는가 → `decision_event:v1:1234`

---

## 2. 축 설계 (Axis Design)

### 설계 프로토콜

축은 다음 두 단계를 통과해야 한다:

**단계 1: 자격 검증 (5Q Checklist)**
- Q1 유한한가? Q2 의사결정과 관련있는가? Q3 여러 prefix에서 공유되는가?
- Q4 안정적인가? Q5 capacity 관리가 가능한가?

**단계 2: 설명력 판단 (Explanatory Power)**
- 이 축이 결정의 "왜"를 얼마나 잘 구분하는가?
- 이 축 없이 같은 설명력을 낼 수 있는 다른 축이 있는가?
- 기존 축과 직교하는가 (값을 서로 예측할 수 없는가)?

### 축 카탈로그

11개 축. 설명력 역할(role) 기준으로 3층 분류.

#### Primary — 결정의 구조를 결정하는 축

| 축 | 역할 | entries | cap | 공유 prefix | 설명력 근거 |
|---|---|---|---|---|---|
| cognitive_phase | 결정이 **어떤 인지 과정**에서 발생했는가 | 7 | 16 | decision_event, escalation_event | 같은 결론이라도 perceive에서 한 것과 reflect에서 한 것은 품질이 다르다. 단계가 다르면 필요한 근거 유형이 달라진다 |
| flow_type | 결정이 **어떤 맥락의 플로우**에서 발생했는가 | 8 | 16 | decision_event, decision_path, escalation_event | 전략 리뷰(ceo_review)의 "위험 높음"과 코드 리뷰(code_review)의 "위험 높음"은 의미가 다르다 |
| evidence_kind | 결정의 **근거 유형**이 무엇인가 | 5 | 16 | decision_event, forcing_response | data 근거의 결정과 intuition 근거의 결정은 검증 방법이 다르다. 결정의 재현 가능성을 결정하는 핵심 축 |

#### Secondary — 결정의 성격을 한정하는 축

| 축 | 역할 | entries | cap | 공유 prefix | 설명력 근거 |
|---|---|---|---|---|---|
| mental_model | **어떤 사고 도구**로 판단했는가 | 13 | 32 | model_apply | 같은 정보를 bezos-doors로 보면 속도 결정, munger-inversion으로 보면 리스크 회피가 된다 |
| escalation_type | **왜 자동 판정이 실패**했는가 | 6 | 16 | escalation_event | 자동화 가능 영역과 인간 개입 필수 영역을 구분하는 축 |
| decision_outcome | 결정이 **어떤 결과**로 끝났는가 | 5 | 16 | decision_path | 결정 경로의 최종 상태. 학습 루프의 피드백 신호 |
| scope_mode | 결정의 **범위 전략**이 무엇인가 | 4 | 8 | decision_path | expansion/selective/hold/reduction — 결정의 방향성을 구분 |

#### Contextual — 결정의 강도/상황을 측정하는 축

| 축 | 역할 | entries | cap | 공유 prefix | 설명력 근거 |
|---|---|---|---|---|---|
| reversibility | 결정이 **되돌릴 수 있는가** | 2 | 4 | model_apply | one-way/two-way — 결정 속도를 보정하는 메타 축 |
| magnitude | 결정의 **영향 범위**가 얼마인가 | 4 | 8 | model_apply | minor~critical — reversibility와 교차하여 결정 전략을 결정 |
| confidence_band | 결정의 **확신도** | 4 | 8 | decision_event, forcing_response | low~very_high — evidence weight의 이산화. 패턴 학습의 임계값 |
| forcing_question | **어떤 강제 질문**에 답했는가 | 6 | 16 | forcing_response | Office Hours Forcing Questions — 전략 결정의 구조화된 입력 |

### 직교성 모델

직교성 = "한 축의 값을 알아도 다른 축의 값을 예측할 수 없다."

**설계 시점 보장 (a priori):**

| 축 쌍 | 직교 근거 |
|--------|---------|
| cognitive_phase × evidence_kind | perceive 단계에서도 data/rule/intuition 모두 가능. 단계가 근거를 결정하지 않는다 |
| flow_type × cognitive_phase | ceo_review에서도 7단계 모두 발생. 플로우가 단계를 건너뛰지 않는다 |
| evidence_kind × confidence_band | data 근거라고 항상 confidence가 높지 않다. 불완전한 데이터는 low confidence |
| reversibility × magnitude | two-way이면서 critical일 수 있다 (대규모 A/B 테스트) |

**런타임 검증 (a posteriori):**

실제 이력이 쌓이면 `gateDistribution()`의 `evidenceKindCorrelations`로 직교성을 확인한다.
특정 축 쌍의 상관비(correlation ratio)가 0.7을 넘으면 직교성 위반 후보 — 두 축이 실질적으로 같은 것을 측정하고 있을 수 있다.

```
직교성 위반 감지 기준:
  correlation ratio > 0.7  → ⚠ 검토 필요
  correlation ratio > 0.9  → 축 병합 또는 재설계 필요
```

---

## 3. 관찰 공간 (Observation Space)

5개 prefix가 의사결정의 관찰 가능한 좌표 공간을 구성한다.
각 prefix는 **하나의 질문**에 답한다.

### decision_event — "왜 이 분기를 선택했는가"

```
dims: flow_type(16) × cognitive_phase(16) × evidence_kind(16) × confidence_band(8)
totalSpace: 32,768
빈도: 높음 (gate 선택마다)
```

가장 기본적인 관찰 단위. 모든 `engine.selectBranch()` 호출이 이 좌표를 생성.
X↔Y 매핑의 **핵심 접점** — 비즈니스 요구(X)가 이 좌표를 통해 기술 결정(Y)에 연결된다.

### decision_path — "전체 결정이 어떻게 끝났는가"

```
dims: flow_type(16) × decision_outcome(16) × scope_mode(8)
totalSpace: 2,048
빈도: 보통 (플로우 완료마다)
```

FlowInstance 완료 시 1건. 결정 경로의 요약 벡터.
패턴 학습의 입력 — 반복되는 경로가 자동 정책 후보가 된다.

### escalation_event — "왜 인간에게 물어야 했는가"

```
dims: flow_type(16) × escalation_type(16) × cognitive_phase(16)
totalSpace: 4,096
빈도: 낮음 (자동 판정 실패 시만)
```

자동→수동 전환의 좌표. 이 prefix의 분포가 "자동화 가능 영역"의 지도가 된다.

### model_apply — "어떤 사고 도구로 판단했는가"

```
dims: mental_model(32) × reversibility(4) × magnitude(8)
totalSpace: 1,024
빈도: 보통 (인지 모델 적용 시)
```

사고 도구의 실제 사용 추적. 모델별 효과성 분석.

### forcing_response — "강제 질문에 어떻게 답했는가"

```
dims: forcing_question(16) × evidence_kind(16) × confidence_band(8)
totalSpace: 2,048
빈도: 낮음 (office-hours 시만)
```

전략 결정의 구조화된 입력. Office Hours 6 Forcing Questions.

### 총 관찰 공간

| prefix | totalSpace | 벡터 공간 역할 |
|--------|-----------|-------------|
| decision_event | 32,768 | 개별 결정의 위치 |
| decision_path | 2,048 | 결정 경로의 요약 |
| escalation_event | 4,096 | 자동화 경계의 지도 |
| model_apply | 1,024 | 사고 도구의 사용 분포 |
| forcing_response | 2,048 | 전략 입력의 구조 |
| **합계** | **41,984** | |

---

## 4. X↔Y 매핑 (인과 증명)

이 시스템의 핵심 주장:
**"특정 코드가 왜 그렇게 작성되었는지, 의사결정 좌표로 인과를 증명한다."**

### 매핑 경로

```
X (비즈니스 요구)
  │ "새 축을 추가해야 한다" / "capacity가 부족하다" / "prefix를 병합해야 한다"
  ▼
의사결정 좌표
  │ dkg decide --type new-axis
  │ → FlowEngine: coordinate-design 자동 시작
  │ → gate 순회: axis-definition → prefix-design → capacity-setting → ...
  │ → 각 gate에서 Evidence 첨부 + confidence 기록
  │ → 완료: coordinateAddress = 1D 정수
  │ → address_context 자동 생성
  ▼
Y (기술 구현)
  │ DecisionNode 생성 (flowInstanceId로 FlowInstance 역참조)
  │ justifies 엣지: FlowSchemaNode → DecisionNode
  │ DKG 그래프에 "왜" 기록
  ▼
검증
  │ qa-sdk dkg trace <decision-id> → 연결된 FlowInstance 코어 추적
  │ flow compare → 다른 결정과 어디서 갈렸는가
  │ flow policy learn → 반복 패턴 자동 감지
```

### 양방향 참조

```
DecisionNode.flowInstanceId  →  FlowInstance  (기술 → 결정)
FlowInstance.context.dkgDecisionId  →  DecisionNode  (결정 → 기술)
FlowSchemaNode  ──justifies──▶  DecisionNode  (DKG 그래프)
```

"이 DecisionNode는 왜 만들어졌는가?" → flowInstanceId → FlowInstance의 selections → 각 gate의 evidence
"이 FlowInstance는 무엇을 만들었는가?" → dkgDecisionId → DecisionNode → 생성된 축/prefix/변경

---

## 5. 벡터 공간 분석

투영된 결정 벡터들의 분포와 이동을 분석한다.

### 벡터 차이 (diffInstances)

두 결정 벡터의 차이 — **어느 차원에서 갈렸는가**.

```
인스턴스 A: [axis-def=new-axis, prefix=new-prefix, capacity=large]  → addr 42
인스턴스 B: [axis-def=reuse,    prefix=new-prefix, capacity=large]  → addr 38
차이: axis-definition 차원에서 분기 (divergence point)
원인: Evidence 차이 — A는 data 근거(5Q 통과), B는 precedent 근거(기존 축 재사용)
```

코어 gate의 차이는 강조(★) — 이 차이가 후속 모든 gate에 cascade됐을 가능성.

### 차원별 분포 (gateDistribution)

특정 차원의 값 분포 — **분산이 큰가, 집중됐는가**.

```
gate "risk" 분포:
  low:      12% (15건)
  medium:   45% (58건)  ← 지배적
  high:     30% (39건)
  critical: 13% (17건)

→ medium이 70% 미만이므로 아직 자동 정책 후보는 아님
→ evidence_kind 상관: high 선택 시 82%가 data 근거 (직교성 주의)
```

지배적 branch(>70%)가 있으면 → 패턴 학습의 정책 후보 힌트.
특정 evidence_kind와 특정 branch의 상관이 높으면 → 직교성 검토 신호.

### 시간별 분포 이동 (compareTimeRanges)

주성분의 설명력이 **시간에 따라 변했는가**.

```
기간 A (3월 1~15일): risk.high = 45%
기간 B (3월 16~24일): risk.high = 12%

shift: -33%p (고위험 결정이 급감)
emerged paths: capacity→large가 기간 B에서 새로 등장
disappeared paths: merge→merge가 기간 B에서 사라짐
```

### 패턴 감지 (detectPatterns)

벡터 공간에서 **같은 영역에 반복적으로 투영되는 점**을 찾는다.

```
context { team: "infra" } → 5회 연속 [risk=low, timeline=within-sprint]
→ 패턴 감지: "infra 팀은 항상 저위험+단기"
→ 정책 후보 생성: confidence 0.92, 빈도 5회
→ 인간 승인 대기 (candidate → approved → FlowPolicy 등록)
```

### 비교 보고서 (ComparisonReport)

벡터 차이의 **원인 추론** — evidence 차원에서 왜 갈렸는가.

추론 유형:
- `evidence-imbalance`: A는 data 근거 3건, B는 0건 → 정보 비대칭
- `exclusive-evidence`: A에만 있는 근거가 분기를 결정
- `confidence-gap`: 같은 근거인데 A의 confidence가 유의미하게 높음

---

## 6. 구조적 제약 (Structural Constraints)

### 게이트 무게 (GateWeight)

모든 gate가 동등하지 않다. 구조적 영향도로 3단계 분류.

| weight | 의미 | 변경 영향 |
|--------|------|---------|
| **core** | 이 결정이 후속 모든 결정의 방향을 바꾼다 | 변경 → 전체 재실행 |
| **structural** | 다수의 후속 결정에 영향 | 변경 → 연쇄 변경 |
| **tactical** | 국소적 영향. 독립적으로 되돌림 가능 | 변경 → 해당 gate만 |

### 인과 그래프 (GateDependency)

gate 간 "이 결정이 저 결정을 바꾸는가"를 명시적으로 기록.

```
axis-definition ──constrains──▶ prefix-design (core → core)
                ──constrains──▶ capacity-setting
                ──enables──▶ version-strategy

merge-split ──invalidates──▶ prefix-design (core!)
            ──invalidates──▶ capacity-setting
```

**코어 무효화 경고**: merge-split을 바꾸면 prefix-design(core)이 무효화 → `⚠ 전체 재설계 필요`

### 코어 게이트 프로파일

`coordinate-design` 플로우 기준 (coreScore 내림차순):

| gate | weight | directImpact | transitiveImpact | coreScore |
|------|--------|-------------|-----------------|-----------|
| axis-definition | core | 3 | 5+ | 22+ |
| prefix-design | core | 3 | 3+ | 19+ |
| merge-split | core | 2 | 2+ | 16+ |
| capacity-setting | structural | 1 | 1 | 8 |
| version-strategy | structural | 0 | 0 | 5 |
| service-binding | tactical | 0 | 0 | 1 |

### 계층 (Decision Layers)

전략 결정은 전술을 제약한다. 역방향은 에스컬레이션.

```
Level 0: strategic   ← "무엇을 만들 것인가"  (office-hours, ceo-review)
Level 1: tactical    ← "어떻게 만들 것인가"  (eng-review, design-review, coordinate-design)
Level 2: operational ← "올바르게 만들고 있는가"  (code-review, investigation)
Level 3: execution   ← "출시한다"  (ship)
```

| 규칙 | 허용 | 위반 시 |
|------|------|--------|
| 하향 제약 | strategic → tactical constrains | — |
| 상향 변경 | — | `upward-mutation` 위반 → 에스컬레이션 필요 |
| 계층 건너뛰기 | — | `skip-layer` 위반 → 중간 계층 경유 필요 |
| 스코프 상속 | 상위 결정 → 하위 context 자동 주입 | — |

### 컨텍스트 바운더리

```
coordinate-design (루트)
  exports: axis_decision, prefix_decision, capacity_decision
     │
     ├──▶ sprint-execution
     │      imports: coordinate_structure ← coordinate-design
     │      owns: office-hours, ceo/eng/design-review, code-review, ship
     │
     ├──▶ dkg-governance
     │      imports: axis_structure ← coordinate-design
     │
     └──▶ platform-runtime
            imports: encoding_constraint ← coordinate-design
            owns: investigation
```

---

## 7. 용어

| 한국어 | 영문 | 좌표 대응 | 정의 |
|--------|------|---------|------|
| 분기점 | Gate | Axis | 하나의 의사결정 지점. 벡터 공간의 차원 |
| 선택지 | Branch | Entry | 분기점에서의 선택 옵션. 차원 내 값 |
| 결정 경로 | Path | Address | 분기점 선택의 전체 시퀀스. 1D 정수로 인코딩 |
| 근거 | Evidence | — | 선택의 이유. kind + weight. 직교성 검증의 대상 |
| 코어 게이트 | Core Gate | — | weight="core". 변경 시 전체 재실행이 필요한 구조적 분기점 |
| 인지 단계 | Cognitive Phase | Primary 축 | perceive→interpret→evaluate→decide→plan→execute→reflect |
| 인지 모델 | Mental Model | Secondary 축 | 의사결정에 적용하는 사고 도구 (13종) |
| 에스컬레이션 | Escalation | — | 자동 판정 불가 → 인간 결정 요청. 하위→상위 계층 변경 요청 |
| 벡터 | Decision Vector | — | FlowInstance의 전체 선택을 축별 값으로 표현한 것 |

---

## 8. 직렬화

기존 qa-sdk SemanticAddress와 동일:

```
"decision_event:v1:1234"
"decision_path:v1:42"
"model_apply:v1:7"
```

역방향 해석:

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

## 9. 패키지 구조

소스 8,776줄 / 24파일 + 테스트 5,508줄 / 12파일 + CLI 1,685줄 / 2파일.

```
packages/decision-flow/src/         # unscoped, tsup dual format (ESM+CJS)

Layer 0: 타입 정의
  types.ts                           핵심 타입 (FlowSchema, DecisionNarrative, DecisionUnit, DecisionTrace)

Layer 1: 스키마 + 좌표
  schema.ts                          FlowSchemaBuilder + validate
  coordinate.ts                      WeightedIndex 연동 (encode/decode/라운드트립)
  vocabulary.ts                      11축 정의 + AxisExplanatoryMeta (Primary/Secondary/Contextual)
  catalog.ts                         5 prefix 정의 (관찰 좌표)

Layer 2: 실행 엔진
  engine.ts                          FlowEngine (start/select/complete/load + 이벤트 리스너)
  policy.ts                          조건 평가, 자동 선택
  instance-store.ts                  InstanceStore 인터페이스 + MemoryInstanceStore

Layer 3: 분석
  comparison.ts                      벡터 차이 / 차원 분포 / 시간 비교 / 보고서
  policy-learning.ts                 패턴 감지 + 후보 워크플로우 + 분류 (routine/exploratory/escalation/anomaly)
  core-analysis.ts                   gate 구조 분석, 인과 그래프, 영향 분석
  orthogonality.ts                   Cramér's V 직교성 검증

Layer 4: 서사 + 컨텍스트
  narrative.ts                       buildNarrative / verdict / summarize / divergence
  context-provider.ts                ContextProvider (이력+패턴+정책+모델 표면화) + FeatureLookup
  monitor.ts                         DecisionMonitor (메트릭 집계 + 알림)
  hierarchical-context.ts            5레벨 수직 관통 (Domain→DSL→Category→Prefix→Dim)

Layer 5: 응용 (FlowSchema 정의)
  sprint.ts                          gstack 파이프라인 (10 FlowSchema + 6 policies)
  dev-decisions.ts                   일상 결정 (5 FlowSchema + 6 policies + DecisionUnits)
  mental-model.ts                    13 인지 모델 + escalation + Forcing Questions
  boundary.ts                        4 계층 + 바운더리
  observe.ts                         이벤트 인코딩 (5 prefix)
  ingest-adapter.ts                  address_context 빌더
  self-analysis.ts                   qa-sdk 설계 결정 자기참조

index.ts                             barrel export (42 export groups)
```

CLI 영속 (packages/cli/):

```
cli/src/stores/
  flow-sqlite-store.ts               SqliteInstanceStore (WAL + busy_timeout + migrate)

cli/src/commands/
  flow.ts                            18 commands (list/start/select/status/trace/analyze/
                                     compare/policy×5/lookup/history/verdict/judge)
```

의존 방향:

```
decision-flow → weighted-index (좌표 인코딩)
@qa-sdk/cli   → decision-flow + node:sqlite (CLI 영속)
spec-core     → decision-flow (optional peer, 동적 import)
```

---

## 10. 구현 현황

### P0: 코어 타입 + 엔진 — ✅

| 구현 | 파일 |
|------|------|
| 핵심 타입 (FlowSchema, GateSchema, Evidence, GateWeight) | `types.ts` |
| FlowSchemaBuilder + 검증 | `schema.ts` |
| FlowEngine (실행 엔진) | `engine.ts` |
| WeightedIndex 좌표 매핑 | `coordinate.ts` |
| 조건 평가, 자동 선택 | `policy.ts` |
| 관찰 좌표 인코딩 (5 prefix) | `vocabulary.ts` + `catalog.ts` + `observe.ts` |
| 인지 프레임워크 (13 모델) | `mental-model.ts` |
| 스프린트 파이프라인 (8 FlowSchema) | `sprint.ts` |
| 코어 분석 (구조 프로파일, 인과, 영향) | `core-analysis.ts` |
| 계층 + 바운더리 | `boundary.ts` |

### P1: DEMO_CATALOG 통합 — ✅

| 구현 | 파일 |
|------|------|
| decision 도메인 (11축 + 5 prefix) | `demo-catalog.ts`, `demo-dkg-config.ts` |

### P2: 수집 파이프라인 연동 — ✅

| 구현 | 파일 |
|------|------|
| address_context 빌더 | `ingest-adapter.ts` |

### P3: 런타임 자동화 — ✅

| 구현 | 파일 |
|------|------|
| CLI (`qa-sdk flow`) | `cli/src/commands/flow.ts` |

### P4: 학습·비교·DKG 통합 — ✅ (2026-03-24 QG 통과)

PRD: `tasks/prd-decision-flow-p4.md` — 21 US / 78 AC 전부 완료

| 구현 | 파일 |
|------|------|
| InstanceStore (이력 저장) | `instance-store.ts` |
| PatternDetector + PolicyCandidateWorkflow | `policy-learning.ts` |
| diffInstances, gateDistribution, compareTimeRanges, ComparisonReport | `comparison.ts` |
| FlowSchemaNode (DKG 16종째) | `spec-core/src/dkg/dkg.types.ts` |
| bootstrapDkg FlowSchema 자동 생성 | `spec-core/src/dkg/bootstrap.ts` |
| DKG 엣지 (composes/observes/contains/references) | `spec-core/src/dkg/flow-schema-relations.ts` |
| cascadeFromFlowSchema() | `spec-core/src/dkg/graph-registry.ts` |
| dkg decide → flow 브릿지 | `cli/src/commands/dkg-decision-flow.ts` |
| flow policy/compare CLI | `cli/src/commands/flow.ts` |
| dkg flow-schemas CLI | `cli/src/commands/dkg.ts` |
| 통합 E2E (4 시나리오) | `cli/src/commands/dkg.e2e.test.ts` |

---

## 11. Quality Gates

```
pnpm --filter decision-flow typecheck   # 타입 체크
pnpm --filter decision-flow test        # 107 tests (5 files)
pnpm --filter @qa-sdk/cli build         # CLI 빌드
pnpm --filter demo-tests test           # 846 tests (52 files)
```

---

## 12. 후속 과제 (P5 후보)

### P5: 정보 체계 정체성 — ✅ 완료 (2026-03-24)

| 구현 | 파일 |
|------|------|
| AxisExplanatoryMeta (role/explains/designRationale/orthogonalTo) | `vocabulary.ts` |
| AXIS_META 레지스트리 (11축 전체, Primary/Secondary/Contextual 3층) | `vocabulary.ts` |
| checkOrthogonality() — Cramér's V 기반 직교성 검증 | `orthogonality.ts` |
| extractPhaseEvidencePairs/extractEvidenceConfidencePairs — 값 쌍 추출기 | `orthogonality.ts` |
| checkAllDeclaredOrthogonality() — 선언된 직교 쌍 일괄 검증 | `orthogonality.ts` |
| DecisionNarrative (배경→여정→도달→산출→회고 서사 타입) | `types.ts` |
| buildNarrative/extractPivotPoints/summarizeNarrative/findNarrativeDivergence | `narrative.ts` |
| index.ts 서사 교체 (정보 체계 정체성 반영) | `index.ts` |
| 서사 증명 테스트 (7장 18테스트) | `proof.test.ts` |
| 서사 문서 (질문→증명→결론이 쌓이는 구조) | `docs/specs/decision-flow/narrative.md` |

### P6 후보: 계층적 컨텍스트 공급 (Hierarchical Context Supply)

#### 문제 인식

시스템의 목표는 다양한 상황에서 prefix를 쉽게 이해하고, 관련 인과관계를 파악하고, 그것을 요약하는 것.
현재 구조 정보는 8곳에 흩어져 있고(catalog, DKG, GateEngine, decode, registry, convergence, spec-core, ContextProvider),
ContextProvider는 FlowSchema 단일 레벨 이력 조회만 수행한다.

```
시스템 (catalog, DKG, spec-core) = 구조를 표현
decision-flow                     = 구조의 조합으로 완성된 맥락을 정의
```

prefix에 대한 정보는 5개 레벨에 걸쳐 존재하며, ContextProvider가 이 계층을 수직으로 관통해야 한다:

```
Domain (shopping-domain)        → 공유 축, 경계, 소속 prefix 목록
DSL Bundle (dsl-checkout)       → 파이프라인 순서, fixedDims, invariants
Category (event)                → 구조 규칙 (action 축 필수 등), 검증 함수
Prefix (cart_event)             → dims, capacity, gate 상태, 의사결정 이력
Dim/Entry (action:add_to_cart)  → 엔트리 목록, headroom, stride
```

#### 설계 제약 4가지

**1. 의존 역전 (Port 패턴)**

decision-flow는 시스템 패키지에 직접 의존하지 않는 독립 라이브러리다.
계층 정보가 필요하면 **인터페이스(Port)를 정의**하고, 시스템 쪽에서 구현을 주입한다.
현재 ContextProvider가 `InstanceStore`를 주입받는 것과 동일한 패턴.

```typescript
// decision-flow가 정의 (Port)
interface StructuralContextPort {
  getHierarchy(prefixId: string): HierarchicalContext;
  getCategoryRules(category: string): CategoryContext;
  getDomainContext(domainId: string): DomainContext;
  // ...
}

// spec-core/skill이 구현
class SkillBasedStructuralContext implements StructuralContextPort { ... }
```

**2. 정제 기준 (Refinement > Aggregation)**

8곳의 정보를 합치는 것은 aggregation이지 refinement가 아니다.
5개 레벨 전부를 쏟아내면 맥락 과부하.

**상황별로 필요한 깊이가 다르다:**

| 상황 | 필요한 레벨 | 이유 |
|------|-----------|------|
| 회의 중 | Domain, DSL Bundle | "이 prefix가 어떤 맥락에 속하는가" |
| 디버깅 중 | Prefix, Dim/Entry | "이 주소가 정확히 무엇을 의미하는가" |
| 아키텍처 리뷰 | Category, Domain | "구조 규칙을 지키고 있는가" |
| 이상 탐지 | Prefix, Convergence | "메트릭/관측에 이상이 있는가" |
| 신규 설계 | 전체 계층 | "어디에 놓을 것인가" |

이 "상황 → 필요한 깊이" 매핑이 식별 레이어의 초기 형태이자 refinement의 기준.

**3. Skill이 Port의 자연스러운 구현체**

DKG skill의 설계가 이미 `targetKinds`, `specialization(domains, prefixes, dslBundles)`,
category `read/analysis/chain`을 갖고 있다.
decision-flow가 정의하는 Port를 skill이 구현하는 구조가 자연스럽다.

```
decision-flow 정의:  StructuralContextPort
spec-core 구현:      service-explorer skill이 Port를 충족
```

**4. 기존 원칙 유지**

> "강제하지 않는다. 맥락을 표면화하여 쉽게 만든다."

이 원칙이 계층 확장에서도 그대로 적용된다.
상황에 맞게 정제해서 필요한 것만 보여주는 것이 "결정을 쉽게 만든다"에 부합.

#### 구현 순서

```
1단계: Port 인터페이스 정의
  → StructuralContextPort, HierarchicalContext 타입
  → 상황(intent)별 깊이 정의

2단계: Port 구현 (spec-core/skill 기반)
  → service-explorer가 Port를 충족하는 어댑터

3단계: ContextProvider 확장
  → provide()가 FlowSchema 이력 + 구조 계층을 조합
  → intent 파라미터로 깊이 조절

4단계: 식별 레이어 (그 위에 쌓임)
  → 키워드 매핑, DKG 그래프 탐색, LLM 분류 등
  → "상황 → prefix 후보" 자동 추천
```

### P7: 후속 과제 해소 — ✅ 완료 (2026-03-24)

| 구현 | 파일 |
|------|------|
| comparison 벡터 프레이밍 alias (VectorDiff, DimensionDistribution, TemporalAnalysis 등) | `index.ts` |
| PatternClass 분류 (routine/exploratory/escalation/anomaly) + classifyPattern() | `policy-learning.ts` |
| DecisionUnit 타입 (topic/objective/successCriteria/fallback) | `types.ts` |
| DecisionVerdictRecord (success/failure/deferred/superseded + criteriaResults) | `types.ts` |
| DEV_DECISION_UNITS — 4개 플로우별 의사결정 단위 정의 | `dev-decisions.ts` |

### P8: CLI 영속 + 조회 — ✅ 완료 (2026-03-25)

| 구현 | 파일 |
|------|------|
| SqliteInstanceStore (CLI 전용 SQLite 영속) | `cli/src/stores/flow-sqlite-store.ts` |
| FlowEngine.loadInstance() (외부 인스턴스 주입) | `decision-flow/src/engine.ts` |
| active 인스턴스 세션 간 유지 (start→종료→select 이어서) | `cli/src/commands/flow.ts` |
| `flow lookup <keyword>` (키워드 의사결정 이력 조회) | `cli/src/commands/flow.ts` |
| `flow history [schema-id]` (완료 인스턴스 이력) | `cli/src/commands/flow.ts` |
| `flow verdict <instance-id>` (판정 상태 + 성공 기준) | `cli/src/commands/flow.ts` |

영속 구조:
```
~/.qa-sdk/decision-flow.sqlite
  flow_instances: id, schema_id, status, context(JSON), selections(JSON), address, ...

flow start   → INSERT (active)
flow select  → UPDATE (active → active or completed)
flow history → SELECT ... ORDER BY started_at DESC
flow lookup  → SELECT ... WHERE context LIKE '%keyword%'
flow verdict → SELECT ... WHERE id = ?
```

### P9: 안정화 + 시간축 + 라우터 개선 — ✅ 완료 (2026-03-25)

| 구현 | 파일 |
|------|------|
| SQLite JSON parse 안전 + WAL + busy_timeout | `cli/stores/flow-sqlite-store.ts` |
| loadInstance 스키마 검증 + 복원 시 버전 체크 | `engine.ts`, `cli/commands/flow.ts` |
| buildNarrative 0 selections 방어 | `narrative.ts` |
| SqliteInstanceStore 10 tests | `cli/stores/flow-sqlite-store.test.ts` |
| loadInstance + buildNarrative 방어 3 tests | `decision-flow.test.ts` |
| ARCHITECTURE_DECISION_FLOW (4 gates) | `dev-decisions.ts` |
| decision-router 유형 확장 (8유형) | `dev-decisions.ts` |
| 라우터 → 하위 플로우 자동 시작 | `cli/commands/flow.ts` |
| gate별 durationMs 자동 측정 | `engine.ts`, `cli/commands/flow.ts` |
| flow history 소요 시간 컬럼 | `cli/commands/flow.ts` |
| flow verdict 시간 분석 (총 소요, gate별, 완료→판정) | `cli/commands/flow.ts` |
| flow judge (판정 기록 + verdict SQLite 영속) | `cli/commands/flow.ts`, `cli/stores/flow-sqlite-store.ts` |
| evidence 없이 코어 gate 선택 시 경고 + mentalModel 힌트 | `cli/commands/flow.ts` |

### P10: ingest 전송 — ✅ 완료 (2026-03-25)

| 구현 | 파일 |
|------|------|
| FlowIngestEmitter (onGateSelected/onFlowCompleted → /v1/ingest POST) | `cli/stores/flow-ingest-emitter.ts` |
| INGEST_URL 환경변수 또는 localhost:3200 기본값 | |
| fail-open: 전송 실패해도 flow 진행 차단 안 함 | |

구조:
```
flow select → FlowEngine
  ├── instanceStore.save() → SQLite (로컬 캐시)
  └── FlowIngestEmitter   → ingest-server (localhost 또는 prod)
                              └── Phase 1 저장 → Phase 2 verdict → convergence
```

### 잔여 후속 과제

| 과제 | 상태 | 설명 |
|------|------|------|
| convergence 연동 | ingest 전송 연결됨 → 서버 기동 시 자동 동작 | convergence pipeline이 decision prefix를 자동 수집 |
| GateEngine 연동 | 보류 | FlowSchema 레벨 관리가 현재 적합. 좌표 게이팅은 서버 운영 단계에서 |
| codegen 연동 | 필요 시 | `pnpm codegen` 실행하면 decision 타입 자동 생성 |

### Non-Goals

- 실시간 스트리밍 학습 / 강화학습 / 외부 ML 모델
- 통계적 유의성 검정 (t-test 등)
- 실시간 비교 대시보드
- DKG UI에서 FlowSchema 편집
