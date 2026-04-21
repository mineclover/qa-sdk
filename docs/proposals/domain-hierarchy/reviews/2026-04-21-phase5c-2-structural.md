---
def:
  id: domain-hierarchy-phase5c-2-structural
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: validation
  links:
    - target: domain-hierarchy-readme
      type: depends_on
status: under-review
date: 2026-04-21
part_of: domain-hierarchy
role: review
---

# Phase 5c-2 — Structural dup-coord 해소 + B-2 마무리

## 목적 ^purpose

Phase 5b 실행 후 잔존한 **20 dup-coord 그룹**을 primary-parent layout promotion 패턴으로 구조적 재분류한다. 병행하여 Phase 5b 가 보류한 **9 B-2 MED-confidence 문서**의 최종 판정을 기록한다.

Phase 5b 가 "aspect 의미 명확화" 에 집중했다면, 본 5c-2 는 "좌표 키 분리" 에 집중한다. 핵심 메커니즘: tier 를 `system` → `layout` 으로 승격하면 `${tier}:${scope}:${layer}:${aspect}:${domainRoot}` 키의 앞머리가 바뀌어, 동일 coord 공간에서 나온다. layout 승격 시 `contains` → `refs` 강제 전환이 필요하다 (validator line 213-230).

## B-2 처리 결과 (9 docs)

Phase 5b 가 보류한 9 MED-confidence 문서의 최종 상태.

| doc_id | 현재 aspect | 처리 | 사유 |
|---|---|---|---|
| registry-service-modules | func_def | Kept | NestJS 런타임 모듈 조립 문서는 범용 서비스 구성. 어느 신규 값에도 맞지 않음. Phase 5b 판단 유지. dup-coord 그룹 아님. |
| df-narrative-group | func_def | Kept | 서사 문서 누적 구조. 분석/인코딩 어느 쪽도 아님. df-system layout 승격 (Part B) 으로 dup-coord 자연 해소. |
| df-system | func_def | Adjusted-via-tier | aspect 는 func_def 유지. tier 만 system → layout 승격 (Part B). |
| query-quality-bundle | process_flow | Kept | quality-bundle 특수 구조. gate_flow / query_contract 어디에도 완벽히 맞지 않음. dup-coord 그룹 아님. |
| system-infra | process_flow | Kept | "런타임 인프라 도메인" 그룹 루트. aspect 변경보다 layer 명확화가 본질. dup-coord 그룹 아님. |
| registry-system | api_contract | Kept | 중앙 레지스트리 — 도메인-특화 계약 아닌 fallback. dup-coord 그룹 아님. |
| dkg-skill-catalog | domain_data | Kept | RFC §D 에서 `dkg_data` 값 제외 결정. Phase 5c-2 에서도 신규 aspect 추가 없음. dkg-state-store 와 2-member 잔존 dup. |
| dkg-state-store | domain_data | Kept | 동일. dkg-skill-catalog 와 잔존 dup. |
| dkg-system | domain_data | Adjusted-via-tier | aspect 는 domain_data 유지. tier 만 system → layout 승격 (Part B). dkg-system 이 3-doc 그룹에서 이탈. |

집계: **6 kept / 3 adjusted-via-tier / 0 applied (new aspect) / 0 vocab 추가**. RFC §R6 "사람 결정 불가 < 20%" 기준 내.

## 5c-2 패턴별 결과

본 단계에서 적용된 구조적 패턴:

| 패턴 | 그룹 수 | 비고 |
|---|---:|---|
| Primary-parent layout promotion | 17 | 17 문서의 `tier: system` → `layout`, `contains` → `refs` 전환 |
| Cross-scope tag (Phase 5b 적용분 유지) | 1 | store-adapter-parity TODO (2 건) — Phase 5b B-3 에서 태그 부여 |
| Content merge | 0 | 해당 없음 (phase 5a 에서 이미 처리) |

## 그룹별 처리 내역 (20 → 10)

