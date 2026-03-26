---
def:
  id: index-arch-layers
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: domain
  svc: weighted-index
  tags: [tier-infra]
  links:
    - target: schema-layer-spec
      type: depends_on
    - target: indexing-architecture
      type: refines
---

# 인덱싱 아키텍처 - 레이어 구조

## 목적 ^purpose

인덱싱 시스템의 L0-L4 레이어를 vocabulary, coordinate, schema, runtime, semantic 단계로 나눠 각 레이어의 책임과 현재 구현 상태를 정리한다.

## 레이어 정의

- L0 Vocabulary는 축, prefix, 용어를 정의하는 가장 낮은 계약 레이어다.
- L1 Coordinate는 stride와 address 계산을 담당하며 현재 구현의 중심이다.
- L2 Schema는 구조 검증과 문서 투영의 진입점이며, 구현보다 계약이 먼저 고정돼야 한다.
- L3 Runtime은 실제 서비스/SDK가 좌표 계약을 소비하는 단계다.
- L4 Semantic은 외부 도메인 의미 체계와 연결되는 해석 레이어다.

## 운영 원칙

- 하위 레이어가 상위 레이어를 모르게 하는 방향으로 의존을 정리한다.
- 구현 완료 여부는 레이어 책임과 별개로 추적하며, 미완성 레이어도 문서 계약은 먼저 존재해야 한다.
- schema/runtime 분리는 `schema-layer-spec`과 직접 연결된다.
