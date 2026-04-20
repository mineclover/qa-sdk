---
def:
  id: aspect-vocab-split-00-design
  type: knowledge
  knowledge_kind: proposal
  lifecycle: review
  owner_system: definition-catalog
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: system
  depth: specification
  links:
    - target: aspect-vocab-split-readme
      type: depends_on
status: under-review
date: 2026-04-21
part_of: aspect-vocab-split
role: design
---

# Aspect Vocabulary Split — 설계 개요

## 목적 ^purpose

현재 17 건의 duplicate-coordinate 경고는 다음 네 개 aspect 가 "여러 시스템의 공통 분류" 로 작동하면서 발생했다.

- `func_def`: 7 그룹 (48% 의 dup-coord)
- `process_flow`: 4 그룹
- `api_contract`: 3 그룹
- `domain_data`: 2 그룹

본 문서는 이 네 aspect 각각에 대해 (a) 현재 사용 현황, (b) 자연 클러스터, (c) 제안 하위 aspect 값, (d) 선정 근거, (e) 리스크를 기술한다. 문서 마이그레이션 계획은 [01-migration.md](./01-migration.md), 개별 문서 매핑은 [02-impact.md](./02-impact.md) 에서 다룬다.

## 인벤토리 (2026-04-21 기준)

| aspect | 총 사용 문서 수 | dup-coord 그룹 수 | 영향 문서 수 (dup-coord 멤버) |
|---|---:|---:|---:|
| `func_def` | 288 | 7 | 26 |
| `process_flow` | 142 | 4 | 13 |
| `api_contract` | 100 | 3 | 12 |
| `domain_data` | 149 | 2 | 8 |

데이터 소스: `sqlite3 data/definition-service.sqlite "SELECT aspect, COUNT(*) FROM documents GROUP BY aspect"` 및 `pnpm exec qa-sdk def audit` 의 duplicate-coordinate 블록.

dup-coord 멤버 전수 목록은 [02-impact.md](./02-impact.md) 표에서 확인 가능.

## 개념 구분 — 왜 값 추가로 충분한가

Phase 5 redesign 은 두 가지 해소 축을 제시했다.

1. **owner_system / root 분리** — 서비스 경계 명확화. layout 승격과 `@def.boundary` 재지정으로 달성 가능. Phase 5c 에서 11 건 처리.
2. **aspect 어휘 세분화** — taxonomy 재구성. 5c 로 해소되지 않는 잔여 그룹의 근본 원인.

본 제안은 (2) 를 다룬다. Phase 5c 가 **"`contains` 관계 명시" 만으로도 tier 승격을 통해 좌표를 분리할 수 있다** 는 점을 증명했지만, (a) `@def.boundary` 제약에 묶인 그룹, (b) 3+ 멤버가 남아있는 그룹, (c) 둘 다 이미 layout 인 그룹 은 구조 변경만으로는 해소할 수 없다. 공통 패턴: **여전히 "같은 scope × layer × aspect" 를 공유하는 서로 다른 시스템** 이 존재.

해결의 본질은 aspect 가 지나치게 coarse 해서 시스템의 정체성을 식별하지 못하는 것이다. 기존 값 `func_def` 는 "기능 정의" 라는 최상위 레이블이며, "기능" 의 성격(생성 대상인가, 검증 대상인가, 실행 런타임인가) 을 구별하지 못한다.

## 제안 분할

본 절에서 각 target aspect 의 제안 새 값을 정의한다. 각 값은 다음 네 가지를 충족해야 한다.

- **의미 구분** — 다른 형제 값과 gray-area overlap 없음
- **100% 커버 + fallback** — 현재 aspect 의 모든 사용처를 새 값 중 하나 또는 fallback 으로 귀속 가능
- **이름 간결성** — kebab 아닌 underscore, 2 단어 결합
- **dup-coord 해소 기여** — 같은 신규 값에 3+ 형제가 다시 수렴하지 않음(반복 패턴 방지)

### A. `func_def` → 7 개 sub-aspect + fallback

현재 288 문서. dup-coord 7 그룹 × 26 멤버가 대상.

