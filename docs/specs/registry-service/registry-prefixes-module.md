---
def:
  tier: component
  id: registry-prefixes-module
  address: def_document:v2:68874
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: domain
  svc: registry-service
  tags: [runtime, structural, versioning]
  links:
    - target: registry-service-modules
      type: refines
sources:
  - packages/registry-service/src/modules/prefixes/prefix.module.ts
  - packages/registry-service/src/modules/prefixes/prefix.service.ts
  - packages/registry-service/src/modules/prefixes/prefix.controller.ts
  - packages/registry-service/src/lib/registry-service.ts
  - packages/registry-service/src/modules/prefixes/prefix.controller.test.ts
---
# Registry Prefixes Module

## 목적 ^purpose

prefix 등록, 조회, profile patch, 삭제를 Nest 경계에서 일관되게 제공해 prefix owner 메타데이터와 version registry를 같은 규칙으로 관리한다. 특히 삭제 시 reverse reference를 확인해 종속 composite/version을 보호하는 것이 이 모듈의 중요한 역할이다.

## 사용 맥락 ^context

`/prefixes` CRUD를 구현하거나 prefix profile 변경이 다른 lifecycle API와 어떻게 맞물리는지 추적할 때 이 모듈을 본다. prefix 삭제 회귀를 조사할 때도 owner store만이 아니라 `RegistryService` 내부 reverse-ref 검사까지 포함한 실제 삭제 경로를 여기서 따라간다.

## 설계 의도 ^intent

이 모듈은 별도 provider 토큰을 늘리지 않고 `PrefixService`가 `DATABASE`에서 필요한 SQL store를 조립한 뒤 기존 `RegistryService`를 thin wrapper로 재사용한다. prefix API가 결국 registry core 규칙의 얇은 transport여야 하므로, Nest 전용 DTO나 별도 domain 계층을 만들지 않고 기존 service semantics를 유지하는 쪽을 택했다.

## 구성 ^overview

- controller: `PrefixController`
- provider/export: `PrefixService`
- surface:
  - `POST /prefixes`
  - `GET /prefixes`
  - `GET /prefixes/:prefix`
  - `PATCH /prefixes/:prefix`
  - `DELETE /prefixes/:prefix`
- 핵심 규칙:
  - 삭제 전 prefix의 모든 버전에 대해 reverse ref를 검사한다.
  - prefix profile patch와 version 조회는 같은 `RegistryService`를 통해 일관되게 처리한다.

## 관련 소스

- `packages/registry-service/src/modules/prefixes/prefix.module.ts` — Nest 모듈 정의
- `packages/registry-service/src/modules/prefixes/prefix.service.ts` — `RegistryService` wrapper와 삭제 로그
- `packages/registry-service/src/modules/prefixes/prefix.controller.ts` — `/prefixes` HTTP adapter
- `packages/registry-service/src/lib/registry-service.ts` — prefix 삭제 보호와 core registry 규칙