| # | 그룹 (주요 멤버) | 크기 | 승격 대상 | 결과 | 최종 |
|---|---|---:|---|---|---|
| 1 | bdd-contract-system / definition-harness | 2 | definition-harness → layout | 완전 해소 | ✓ |
| 2 | browser-runtime-system / browser-system | 2 | browser-system → layout | 완전 해소 | ✓ |
| 3 | clickhouse-analytics-todo / redis-cache-pipeline-todo | 2 | — (cross-scope 태그 유지) | 정보성 허용 | △ 잔존 |
| 4 | content-service-spec / payment-service-spec / shopping-backend-spec | 3 | shopping-backend-spec → layout | 부분 해소 (2 잔존) | △ 잔존 |
| 5 | cq-system / partial-binder-spec / wi-pack-format-system / wi-system | 4 | wi-system → layout | 부분 해소 (3 잔존) | △ 잔존 |
| 6 | decision-service-system / definition-service-system | 2 | decision-service-system → layout | 완전 해소 | ✓ |
| 7 | decode-api / decode-service-spec / decode-system | 3 | decode-system → layout | 부분 해소 (2 잔존) | △ 잔존 |
| 8 | decode-bigint / decode-service-system | 2 | decode-service-system → layout | 완전 해소 | ✓ |
| 9 | definition-management / observability-model / service-quality-bundle / harness-architecture | 4 | definition-management → layout | 부분 해소 (3 잔존) | △ 잔존 |
| 10 | definition-taxonomy / structural-taxonomy / taxonomy-boundaries | 3 | definition-taxonomy → layout | 부분 해소 (2 잔존) | △ 잔존 |
| 11 | df-narrative-group / df-system | 2 | df-system → layout | 완전 해소 | ✓ |
| 12 | dkg-skill-catalog / dkg-state-store / dkg-system | 3 | dkg-system → layout | 부분 해소 (2 잔존) | △ 잔존 |
| 13 | gate-api / gate-event-bus | 2 | gate-api → layout | 완전 해소 | ✓ |
| 14 | gate-cache-invalidation / gate-consistency | 2 | gate-cache-invalidation → layout | 완전 해소 | ✓ |
| 15 | ingest-quality-bundle / ingest-system | 2 | ingest-quality-bundle → layout (ingest-system boundary) | 완전 해소 | ✓ |
| 16 | pipeline-aggregator / pipeline-cache | 2 | pipeline-aggregator → layout | 완전 해소 | ✓ |
| 17 | query-api-spec / query-system | 2 | query-system → layout (query-api-spec boundary) | 완전 해소 | ✓ |
| 18 | scope-nesting-pattern-lifecycle / provider-patterns / scope-nesting-system | 3 | scope-nesting-system → layout | 부분 해소 (2 잔존) | △ 잔존 |
| 19 | spec-analyzer-system / spec-tracker-system / spec-verification-system | 3 | spec-verification-system → layout | 부분 해소 (2 잔존) | △ 잔존 |
| 20 | viz-roleplay-system / viz-surface-system / viz-system | 3 | viz-system → layout | 부분 해소 (2 잔존) | △ 잔존 |

완전 해소 = 9 그룹 / 부분 해소 + 잔존 = 11 (→ 그 중 1 은 태그 부여) / 신규 collision 발생 0.

## 잔여 dup-coord (10 그룹)

패턴별 분류:

### (a) 3+ 멤버 그룹 — 추가 promotion 시 layout 레벨 collision 발생 (7 건)

"primary 승격 완료, 2+ sibling 잔존" 공통 패턴. 남은 sibling 중 하나를 추가 layout 승격하면 이미 layout 으로 올라간 primary 와 같은 coord 에서 재충돌한다. 해소에는 **aspect 세분화** (RFC Phase 5c-3 / 또는 aspect-schema-hierarchy Phase C) 가 필요.

| # | 좌표 | 잔존 멤버 | 비고 |
|---|---|---|---|
| 4 | `system:feature:domain:domain_service_func @ system-libraries` | content-service-spec, payment-service-spec | 이커머스 도메인 peer 2. |
| 5 | `system:feature:domain:encoding_func @ partial-binder-spec` | cq-system, partial-binder-spec, wi-pack-format-system | 인코딩 코어 3. |
| 7 | `system:interface:mediation:decode_contract @ registry-system` | decode-api, decode-service-spec | decode-service-spec 은 `@def.boundary` 소스 → layout 승격 불가. |
| 9 | `system:flow:operation:definition_mgmt_flow @ definition-catalog-spec` | observability-model, service-quality-bundle, harness-architecture | definition 관리 서브도메인 3. |
| 10 | `system:data:domain:taxonomy_data @ definition-catalog-spec` | structural-taxonomy, taxonomy-boundaries | `cross-scope` 태그 기보유 — 의도적 공유. |
| 12 | `system:data:domain:domain_data @ dkg-system` | dkg-skill-catalog, dkg-state-store | DKG 내부 peer. |
| 18 | `system:feature:domain:nesting_func @ scope-nesting-system` | pattern-lifecycle, provider-patterns | scope-nesting 내부 peer. |
| 19 | `system:feature:operation:analyzer_func @ definition-catalog-spec` | spec-analyzer-system, spec-tracker-system | 분석기 peer. |
| 20 | `system:ui:experience:component @ canvas-viewport-spec` | viz-roleplay-system, viz-surface-system | viz 서브도메인 peer. |

