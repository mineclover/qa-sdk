---
def:
  id: df-axis-model
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  tags: [decision]
  links:
    - target: axis-decision-guide
      type: depends_on
---
# Decision Flow 축 모델

## 목적 ^purpose

의사결정 도메인의 11개 축 정의. 5Q 자격 검증 + 설명력 판단을 통과한 축만 포함. Primary(구조 결정)/Secondary(성격 한정)/Contextual(강도 측정) 3층 분류.

## 구성 ^overview

Primary 3축: cognitive_phase(7), flow_type(8), evidence_kind(5).
Secondary 4축: mental_model(13), escalation_type(6), decision_outcome(5), scope_mode(4).
Contextual 4축: reversibility(2), magnitude(4), confidence_band(4), forcing_question(6).
직교성: 설계 시점 선언(a priori) + 런타임 검증(correlation ratio > 0.7 → 위반 후보).

## 직교성 모델 ^constraint

직교성 = "한 축의 값을 알아도 다른 축의 값을 예측할 수 없다."

| 축 쌍 | 직교 근거 |
|--------|---------|
| cognitive_phase × evidence_kind | perceive에서도 data/rule/intuition 모두 가능 |
| flow_type × cognitive_phase | ceo_review에서도 7단계 모두 발생 |
| evidence_kind × confidence_band | data 근거라고 항상 confidence가 높지 않다 |
| reversibility × magnitude | two-way이면서 critical일 수 있다 |

런타임 위반 감지: correlation ratio > 0.7 → 검토, > 0.9 → 병합/재설계.
