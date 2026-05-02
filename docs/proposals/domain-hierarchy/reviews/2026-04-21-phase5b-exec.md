---
def:
  id: domain-hierarchy-phase5b-exec
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

# Phase 5b Execution — Aspect Vocabulary Split Rollout

## 목적 ^purpose

[aspect-vocab-split RFC](../../aspect-vocab-split/) 의 Phase B-0 ~ B-3 실행 결과를 기록한다. 계획: 17 dup-coord 그룹을 17 신규 aspect 값으로 재분산하여 "여러 시스템이 coarse 한 func_def/process_flow/api_contract/domain_data 를 공유하는" 문제를 해소한다. 실제 결과: dup-coord 17 → 20 으로 증가했으나, 이는 RFC 00-design §R1/R6 및 02-impact §A.3/§A.6/§B.2 등에서 명시적으로 예고한 "신규 값 재수렴" 때문으로, 의도된 중간 상태다.

## B-0 요약 — 어휘 확장 (non-breaking)

### 변경 파일 (4)

| 파일 | LOC 변화 | 변경 요약 |
|---|---:|---|
| `packages/definition-catalog/src/types.ts` | +25 | `DefAspect` union 에 17 신규 값 추가 (func_def/process_flow/api_contract/domain_data 자식) |
| `packages/definition-catalog/src/vocabulary.ts` | +91 | `DEF_ASPECT.entries` 23→40, `capacity` 64→128, `ko` 17 매핑, 신규 `ASPECT_PARENTS` map + `deriveAspectParent()` helper |
| `packages/definition-catalog/src/taxonomy.ts` | +32 | `VALID_SCOPE_ASPECTS` feature/flow/interface/data 에 신규 값 추가, `DEFINITION_TAXONOMY` 각 scope 에 description 추가 |
| `packages/definition-catalog/src/index.ts` | +2 | `ASPECT_PARENTS` / `deriveAspectParent` 재수출 |
| 합계 | +159 / -17 | |

### 빌드 및 검증

- `pnpm --filter definition-catalog build` 성공 (ESM 208KB, CJS 213KB, DTS 114KB)
- `pnpm --filter definition-data-source build` 성공
- `pnpm --filter @qa-sdk/cli build` 성공
- `pnpm exec qa-sdk def sync` — 1212건 문서, 3108건 링크 정상
- `pnpm exec qa-sdk def validate` — errors=0, warnings=73 (baseline 유지)
- `pnpm exec qa-sdk def audit` — dup-coord=17 (baseline 유지, 문서 미이동)

## B-1 배치별 결과

### B-1a: func_def → 6 신규 값 (19 HIGH 문서 이동)

| 신규 값 | 이동 문서 | 수 |
|---|---|---:|
| `harness_func` | bdd-contract-system, definition-harness | 2 |
| `gate_func` | definition-quality-gates | 1 |
| `analyzer_func` | spec-analyzer-system, spec-tracker-system, spec-verification-system, df-analysis-group | 4 |
| `domain_service_func` | content-service-spec, payment-service-spec, shopping-backend-spec | 3 |
| `encoding_func` | cq-system, partial-binder-spec, wi-pack-format-system, wi-system, decode-bigint, decode-service-system | 6 |
| `nesting_func` | scope-nesting-pattern-lifecycle, scope-nesting-provider-patterns, scope-nesting-system | 3 |
| 합계 | | **19** |

dup-coord 감소: A.1 (8→2), A.2 (3→3 재수렴), A.3 (4→4 재수렴), A.4 (3→2), A.5 (3→2), A.6 (3→3 재수렴), A.7 (2 유지 — B-3 처리).

### B-1b: process_flow → 5 신규 값 (10 HIGH 문서 이동)

| 신규 값 | 이동 문서 | 수 |
|---|---|---:|
| `lifecycle_flow` | browser-lifecycle-system | 1 |
| `ingest_flow` | ingest-quality-bundle, ingest-system | 2 |
| `pipeline_flow` | pipeline-system | 1 |
| `definition_mgmt_flow` | definition-management, definition-mgmt-observability-model, definition-service-quality-bundle, harness-architecture | 4 |
| `gate_flow` | gate-cache-invalidation, gate-consistency | 2 |
| 합계 | | **10** |

dup-coord 감소: B.1 (4→2), B.2 (4→4 재수렴), B.3 (3→2), B.4 (2 유지 — B-2 에서 system-libraries 이동).

### B-1c: api_contract → 5 신규 값 (11 HIGH 문서 이동)

