---
def:
  id: dkg-queries
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [tier-system]
  links:
    - target: dkg-node-types
      type: depends_on
    - target: dkg-edge-types
      type: depends_on
---
# DKG 설계 시점 질의

## 목적 ^purpose

DKG 그래프에서 설계 시점 정보를 추출하는 질의 함수. 다이어그램 목록, 메트릭 수집, 영향 분석, 커버리지 계산 등을 제공한다.

## 구성 ^overview

주요 질의: listAllDiagrams(다이어그램 목록), collectMetrics(DKG 메트릭), traceFlows(IntentLink 위반 감지), cascadeFromFlowSchema(flow→DKG 전파), service-skills(관측 자동 생성).
