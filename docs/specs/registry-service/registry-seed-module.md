---
def:
  tier: component
  id: registry-seed-module
  address: def_document:v2:68875
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: operation
  svc: registry-service
  tags: [runtime, migration, observability]
  links:
    - target: registry-service-modules
      type: refines
sources:
  - packages/registry-service/src/modules/seed/seed.module.ts
  - packages/registry-service/src/modules/seed/seed.service.ts
  - packages/registry-service/src/runtime.module.ts
  - packages/registry-service/src/core/index.ts
  - packages/registry-service/src/core/seed-catalog.ts
  - packages/registry-service/src/core/seed-config.ts
  - packages/registry-service/src/core/seed-endpoints.ts
  - packages/registry-service/src/core/seed-events.ts
  - packages/registry-service/src/modules/seed/seed.service.unit.test.ts
  - packages/registry-service/src/modules/seed/seed.service.test.ts
---
# Registry Seed Module

## 목적 ^purpose

서버 부팅 시 demo catalog, axis, config, endpoints, event schemas를 자동으로 seed하고 definition-service sync를 트리거해 개발 런타임이 즉시 사용 가능한 초기 상태로 올라오게 한다. startup side effect를 runtime 경로에만 제한하는 것이 이 모듈의 핵심 역할이다.

## 사용 맥락 ^context

서버 시작 시 초기 데이터가 어디에서 채워지는지, 왜 `AppModule`이 아니라 `RuntimeModule`이 seed를 합성하는지 확인할 때 이 문서를 본다. integration test는 빈 DB를 가정하지만 실제 런타임은 seed가 필요하므로, 그 분리를 이해해야 할 때 가장 직접적인 참조가 된다.

## 설계 의도 ^intent

`SeedModule`은 `CatalogModule`, `AxisModule`, `ServiceModule`, `EventModule`이 export하는 store/provider만 재사용하고, 새 store 조립을 추가하지 않는다. `SeedService`는 `OnModuleInit`에서 startup 작업을 수행하고 seed 완료 후 `DefinitionClient.triggerSync()`를 fail-open으로 호출해 문서 동기화 실패가 런타임 기동을 막지 않게 한다.

## 구성 ^overview

- imports: `CatalogModule`, `AxisModule`, `ServiceModule`, `EventModule`
- provider: `SeedService`
- runtime 연결:
  - `RuntimeModule`이 `AppModule + SeedModule`을 합성한다.
  - `AppModule` 자체에는 seed side effect를 넣지 않는다.
- startup 작업:
  - `seedDemoCatalog()`
  - `seedConfigs()`
  - `seedEndpoints()`
  - `seedEventSchemas()`
  - `definitionClient.triggerSync()`

## 관련 소스

- `packages/registry-service/src/modules/seed/seed.module.ts` — runtime seed 모듈 정의
- `packages/registry-service/src/modules/seed/seed.service.ts` — seed 실행과 definition-service sync 트리거
- `packages/registry-service/src/runtime.module.ts` — `AppModule + SeedModule` 합성
- `packages/registry-service/src/core/index.ts` — seed 함수 export
