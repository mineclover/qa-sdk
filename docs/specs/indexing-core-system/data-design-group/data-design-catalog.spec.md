---
def:
  tier: component
  id: data-design-catalog
  address: def_document:v2:342154
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [data, structural, runtime]
  links:
    - target: coord-foundation
      type: depends_on
    - target: data-design-group
      type: refines
sources:
  - packages/weighted-index/src/index.ts
  - packages/weighted-index/src/math/weighted-index.ts
  - packages/weighted-index/src/math/weighted-index.test.ts
  - packages/weighted-index/src/math/calc.ts
  - packages/weighted-index/src/math/calc.test.ts
  - packages/weighted-index/package.json
  - packages/weighted-index/src/vocab/label-registry.ts
  - packages/weighted-index/src/vocab/label-registry.test.ts
  - packages/weighted-index/src/vocab/prefix-registry.ts
  - packages/weighted-index/src/vocab/prefix-registry.test.ts
  - packages/weighted-index/src/vocab/partial-binder.ts
  - packages/weighted-index/src/vocab/partial-binder.test.ts
  - packages/index-meta/src/meta-registry.ts
  - packages/index-meta/src/meta-registry.test.ts
  - packages/index-meta/src/meta-resolver.ts
  - packages/index-meta/src/meta-resolver.test.ts
  - packages/index-meta/src/meta-codec.ts
  - packages/index-meta/src/meta-codec.test.ts
  - packages/index-meta/src/address-protocol-manager.ts
  - packages/index-meta/src/address-protocol-manager.test.ts
  - packages/address-index/src/index.ts
  - packages/address-index/src/types.ts
  - packages/address-index/src/port.ts
  - packages/address-index/src/memory-store.ts
  - packages/address-index/src/address-index.test.ts
  - packages/address-index/package.json
  - packages/tag-search/src/index.ts
  - packages/tag-search/src/types.ts
  - packages/tag-search/src/port.ts
  - packages/tag-search/src/memory-store.ts
  - packages/tag-search/src/search.test.ts
  - packages/tag-search/package.json

---

# 좌표 데이터 설계 - 카탈로그와 운영 원칙

## 목적 ^purpose

주소와 entity 이름의 양방향 매핑, 카탈로그 구축 흐름, prefix 기반 운영 원칙을 데이터 설계 관점에서 정리한다.

## 카탈로그 역할

- 좌표 주소만으로는 의미를 읽을 수 없으므로 entity 이름과 주소의 양방향 매핑이 필요하다.
- prefix 카탈로그는 축 정의, 버전, export surface를 한 번에 묶어 런타임과 코드젠의 공통 입력이 된다.
- 의미 부여는 주소 체계와 별도 레이어로 두되, 역참조가 가능해야 운영 도구가 설명력을 갖는다.

## 구축 흐름

- 설계자는 축과 capacity를 먼저 고정하고, 그 위에 prefix와 entity 매핑을 올린다.
- 운영 단계에서는 prefix 버전이 늘어나도 기존 주소가 깨지지 않도록 카탈로그를 append-only에 가깝게 관리한다.
- 설계 원칙은 "구조는 닫히고, 의미는 카탈로그에서 열린다"는 분리를 유지하는 데 있다.

## 운영 규칙

- 상위 시스템은 카탈로그를 단일 SSOT로 보고 codegen, decode, query가 모두 같은 메타데이터를 읽어야 한다.
- 축 추가나 prefix 변형은 주소 공간 자체보다 카탈로그 파생 체인에 먼저 영향을 준다고 간주한다.
- 압축/범위 제어 규칙은 `data-design-compression`, 통합 카탈로그 운영은 이 문서가 맡는다.
