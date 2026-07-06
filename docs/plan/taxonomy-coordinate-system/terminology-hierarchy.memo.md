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

# 용어 계층 — axis → taxonomy → space (semantic space)

## 배경

좌표계의 계층 구조를 지칭하는 용어가 혼용되고 있었다(DSL, taxonomy, prefix, 좌표계 등). 이 메모에서 3단계 용어를 확정한다.

## 3단계 용어

```
axis            1차원. 유한한 값의 집합.
    ↓ 교차
taxonomy        axis 교차로 하나의 분류 체계를 정의.
    ↓ 교차
space  taxonomy 교차로 하나의 의미 좌표 공간을 형성.
```

| 단계 | 용어 | 정의 | 예시 |
|------|------|------|------|
| 1 | **axis** (축) | 1차원. 유한하고 안정적인 값의 집합 | role, environment, feature |
| 2 | **taxonomy** (분류 체계) | axis들의 교차로 특정 도메인의 분류를 정의 | permission = role × env × feature |
| 3 | **space** (의미 공간) | taxonomy들의 교차로 하나의 의미 좌표 공간을 형성 | structural space, contextual space |

## 기존 용어와의 관계

| 기존 용어 | 새 위치 | 설명 |
|-----------|---------|------|
| axis | axis (동일) | 변경 없음 |
| DSL | taxonomy를 표현하는 언어 | taxonomy의 하위 개념. taxonomy = "무엇을 분류하는가", DSL = "그것을 어떻게 표기하는가" |
| prefix | taxonomy의 인스턴스 | 데이터 레벨에서 taxonomy 교차의 구체적 결과 단위 |
| 좌표계 | space | 상위 포괄 용어 |

## space의 두 종류

| 종류 | 역할 | 포함하는 taxonomy |
|------|------|-------------------|
| **structural space** | 시스템 자체를 정의 | 패싯 단위, 데이터 흐름, 유저 경험 등 핵심 모델링 |
| **contextual space** | 구조를 뒷받침하는 맥락 | 의사결정 기록, 테스트 커버리지, 변경 이력 등 보조 |

structural이 먼저 정의되어야 contextual이 의미를 가진다.

## 이 시스템이 하는 일

taxonomy들의 조합으로 문서를 작성하는 시스템이다. taxonomy 교차가 명확한 좌표를 만들고, 그 좌표 위에서 정보를 정의하는 것은 **시스템과 시스템의 데이터 흐름, 유저 경험을 메타 모델링하는 것**과 같다.

```
시스템 정의 = structural space 위의 좌표점들
맥락 기록   = contextual space 위의 좌표점들
메타 모델   = structural + contextual의 합집합
```

## 우선순위

1. **structural space의 핵심 taxonomy 조합 정의** — 시스템 자체를 모델링하는 축
2. contextual space 정의 — 의사결정, 테스트 커버리지 등 보조 축
3. structural ↔ contextual 연결 — 교차 참조, 추적성

## space와 scope×aspect×depth의 관계

두 체계는 **직교**한다:

```
space (수평)           = "무엇에 대한 것인가" — 의미 좌표 (어떤 면)
scope × aspect × depth (수직) = "그것의 어디를 보는가" — 깊이 탐색 (면의 어디)
```

비유: 시스템이 로봇이라면
- **space** = 외골격, 소프트웨어, 하드웨어... (어떤 면인가)
- **scope×aspect×depth** = 하드웨어 → CPU → 아키텍처 → 명령어셋 (깊이를 타고 들어감)

```
space: "인증 시스템"
  ├── scope:feature / aspect:func_def / depth:overview     → 인증 전체 설계
  ├── scope:feature / aspect:func_def / depth:specification → bitmask 판정 상세
  ├── scope:constraint / aspect:tech_constraint             → JWT 서명 검증 제약
  └── scope:interface / aspect:api_contract                 → enrichment API 계약
```

같은 space 안에서 scope×aspect×depth가 깊이를 타고 들어간다.

## space와 문서 7종의 관계

문서 7종(spec/rule/todo/test/cases/memo/plan)은 **space의 의존**이다:

```
space (면)
  = 시스템의 한 면을 정의하는 의미 좌표 공간

  그 면을 표현하는 산출물들 (의존):
    ├── spec    — 면을 정의
    ├── rule    — 면의 소비 규칙
    ├── test    — 면을 검증
    ├── cases   — 면 위의 사용 흐름
    ├── todo    — 면의 미구현 잔여
    ├── memo    — 면에 대한 의사결정 기록
    └── plan    — 면의 방향
```

- space가 없으면 문서가 의미 없음 ("무엇에 대한 스펙?")
- space가 있으면 문서들이 같은 좌표를 공유하며 면을 입체적으로 기술
- 현재 문서 체계에 빠져있던 것: "이 문서가 어떤 space에 속하는가"라는 상위 좌표

## 미결 사항

- structural space를 구성하는 taxonomy 목록 확정
- goal × interface × scenario가 structural의 하위인지 별도 레이어인지
- space 간 교차 표기법
- 문서 frontmatter에 space 좌표를 어떻게 표현할 것인가

## 영향받는 문서

- `goal-scenario-interface-triad.memo.md` — goal/interface/scenario는 space 레벨의 taxonomy
- `purpose.md` — 청사진 전체 구조에 3단계 용어 반영 필요
- `meta-taxonomy.memo.md` — taxonomy 분류군과 space 관계
- `doc-type-convention.spec.md` — 7종 문서가 space의 의존이라는 관계 명시 필요
