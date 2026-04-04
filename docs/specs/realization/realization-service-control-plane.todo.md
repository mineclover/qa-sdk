---
def:
  id: realization-service-control-plane
  level: module
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: implemented
  tags: [runtime, contract, deployment]
---
# Service Control Plane — 구현 TODO

## 목적 ^purpose

runtime/deployment address system 설계를 실행 가능한 작업 단위로 분해하고, 서비스 단위 정의를 child component 중 하나로 내린 뒤 component 조합으로 manifest를 생성하는 구조를 구현 대상으로 고정한다.

## 분해된 TODO

구현 완료된 facet은 대응 `.spec.md`로 승격했다. 이 TODO는 실제 서비스별 cleanup rollout과 운영 정리 잔여만 추적한다.

## 공통 작업

- [x] child component별 id/scope/aspect를 분리하고 store/API surface를 구현했다.
- [x] warning / cleanup-plan / cleanup-draft / cleanup-activate / dashboard / CLI lane을 구현했다.
- [x] cleanup 흐름을 `service-control-plane-cleanup.test.md` 시나리오로 고정했다.
- [x] 실제 서비스별 cleanup rollout 결과를 문서/운영 플레이북에 반영한다.
- [x] 구현 완료된 leaf 패싯을 대응 `.spec.md`로 승격했다.
