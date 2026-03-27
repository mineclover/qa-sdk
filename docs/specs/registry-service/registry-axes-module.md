---
def:
  id: registry-axes-module
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
# Registry Axes Module

## 목적 ^purpose

catalog namespace 아래의 axis profile CRUD와 entry headroom 관리를 별도 모듈로 분리해 axis 상태를 catalog의 부속 메타데이터로 운영한다. capacity 대비 entryCount를 기반으로 headroom 경고를 유지하는 것이 이 모듈의 핵심이다.

## 사용 맥락 ^context

`/catalogs/:catalogId/axes` 경로를 다루거나 axis profile 변경이 dashboard 갱신으로 이어지는 경로를 확인할 때 이 문서를 본다. `catalogId`가 존재 검증 대상이 아니라 axis store namespace key라는 semantics를 기억해야 하는 API라서, route만 보고 판단하면 안 되는 경우에 특히 중요하다.

## 설계 의도 ^intent

`AxisService`는 `AxisProfileStore`와 optional change handler만 주입받아 catalog 격리 semantics를 store 경계에 그대로 위임한다. axis 추가/patch/entry 추가/삭제에서 `catalogId`를 단순 namespace로 다루고, entry 추가 시에는 현재 headroom을 계산해 409 payload에 그대로 포함시켜 기존 API 계약을 유지한다.

## 구성 ^overview

- controller: `AxisController`
- providers/export: `AXIS_STORE`, `AXIS_CHANGE_HANDLER`, `AxisService`
- surface:
  - `GET /catalogs/:catalogId/axes`
  - `GET /catalogs/:catalogId/axes/:id`
  - `POST /catalogs/:catalogId/axes`
  - `PATCH /catalogs/:catalogId/axes/:id`
  - `POST /catalogs/:catalogId/axes/:id/entries`
  - `DELETE /catalogs/:catalogId/axes/:id`
- 핵심 규칙:
  - `catalogId`는 axis store namespace key다.
  - `entryCount >= capacity`면 headroom 0과 함께 409를 반환한다.

## 관련 소스

- `packages/registry-service/src/modules/axes/axis.module.ts` — axis store/provider 조립
- `packages/registry-service/src/modules/axes/axis.service.ts` — namespace/headroom semantics
- `packages/registry-service/src/modules/axes/axis.controller.ts` — `/catalogs/:catalogId/axes` HTTP adapter
- `packages/registry-service/src/modules/axes/axis.change-notifier.ts` — dashboard 연동용 변경 알림
