---
def:
  id: pipeline-monitoring
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  tags: [observability]
---
# 파이프라인 자체 모니터링

## 목적 ^purpose

파이프라인 자체의 관측 메트릭. Phase 1/2 처리량, 지연, DLQ 크기, 재시도 횟수, reconstruction 성공률을 수집한다.