| 제안 값 | 의미 | 대표 소속 시스템 | 대표 마이그레이션 문서 (현재 func_def) |
|---|---|---|---|
| `codegen_func` | 카탈로그/스키마를 TypeScript/Proto 소스 코드로 생성하는 기능 정의 | apm-system, codegen, definition-quality-gates | apm-codegen-system, codegen-core, spec-prop-codegen |
| `harness_func` | 테스트 하네스/FSM/문서-코드 1:1 분해용 실행 기능 정의 | definition-harness, definition-catalog | definition-harness, definition-harness-derive, bdd-contract-system, simulation-tests-spec |
| `gate_func` | 품질 게이트·정합성 검증 엔진 기능 정의 | gate-system, quality-gates-system | definition-quality-gates, definition-gate-derivation, gate-engine-func |
| `analyzer_func` | 수집된 이벤트/문서에 대한 분석·drift·tracker 기능 정의 | analysis-system, df-system, spec-tracker | analysis-system, spec-analyzer-system, spec-tracker-system, spec-verification-system, df-analysis-group |
| `encoding_func` | 좌표/값 인코딩·디코딩·pack-format 기능 정의 (weighted-index/partial-binder/cq 계열) | wi-system, cq-system, partial-binder, decode-system | cq-system, partial-binder-spec, wi-pack-format-system, wi-system, decode-bigint |
| `domain_service_func` | 도메인 비즈니스 서비스(e-commerce, 결제, 콘텐츠) 기능 정의 | platform-demo-api, shopping-backend | content-service-spec, payment-service-spec, shopping-backend-spec |
| `nesting_func` | Provider/scope nesting pattern 의 lifecycle/resolution 기능 정의 | scope-nesting-system | scope-nesting-pattern-lifecycle, scope-nesting-provider-patterns, scope-nesting-system |
| `func_def` (fallback 유지) | 위 7 값 중 어느 것에도 속하지 않는 일반 기능 정의 | 모든 기타 | 나머지 약 260 문서 현행 유지 |

**dup-coord 해소 전망**: 7 개 func_def 그룹 모두 서로 다른 새 aspect 로 분산되므로 `func_def` 키 기준 잔여 dup-coord 는 **0** 이 될 것으로 예상(단 decision-service-system, definition-service-system 등 "서비스의 general 기능" 카테고리는 HIGH 판단 어려움 — MED 처리).

### B. `process_flow` → 5 개 sub-aspect + fallback

현재 142 문서. dup-coord 4 그룹 × 13 멤버가 대상.

| 제안 값 | 의미 | 대표 소속 시스템 | 대표 마이그레이션 문서 |
|---|---|---|---|
| `lifecycle_flow` | 브라우저/프로세스/세션 lifecycle 상태 전이 흐름 | browser-lifecycle | browser-lifecycle-system, browser-lifecycle-states |
| `ingest_flow` | 이벤트/로그 ingest 파이프라인 흐름 | ingest-system | ingest-system, ingest-quality-bundle, ingest-interface-pipeline |
| `pipeline_flow` | 일반 파이프라인 처리 단계 흐름 (realization/enrichment 등) | pipeline-system, realization-pipeline | pipeline-system, pipeline-phase-flow, realization-pipeline |
| `gate_flow` | gate 캐시 무효화·consistency·query quality 흐름 | gate-system, query-system | gate-cache-invalidation, gate-consistency, query-quality-bundle |
| `definition_mgmt_flow` | definition-catalog 관리(harness/observability/quality) 흐름 | definition-catalog | definition-management, definition-mgmt-observability-model, definition-service-quality-bundle, harness-architecture |
| `process_flow` (fallback 유지) | 위 5 값에 속하지 않는 일반 process 흐름 | 기타 | 나머지 약 120 문서 현행 유지 |

**잔여 고려**: `layout:flow:operation:process_flow @ system-libraries` (system-infra / system-libraries 2 멤버) 는 2 개 모두 tier=`layout` 의 system-root. system-infra 는 infra scope 의 인프라 루트, system-libraries 는 라이브러리 루트. 본 제안은 이 그룹을 대상으로 `infra_flow` 를 추가 정의하지 않고 **system-libraries 의 기존 aspect 를 `process_flow` 가 아닌 `relation` 으로 이동** 하는 방식(Option-B)을 권장한다 — system-libraries 는 "라이브러리 간 의존 관계" 를 다루지 "흐름" 을 다루지 않기 때문이다. 이 세부 조치는 B-3 단계에서 사람이 결정한다.

