---
def:
  id: service-manifest-assembly
  tier: system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  layer: operation
  links:
    - target: realization-service-control-plane
      type: refines
    - target: service-release-manifest
      type: refs
    - target: service-manifest-validation
      type: contains
    - target: service-manifest-cleanup-lane
      type: contains
contains:
  - service-manifest-validation
  - service-manifest-cleanup-lane
---
# Service Manifest Assembly

## 목적 ^purpose

이미 존재하는 child component version을 선택해 deterministic한 release manifest를 조립하는 흐름을 상위 개념으로 고정한다. validate/assemble 계약과 cleanup lane은 별도 leaf로 분리한다.

## 구성 ^overview

- `service-manifest-validation`: `validate`/`assemble` contract, ownership coverage, semantics key
- `service-manifest-cleanup-lane`: warning/cleanup-plan/cleanup-draft/cleanup-activate/CLI orchestration

## 분해 원칙

- validation/assemble은 deterministic contract facet이다.
- cleanup lane은 deprecated ref remediation facet이다.
- 둘 다 `service-release-manifest`를 전제로 하지만, 실패 조건과 운영 책임이 달라 별도 leaf로 추적한다.

## 관련 문서

- [service-manifest-validation.spec.md](service-manifest-validation.spec.md)
- [service-manifest-cleanup-lane.spec.md](service-manifest-cleanup-lane.spec.md)
