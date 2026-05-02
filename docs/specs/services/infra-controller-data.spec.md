---
def:
  tier: component
  id: infra-controller-data
  address: def_document:v2:343042
  scope: data
  aspect: system_data
  depth: overview
  lifecycle: approved
  layer: operation
  svc: infra-controller
  tags: [external]
  links:
    - target: infra-controller-spec
      type: refines
---
# Infra Controller — data/system_data

## 목적 ^purpose

인프라 운영 데이터. 배포 이벤트, 헬스 체크, 파이프라인 메트릭.

## 구성 ^overview

Infra Controller — data/system_data의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
