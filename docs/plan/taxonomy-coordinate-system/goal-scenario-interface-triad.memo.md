---
status: draft
sources:
  - packages/taxonomy-engine/src/schema/ir.ts
  - packages/taxonomy-engine/src/parser/index.ts
  - packages/taxonomy-engine/src/validate/index.ts
  - packages/taxonomy-engine/src/indexer/index.ts
  - packages/taxonomy-engine/src/query/walk-by-coordinate.ts
  - packages/taxonomy-engine/src/query/walk-relation.ts
  - packages/taxonomy-engine/__tests__/dogfooding.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-def-catalog.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-lesson-builder.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-dkg.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-ingest.test.ts
  - docs/taxonomies/qa-sdk-coordinate-system.yaml
  - docs/taxonomies/qa-sdk-def-catalog.yaml
  - docs/taxonomies/lesson-builder-content.yaml
  - docs/taxonomies/dkg-schema.yaml
  - docs/taxonomies/ingest-coords.yaml
  - docs/specs/system/meta-taxonomy.spec.md
  - docs/specs/system/dual-coordinate-system.spec.md
---

# Goal × Scenario × Interface — 위상 좌표 3축

## 배경

qa-sdk의 기존 좌표계(axis × prefix)는 데이터/이벤트의 차원 압축을 다룬다. 하지만 "이 시스템이 해결하는 문제는 무엇인가"라는 제품 레벨의 질문에는 답하지 않는다.

시스템의 5가지 목적(설계 관리, 테스트 리스트, 정합성, 의도 문서, 변화 관측)은 **시스템이 하는 일**이지 **해결하는 문제**가 아니다. 문제가 먼저 정의되어야 하위 설계가 따라간다.

## 3축 정의

| 축 | 질문 | 정의 |
|---|---|---|
| **goal** | "왜 존재하는가" | 시스템이 해결하는 문제/목표 |
| **interface** | "무엇을 보여주는가" | URL 단위로 한번에 전달하는 정보의 양 + 사용 편의성. 메뉴 구조도로 표현 |
| **scenario** | "어떻게 사용하는가" | 그 인터페이스 위에서 goal을 이루기 위한 유저의 사용 흐름 |

## 교차

```
goal × interface    = "이 목표를 위해 어떤 화면/정보 단위가 필요한가"
goal × scenario     = "이 목표를 이루기 위한 유저 흐름은 무엇인가"
interface × scenario = "이 화면에서 유저가 밟는 단계는 무엇인가"

goal × interface × scenario = 하나의 좌표점
  → "이 목표를 위해, 이 화면에서, 유저가 밟는 이 단계"
```

## 기존 좌표계와의 관계

```
제품 레벨 (본 메모)
  goal × interface × scenario → 위상 좌표

데이터 레벨 (기존)
  axis × prefix → 차원 압축 좌표

연결점: taxonomy 청사진의 "비즈니스 분해 좌표(중간층)"
  서비스 레지스트리 (최상위)
      ↓
  비즈니스 분해 좌표 (중간) ← goal × interface × scenario 가 여기에 해당
      ↓
  각 taxonomy algebra (해석)
      ↓
  좌표 행렬 (표현)
```

## 미결 사항

- goal의 구체적 목록: qa-sdk가 해결하는 문제를 한 문장씩 나열
- interface 구조도: URL/메뉴 단위의 정보 설계
- scenario 정의: cases.md 문서 타입과의 관계 — cases가 이 축의 인스턴스가 될 수 있음
- 3축 교차의 좌표 표기법: 기존 address(정수) 체계와 호환 여부

## 영향받는 문서

- `docs/plan/taxonomy-coordinate-system/purpose.md` — 청사진 전체 구조
- `docs/plan/taxonomy-coordinate-system/business-decomposition-coordinate.memo.md` — 비즈니스 분해 좌표
- `project_system-purpose.md` (memory) — 5가지 목적 → goal 축에서 재정의 필요
