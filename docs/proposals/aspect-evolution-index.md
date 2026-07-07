---
def:
  id: aspect-evolution-index
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
    - target: domain-hierarchy-readme
      type: refs
    - target: aspect-vocab-split-readme
      type: refs
    - target: aspect-schema-hierarchy-readme
      type: refs
    - target: aspect-naming-convention
      type: refs
    - target: cases-md-convention
      type: refs
    - target: test-md-convention
      type: refs
    - target: validator-suppression-tags
      type: refs
    - target: catalog-purity-bridge
      type: refs
    - target: change-simulation-precedence
      type: refs
    - target: system-specs-rules-index
      type: refs
status: accepted
date: 2026-04-21
part_of: aspect-evolution
role: index
sources:
  - packages/definition-catalog/src/vocabulary.ts
  - packages/definition-catalog/src/aspect-parents.test.ts
  - packages/definition-catalog/src/aspect-family.test.ts
  - packages/definition-service/drizzle/20260421000000_aspect_parents/migration.sql
  - packages/definition-service/src/core/aspect-registry.ts
  - packages/definition-service/src/sync/aspect-parents-sync.ts
  - packages/cli/src/commands/def.ts
---

> **RFC 통합 인덱스.** 2026-04-20 ~ 2026-04-21 세션에서 실행된 3개 RFC (`domain-hierarchy`, `aspect-vocab-split`, `aspect-schema-hierarchy`) 의 통합 서사 + 최종 상태 보고.

# Aspect Evolution — 3-RFC 통합 인덱스

## 목적 ^purpose

이 문서는 2026-04-20 ~ 2026-04-21 세션에서 `definition-catalog` 의 좌표/aspect 체계를 진화시킨 3개 RFC 를 하나의 이야기로 엮는다. 각 RFC 는 독립적으로 실행되었지만, 문제 정의(WHY) → 어휘 확장(WHAT) → 스키마 승격(HOW) 의 수순으로 **같은 근원 문제(duplicate-coordinate 36건)** 를 단계적으로 해소했다.

## 통합 서사

### 1. WHY — [domain-hierarchy](./domain-hierarchy/) (구조적 모호성 → 좌표 충돌)

**문제**: 서로 다른 도메인(APM, DF, WI, CQ, decode, gate …) 에 속한 시스템들이 같은 `(tier, scope, layer, aspect)` 좌표를 공유하여 `duplicate-coordinate` 경고 30건 발생.

**핵심 통찰**: 중복은 "내용 중복" 이 아니라 "**도메인 식별 부재**". 시스템의 도메인은 신규 스키마 필드 없이 `depends_on` / `refines` 링크 그래프에서 파생 가능.

**해결**: `deriveDomainRoot()` 파생 로직 + duplicate-coordinate 키를 `tier:scope:layer:aspect:domain_root` 로 확장. Class A/B/C/D 분류 기반 단계적 정리 (5a/5b/5c/5d/5e/5f/5g).

- **Class A (Abstract)**: 20 그룹 — `contains` 링크 명시 + tier 승격으로 해소 (저위험)
- **Class C (Co-locate)**: 4 그룹 — `knowledge_kind=proposal|adr|convention` 면제 규칙 + `cross-scope` 태그 (저위험)
- **Class M (Merge)**: 2 그룹 — motion-workspace 서비스 병합 + TODO cross-scope 처리
- **Class D (Diversify)**: 10 그룹 — aspect 어휘 세분화 필요 → **아래 RFC 2 로 이관**

### 2. WHAT — [aspect-vocab-split](./aspect-vocab-split/) (어휘 부족 → 세분화)

**문제**: Class D 17 그룹의 근원은 `func_def` / `process_flow` / `api_contract` / `domain_data` 가 **너무 coarse** 하여 같은 좌표에 서로 다른 시스템 정체성이 수렴.

**핵심 통찰**: 어휘 분할은 **값 치환이 아닌 값 추가** 로 한다. 기존 값은 fallback 으로 잔존하여 migration 가역성 보장. 신규 값은 `{role}_{parent-stem}` 네이밍 컨벤션 준수 — 저자 규율은 구조적이지만 부모 추론은 **명시 map** 으로 담당 (이름 역산 금지).

**해결**: Phase B-0 (vocabulary 확장) → B-1 (HIGH migration) → B-2 (MED migration) → B-3 (LOW/exception) 의 4단계.

