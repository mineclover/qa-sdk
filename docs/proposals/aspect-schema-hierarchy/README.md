---
def:
  id: aspect-schema-hierarchy-readme
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: layout
  depth: overview
  links:
    - target: aspect-schema-hierarchy-00-design
      type: refs
    - target: aspect-schema-hierarchy-01-migration
      type: refs
    - target: aspect-schema-hierarchy-02-schema-diff
      type: refs
status: under-review
date: 2026-04-21
part_of: aspect-schema-hierarchy
role: index
supersedes: -
superseded_by: -
---

> **RFC / Proposal.** `docs/proposals/aspect-schema-hierarchy/`. 아직 정규 스펙 아님 — validator/스키마/DB migration 은 본 제안 수락 전에 수정하지 않는다.

# Aspect Schema Hierarchy — Phase C RFC

## 목적 ^purpose

Phase 5b B-0 에서 런타임 map 으로 선언된 `ASPECT_PARENTS` (자식→부모 17 쌍) 를 **definition-service SQLite 스키마로 승격** 하여, 외부 도구 (registry-service, DKG audit, dashboard filter) 가 aspect 부모-자식 관계를 데이터로 질의할 수 있게 만든다. 본 RFC 는 Option C-1 (`aspect_parents` metadata table) 을 선택하고 Phase C-0 ~ C-4 단계 전환 계획을 제시한다. 문서 frontmatter / DEF_ASPECT 코드 상수 / validator 경로는 **불변** — 최소 침습 원칙.

## 배경

Phase 5b B-0~B-4 (2026-04-21 완료) 결과:

- `DEF_ASPECT.entries` = **40** (기존 23 + 신규 17)
- `ASPECT_PARENTS` **런타임 map** 이 자식→부모 관계 17 쌍 선언
- `deriveAspectParent()` helper 제공
- 명명 컨벤션 `{role}_{parent-stem}` 문서화

이로써 [aspect-vocab-split 01-migration](../aspect-vocab-split/01-migration.md) § "Phase C — Schema Hierarchy 전환" 의 **개시 트리거 조건 중 aspect 수 ≥ 40** 이 충족되었다. 나머지 두 트리거 (rollup 쿼리 요구 ≥ 5회, UX 한계) 는 누적 중이나 **Phase C-0 (schema 도입) 은 rollup 요구와 독립적으로 선행 가치가 있다** — 런타임 map 이 코드에만 존재하면 외부 도구 (registry-service fetch, DKG audit, dashboard filter) 가 부모 관계를 알 수 없다.

## 핵심 주장

1. **부모 관계를 데이터로 승격** 한다. 현재 `ASPECT_PARENTS` map 은 `packages/definition-catalog/src/vocabulary.ts` 에만 존재 → registry-service 축 catalog 과 `definition-service` SQLite 에 도달하지 못한다.
2. **최소 침습 설계** 를 채택한다. 문서 frontmatter 는 불변 (`aspect: codegen_func`), 유저-facing breaking change 없음. 스키마는 metadata 테이블 1개만 추가.
3. **가역성 유지** — 각 단계는 독립 revert 가능. `ASPECT_PARENTS` 원본은 Phase C 완료 후에도 vocabulary.ts 에 코드 SSOT 로 남긴다 (DB 는 파생 복제본).
4. **rollup API 는 C-2 에서 도입** — schema 는 C-0 에서 먼저 깔고, 실제 rollup 기능은 수요가 구체화된 후 추가.
5. **aspects 전체 dimension 테이블화는 보류** — C-2 보다 큰 변화는 Phase C-4 후속 RFC 로 미룬다 (Option C-2, 아래 [00-design §대안 비교](./00-design.md)).

## 선택 옵션: **C-1 (aspect_parents metadata table)**

| 옵션 | 변화 범위 | 공수 | 본 RFC |
|---|---|---:|---|
| **C-1 Metadata table** | `aspect_parents (child_id, parent_id, description)` 추가 | 4-6 일 | ✅ 채택 |
| C-2 Full aspects dimension | `aspects(id, display_ko, parent_id, deprecated_at...)` 추가 + DEF_ASPECT 코드 축소 | 8-12 일 | 미채택 (Phase C-4 후보) |
| C-3 Minimal parent column | 기존 aspects 테이블이 없으므로 적용 불가 | — | N/A |

