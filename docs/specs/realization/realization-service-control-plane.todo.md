---
def:
  id: realization-service-control-plane
  level: module
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: draft
  tags: [runtime, contract, deployment]
---
# Service Control Plane — 구현 TODO

## 목적 ^purpose

runtime/deployment address system 설계를 실행 가능한 작업 단위로 분해하고, 서비스 단위 정의를 child component 중 하나로 내린 뒤 component 조합으로 manifest를 생성하는 구조를 구현 대상으로 고정한다.

## 분해된 TODO

| 패싯 | 문서 | 역할 |
|------|------|------|
| 서비스 단위 | [service-unit-spec.todo.md](service-unit-spec.todo.md) | 서비스 논리 단위 정의 |
| 소유권 | [service-ownership-spec.todo.md](service-ownership-spec.todo.md) | prefix 생산/소비 |
| 노출 정책 | [service-exposure-spec.todo.md](service-exposure-spec.todo.md) | gateway/routing |
| runtime 주소 | [runtime-service-address.todo.md](runtime-service-address.todo.md) | qa-sdk 주소 모델 |
| deployment 주소 | [deployment-address.todo.md](deployment-address.todo.md) | 배포 target identity |
| deployment binding | [deployment-binding.todo.md](deployment-binding.todo.md) | URL/outputs overlay |
| release artifact | [service-release-manifest.todo.md](service-release-manifest.todo.md) | versioned manifest |
| 조립 규칙 | [service-manifest-assembly.todo.md](service-manifest-assembly.todo.md) | assembly/resolve contract |

## 공통 작업

- [ ] child component별 id/scope/aspect가 definition-catalog 규칙에 맞는지 검토한다.
- [ ] leaf TODO 간 중복 항목을 줄이고, 공통 검증 규칙은 `service-manifest-assembly.todo.md`로 모은다.
- [ ] 완료된 패싯부터 `.spec.md`로 승격하고, 상위 index는 `realization-service-control-plane.spec.md`에서 유지한다.
