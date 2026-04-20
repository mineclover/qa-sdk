---
def:
  id: df-narrative-proof-core-gates
  type: knowledge
  knowledge_kind: narrative
  level: leaf
  tier: component
  scope: feature
  aspect: scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: decision-flow
  tags: [decision, testing]
  links:
    - target: df-narrative-proofs
      type: refines
    - target: df-constraint
      type: depends_on
    - target: decision-standard-group
      type: depends_on
    - target: axis-decision-guide
      type: depends_on
---
# Decision Flow — 서사 증명: 코어 gate와 축 설계

## 목적 ^purpose

코어 gate, 축 직교성, 축 선택 근거가 단순 선언이 아니라 실제 구조적 영향을 설명하는 기준이라는 점을 증명한다.

## 구성 ^overview

- 장 4: 코어 gate가 구조적 영향을 결정한다.
- 장 5: 직교성은 선언만으로 보장되지 않는다.
- 장 6: 축 선택의 근거가 코드에 산다.

## 장 4: 코어 gate가 구조적 영향을 결정한다

### 질문

모든 결정이 동등한가?

### 증명

- scope: `weight=core`, `directImpact=2`
- architecture: `weight=structural`, `directImpact=1`
- testing: `weight=tactical`, `directImpact=0`

`identifyCoreGates()`는 scope만 코어로 식별한다.

### 결론

scope가 코어다. "무엇을 만들 것인가"가 "어떻게 만들 것인가"를 결정하고, 그 다음에 "어떻게 검증할 것인가"가 결정된다.

## 장 5: 직교성은 선언만으로 보장되지 않는다

### 질문

사전 선언한 축 독립성이 실제 데이터에서도 유지되는가?

### 증명

- 유지 케이스: Cramér's V < 0.3 → 직교성 유지
- 위반 케이스: evaluate→항상 data, decide→항상 rule → V > 0.7 → 직교성 의심

### 결론

직교성은 사전 설계와 사후 검증의 균형으로 유지된다. 축은 설계하지만, 데이터가 쌓이면 다시 검증해야 한다.

## 장 6: 축 선택의 근거가 코드에 산다

### 질문

축 선택의 이유가 6개월 후에도 남는가?

### 증명

AXIS_META 레지스트리에 explains, designRationale, orthogonalTo가 기록된다.

예:
- `cognitive_phase`: decision_speed보다 설명력이 높다
- `evidence_kind`: evidence_count보다 종류가 품질을 더 잘 설명한다

### 결론

축 설계 근거는 코드와 메타데이터 안에 보존되어야 한다. 그래야 축을 바꿔도 "왜 바꿨는가"가 이어진다.