### C. `api_contract` → 5 개 sub-aspect + fallback

현재 100 문서. dup-coord 3 그룹 × 12 멤버가 대상.

| 제안 값 | 의미 | 대표 소속 시스템 | 대표 마이그레이션 문서 |
|---|---|---|---|
| `decode_contract` | decode 서비스·API·스펙 계약 | decode-system | decode-api, decode-service-spec, decode-system, decode-svc-api-contract |
| `gate_contract` | gate 서비스·이벤트 버스 API 계약 | gate-system | gate-api, gate-event-bus |
| `query_contract` | query 서비스 API 계약 | query-system | query-api-spec, query-system, query-api |
| `browser_contract` | 브라우저 런타임/프로토콜 계약 | browser-system | browser-runtime-system, browser-system |
| `pipeline_contract` | 파이프라인 aggregator·cache 계약 | pipeline-system | pipeline-aggregator, pipeline-cache |
| `api_contract` (fallback 유지) | 기타 일반 API 계약 (definition-service, ingest-server, registry, platform-sdk 등 "도메인 외 일반 서비스 계약") | 기타 | 나머지 약 75 문서 현행 유지 |

**dup-coord 해소 전망**: 3 그룹 중 registry-system 그룹의 `registry-system` 자체는 fallback(`api_contract`) 으로 남고 decode-* 는 `decode_contract` 로 이동하면 해당 그룹은 2 → 1 로 축소. 완전 해소 확인은 B-1 적용 후 audit 로 재검증 필요.

### D. `domain_data` → 3 개 sub-aspect + fallback

현재 149 문서. dup-coord 2 그룹 × 8 멤버가 대상 (viz-* 그룹은 `component` aspect 이므로 본 아이템 대상에서 제외).

| 제안 값 | 의미 | 대표 소속 시스템 | 대표 마이그레이션 문서 |
|---|---|---|---|
| `taxonomy_data` | 분류 체계(taxonomy) 데이터 — meta-taxonomy 포함 | definition-catalog | definition-taxonomy, structural-taxonomy, taxonomy-boundaries, meta-taxonomy, pm-taxonomy, df-taxonomy |
| `coordinate_model_data` | 좌표·주소·차원 데이터 모델 | coord-foundation, definition-catalog | dual-coordinate-system, coord-foundation, coord-closed-space, coord-stride-stability, address-index, definition-addressing |
| `dkg_data` | DKG 노드/엣지/스킬 카탈로그·state-store 데이터 | dkg-system | dkg-skill-catalog, dkg-state-store, dkg-system, dkg-node-types, dkg-edge-types |
| `domain_data` (fallback 유지) | 비즈니스 도메인 일반 데이터 (content, payment, shopping, perm, permission, table-schema 등) | 기타 | 나머지 약 130 문서 현행 유지 |

**dup-coord 해소 전망**: definition-catalog-spec 흡수 5 멤버 중 4 멤버가 `taxonomy_data`/`coordinate_model_data` 로 분산 → 해당 그룹은 5 → 1(definition-catalog-spec 자신만 남음) 로 축소. dkg 그룹은 3 멤버 모두 `dkg_data` 로 귀속되어 해당 그룹은 **재발** — 경고 3 → 3. 이 경우 `dkg_data` 는 세분화 의미가 없다. 대안: dkg 그룹은 aspect 분할이 아니라 Phase 5c 의 layout 승격 또는 sibling 계층화(`dkg-state-store refines dkg-skill-catalog`) 로 해소한다(본 RFC 범위 밖).

**결론**: `dkg_data` 를 제안에서 제외하는 버전 (domain_data → `taxonomy_data`/`coordinate_model_data` 2 개만) 이 더 잘 작동한다. 02-impact.md 표에서는 dkg 3 멤버를 confidence=`low`(사람 결정 필요) 로 표기한다.

### E. 제외 — `component` (viz 그룹)

