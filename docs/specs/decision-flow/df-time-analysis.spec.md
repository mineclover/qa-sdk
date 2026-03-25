---
def:
  id: df-time-analysis
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [decision]
  links:
    - target: df-state-model
      type: depends_on
    - target: df-system
      type: implements
---
# 시간축 분석

## 목적 ^purpose

gate별 체류 시간을 자동 측정하고, 결정 소요 시간과 완료→판정 지연을 분석한다. 과정(active→completed)과 결론(verdict)의 시간축이 다름을 시스템이 인식한다.

## 구성 ^overview

- **durationMs 자동 측정**: CLI에서 이전 selection timestamp ~ 현재 시각으로 계산하여 FlowEngine에 전달
- **flow history**: 소요 시간 컬럼 (총 start~complete 시간)
- **flow verdict**: 총 소요, gate별 체류 시간, 완료→판정 지연 시간 표시
- **시간 기반 성공 기준**: "1주일 내 버그 미발생", "1개월 내 인시던트 없음" 등 시간 조건의 deferred 판정
