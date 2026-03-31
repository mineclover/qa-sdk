---
def:
  id: coord-foundation
  address: def_document:v2:342153
  scope: data
  aspect: domain_data
  depth: overview
  level: module
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
---

# 좌표 시스템 기반 원리

## 목적 ^purpose

이 시스템은 **좌표 시스템(Coordinate System)**이다.
유한한 개념 조합에 정수 주소를 부여하고, 주소를 해석하고, 주소 공간을 버전 관리한다.
**데이터를 저장하지 않는다.** 저장은 이 좌표 위에 구축되는 별도 계층의 책임이다.

사용 패턴: [`patterns.md`](patterns.md) · 프로젝트 관례: [`../indexing-core-system/conventions-system.md`](../indexing-core-system/conventions-system.md) · 설계 구조: [`data-design.md`](data-design.md)

- [`weighted-index/`](weighted-index/README.md)
- [`index-meta/`](index-meta/README.md)

## 구성 ^overview

- **닫힌 조합 공간**: 설계 시점에 상한이 고정된 유한 차원만 WeightedIndex 대상. 무한값(UUID, 타임스텝)은 외부 키로 관리
- **전단사(bijection) 보장**: `[0, size-1]` 범위의 정수가 모든 조합에 1:1 대응 — 역변환 가능, 비트마스크 호환, 범위 쿼리 지원
- **Stride 공식과 주소 안정성**: `address = Σ coord[i] × stride[i]`, 단일 축은 항상 안정, 복합 축은 capacity 변경 시 stride 변동으로 주소 무효화
- **Capacity Headroom**: headroom 내 entries 추가는 shape 불변 → stride 불변 → 주소 보존. 소진 시 새 버전 + 마이그레이션 필요
- **2-Phase 운영 모델**: Phase 1(평시, headroom 내 append) / Phase 2(Draft Cycle, capacity 조정 → release → read-repair 마이그레이션)
- **3-레이어 분리**: 수학(weighted-index, 정수↔좌표) → 스키마(index-meta, 축 의미/엔티티) → 데이터(사용자 구현, DB 저장)
- **가속 지향 설계**: 문자열은 스키마 레이어에서 정수로 변환, 수학 레이어 이하는 정수만 — 하드웨어 가속 경계가 자연스럽게 형성
- **packed key = identity**: 동일 의미는 항상 동일 key — 캐시 키, DB PK, 비교 연산의 기반

## 하위 문서

| 문서 | 내용 |
|------|------|
| [닫힌 조합 공간](foundation-closed-space.md) | 유한 차원 적합성 판단 기준, 전단사 보장 |
| [Stride 공식과 주소 안정성](foundation-stride-stability.md) | stride 결정 원리, 단일/복합 축 안정성, capacity headroom |
| [버전화된 닫힌 공간의 계열](foundation-version-series.md) | 버전 관리, draft 워크플로우, cascade 전파, entries append-only |
| [레이어 분리](foundation-layer-separation.md) | 수학/스키마/데이터 3-레이어, weighted-index 내부 구조 |
| [가속 지향 설계 원칙](foundation-acceleration.md) | 문자열 경계, ref_id 수렴, packed key identity, 불변성 |

## 참조

관련 스펙:
- 사용 패턴: [`patterns.md`](patterns.md)
- 프로젝트 관례: [`../indexing-core-system/conventions-system.md`](../indexing-core-system/conventions-system.md)
- 설계 구조: [`data-design.md`](data-design.md)