- 신규 aspect 17개 (`codegen_func`, `harness_func`, `ingest_flow`, `decode_contract`, `taxonomy_data` …)
- `ASPECT_PARENTS` runtime map 도입 — child → parent 단방향 조회
- `deriveAspectParent()` helper (pure function, DB 의존 無)
- capacity 64 → 128 확장 (headroom = 88)
- Mini-5b: 2 개 재수렴 그룹 해소 — `encoding_func` 하위 3개 + `definition_mgmt_flow` 하위 3개 추가

### 3. HOW — [aspect-schema-hierarchy](./aspect-schema-hierarchy/) (런타임 map → DB 스키마)

**문제**: Phase B 완료 시점 `ASPECT_PARENTS` 은 `vocabulary.ts` 에만 존재 → registry-service, DKG audit, dashboard filter 같은 외부 도구가 부모 관계를 데이터로 질의 불가.

**핵심 통찰**: 최소 침습 + 순수성 유지 — 문서 frontmatter **불변**, `DEF_ASPECT` 코드 상수 **불변**, `definition-catalog` 패키지는 **DB 의존 없음 유지** (SSOT 는 여전히 코드).

**해결**: Option C-1 (`aspect_parents` metadata table) 채택. 단계 트리거는 **aspect 수 ≥ 40** 도달 (Mini-5b 완료 시점 충족).

- **Phase C-0**: `aspect_parents (child_id, parent_id, description)` 테이블 + Drizzle migration + CLI `def sync` 포퓰레이트
- **Phase C-1**: `aspect-registry.ts` bridge — DB-first + runtime map fallback + insert-on-discovery (onModuleInit + run 훅)
- **Phase C-2**: `getAspectFamily()` BFS helper + CLI `def list --include-children` + `def audit --rollup-aspect` (chicken-egg 해소 위해 수요 게이트 해제 후 진입)
- Phase C-3 (deprecation) / C-4 (full dimension) 는 1 릴리즈 관찰 후 또는 별도 RFC

## 실행 타임라인

| 날짜 | 마일스톤 | dup-coord | errors | warnings |
|---|---|---:|---:|---:|
| 2026-04-20 (세션 시작) | Phase 0 (시뮬레이션) | 28 | 0 | 68 |
| 2026-04-20 | Phase 2 (domain_root validator) | 30 | 0 | - |
| 2026-04-20 | Phase 3 (깊이 있는 depends_on 링크 보완) | 36 ↑ | 0 | - |
| 2026-04-20 | Phase 5c (Class A 11 그룹 layout 승격) | 25 | 0 | - |
| 2026-04-20 | Phase 5d (knowledge_kind 면제) | - | 0 | - |
| 2026-04-20 | Phase 5e (boundary 재지정 + 3 layout 승격) | - | 0 | - |
| 2026-04-21 | Phase 5b B-0 (aspect 17개 추가) | 17 | 0 | - |
| 2026-04-21 | Phase 5b B-1~B-3 (HIGH/MED/LOW 마이그레이션) | 17 → 10 | 0 | - |
| 2026-04-21 | Phase 5f (multi-parent + orphan 정리) | 10 | 0 | 12 |
| 2026-04-21 | Phase 5g (cross-scope 태그 + level-violation) | 10 → 3 | 0 | 3 |
| 2026-04-21 | Phase C-0/C-1 (schema + bridge) | 3 | 0 | - |
| 2026-04-21 | Mini-5b (6개 sub-aspect 추가 + 마이그레이션) | 3 → 0 | 0 | 0 |
| 2026-04-21 | Phase C-2 (rollup API + CLI) | 0 | 0 | 0 |

**dup-coord 흐름**: 28 → (36 peak) → **0**. 최종: errors=0, warnings=0.

## 최종 상태 지표

| 지표 | 세션 시작 (2026-04-20) | 세션 종료 (2026-04-21) | 변화 |
|---|---:|---:|---:|
| `errors` | 0 | **0** | 0 |
| `warnings` | 68 | **0** | **-68 (-100%)** |
| `duplicate-coordinate` | 28 (peak 36) | **0** | **-100%** |
| `multi-parent` | - | 0 | - |
| `orphan` | - | 0 | - |
| `level-violation` | - | 0 | - |
| `DEF_ASPECT.entries` | 23 | **46** | +23 |
| `ASPECT_PARENTS` map | 없음 | **25 쌍** (4 parents × 다수 children) | +25 |
| `aspect_parents` DB 테이블 | 없음 | **존재 + 25 rows** | 신규 |
| CLI `--include-children` | 없음 | **구현** | 신규 |
| CLI `--rollup-aspect` | 없음 | **구현** | 신규 |

