---
def:
  tier: component
  id: registry-catalog-module
  address: def_document:v2:68871
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: domain
  svc: registry-service
  tags: [runtime, structural, entry-point]
  links:
    - target: registry-service-modules
      type: refines
---
# Registry Catalog Module

## 목적 ^purpose

catalog 정의와 그에 부속된 config/decode-map surface를 Nest 모듈 하나로 묶어 `registry-service`가 catalog를 CRUD 가능한 런타임 SSOT로 유지하게 한다. catalog 데이터와 config store를 같은 경계에서 다루되, transport별 로직 복제를 피하는 것이 이 모듈의 핵심 가치다.

## 사용 맥락 ^context

`/catalogs`, `/catalogs/:id/config`, `/catalogs/:id/pattern-rules`, `/api/decode-map` 요청이 들어오면 이 모듈이 진입점이 된다. catalog 수정이 dev dashboard cache나 후속 분석에 영향을 줄 수 있으므로, catalog 변경 알림이 필요한 기능도 이 모듈을 통해 연결한다.

## 설계 의도 ^intent

`CatalogService`가 `SqlCatalogStore`와 `SqlConfigStore`를 직접 감싸고, `CatalogChangeNotifier`를 optional handler로 붙여 controller는 thin adapter로 남긴다. decode map 계산은 별도 `DecodeMapService`로 분리해 catalog CRUD와 조회 전개 로직을 섞지 않고, Nest와 다른 transport가 같은 store/service 계층을 재사용할 수 있게 한다.

## 구성 ^overview

- controllers: `CatalogController`, `DecodeMapController`
- providers: `CATALOG_STORE`, `CONFIG_STORE`, `CATALOG_CHANGE_HANDLER`, `CatalogService`, `DecodeMapService`
- exports: `CatalogService`, `DecodeMapService`, `CATALOG_STORE`, `CONFIG_STORE`
- surface:
  - `POST/GET/PUT/DELETE /catalogs`
  - `GET/PUT /catalogs/:id/config`
  - `GET/PUT /catalogs/:id/pattern-rules`
  - `GET /catalogs/:id/prefixes`
  - `GET /catalogs/:id/configs`
  - `GET /api/decode-map`
  - `GET /api/decode-map/:prefix/:version`

## 관련 소스

- `packages/registry-service/src/modules/catalog/catalog.module.ts` — store/provider 조립
- `packages/registry-service/src/modules/catalog/catalog.service.ts` — catalog/config CRUD와 change notifier 연계
- `packages/registry-service/src/modules/catalog/catalog.controller.ts` — `/catalogs` HTTP adapter
- `packages/registry-service/src/modules/catalog/decode-map.service.ts` — prefix/version decode map 계산
- `packages/registry-service/src/modules/catalog/decode-map.controller.ts` — `/api/decode-map` HTTP adapter
- `packages/registry-service/src/modules/catalog/catalog.change-notifier.ts` — dashboard 연동용 변경 알림
