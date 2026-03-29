---
def:
  id: monitor-data
  address: def_document:v2:343043
  scope: data
  aspect: system_data
  depth: overview
  lifecycle: approved
  layer: operation
  svc: monitor
  tags: [external]
  links:
    - target: monitor-service-spec
      type: refines
---
# Monitor — data/system_data

## 목적 ^purpose

모니터링 시각화 데이터. 세션 집계, 트레이스 메타, 이벤트 스트림 버퍼.

## 구성 ^overview

Monitor — data/system_data의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
