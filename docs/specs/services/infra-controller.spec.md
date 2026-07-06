---
def:
  id: infra-controller-spec
  tier: system
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
sources:
  - simulations/enterprise-pm/services/canary-controller/src/app.module.ts
  - simulations/enterprise-pm/services/canary-controller/src/cycle/cycle-scheduler.service.ts
  - simulations/enterprise-pm/services/canary-controller/src/cycle/cycle-scheduler.ring-buffer.test.ts
  - simulations/enterprise-pm/services/canary-controller/src/action/action-executor.service.ts
  - simulations/enterprise-pm/services/canary-controller/src/action/action-executor.test.ts
  - simulations/enterprise-pm/services/canary-controller/src/decision/safety-decision.service.ts
  - simulations/enterprise-pm/services/canary-controller/src/decision/safety-decision.test.ts
  - simulations/enterprise-pm/services/canary-controller/src/decision/resource-decision.service.ts
  - simulations/enterprise-pm/services/canary-controller/src/decision/resource-decision.test.ts
  - simulations/enterprise-pm/services/canary-controller/src/verdict/category-verdict.service.ts
  - simulations/enterprise-pm/services/canary-controller/src/verdict/category-verdict.test.ts
  - simulations/enterprise-pm/services/canary-controller/src/integration/cycle-flow.test.ts
  - simulations/enterprise-pm/services/canary-controller/src/integration/stage-1b.smoke.test.ts
---
# Infra Controller

## 목적 ^purpose

인프라 운영 자동화 컨트롤러. deploy_event, health_event, pipeline_point 등 10개 prefix를 소유하여 배포/헬스/파이프라인/패턴 감지 이벤트를 생산한다. DevOps 팀이 관리한다.

## 구성 ^overview

Infra Controller의 핵심 책임, 경계, 주요 구성 요소를 한 문서에서 빠르게 파악할 수 있도록 정리한다.
