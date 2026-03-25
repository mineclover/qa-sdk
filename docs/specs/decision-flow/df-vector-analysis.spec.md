---
def:
  id: df-vector-analysis
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [decision]
  links:
    - target: df-observation-space
      type: depends_on
---
# Decision Flow 벡터 분석

## 목적 ^purpose

투영된 결정 벡터들의 분포, 차이, 이동, 패턴을 분석하는 기능. 개별 결정을 넘어서 "어떤 패턴으로 결정하고 있는가"를 벡터 공간에서 발견한다.

## 구성 ^overview

4개 분석 함수: diffInstances(벡터 차이), gateDistribution(차원별 분포), compareTimeRanges(시간별 이동), detectPatterns(반복 패턴 감지). ComparisonReport로 원인 추론(evidence-imbalance, exclusive-evidence, confidence-gap).