Reasoning: DEF_ASPECT 는 여전히 **코드가 SSOT** 이며 (codegen / `deriveAspectParent` / scope 검증 모두 코드 상수 의존), Phase C 의 한계 가치는 **부모 관계를 DB 에서 질의 가능하게** 하는 것이다. Full dimension 테이블화는 코드/DB SSOT 이중화 문제를 일으키므로 분리.

## 단계 요약 (Phase C-0 ~ C-4)

| 단계 | 본 RFC 범위? | 작업 | 가역성 |
|---|---|---|---|
| **C-0. Schema introduction** | ✅ | `aspect_parents` 테이블 추가 + `ASPECT_PARENTS` map 에서 populate | 완전 |
| **C-1. Validator bridge** | ✅ | validator 가 DB 조회, DB 미존재/빈 상태 시 runtime map fallback | 완전 |
| **C-2. Rollup API** | ✅ | `getAspectFamily(aspect)` + CLI `--include-children` / `--rollup-aspect` | 완전 |
| **C-3. Runtime map deprecation** | ✅ | `ASPECT_PARENTS` JSDoc `@deprecated` (1 릴리즈 cycle 유지) | 완전 |
| **C-4. Full aspects dimension** | ❌ 별도 RFC | Option C-2 승격 — `aspects` 테이블 도입 | 복합 |

상세 전환 순서 + 성공 기준 + 롤백: [01-migration.md](./01-migration.md). DDL before/after + populate 스크립트 아웃라인: [02-schema-diff.md](./02-schema-diff.md).

## 구성 문서

| 문서 | 내용 |
|------|------|
| [00-design.md](./00-design.md) | 현재 상태 분석, 옵션 비교 (C-1/C-2/C-3), 선택 rationale, 리스크, 오픈 질문 |
| [01-migration.md](./01-migration.md) | Phase C-0 ~ C-4 롤아웃 계획. 각 단계의 성공 기준과 롤백 경로 |
| [02-schema-diff.md](./02-schema-diff.md) | DDL before/after 차분, bulk populate 스크립트 아웃라인, drizzle 스키마 삽입 지점 |

## 상태

- 2026-04-21: draft 작성 완료 (Phase 5b B-4 직후)
- 다음 행동: 사람 리뷰 → Phase C-0 schema 도입 승인 여부 판단
- 의존 문서:
  - [aspect-vocab-split/README.md](../aspect-vocab-split/README.md) (Phase A/B/C 단계적 접근)
  - [aspect-vocab-split/00-design.md](../aspect-vocab-split/00-design.md) § "Helper: deriveAspectParent", § "대안 검토"
  - [aspect-vocab-split/01-migration.md](../aspect-vocab-split/01-migration.md) § "Phase C — Schema Hierarchy 전환"

## 범위 외

- **문서 frontmatter 문법 변경 금지** — `aspect: codegen_func` 불변. 컴포지트 표기 (`aspect: func_def > codegen`) 는 미채택.
- **DEF_ASPECT 코드 상수 제거 금지** — scope 검증 / codegen 이 의존. C-4 까지 보존.
- **scope 축으로의 확장 미포함** — scope 는 8 값이라 계층 없이 flat 유지 (Q3 참조).
- **신규 aspect 추가 PR workflow 재설계 미포함** — 기존 vocabulary.ts PR + `def sync` flow 유지.

## 참조

- `packages/definition-catalog/src/vocabulary.ts` — `ASPECT_PARENTS` map / `deriveAspectParent`
- `packages/definition-service/src/db/schema.ts` — 신규 `aspect_parents` 테이블 추가 지점
- `packages/definition-service/src/core/axis-registry.ts` — validator 읽기 경로 업데이트 지점 (C-1)
- `packages/definition-catalog/src/validate.ts` — scope-aspect 검증 로직 (C-1)
- `docs/specs/definition-catalog/definition-taxonomy.spec.md` — semantic definition 반영 대상 (후속)
