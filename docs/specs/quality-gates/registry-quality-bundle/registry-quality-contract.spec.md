---
def:
  tier: component
  id: registry-quality-contract
  scope: interface
  aspect: api_contract
  depth: specification
  svc: registry-service
  lifecycle: approved
  layer: mediation
  tags: [testing, contract, work-domain:productivity]
  links:
    - target: registry-quality-bundle
      type: refines
---
# Registry Service Public Contract


## 탐색 ^navigation

quality-gates-system > registry-quality-bundle > **registry-quality-contract**

형제: `gate-registry-build` · `gate-registry-test` · `gate-registry-service-flow`

## 목적 ^purpose

`registry-service`가 외부 소비자에게 약속하는 catalog/prefix/version/service topology/service-control-plane surface를 한 문서로 고정하여 quality gate의 기준점을 제공한다.

## 구성 ^overview

핵심 계약은 `CatalogService`, `PrefixService`, `VersionService`, `ServiceTopologyService`, `ManifestService`, `/catalogs`, `/prefixes`, `/api/services`, `/api/services/:serviceId/ownership/topology`, `/api/endpoints`, `/manifests/assemble`, `/manifests/validate`, `/resolve/services/:serviceId` 경로다.
validation gate 문서는 이 계약이 build/test/service-flow 수준에서 유지되는지 검증한다.

## 입력 ^inputs

- catalog 입력은 snapshot/config/pattern-rules와 prefix 집합이다.
- version 입력은 prefix/version lifecycle action과 activation hook 의존성이다.
- service topology 입력은 service entries, ownedPrefixes, endpoint overlay, gateway 구성이 다.
- service control plane 입력은 child component version, ownership prefix pin, runtime/deployment sync, manifest assembly body다.

## 출력 ^outputs

- catalog surface는 registry catalog CRUD와 decode-map 응답을 제공한다.
- prefix/version surface는 lifecycle/profile 조회와 activate/release 결과를 제공한다.
- service surface는 topology, svc-owner, endpoint resolve, gateway 구성을 제공한다.
- service-control-plane surface는 child component lifecycle, manifest validation/assembly, cleanup/resolve 진단을 제공한다.

## 사전 조건 ^precondition

- registry-service package는 build 후 실행 가능한 dist 산출물을 생성해야 한다.
- catalog/prefix/service store는 seed 이후 일관된 초기 상태를 유지해야 한다.
- quality bundle은 이 계약을 기준으로 build/test/service-flow 게이트를 실행한다.

## 사후 조건 ^postcondition

- build gate는 registry-service 산출물과 타입이 일관되게 생성됨을 보장한다.
- test gate는 app/sql/e2e/store 핵심 동작이 유지됨을 보장한다.
- service-flow gate는 catalog/service/dashboard 흐름이 실제 테스트에서 유지됨을 보장한다.

## 증거 요구 ^evidence

- `qa-sdk quality claims registry-quality-bundle` 결과에 claim이 1건 이상 있어야 한다. [reversible]
- `gate-registry-build`, `gate-registry-test`, `gate-registry-service-flow`가 이 계약 문서를 `depends_on`으로 참조해야 한다. [reversible]
- 관련 구현 파일과 대응 테스트 또는 gate 실행 결과가 저장소/ledger에서 확인되어야 한다. [reversible]

## 관련 소스

- `registry-service/src/app.module.ts`
- `registry-service/src/lib/registry-service.ts`
- `registry-service/src/stores/catalog-store.ts`
- `registry-service/src/stores/service-endpoint-store.ts`
