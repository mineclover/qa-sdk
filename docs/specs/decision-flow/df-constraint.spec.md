---
def:
  id: df-constraint
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  svc: decision-flow
  tags: [decision]
  links:
    - target: df-vector-analysis
      type: constrains
    - target: df-causal-mapping
      type: constrains
---
# Decision Flow 구조적 제약

## 목적 ^purpose

게이트 무게(core/structural/tactical), 인과 그래프(GateDependency), 결정 계층(strategic→tactical→operational→execution)과 컨텍스트 바운더리를 정의한다.

## 게이트 무게 ^constraint

| weight | 의미 | 변경 영향 |
|--------|------|---------|
| core | 후속 모든 결정의 방향을 바꾼다 | 전체 재실행 |
| structural | 다수의 후속 결정에 영향 | 연쇄 변경 |
| tactical | 국소적 영향, 독립적 되돌림 가능 | 해당 gate만 |

## 계층 규칙 ^constraint

| 규칙 | 허용 | 위반 시 |
|------|------|--------|
| 하향 제약 | strategic → tactical | — |
| 상향 변경 | — | upward-mutation → 에스컬레이션 필요 |
| 계층 건너뛰기 | — | skip-layer → 중간 계층 경유 필요 |
| 스코프 상속 | 상위 결정 → 하위 context 자동 주입 | — |

## 계층 + 컨텍스트 바운더리 (`boundary.ts`)

### 4계층 모델 (DecisionLayer)

```
Layer 0: Strategic    "무엇을 만들 것인가"  → office-hours, ceo-review
Layer 1: Tactical     "어떻게 만들 것인가"  → eng-review, design-review, coordinate-design
Layer 2: Operational  "올바르게 만들고 있는가" → code-review, investigation
Layer 3: Execution    "출시한다"            → ship
```

`getLayerForFlow(flowId)` — flow ID → 소속 DecisionLayer 조회.

### 위반 검증 (`validateLayerConstraints`)

`validateLayerConstraints(sourceFlowId, targetFlowId, effect, contexts?)` → `LayerViolation[]`

3가지 위반 유형:
- **upward-mutation**: 하위 계층이 상위 계층을 constrains/invalidates. 에스컬레이션 필요
- **skip-layer**: 2단계 이상 건너뛴 영향 (예: strategic → operational). 중간 계층 경유 필요
- **boundary-crossing**: 다른 `DecisionContext` 간 영향인데 import가 정의되지 않음

### 컨텍스트 바운더리 (DecisionContext)

DDD Bounded Context를 의사결정에 적용. 각 컨텍스트는:

- `ownedFlows`, `ownedAxes`, `ownedPrefixes` — 자기 소유 자산
- `exports: ContextExport[]` — 외부에 발행하는 결정 (kind: `"value"` 또는 `"constraint"`)
- `imports: ContextImport[]` — 외부에서 수신하는 제약 (effect: `"constrains"` | `"blocks"` | `"informs"`)

### 스코프 상속 (`propagateScope`)

상위 계층 결정을 하위 계층 컨텍스트로 전파한다.

```
propagateScope(parentInstance, parentSchema, childFlowId, exports) → Record<string, unknown>
```

- 상위→하위 방향만 전파 (하위→상위는 무시)
- export.kind="value" → `inherited_{name}: branchId`
- export.kind="constraint" → `constraint_{name}: { gateId, branchId, fromLayer, fromFlow }`
- 예: ceo-review의 scope-mode=expansion → eng-review에 `{ inherited_scope_mode: "expansion" }` 주입

### 에스컬레이션 요청 (`EscalationRequest`)

하위 계층에서 상위 계층 결정의 변경이 필요할 때 명시적 요청을 생성한다.

`createEscalationRequest(sourceContext, targetContext, ...)` → `EscalationRequest`

직접 변경하지 않는 이유: 상위 결정은 cascade 영향이 크므로 명시적 승인(approved/rejected/deferred) 필요.

## 인지 프레임워크 (`mental-model.ts`)

### 가역성 분류 (Bezos Doors)

| 유형 | Reversibility | 의미 |
|------|:------------:|------|
| one-way | 되돌리기 어려움 | 더 많은 근거, 더 높은 confidence 요구 |
| two-way | 쉽게 되돌림 | 70% 정보면 충분 — 빠르게 결정 |

`Magnitude` (minor/moderate/major/critical) × `Reversibility`로 결정 속도 보정.