| 신규 값 | 이동 문서 | 수 |
|---|---|---:|
| `browser_contract` | browser-runtime-system, browser-system | 2 |
| `pipeline_contract` | pipeline-aggregator, pipeline-cache | 2 |
| `decode_contract` | decode-api, decode-service-spec, decode-system | 3 |
| `gate_contract` | gate-api, gate-event-bus | 2 |
| `query_contract` | query-api-spec, query-system | 2 |
| 합계 | | **11** |

dup-coord: C.1 (4→2+2, 둘 다 재수렴), C.2 (4→3 decode_contract + registry-system fallback), C.3 (4→2+2, 둘 다 재수렴).

### B-1d: domain_data → 2 신규 값 (4 HIGH 문서 이동)

| 신규 값 | 이동 문서 | 수 |
|---|---|---:|
| `taxonomy_data` | definition-taxonomy, structural-taxonomy, taxonomy-boundaries | 3 |
| `coordinate_model_data` | dual-coordinate-system | 1 |
| 합계 | | **4** |

D.1 (5→1+3 taxonomy_data 재수렴 + definition-catalog-spec 독립 fallback). D.2 (dkg, 3 유지 — RFC §D 에서 제외 결정).

### B-1 합계

- 이동 문서: **44** (HIGH 전원; RFC 문서가 명시한 47 중 LOW 2+MED 1 은 보류)
- 빌드/sync/validate 매 배치 후 errors=0

## B-2 적용/보류

### 적용 (1 건)

| doc_id | 변경 | 근거 |
|---|---|---|
| system-libraries | `process_flow` → `relation` | RFC §B.4 Option-B — "라이브러리 간 의존 관계" 는 process 가 아닌 relation 에 적합 |

### 보류 (9 건, fallback 유지 선택)

| doc_id | 현재 aspect | 보류 사유 |
|---|---|---|
| registry-service-modules | func_def | NestJS 런타임 모듈 조립 — 일반 서비스 구성 (RFC §A.4 fallback 권장) |
| df-narrative-group | func_def | 서사 문서 누적 구조 — 분석도 인코딩도 아님 (RFC §A.5) |
| df-system | func_def | 다차원 벡터 공간 "시스템 전체" — 하위 값 모두 포괄 (RFC §A.5) |
| query-quality-bundle | process_flow | 품질 번들 특수 구조 — gate_flow/query_contract 어디에도 완벽히 맞지 않음 (RFC §B.3) |
| system-infra | process_flow | "런타임 인프라 도메인" 그룹 루트 — layer 명확화가 본질, aspect 변경 아님 (RFC §B.4) |
| registry-system | api_contract | 중앙 레지스트리 — 도메인-특화 계약이 아니므로 fallback 유지 (RFC §C.2) |
| dkg-skill-catalog | domain_data | RFC §D 에서 `dkg_data` 값 제외 결정, Phase 5c 계층화 대기 |
| dkg-state-store | domain_data | 동일 |
| dkg-system | domain_data | 동일 |

적용 1 / 보류 9 = RFC 의 MED 10 건 100% 처리.

## B-3 최종 케이스

### 적용: A.7 TODO 그룹 cross-scope 태그 (2 건)

- `clickhouse-analytics-todo` — `tags` 에 `cross-scope` 추가
- `redis-cache-pipeline-todo` — `tags` 에 `cross-scope` 추가

효과: dup-coord 자체는 해소되지 않지만(20 유지), 리뷰어에게 "의도적 공동 좌표" 임을 명시. Phase 5a Class M 선례 (2026-04-20-phase5a-class-m.md) 와 동일 패턴.

### LOW 보류 (2 건)

| doc_id | 사유 |
|---|---|
| decision-service-system | FlowSchema/FlowInstance 서비스 전체 — 새 값 어느 것에도 맞지 않음. 사람 결정 필요 |
| definition-service-system | NestJS 문서 메타데이터 서비스 전체 — "서비스 자체" vs "주 기능" 모호 |

두 문서 모두 `func_def` fallback 유지. RFC §A.1 low confidence 처리 지침 준수.

## 전체 metrics before/after

| 지표 | Phase 5d 완료 (before) | Phase 5b 완료 (after) | Δ | 비고 |
|---|---:|---:|---:|---|
| errors | 0 | 0 | 0 | 유지 |
| warnings (total) | 73 | 82 | **+9** | 신규 aspect 재수렴으로 인한 dup-coord 그룹 증가 영향 |
| duplicate-coordinate | 17 | 20 | **+3** | 기존 7 func_def 그룹 → 5 잔존(def-cat 2, decision-standard 1, store-adapter 1, nesting 1, encoding 1) + 6 신규 재수렴 그룹 |
| multi-parent | 15 | 15 | 0 | 유지 |
| orphan | 7 | 7 | 0 | 유지 |
| test count | 575/600 passing | 575/600 passing | 0 | 2건 capacity 하드코딩 테스트를 SSOT 파생으로 교정 |

