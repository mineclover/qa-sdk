---
def:
  tier: component
  id: definition-service-quality-contract
  scope: interface
  aspect: api_contract
  depth: specification
  svc: definition-service
  lifecycle: approved
  layer: mediation
  tags: [testing, contract, work-domain:productivity]
  links:
    - target: definition-service-quality-bundle
      type: refines
sources:
  - packages/definition-service/src/main.ts
  - packages/definition-service/src/app.module.ts
  - packages/definition-service/src/modules/docs/docs.service.ts
  - packages/definition-service/src/modules/sync/sync.service.ts
  - packages/definition-service/src/modules/search/search.service.ts
  - packages/definition-service/src/modules/graphql/doc.resolver.ts
  - packages/definition-catalog/src/scan-real.test.ts
  - packages/definition-catalog/src/cli-tools-real.test.ts
---
# Definition Service Public Contract


## 탐색 ^navigation

quality-gates-system > definition-service-quality-bundle > **definition-service-quality-contract**

형제: `gate-definition-service-build` · `gate-definition-service-sync` · `gate-definition-service-context`

## 목적 ^purpose

`definition-service`가 외부 소비자에게 약속하는 docs/graph/sync/search/GraphQL surface를 한 문서로 고정하여 quality gate의 기준점을 제공한다.

## 구성 ^overview

핵심 계약은 `DocsService`, `SyncService`, `SearchService`, `DocResolver`, `POST /sync`, `GET /docs`, `POST /graphql`이다.
validation gate 문서는 이 계약이 build, 문서 스캔, 컨텍스트 조회 수준에서 유지되는지 검증한다.

## 입력 ^inputs

- docs 입력은 frontmatter가 있는 markdown 문서 집합과 메타데이터 patch다.
- sync 입력은 file→DB 또는 DB→file 방향의 전체 문서 집합이다.
- search/context 입력은 docId, 검색어, graph link 집합이다.

## 출력 ^outputs

- docs surface는 문서 목록, 단건, 계층, 링크, 이력 조회를 제공한다.
- sync surface는 file→DB / DB→file 동기화 결과를 반환한다.
- GraphQL/검색 surface는 문서/영향/concern/context 조회를 제공한다.

## 사전 조건 ^precondition

- definition-service package는 build 후 실행 가능한 dist 산출물을 생성해야 한다.
- 문서 그래프는 scanAndBuild 기준으로 깨지지 않아야 한다.
- quality bundle은 이 계약을 기준으로 build/sync/context 게이트를 실행한다.

## 사후 조건 ^postcondition

- build gate는 definition-service 산출물과 타입이 일관되게 생성됨을 보장한다.
- sync gate는 docs 스캔과 frontmatter 파싱이 깨지지 않음을 보장한다.
- context gate는 문서 컨텍스트/영향/의존 조회가 실제 docs 그래프에서 동작함을 보장한다.

## 증거 요구 ^evidence

- `qa-sdk quality claims definition-service-quality-bundle` 결과에 claim이 1건 이상 있어야 한다. [reversible]
- `gate-definition-service-build`, `gate-definition-service-sync`, `gate-definition-service-context`가 이 계약 문서를 `depends_on`으로 참조해야 한다. [reversible]
- 관련 구현 파일과 대응 테스트 또는 gate 실행 결과가 저장소/ledger에서 확인되어야 한다. [reversible]

## 관련 소스

- `definition-service/src/modules/docs/docs.service.ts`
- `definition-service/src/modules/sync/sync.service.ts`
- `definition-service/src/modules/search/search.service.ts`
- `definition-service/src/modules/graphql/doc.resolver.ts`