### 3-Layer 지식 (KnowledgeLayer)

| Layer | 이름 | 신뢰도 |
|-------|------|:------:|
| L1 | tried-and-true (검증된 것) | 중 |
| L2 | new-and-popular (새롭고 인기 있는 것) | 하 |
| L3 | first-principles (제1원리) | 상 |

신뢰 순서: L3 > L1 > L2. L3가 L1을 뒤집을 때 = Eureka Moment (`LayeredAnalysis.eurekaInsight`).

### 인지 모델 레지스트리 (MENTAL_MODELS)

13종 `MentalModel`. 각 모델은 `question` (핵심 질문)과 `antiPattern` (함정)을 정의한다.

| ID | 이름 | 핵심 질문 |
|----|------|----------|
| bezos-doors | 가역성 분류 | 이 결정은 되돌릴 수 있는가? |
| munger-inversion | 반전 사고 | 무엇이 실패를 만드나? |
| jobs-subtraction | 초점 = 빼기 | 이것을 빼면 핵심이 더 강해지는가? |
| speed-calibration | 속도 보정 | 70% 정보로 결정하면 어떤 위험이 있는가? |
| proxy-skepticism | 대리 회의 | 이 지표가 아직 사용자 가치를 대변하는가? |
| boil-the-lake | 호수를 끓여라 | 90%와 100% 구현의 추가 비용은? |
| three-layer | 3-Layer 지식 | L1/L2/L3 중 어디서 판단하는가? |
| narrative-coherence | 서사 일관성 | 이 결정의 '왜'를 한 문장으로 설명할 수 있는가? |
| temporal-depth | 시간적 깊이 | 12개월 뒤 이 결정을 어떻게 평가할 것인가? |
| founder-mode | 파운더 모드 | 깊이 관여하면 팀의 사고를 확장하는가? |
| wartime-awareness | 전시 인식 | 지금은 평시인가 전시인가? |
| design-trust | 신뢰를 위한 설계 | 이 인터페이스 결정이 사용자 신뢰를 쌓는가? |
| edge-paranoia | 엣지 케이스 편집증 | 이름이 47글자면? 결과가 0개면? |

### mentalModel 답변 검증

`validateMentalModelAnswers(gateId, mentalModelIds, evidenceList)` → `GateModelValidation`

gate에 연결된 mentalModel의 핵심 질문에 답변했는지 사후 검증. evidence의 source/content에 모델 ID 또는 이름이 포함되면 답변한 것으로 간주. **강제하지 않음 (fail-open)** — 경고만 반환.

`validateInstanceModelCoverage(instance, schema)` — FlowInstance 전체의 mentalModel 답변 현황 일괄 검증.

### 에스컬레이션 판정 (AutoDecisionPrinciple)

6가지 원칙으로 자동 처리 가능 여부를 판단한다.

| 원칙 | 의미 | 자동 |
|------|------|:----:|
| standard-pattern | 확립된 패턴 | ✅ |
| completeness | 완전 구현의 한계 비용이 낮음 | ✅ |
| test-coverage | 테스트 추가 | ✅ |
| observability | 로깅/메트릭/트레이스 추가 | ✅ |
| security | 보안 강화 | ✅ |
| taste | 위 5개 해당 없음 | ✗ → 인간 결정 |

`classifyEscalation(tags)` → `EscalationJudgment { principle, isTasteDecision, rationale }`

### Forcing Questions (Office Hours)

6개 근본 타당성 검증 질문 (`FORCING_QUESTIONS`):

| ID | 이름 | 핵심 질문 |
|----|------|----------|
| demand-reality | 수요 현실 | 이것이 사라지면 진심으로 화가 날 사람의 가장 강력한 증거는? |
| status-quo | 현재 상태 | 사용자가 지금 이 문제를 어떻게 해결하고 있는가? |
| desperate-specificity | 절박한 구체성 | 이것이 가장 필요한 실제 사람의 이름, 직함, 일상은? |
| narrowest-wedge | 최소 쐐기 | 이번 주에 돈을 받을 수 있는 가장 작은 버전은? |
| observation | 관찰 | 실제 사용을 도움 없이 지켜본 적 있는가? |
| future-fit | 미래 적합성 | 3년 뒤 세상이 달라지면 이 제품은 더 필수적이 되는가? |

각 질문에 `pushBackOn` 필드가 있어, 표면적 답변일 때 재질문 방향을 안내한다.
