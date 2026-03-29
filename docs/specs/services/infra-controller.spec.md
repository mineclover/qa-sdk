---
def:
  id: infra-controller-spec
  level: module
  address: def_document:v2:68634
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: operation
  svc: infra-controller
  tags: [external]
  links:
    - target: system-infra
      type: refines
    - target: infra-controller-api
      type: contains
    - target: infra-controller-data
      type: contains
---
# Infra Controller

## 목적 ^purpose

인프라 운영 자동화 컨트롤러. deploy_event, health_event, pipeline_point 등 10개 prefix를 소유하여 배포/헬스/파이프라인/패턴 감지 이벤트를 생산한다. DevOps 팀이 관리한다.

## 구성 ^overview

Infra Controller의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
