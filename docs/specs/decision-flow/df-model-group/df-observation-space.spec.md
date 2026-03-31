---
def:
  id: df-observation-space
  address: def_document:v2:342166
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: decision-flow
  tags: [decision]
  links:
    - target: df-axis-model
      type: depends_on
---
# Decision Flow 관찰 공간

## 목적 ^purpose

5개 prefix가 의사결정의 관찰 가능한 좌표 공간을 구성한다. 각 prefix는 하나의 질문에 답한다.

## 구성 ^overview

decision_event(32K, 개별 결정 위치), decision_path(2K, 결정 경로 요약), escalation_event(4K, 자동화 경계), model_apply(1K, 사고 도구 사용), forcing_response(2K, 전략 입력). 총 관찰 공간: 41,984.

## Prefix 정의

| prefix | dims | totalSpace | 역할 |
|--------|------|-----------|------|
| decision_event | flow_type × cognitive_phase × evidence_kind × confidence_band | 32,768 | 개별 결정의 위치 |
| decision_path | flow_type × decision_outcome × scope_mode | 2,048 | 결정 경로의 요약 |
| escalation_event | flow_type × escalation_type × cognitive_phase | 4,096 | 자동화 경계의 지도 |
| model_apply | mental_model × reversibility × magnitude | 1,024 | 사고 도구의 사용 분포 |
| forcing_response | forcing_question × evidence_kind × confidence_band | 2,048 | 전략 입력의 구조 |