(※ 위 표는 9 개이지만, 그 중 10 번(structural-taxonomy) 은 이미 cross-scope 태그 보유 → 정보성 허용 범주.)

### (b) LOW B-2 보류 (1 건)

| # | 좌표 | 잔존 멤버 | 비고 |
|---|---|---|---|
| 6 | `none:feature:operation:func_def @ store-adapter-parity` | clickhouse-analytics-todo, redis-cache-pipeline-todo | Phase 5b B-3 에서 cross-scope 태그 부여됨. 정보성 허용. |

## 전체 metrics before/after

| 지표 | Phase 5b 완료 (before) | Phase 5c-2 완료 (after) | Δ |
|---|---:|---:|---:|
| errors | 0 | 0 | 0 |
| warnings (total) | 82 | 68 | **-14** |
| duplicate-coordinate | 20 | 10 | **-10** (-50%) |
| multi-parent | 15 | 9 | -6 (layout 승격 시 일부 multi-parent 해소) |
| orphan | 45 | 45 | 0 |
| test count | 575/600 passing | 575/600 passing | 0 (회귀 없음) |
| system-contains-system (error) | 0 | 0 | 0 |
| invalid-code-boundary (error) | 0 | 0 | 0 |

**해석**:
- 20 dup-coord 그룹 중 **9 건 완전 해소 + 8 건 부분 해소** (sibling 수 감소) + 1 건 태그 유지 + 2 건 B-2 로 다뤄짐.
- 남은 10 그룹은 모두 "primary 승격 후 layout collision" 한계에 부딪힘. 본 RFC 범위 (tier promotion + B-2 판정) 에서는 더 이상 감소 불가.
- 전 배치가 errors=0 유지, system-contains-system 0, invalid-code-boundary 0 유지.
- 테스트 회귀 없음 (25 건 pre-existing 실패는 baseline 동일).

## 커밋 목록

| # | hash | 제목 |
|---|---|---|
| 1 | 7f534da0 | refactor(def): phase5c-2 — primary-parent layout promotion (17 docs) |
| 2 | 04dfe084 | refactor(def): phase5c-2 — additional layout promotions (2 docs) |
| (본 보고서) | — | docs(proposals): phase5c-2 structural resolution report |

## Phase C 연결

남은 10 dup-coord 그룹의 특징:
- 모두 **sibling peer 2+ 건** 이 같은 coord 에서 충돌.
- layout promotion 으로는 resolv 불가 (primary 이미 올라감, 추가 승격 시 layout 레벨 collision).
- **aspect 세분화**만이 구조적 해소 수단.

Phase C (aspect-schema-hierarchy RFC) 가 다음 요구사항을 충족하면 이 잔여군을 해소할 수 있다:
- 17 aspect 값을 추가로 세분화 (예: `encoding_func` → `wi_encoding_func` + `partial_encoding_func` + `cq_encoding_func`).
- 또는 aspect 를 계층형으로 전환 (parent aspect + child aspect) 하여 peer 3 건이 서로 다른 child 에 배치.
- scope/layer/depth 축에 특수값 추가 (예: depth=`sub-specification`) 는 RFC 변경 범위.

Phase 5c-2 는 **tier 축 활용의 한계** 를 도달했다. 다음 단계는 aspect 축의 재설계.

## 가역성

모든 변경은 frontmatter `tier` + `links[].type` 만 수정. 파일 본문 무수정. `tier: layout` → `tier: system` 복귀 + `type: refs` → `type: contains` 되돌리면 1:1 원복.

## 산출물

- 수정 파일: 19 건 (17 primary promotion + 2 추가 promotion)
- 본 보고서: `docs/proposals/domain-hierarchy/reviews/2026-04-21-phase5c-2-structural.md`
- baseline/after 로그: `/tmp/phase5c2-before.txt` · `/tmp/phase5c2-before-audit.txt` · `/tmp/phase5c2-after.txt` · `/tmp/phase5c2-after-audit.txt` · `/tmp/phase5c2-by-domain.txt`

## 참조

- [2026-04-21-phase5b-exec.md](./2026-04-21-phase5b-exec.md) — Phase 5b 실행, 20 잔존 그룹 리스트
- [2026-04-20-phase5c-abstract.md](./2026-04-20-phase5c-abstract.md) — layout promotion 패턴 원전
- [../../aspect-vocab-split/02-impact.md](../../aspect-vocab-split/02-impact.md) — MED confidence 매핑 (B-2 판정 근거)
- `packages/definition-catalog/src/validate.ts` §tier 검증 (line 213-255) — layout 제약
- `packages/definition-catalog/src/domain-root.ts` — dup-coord 키 파생