`system:ui:experience:component @ canvas-viewport-spec` (viz-roleplay-system, viz-surface-system, viz-system) 1 그룹은 `component` aspect 다. 해결책은 viz 도메인 내부의 계층화이며 (viz-system 을 `contains` parent 로, roleplay/surface 를 자식으로), tier 승격 후에는 aspect 분할이 필요 없다. 본 제안에서 다루지 않는다(`docs/proposals/domain-hierarchy/reviews/2026-04-20-phase5c-abstract.md` §"Class A 3+ 멤버" 로 재분류 권장).

## 명명 컨벤션

- 모든 신규 값은 `snake_case`, 2 단어 결합.
- 첫 단어 = **도메인 식별자** (소속 시스템/영역), 두 번째 단어 = **기존 aspect 의 개념 부류** (func/flow/contract/data).
- 예: `codegen_func` = `codegen` + `func`.
- 기존 coarse 값은 **fallback** 으로 유지하여 하위 분류로 귀속되지 않는 경우를 허용. 제거는 B-4 단계에서만 검토.

## 유효 scope-aspect 조합 (VALID_SCOPE_ASPECTS)

신규 값의 scope 매핑:

| scope | 신규 aspect |
|---|---|
| `feature` | `codegen_func`, `harness_func`, `gate_func`, `analyzer_func`, `encoding_func`, `domain_service_func`, `nesting_func` |
| `flow` | `lifecycle_flow`, `ingest_flow`, `pipeline_flow`, `gate_flow`, `definition_mgmt_flow` |
| `interface` | `decode_contract`, `gate_contract`, `query_contract`, `browser_contract`, `pipeline_contract` |
| `data` | `taxonomy_data`, `coordinate_model_data` |

Phase B-0 은 위 매핑을 `VALID_SCOPE_ASPECTS` 에 **추가** 한다(기존 값 제거는 B-4 까지 없음).

## Capacity 영향

현재 `def_aspect.entries` = 23, capacity = 64. 본 제안 추가값 = 17(`feature` 7 + `flow` 5 + `interface` 5 + `data` 2, `dkg_data` 제외).

- 총 entry 수: 23 + 17 = **40**
- 필요 capacity: `nextPowerOf2(40 * 2 = 80) = 128`
- 현재 capacity 64 → **128 확장 필요** (Phase B-0 에서 `capacity: 64 → 128`).
- headroom = 128 - 40 = 88 (여유 > 1, critical 아님).

## Confidence 분포 (02-impact.md 요약)

| aspect | HIGH | MED | LOW |
|---|---:|---:|---:|
| `func_def` | 21 | 3 | 2 |
| `process_flow` | 11 | 2 | 0 |
| `api_contract` | 10 | 2 | 0 |
| `domain_data` | 5 | 3 | 0 |
| 합계 | **47** | **10** | **2** |

LOW 비율 = 2/59 ≈ 3.4% → 분할 기준의 granularity 는 적절. LOW 2 건은 `decision-service-system` 과 `definition-service-system` 로, "서비스 전체" 와 "서비스의 주 기능" 사이 모호하여 인간 판단 필요.

## 리스크 / 오픈 이슈

### 리스크

- **R1 — 좌표 변경 cascade**: aspect 변경은 문서의 `address` 불변성에는 영향이 없지만(address 는 독립 정수), `scope:aspect:depth:layer` 문자열 좌표 키에 의존하는 외부 도구(링크 빌더, validator 등) 가 변경된 좌표를 인식하지 못할 수 있음. 대응: B-0 에서 새 값만 추가하여 기존 문서 좌표를 바꾸지 않음. 실제 좌표 이동은 B-1~B-3 에서 문서 단위로 점진 진행.
- **R2 — VALID_SCOPE_ASPECTS 검증 실패**: 신규 aspect 를 scope 에 추가하지 않으면 `validateScopeAspect` 가 에러를 뱉어 정규 스펙 검증이 실패한다. 대응: B-0 에서 vocabulary 와 동시에 `VALID_SCOPE_ASPECTS` 갱신. 누락 시 `pnpm exec qa-sdk def validate` 가 즉시 errors 로 보고.
- **R3 — 외부 도구/`@def.boundary` 의 aspect 의존**: validator 외에도 `packages/definition-data-source/` 나 CLI `def audit` 가 aspect 문자열을 하드코딩한 위치가 있는지 확인 필요. 현재 확인된 소스는 `VALID_SCOPE_ASPECTS` 한 곳이며, `@def.boundary` 는 doc-id 기반이라 aspect 의존 없음. Open Question Q2 에서 소스 grep 전수 결과 기록 예정.
- **R4 — 사람 리뷰 부담**: MED 10 건은 "두 개 이상 신규 값이 모두 적합한" 문서로, 개별 승인이 필요하다. 1 건당 ~3 분 가정 시 약 30 분 소요.
- **R5 — 도메인 전문가 부재**: `encoding_func` (wi/partial-binder/cq/decode) 는 수학적 인코딩 도메인으로 추가 세분화(예: `hardware_func` vs `cpu_func`) 가 필요할 가능성이 있다. 단 현재 dup-coord 는 1 그룹만 유발하므로 본 제안에서는 단일 값으로 처리.
- **R6 — confidence=LOW 비율 증가**: 현재 LOW = 3.4% 는 양호. 만약 향후 인벤토리를 다시 돌렸을 때 LOW 비율이 20% 이상이면 분할 granularity 가 과도/과소 (재설계 필요) 라는 신호로 삼는다. 현재는 해당 없음.