**해석**: dup-coord 수 증가는 예상된 결과다. RFC 02-impact.md 가 제시한 "재수렴" 위험(§A.3/§A.6/§B.2/§C.1/§C.3/§D.1) 은 실측으로 확인되었고, 본 Phase 5b 는 **aspect 의미 명확화**를 달성했다(coarse 한 func_def 288건 중 19건이 역할별로 분산됨). 구조적 dup-coord 해소는 Phase 5c (sibling 계층화 + contains 명시) 에서 다룬다.

## 해소된 dup-coord 그룹 (전/후 대응)

| 원 그룹 (Phase 5d 상태) | 크기 | Phase 5b 후 | 잔존 여부 |
|---|---:|---|---|
| A.1 `system:feature:operation:func_def` @ definition-catalog-spec | 8 | 2 (decision/definition-service-system 만) | 잔존 (LOW, 보류) |
| A.2 `system:feature:domain:func_def` @ system-libraries | 3 | 0 (전원 domain_service_func 로 이동, 새 그룹 3 형성) | 이동 성공, 새 그룹 재수렴 |
| A.3 `system:feature:domain:func_def` @ partial-binder-spec | 4 | 0 (전원 encoding_func, 새 그룹 4) | RFC 예고대로 재수렴 |
| A.4 `system:feature:mediation:func_def` @ registry-system | 3 | 1 (registry-service-modules, MED 보류) + 새 encoding_func 2 그룹 | 부분 해소 |
| A.5 `system:feature:domain:func_def` @ decision-standard-group | 3 | 2 (df-narrative/df-system, MED 보류) | 부분 해소 |
| A.6 `system:feature:domain:func_def` @ scope-nesting-system | 3 | 0 (전원 nesting_func, 새 그룹 3) | RFC 예고대로 재수렴 |
| A.7 `none:feature:operation:func_def` @ store-adapter-parity | 2 | 2 (cross-scope 태그, info 강등 대상) | 태그 부여, 그룹 유지 |
| B.1 `system:flow:operation:process_flow` @ storage-system | 4 | 0 (4 신규 값 분산) + 새 ingest_flow 2 그룹 | 부분 해소 |
| B.2 `system:flow:operation:process_flow` @ definition-catalog-spec | 4 | 0 (전원 definition_mgmt_flow, 새 그룹 4) | RFC 예고대로 재수렴 |
| B.3 `system:flow:operation:process_flow` @ gate-system | 3 | 1 (query-quality-bundle MED) + 새 gate_flow 2 그룹 | 부분 해소 |
| B.4 `layout:flow:operation:process_flow` @ system-libraries | 2 | 1 (system-libraries → relation 이동) + system-infra 1 (MED 보류) | 대부분 해소 |
| C.1 `system:interface:operation:api_contract` @ storage-system | 4 | 0 + 2 새 그룹 (browser_contract, pipeline_contract 각 2) | 재수렴 |
| C.2 `system:interface:mediation:api_contract` @ registry-system | 4 | 1 registry-system fallback + 새 decode_contract 3 그룹 | 부분 해소 |
| C.3 `system:interface:mediation:api_contract` @ gate-system | 4 | 0 + 2 새 그룹 (gate_contract, query_contract 각 2) | 재수렴 |
| D.1 `system:data:domain:domain_data` @ definition-catalog-spec | 5 | 1 (def-catalog-spec fallback) + 새 taxonomy_data 3 그룹 | 부분 해소 |
| D.2 `system:data:domain:domain_data` @ dkg-system | 3 | 3 (dkg_data 제외 결정, fallback 유지) | 미변동 (설계 의도) |
| viz `system:ui:experience:component` @ canvas-viewport-spec | 3 | 3 (본 RFC 범위 외) | 미변동 |

## 남은 dup-coord 그룹 (Phase 5.5 Wave 3 후보)

신규 재수렴 그룹 (Phase 5b B-1 결과로 발생한 새 그룹):

