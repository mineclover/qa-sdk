---
def:
  id: storage-system
  scope: data
  aspect: system_data
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [structural, entry-point]
  links:
    - target: storage-adapters-spec
      type: contains
    - target: storage-schema-spec
      type: contains
    - target: scenario-store-spec
      type: contains
    - target: verdict-spec
      type: contains
    - target: graph-spec
      type: contains
    - target: utils-spec
      type: contains
---

## 목적 ^purpose

이벤트/시나리오/판정/그래프 데이터의 저장 어댑터, 스키마, 유틸리티.

## 구성 ^overview

- `storage-adapters-spec`: core 포트의 Drizzle/PostgreSQL 및 In-Memory 구현체.
- `storage-schema-spec`: PostgreSQL 테이블 정의.
- `scenario-store-spec`: 검증 완료된 `ScenarioSpec` 문서를 저장하고 조회하는 core 포트 계약.
- `verdict-spec`: spec/runtime 매칭 결과와 최종 판정 보고서의 canonical 구조.
- `graph-spec`: 기대 행동 그래프(`SpecGraph`)와 실행 그래프(`RuntimeGraph`)의 canonical 구조.
- `utils-spec`: ULID 기반 prefix ID 생성 및 타임스탬프 유틸리티.
