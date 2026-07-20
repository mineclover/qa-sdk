---
def:
  id: coord-foundation
  address: def_document:v2:342153
  scope: data
  aspect: domain_data
  depth: overview
  tier: system
  svc: weighted-index
  lifecycle: approved
  layer: domain
  tags: [entry-point]
  links:
    - target: coord-closed-space
      type: contains
    - target: coord-stride-stability
      type: contains
    - target: coord-version-series
      type: contains
    - target: coord-layer-separation
      type: contains
    - target: coord-acceleration-design
      type: contains
    - target: coord-id-allocation-design
      type: contains
    - target: coord-semantic-indexing-logic
      type: contains
    - target: coord-semantic-indexing-pack
      type: contains
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
  - packages/weighted-index/src/protocol/semantic-address.ts
  - packages/weighted-index/src/protocol/semantic-address.test.ts
  - packages/weighted-index/src/protocol/pack-format.ts
  - packages/weighted-index/src/protocol/pack-format.test.ts
  - packages/weighted-index/src/protocol/capacity-planner.ts
  - packages/weighted-index/src/protocol/capacity-planner.test.ts
  - packages/index-meta/src/meta-registry.ts
  - packages/index-meta/src/meta-registry.test.ts
  - packages/index-meta/src/meta-resolver.ts
  - packages/index-meta/src/meta-resolver.test.ts
  - packages/index-meta/src/meta-codec.ts
  - packages/index-meta/src/meta-codec.test.ts
  - packages/index-meta/src/address-protocol-manager.ts
  - packages/index-meta/src/address-protocol-manager.test.ts

---

# 좌표 시스템 기반 원리

## 목적 ^purpose

이 시스템은 **좌표 시스템(Coordinate System)**이다.
유한한 개념 조합에 정수 주소를 부여하고, 주소를 해석하고, 주소 공간을 버전 관리한다.
**데이터를 저장하지 않는다.** 저장은 이 좌표 위에 구축되는 별도 계층의 책임이다.

Axis와 Prefix는 개념 계층(Entry → Taxonomy → System)에 적용되는 **좌표 표현 수단**이다. 계층 자체가 아니라, 각 계층 단위에 주소를 부여하는 방법이다. Axis = 1D 표현, Prefix = nD 표현. 계층 원칙: [composition-hierarchy.spec.md](../system/composition-hierarchy.spec.md)

사용 패턴: [`patterns.md`](patterns.md) · 프로젝트 관례: [`conventions-system.md`](conventions-system.md) · 설계 구조: [`data-design.md`](data-design-group.md)

- [`weighted-index/`](../indexing/weighted-index/README.md)
- [`index-meta/`](../indexing/index-meta/README.md)

## 구성 ^overview

- **닫힌 조합 공간**: 설계 시점에 상한이 고정된 유한 차원만 WeightedIndex 대상. 무한값(UUID, 타임스텝)은 외부 키로 관리
- **전단사(bijection) 보장**: `[0, size-1]` 범위의 정수가 모든 조합에 1:1 대응 — 역변환 가능, 비트마스크 호환, 범위 쿼리 지원
- **Stride 공식과 주소 안정성**: `address = Σ coord[i] × stride[i]`, 단일 축은 항상 안정, 복합 축은 capacity 변경 시 stride 변동으로 주소 무효화
- **Capacity Headroom**: headroom 내 entries 추가는 shape 불변 → stride 불변 → 주소 보존. 소진 시 새 버전 + 마이그레이션 필요
- **2-Phase 운영 모델**: Phase 1(평시, headroom 내 append) / Phase 2(Draft Cycle, capacity 조정 → release → read-repair 마이그레이션)
- **3-레이어 분리**: 수학(weighted-index, 정수↔좌표) → 스키마(index-meta, 축 의미/엔티티) → 데이터(사용자 구현, DB 저장)
- **ID 책임 분리**: `recordId`, stream pointer, storage placement, semantic address는 서로 다른 계약. 하나의 숫자로 유일성/순서/분산/의미 복원을 동시에 해결하지 않는다
- **의미론 인덱싱 루프**: catalog → resolver → materializer → grounding planner → feedback promoter로 RAG/text-to-SQL/검색 grounding을 닫는다
- **의미론 인덱싱 Pack**: spec-transition, taxonomy 관리, 좌표 배정, 파생 인덱스, feedback proposal을 같은 semantic snapshot의 호환성 단위로 묶는다
- **가속 지향 설계**: 문자열은 스키마 레이어에서 정수로 변환, 수학 레이어 이하는 정수만 — 하드웨어 가속 경계가 자연스럽게 형성
- **packed key = identity**: 동일 의미는 항상 동일 key — 캐시 키, DB PK, 비교 연산의 기반

## 하위 문서

| 문서 | 내용 |
|------|------|
| [닫힌 조합 공간](foundation-closed-space.md) | 유한 차원 적합성 판단 기준, 전단사 보장 |
| [Stride 공식과 주소 안정성](foundation-stride-stability.md) | stride 결정 원리, 단일/복합 축 안정성, capacity headroom |
| [버전화된 닫힌 공간의 계열](foundation-version-series.md) | 버전 관리, draft 워크플로우, cascade 전파, entries append-only |
| [레이어 분리](foundation-layer-separation.md) | 수학/스키마/데이터 3-레이어, weighted-index 내부 구조 |
| [ID 할당과 좌표 주소 설계](foundation-id-allocation-design.md) | Snowflake, TiDB, Kafka 비교와 `recordId`/stream pointer/semantic address 책임 분리 |
| [의미론 인덱싱 기본 로직](foundation-semantic-indexing-logic.md) | RAG, text-to-SQL, 사용자 검색을 위한 catalog/resolver/materializer/planner/feedback 루프 |
| [Semantic Indexing Pack](foundation-semantic-indexing-pack.md) | spec-transition, taxonomy 관리, 좌표 배정, 파생 인덱스를 묶는 호환성 단위 |
| [가속 지향 설계 원칙](foundation-acceleration.md) | 문자열 경계, ref_id 수렴, packed key identity, 불변성 |

## 참조

관련 스펙:
- 사용 패턴: [`patterns.md`](patterns.md)
- 프로젝트 관례: [`../indexing-core-system/conventions-system.md`](../indexing-core-system/conventions-system.md)
- 설계 구조: [`data-design.md`](data-design-group.md)