1. `system:feature:operation:harness_func` @ definition-catalog-spec — 2 docs (bdd-contract / definition-harness) — Phase 5c: `definition-harness refines bdd-contract-system` 또는 반대 계층화
2. `system:feature:operation:analyzer_func` @ definition-catalog-spec — 3 docs (spec-analyzer / spec-tracker / spec-verification) — spec-verification-system 이 이미 depends_on 으로 셋을 집약 중, `contains` 로 격상하면 해소
3. `system:feature:domain:domain_service_func` @ system-libraries — 3 docs (content / payment / shopping) — domain 성격은 유지 필요, 별도 `ecommerce_func` 분할 또는 contains 계층화
4. `system:feature:domain:encoding_func` @ partial-binder-spec — 4 docs (cq / partial-binder / wi-pack-format / wi) — `wi-system` 을 contains parent 로 승격
5. `system:feature:mediation:encoding_func` @ registry-system — 2 docs (decode-bigint / decode-service-system) — decode-system cluster 와 병합
6. `system:feature:domain:nesting_func` @ scope-nesting-system — 3 docs — scope-nesting-system 을 contains parent 로 승격
7. `system:flow:operation:definition_mgmt_flow` @ definition-catalog-spec — 4 docs — `definition-management` 를 primary parent 로 승격
8. `system:flow:operation:gate_flow` @ gate-system — 2 docs — contains 계층화
9. `system:flow:operation:ingest_flow` @ storage-system — 2 docs — ingest-system 이 bundle 을 contains
10. `system:interface:mediation:decode_contract` @ registry-system — 3 docs — decode-system contains decode-api/service-spec
11. `system:interface:mediation:gate_contract` @ gate-system — 2 docs — gate-api contains event-bus
12. `system:interface:mediation:query_contract` @ gate-system — 2 docs — query-system contains query-api
13. `system:interface:operation:browser_contract` @ storage-system — 2 docs — browser-system contains runtime
14. `system:interface:operation:pipeline_contract` @ storage-system — 2 docs — pipeline-system contains aggregator/cache
15. `system:data:domain:taxonomy_data` @ definition-catalog-spec — 3 docs — definition-taxonomy 를 primary parent

잔존 원 그룹:
- A.1 decision/definition-service-system (2)
- A.5 df-narrative-group/df-system (2)
- A.7 clickhouse/redis TODO (2, cross-scope 태그 부여됨)
- B.4 system-infra 단독 (1 — dup-coord 발동 안 함, 실제 제외)
- D.2 dkg-system cluster (3)
- viz cluster (3)

## 커밋 목록

| # | hash | 제목 |
|---|---|---|
| 1 | e92fd341 | feat(def): phase5b B-0 — add 17 aspect values + ASPECT_PARENTS map |
| 2 | 4fee2e17 | fix(def): phase5b B-1a func_def migration (19 docs) |
| 3 | 43b729e8 | fix(def): phase5b B-1b process_flow migration (10 docs) |
| 4 | 12a0d084 | fix(def): phase5b B-1c api_contract migration (11 docs) |
| 5 | a8a3b11c | fix(def): phase5b B-1d domain_data migration (4 docs) |
| 6 | bd043077 | fix(def): phase5b B-2 med-confidence system-libraries → relation (1 doc) |
| 7 | d3a2d95b | fix(def): phase5b B-3 add cross-scope tag to store-adapter-parity TODOs (2 docs) |
| 8 | baac3add | test(def): derive capacity constants from SSOT in scope-registry.test |

총 8 커밋. Report 커밋 (본 문서) 은 9번째로 추가 예정.

## 다음 단계

1. **Phase 5c 재개 (Phase 5.5 Wave 3)** — 위 15 신규 재수렴 그룹 대부분이 "동일 domain_root 하 같은 aspect" 패턴이므로 `contains` primary parent 승격으로 해소 가능. 예상 dup-coord 감소: 20 → 7~8.
2. **Phase C 트리거 재검토** — aspect 수 40 (임계치 도달). rollup 쿼리 수요가 5회 이상 누적되면 schema migration 개시.
3. **LOW 케이스 사람 결정** — decision-service-system / definition-service-system 은 Phase 5c 에서 `contains` 구조로 재평가.

## 참조

- [../../aspect-vocab-split/00-design.md](../../aspect-vocab-split/00-design.md) — 제안 분할 근거
- [../../aspect-vocab-split/01-migration.md](../../aspect-vocab-split/01-migration.md) — Phase B-0~B-4 계획
- [../../aspect-vocab-split/02-impact.md](../../aspect-vocab-split/02-impact.md) — 문서별 매핑
- [2026-04-20-phase5d-cleanup.md](./2026-04-20-phase5d-cleanup.md) — Phase 5b 직전 상태 (dup-coord 17)
- `packages/definition-catalog/src/vocabulary.ts` §`DEF_ASPECT` / `ASPECT_PARENTS`
- `packages/definition-catalog/src/taxonomy.ts` §`VALID_SCOPE_ASPECTS`
- 검증 로그: `/tmp/phase5b-b0.txt`, `/tmp/phase5b-final.txt`, `/tmp/phase5b-by-domain.txt`