## 남은 과제

| 항목 | 상태 | 트리거 |
|---|---|---|
| Phase C-3 (runtime map `@deprecated`) | 대기 | C-2 완료 후 **1 릴리즈 cycle** 관찰 경과 시점 |
| Phase C-4 (full aspects dimension) | 별도 RFC | DKG/dashboard 에서 aspects 테이블 직접 질의 수요 발생 시 |
| aspect-vocab-split B-4 (레거시 fallback 제거) | 영구 유지 권장 | 해당 없음 (fallback 잔존이 비용 < 이득) |

본 세션의 3-RFC 작업은 위 3건의 후속 외에 **pending work 없음**.

## 현재 증거 표면 ^evidence

- `DEF_ASPECT`, `ASPECT_PARENTS`, `ROOT_ASPECTS`, `deriveAspectParent()`, `getAspectFamily()`는 `packages/definition-catalog/src/vocabulary.ts`가 소유한다.
- Aspect parent completeness와 family BFS는 `packages/definition-catalog/src/aspect-parents.test.ts`, `packages/definition-catalog/src/aspect-family.test.ts`가 검증한다.
- Phase C-0/C-1/C-2의 service-side replica와 DB-first bridge는 `aspect_parents` migration, `aspect-registry.ts`, `aspect-parents-sync.ts`에 구현되어 있다.
- 검증 명령: `corepack pnpm --filter definition-catalog test`, `corepack pnpm --filter @qa-sdk/definition-service test`, `corepack pnpm --filter @qa-sdk/cli test`.

## 부산물 — 규칙 성문화

세션 중 암묵적으로 확립된 규율을 성문화한 rule 문서 6종:

| 규칙 | 파일 |
|---|---|
| aspect 네이밍 컨벤션 `{role}_{parent-stem}` | [`docs/specs/system/aspect-naming-convention.rule.md`](../specs/system/aspect-naming-convention.rule.md) |
| `.cases.md` 파일 구조 및 frontmatter 표준 | [`docs/specs/system/cases-md-convention.rule.md`](../specs/system/cases-md-convention.rule.md) |
| `.test.md` 파일 구조 및 provider 시나리오 표준 | [`docs/specs/system/test-md-convention.rule.md`](../specs/system/test-md-convention.rule.md) |
| Validator 경고 억제 태그/필드 목록 | [`docs/specs/system/validator-suppression-tags.rule.md`](../specs/system/validator-suppression-tags.rule.md) |
| catalog 패키지 순수성 + service bridge 패턴 | [`docs/specs/system/catalog-purity-bridge.rule.md`](../specs/system/catalog-purity-bridge.rule.md) |
| 구조 변경 전 시뮬레이션 선행 원칙 | [`docs/specs/system/change-simulation-precedence.rule.md`](../specs/system/change-simulation-precedence.rule.md) |

## 참조

- [domain-hierarchy/README.md](./domain-hierarchy/README.md) — 도메인 계층 파생 원 RFC
- [aspect-vocab-split/README.md](./aspect-vocab-split/README.md) — aspect 어휘 분할 RFC
- [aspect-schema-hierarchy/README.md](./aspect-schema-hierarchy/README.md) — aspect schema 계층 RFC
- [domain-hierarchy/reviews/2026-04-20-phase5-redesign.md](./domain-hierarchy/reviews/2026-04-20-phase5-redesign.md) — 36 그룹 Class A/B/C/D 분류
- [domain-hierarchy/reviews/2026-04-21-final-cleanup.md](./domain-hierarchy/reviews/2026-04-21-final-cleanup.md) — Phase 5g 최종 정리 (warnings 13 → 3)
- [domain-hierarchy/reviews/2026-04-21-phase-c-0-1-exec.md](./domain-hierarchy/reviews/2026-04-21-phase-c-0-1-exec.md) — Phase C-0/C-1 실행 기록
- [domain-hierarchy/reviews/2026-04-21-phase-c-2-exec.md](./domain-hierarchy/reviews/2026-04-21-phase-c-2-exec.md) — Phase C-2 실행 기록
- `packages/definition-catalog/src/vocabulary.ts` §`DEF_ASPECT`, `ASPECT_PARENTS`
- `packages/definition-catalog/src/validate.ts` §duplicate-coordinate, §cross-scope opt-out
- `packages/definition-service/src/core/aspect-registry.ts` — bridge (DB-first + fallback)
