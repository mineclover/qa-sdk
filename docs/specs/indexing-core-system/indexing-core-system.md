---
def:
  id: indexing-core-system
  scope: flow
  aspect: process_flow
  depth: overview
  lifecycle: approved
  tags: [entry-point]
  links:
    - target: coord-foundation
      type: contains
    - target: data-design-group
      type: contains
    - target: index-arch-group
      type: contains
    - target: schema-layer-spec
      type: contains
    - target: dsl-bundle-spec
      type: contains
    - target: conventions-system
      type: contains
    - target: table-system-group
      type: contains
    - target: event-schema-spec
      type: contains
    - target: signal-model-spec
      type: contains
    - target: coord-states-group
      type: contains
    - target: bigint-addressing-group
      type: contains
    - target: acceleration-spec
      type: contains
    - target: coord-patterns
      type: contains
    - target: behavior-traversal-group
      type: contains
    - target: version-operations
      type: contains
    - target: dim-ops-system
      type: contains
    - target: layout-sim-formats
      type: contains
    - target: ontology-eval
      type: contains
    - target: slot-marker-group
      type: contains
    - target: adr-merge-dedup
      type: contains
    - target: benchmark-system
      type: contains
---

## 목적 ^purpose

좌표 시스템의 기반 원리, 데이터 설계, 축/prefix 운영, 차원 연산을 정의하는 핵심 인덱싱 레이어.

## 구성 ^overview

overview: 총 20개 멤버.
- `coord-foundation`: 이 시스템은 좌표 시스템(Coordinate System)이다.
- `data-design-group`: 좌표 시스템의 압축, 편입, 카탈로그 운영을 데이터 설계 관점에서 분할한 그룹.
- `index-arch-group`: vocabulary부터 semantic까지 인덱싱 레이어와 추적 경계를 정리한 그룹.
- `schema-layer-spec`: Status: DRAFT "스키마 시스템은 구조를 정의하고 검증하지만, 그 구조의 의미를 소유하지 않는다." Schema validates composition, not truth.
- `dsl-bundle-spec`: prefix는 차원 교차의 원자 단위다.
- `conventions-system`: naming, reserved entries, acceleration 방향의 공통 규칙을 분리한 그룹.
- `table-system-group`: 테이블 스키마 정의, DimRef 타입, 접근자 API를 분리한 그룹.
- `event-schema-spec`: 이벤트 스키마는 온톨로지의 관계 정의와 같은 개념이다.
- `signal-model-spec`: Signal = 시스템에서 발생한 의미있는 순간.
- `coord-states-group`: 좌표 상태 분류, 활성 영역, 버전/합성 규칙을 분리한 그룹.
- `bigint-addressing-group`: BigInt 인코딩 API와 전환 전략을 분리한 그룹.
- `acceleration-spec`: 현재 인덱싱 시스템의 구조적 특성이 왜 하드웨어 가속에 적합한지를 정리하고, 향후 FPGA/PCIe 가속기를 위한 인터페이스 확장 방향을 제시한다.
- `coord-patterns`: 시스템을 어떻게 쓰는가 — 버전 이동, index 합성, 필터링 패턴.
- `behavior-traversal-group`: 행위 축, 질의 DSL, 내부 모델을 분리한 그룹.
- `version-operations`: 버전의 수학적 원리(stride, capacity, headroom)는 `foundation.md` §2–§3을 참조한다.
- `dim-ops-system`: 축 교차 선택, 환경 주입, 배포 시점 해석을 분리한 그룹.
- `layout-sim-formats`: UUID만이 아닌 다양한 PackFormat에서 차원 배치를 시뮬레이션하고, 인덱스 저장 타입(Number vs BigInt)에 따른 도달 가능 범위를 시각화한다.
- `ontology-eval`: 좌표 시스템(Coordinate System)이 RDF/OWL 온톨로지의 스키마 영역을 어디까지 담을 수 있는지 평가한다.
- `slot-marker-group`: 슬롯 마커의 개념, 용량 규칙, 패턴을 분리한 그룹.
- `adr-merge-dedup`: 상태: 구현 완료 (2026-03-18) 관련 계획: tasks/indexing-merge-plan.md 계약 테스트: `packages/demo-tests/src/merge-contract/` 영향 패키지: weighted-index, permission-engine, index-meta, decode-service ---
