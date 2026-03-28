---
def:
  id: registry-workspace-module
  address: def_document:v1:538
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: domain
  svc: registry-service
  tags: [tier-infra]
  links:
    - target: registry-service-modules
      type: refines
---
# Registry Workspace Module

## 목적 ^purpose

draft workspace 시뮬레이션과 분석, 일괄 lock/release 흐름을 별도 모듈로 분리해 prefix version 변경의 파급 효과를 한 번에 계산하게 한다. registry core를 직접 노출하지 않고 workspace 중심의 orchestration surface를 제공하는 것이 이 모듈의 역할이다.

## 사용 맥락 ^context

`/workspace` 하위 경로에서 draft 영향 범위를 계산하거나 전체 release order를 추적할 때 이 문서를 본다. 개별 version API가 아니라 여러 draft를 묶어서 다루는 로직이 어디에 있는지, 그리고 simulate/analyze가 어떤 registry store 조합을 사용하는지 확인할 때도 기준점이 된다.

## 설계 의도 ^intent

`WorkspaceService`는 독립 store 계층을 새로 만들지 않고 `RegistryService`와 `draft-workspace` 라이브러리를 조합하는 thin orchestration 서비스로 남긴다. 이렇게 해야 simulate/analyze가 version/prefix core semantics를 재구현하지 않고, lockAll/releaseAll도 기존 lifecycle 규칙을 그대로 재사용할 수 있다.

## 구성 ^overview

- controller: `WorkspaceController`
- provider/export: `WorkspaceService`
- surface:
  - `GET /workspace/drafts`
  - `POST /workspace/simulate`
  - `POST /workspace/analyze`
  - `POST /workspace/lock-all`
  - `POST /workspace/release-all`

## 관련 소스

- `packages/registry-service/src/modules/workspace/workspace.module.ts` — driver 기반 provider 조립
- `packages/registry-service/src/modules/workspace/workspace.service.ts` — simulate/analyze/lock/release orchestration
- `packages/registry-service/src/modules/workspace/workspace.controller.ts` — `/workspace` HTTP adapter
- `packages/registry-service/src/lib/draft-workspace.ts` — draft workspace 계산 함수
- `packages/registry-service/src/lib/registry-service.ts` — lock/release core 규칙
