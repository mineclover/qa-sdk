---
def:
  id: monitor-data
  address: def_document:v1:2680
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
