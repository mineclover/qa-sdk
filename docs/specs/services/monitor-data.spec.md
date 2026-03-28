---
def:
  id: monitor-data
  scope: data
  aspect: system_data
  depth: overview
  lifecycle: approved
  layer: operation
  svc: monitor
  tags: [tier-infra]
  links:
    - target: monitor-service-spec
      type: refines
---
# Monitor — data/system_data

## 목적 ^purpose

모니터링 시각화 데이터. 세션 집계, 트레이스 메타, 이벤트 스트림 버퍼.
