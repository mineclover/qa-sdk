---
def:
  id: infra-service-operations
  type: knowledge
  knowledge_kind: guide
  tier: system
  scope: flow
  aspect: user_scenario
  depth: overview
  lifecycle: approved
  layer: operation
  tags: [entry-point, runtime]
  links:
    - target: infra-engine-pipeline
      type: depends_on
    - target: infra-port-allocation
      type: contains
    - target: cf-workers-deployment
      type: contains
    - target: service-profile
      type: contains
    - target: store-driver-selection
      type: contains
    - target: codec-proto
      type: contains
    - target: verdaccio-local-npm
      type: contains
    - target: infra-engine-system
      type: depends_on
---

# 서비스 운영 참조

## 목적 ^purpose

서비스 포트 할당, URL 관리, 스토어/인사이트 드라이버 선택, Protobuf 전송 포맷, 로컬 npm 배포 절차의 진입점이다.

## 구성 문서 ^overview

| 문서 | 내용 |
|------|------|
| [infra-port-allocation.spec.md](infra-port-allocation.spec.md) | 서비스 포트 할당 (K3s + CF Workers) |
| [cf-workers-deployment.spec.md](cf-workers-deployment.spec.md) | CF Workers 배포 특성, 번들 크기, 엔드포인트 피드백 |
| [service-profile.spec.md](service-profile.spec.md) | Service Profile URL 중앙 관리, 모드 전환 |
| [store-driver-selection.spec.md](store-driver-selection.spec.md) | STORE_DRIVER, INSIGHTS_DRIVER 선택 가이드 |
| [codec-proto.spec.md](codec-proto.spec.md) | Protobuf 포맷 감지, 로컬→JSON / 원격→Proto |
| [verdaccio-local-npm.spec.md](verdaccio-local-npm.spec.md) | Verdaccio 로컬 NPM 배포 워크플로우 |
