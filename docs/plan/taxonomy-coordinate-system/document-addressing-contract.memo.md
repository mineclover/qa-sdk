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

# Document Addressing Contract — 문서 주소 계약

## 목적

문서의 본질 주소와 표현 경로를 분리하고, family/role 분할이 같은 교차점 안에서 일관되게 작동하도록 만든다.

## 관찰

- 문서 역할 taxonomy(`spec/rule/test/plan/todo/memo`)는 표현 축이지 문서의 본질 주소가 아니다
- 문서의 본질은 비즈니스 대상과 구조적 배치에서 먼저 결정되고, 문서 역할은 그 위에 얹히는 sibling 분할
- 파일 경로는 탐색 projection일 뿐, 문서 identity 자체가 되어서는 안 된다

## 주소 2층 모델

| 층 | 역할 | 특성 |
|----|------|------|
| identity address | 불변 식별자 | 링크 그래프와 참조의 기준 |
| presentation path | 가변 탐색 경로 | 사람이 보는 projection |

기존 시스템에서 `address`(불변 정수)와 `id`(kebab-case, 변경 가능)가 이 2층을 부분적으로 구현하고 있다.

## 문서 = taxonomy 교차점 객체

문서는 여러 taxonomy가 교차하는 지점에 존재하는 개체다. 참여하는 taxonomy가 많을수록 의미가 정밀해진다.

비즈니스 분해 좌표계가 이 교차점의 공유 기준이 된다 → `business-decomposition-coordinate.memo.md` 참조.

## family와 role 분리

- `family`는 같은 taxonomy 교차점을 공유하는 문서군
- `role`은 family 내부 문서 역할을 구분

```
service-event-adoption (family)
├── service-event-adoption.spec.md
├── service-event-adoption.rule.md
└── service-event-adoption.test.md
```

현재 시스템에서 `family_id`는 암묵적 — 같은 `def.id`를 공유하는 문서들이 family를 형성. 명시적 `family_id`로의 전환 여부가 미해결.

## 미해결 질문

1. `family_id`를 사람이 읽는 안정 ID로 둘지, 별도 opaque ID로 둘지
2. projection view를 몇 개까지 first-class로 둘지
3. 문서 이동 시 `path` 변경과 `identity address` 유지 규칙을 어디서 강제할지
