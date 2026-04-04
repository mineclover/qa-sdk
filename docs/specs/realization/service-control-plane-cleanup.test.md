---
def:
  id: service-control-plane-cleanup-test
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  links:
    - target: realization-service-control-plane
      type: refines
    - target: service-manifest-cleanup-lane
      type: refines
---
# Service Control Plane Cleanup — 검증 기준

## 목적 ^purpose

deprecated child component를 새 published version으로 교체하고, cleanup draft를 non-destructive하게 생성/활성화하는 운영 흐름을 시나리오 단위로 고정한다.

## 대응 테스트 파일

- `packages/registry-service/src/modules/resolve/resolve.controller.test.ts`
- `packages/registry-service/src/modules/dashboard/dashboard.controller.test.ts`
- `packages/cli/src/commands/service.test.ts`

## 시나리오

### S-001: deprecated 참조 경고 노출

- **describe**: `ResolveController service release read model`
- **it**: `exposes deprecated component references on a separate warning surface`
- **전제**: active manifest가 deprecated `exposure` version을 참조
- **기대**: `GET /resolve/services/:serviceId/warnings`가 `DEPRECATED_COMPONENT_REFERENCE` warning과 summary를 반환

### S-002: cleanup plan 제안

- **describe**: `ResolveController service release read model`
- **it**: `builds a cleanup plan with suggested replacement versions`
- **전제**: deprecated component를 대체할 published component가 하나 존재
- **기대**: `cleanup-plan`이 `replaceable` 상태와 `suggestedVersion`을 반환

### S-003: non-destructive cleanup draft 생성

- **describe**: `ResolveController service release read model`
- **it**: `creates a non-destructive cleanup draft manifest`
- **전제**: active manifest + replacement candidate 존재
- **기대**: `cleanup-draft`가 새 manifest version을 `draft` 상태로 생성, 기존 active는 유지

### S-004: cleanup draft 활성화

- **describe**: `ResolveController service release read model`
- **it**: `activates a cleanup draft and supersedes the previous active manifest`
- **전제**: cleanup draft가 있고 deprecated warning이 모두 해소됨
- **기대**: 이전 active는 superseded, 새 manifest는 active, warning count는 0

### S-005: cleanup activation 차단

- **describe**: `ResolveController service release read model`
- **it**: `blocks cleanup activation when deprecated references remain`
- **전제**: target manifest가 아직 deprecated component를 참조
- **기대**: `cleanup-activate`는 409로 차단

### S-006: assembly candidate 설명력

- **describe**: `ServiceComponentService`
- **it**: `assembly candidates는 published와 제외 사유를 함께 반환한다`
- **전제**: published 1개, draft 1개 이상 존재
- **기대**: `assembly-candidates`가 `published`, `excluded`, `reason`, `readiness`, `summary`를 함께 반환

### S-007: CLI cleanup orchestration

- **describe**: `service cleanup CLI`
- **it**: `cleanup-execute는 plan → draft → activate 순으로 호출한다`
- **전제**: registry cleanup lane이 사용 가능
- **기대**: CLI가 세 경로를 순서대로 호출하고 결과를 출력
