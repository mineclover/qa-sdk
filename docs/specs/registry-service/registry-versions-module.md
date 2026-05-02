---
def:
  tier: component
  id: registry-versions-module
  address: def_document:v2:68877
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: domain
  svc: registry-service
  tags: [runtime, versioning, structural]
  links:
    - target: registry-service-modules
      type: refines
---
# Registry Versions Module

## 목적 ^purpose

prefix 버전의 draft 생성, 수정, lock/unlock, release, activate, deprecate 흐름을 Nest 모듈로 캡슐화해 버전 라이프사이클을 단일 진입점에서 유지한다. activation gate와 post-activation hook, definition-service consumption 기록까지 이 모듈이 lifecycle 연산에 결합한다.

## 사용 맥락 ^context

`/prefixes/:prefix/versions` 하위 경로를 수정하거나 activation 시 부수효과가 어디에서 연결되는지 볼 때 사용한다. constraint gate나 post-activation DKG hook처럼 env-gated optional integration이 transport와 무관하게 공유돼야 할 때도 이 모듈이 기준점이 된다.

## 설계 의도 ^intent

`VersionModule`은 store provider 토큰과 optional port builder를 명시적으로 분리한다. `buildActivationGatePort()`와 `buildPostActivationHookPort()`를 공용화해 런타임별 dynamic import 복제를 없애고, `VersionService`는 `RegistryService` wrapper에 `DefinitionClient` fail-open 호출만 얹어 activation 후 관측 기록을 남긴다.

CLI의 `dkg version` 표면은 이 모듈의 `GET /prefixes/:prefix/versions/:versionId` + transition endpoint를 함께 사용해 `beforeStatus -> afterStatus`를 감사 로그에 남긴다.

## 구성 ^overview

- controller: `VersionController`
- providers:
  - `VERSION_PREFIX_REGISTRY`
  - `VERSION_LIFECYCLE_STORE`
  - `VERSION_PREFIX_OWNER_STORE`
  - `VERSION_DRAFT_LOCK_STORE`
  - `VERSION_ACTIVATION_GATE`
  - `VERSION_POST_ACTIVATION_HOOK`
  - `ActivationGateService`
  - `PostActivationHookService`
  - `VersionService`
- surface:
  - `POST /prefixes/:prefix/versions`
  - `GET /prefixes/:prefix/versions`
  - `GET /prefixes/:prefix/versions/:versionId`
  - `PATCH /prefixes/:prefix/versions/:versionId`
  - `POST /prefixes/:prefix/versions/:versionId/lock`
  - `POST /prefixes/:prefix/versions/:versionId/unlock`
  - `POST /prefixes/:prefix/versions/:versionId/release`
  - `POST /prefixes/:prefix/versions/:versionId/activate`
  - `POST /prefixes/:prefix/versions/:versionId/deprecate`

## 관련 소스

- `packages/registry-service/src/modules/versions/version.module.ts` — store/provider와 optional port 조립
- `packages/registry-service/src/modules/versions/version.service.ts` — lifecycle wrapper와 definition-service consumption 기록
- `packages/registry-service/src/modules/versions/version.controller.ts` — versions HTTP adapter
- `packages/registry-service/src/modules/versions/activation-gate.service.ts` — constraint gate builder
- `packages/registry-service/src/modules/versions/post-activation-hook.service.ts` — post-activation hook builder
- `packages/registry-service/src/lib/registry-service.ts` — 실제 version lifecycle 규칙
