# Taxonomy — 한 좌표 공간

> [[axis]] + [[relation]] + [[constraint]]의 묶음. yaml 파일 단위.

## 정의

좌표 공간 한 개의 완결된 단위. 한 yaml 파일 = 한 Taxonomy.

## 목적

- 분류 도식 한 개를 self-contained로 표현
- import로 다른 taxonomy 활용 가능 (cross-tax)
- version 단위로 lifecycle 관리

## 구조

| 필드 | 내용 |
|------|------|
| `taxonomy` | slug 식별자 (예: "qa-sdk-coordinate-system") |
| `version` | 정수. entries 변경 시 bump |
| `description` | 자유 텍스트 |
| `imports` | 다른 taxonomy 참조 (cross-tax) |
| `axes` | Axis 묶음 |
| `relations` | Relation 묶음 |
| `constraints` | Constraint 목록 |

## 도그푸딩 5건

| taxonomy | 역할 |
|----------|------|
| qa-sdk-coordinate-system | qa-sdk 서비스 토폴로지 |
| lesson-builder-content | 외부 콘텐츠 모델 (cross-axis binding) |
| dkg-schema | 메타-그래프 schema |
| ingest-coords | 서비스 driver matrix |
| qa-sdk-def-catalog | def-catalog 메타데이터 (vocabulary.ts) |

## 핵심 원리

### contentHash 결정론

같은 yaml → 같은 IR contentHash → 같은 codegen 출력. drift 즉시 감지.

### import의 의미

다른 taxonomy를 alias로 끌어와 cross-tax ref 가능. import는 registry 등록 필수 — 없으면 `ref-unresolved-import` 진단.

## 다른 개념과의 관계

- [[axis]], [[relation]], [[constraint]]: Taxonomy의 구성 요소
- [[registry]]: 여러 Taxonomy의 우주

## 참조

- spec: `../00-design.md` §4
- 코드: `packages/taxonomy-engine/src/schema/ir.ts` `TaxonomyIR`
- 도그푸딩: `docs/taxonomies/*.yaml`