### 오픈 이슈

- **Q1 — 기존 `func_def` 등 coarse 값의 생명주기**: B-4 에서 실제로 제거할 것인가, 영구 fallback 으로 유지할 것인가? 제거 시 288 문서 중 약 260 건이 새 값 또는 재분류 필요. 권장: **영구 fallback 유지**. 비용 대비 이득 낮음.
- **Q2 — aspect 참조를 하드코딩한 소스**: `VALID_SCOPE_ASPECTS` 외에 `process.env` 기반 필터링 등에서 aspect 문자열을 쓰는 곳이 있는가? B-0 직전에 `grep -R "func_def\|process_flow\|api_contract\|domain_data" packages/` 로 전수 확인 필요.
- **Q3 — scope 확장 병행 검토**: 현재 7 scope. `decode` / `query` / `encoding` 등 신규 scope 를 추가하여 aspect 는 건드리지 않는 대안이 가능한가? 비교: (a) aspect 분할 — capacity 확장 + 17 값 추가, (b) scope 확장 — capacity 확장 + 3 값 추가 + 모든 기존 aspect 재분배 필요. **비용 관점에서 (a) 선호**. Q3 는 후속 토론 주제.
- **Q4 — 분할 축: "기능 종류" vs "역할"**: 예를 들어 `codegen_func` 는 "codegen 이라는 기능 종류" 지만 `harness_func` 는 "test harness 라는 역할". 축을 통일해야 하는가? 현재 제안은 혼합 — **소속 시스템 도메인을 축으로 채택**. 일관성을 위해 `X_func` 의 X 는 전부 "도메인 식별자" 로 정렬. 역할 축은 `def_layer` 가 이미 담당(domain/operation/mediation/experience).

## 적용 후 예상 상태

B-0 (vocabulary 만) 적용 시:
- errors = 0 (유지)
- warnings = 73 (유지 — aspect 추가만으로는 변하지 않음)
- dup-coord = 17 (유지 — 문서 미이동)

B-1 (HIGH 마이그레이션) 완료 시 (낙관적 추정):
- dup-coord: 17 → **3–5** (func_def 7 → 0, process_flow 4 → 1, api_contract 3 → 0, domain_data 2 → 1, viz 그룹 1 유지)

## 참조

- [README.md](./README.md) — 본 RFC 진입점
- [01-migration.md](./01-migration.md) — 단계별 실행 계획
- [02-impact.md](./02-impact.md) — 문서별 매핑 표
- `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase5-redesign.md` §"Class D" — Class D 10 그룹 원 분류
- `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase5c-abstract.md` — 본 RFC 직전 Class A 처리 내역
- `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase5d-cleanup.md` — proposal exemption 선례(dup-coord 해소 경로 중 하나)
- `packages/definition-catalog/src/vocabulary.ts` §`DEF_ASPECT` — 적용 지점
- `packages/definition-catalog/src/taxonomy.ts` §`VALID_SCOPE_ASPECTS` — 적용 지점
- `docs/specs/definition-catalog/definition-taxonomy.spec.md` — semantic definition 반영 대상
