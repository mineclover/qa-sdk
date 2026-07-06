---
def:
  id: domain-hierarchy-phase5-redesign
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
    - target: domain-hierarchy-readme
      type: depends_on
  sources:
    - packages/definition-catalog/src/types.ts
    - packages/definition-catalog/src/taxonomy.ts
    - packages/definition-catalog/src/vocabulary.ts
    - packages/definition-catalog/src/validate.ts
    - docs/specs/system/aspect-naming-convention.rule.md
    - docs/specs/system/validator-suppression-tags.rule.md
status: under-review
date: 2026-04-20
part_of: domain-hierarchy
role: plan
---

# Phase 5 재설계 — 36 duplicate-coordinate 그룹 분류 계획

## 목적 ^purpose

Phase 3b Option B 적용 후 duplicate-coordinate 그룹이 28 → **36** 으로 증가했다. 원래 Phase 5 plan(`01-migration.md`)은 5~8쌍의 "진짜 내용 중복" merge 를 전제했으나, 자식→부모 `depends_on` 흡수로 *형제 collision* 이 대규모로 드러나면서 범위가 완전히 달라졌다. 본 문서는 36 그룹을 **M / D / A / C** 네 클래스로 전수 분류하고, 각 그룹마다 권장 조치·효과·리스크를 명시하여 **사람 승인 기반의 단계별 실행 계획(Phase 5a~5d)** 으로 재구성한다. 분석만 수행하며 프론트매터/aspect 어휘 변경은 본 문서에서 수행하지 않는다.

## 분류 체계

| 클래스 | 정의 | 전형적 조치 |
|---|---|---|
| **M** Merge | 진짜 내용 중복. lifecycle 비대칭 가능 | 한 쪽 deprecated 처리 또는 본문 병합 |
| **D** Diversify | 같은 domain 안 서로 다른 개념. aspect/domain_root 파편화 필요 | aspect 어휘 세분화 또는 root 분리 (HIGH RISK) |
| **A** Abstract | 한 멤버가 다른 멤버의 parent/container | `contains` 링크 명시, parent 를 module/group/layout 로 승격 |
| **C** Co-locate | 의도적으로 좌표를 공유하는 proposal/convention cluster | `cross-scope` 태그 부여 또는 validator 예외 |

## 36 그룹 전수 카탈로그

우선순위(high → low) → 클래스(D → M → A → C) → memberCount 역순으로 정렬.

| # | 좌표 / domain_root | 멤버수 | 멤버 | 클래스 | 노력 | 우선순위 | 리스크 | 권장 조치 |
|---|---|---|---|---|---|---|---|---|
| 1 | `system:feature:operation:func_def` / root=`definition-catalog-spec` | 7 | `decision-service-system`, `definition-harness`, `definition-quality-gates`, `definition-service-system`, `spec-analyzer-system`, `spec-tracker-system`, `spec-verification-system` | **D** | L | high | high | 7건(!) 초대형 cluster: decision/definition-harness/definition-quality-gates/definition-service-system/spec-analyzer/spec-tracker/spec-verification. definition-catalog-spec root 흡수가 과도. aspect 세분화(e.g., `harness_func` / `gate_func` / `analyzer_func` / `tracker_func`) + owner_system 재분배 필수. |
| 2 | `system:data:domain:domain_data` / root=`definition-catalog-spec` | 6 | `definition-catalog-spec`, `definition-taxonomy`, `dual-coordinate-system`, `meta-semantic-concepts`, `structural-taxonomy`, `taxonomy-boundaries` | **D** | L | high | high | definition-taxonomy / dual-coordinate-system / meta-semantic-concepts / structural-taxonomy / taxonomy-boundaries 는 서로 다른 taxonomy 면. aspect `domain_data` → `taxonomy` / `concept_meta` / `coordinate_model` 로 세분화하거나 layer=`domain` 을 `mediation` 으로 이동(일부). |
| 3 | `system:flow:operation:process_flow` / root=`storage-system` | 4 | `browser-lifecycle-system`, `ingest-quality-bundle`, `ingest-system`, `pipeline-system` | **D** | L | high | high | aspect 세분화 필수. browser-lifecycle / ingest / pipeline 은 서로 다른 runtime flow 영역. `process_flow` → `lifecycle_flow` / `ingest_flow` / `pipeline_flow` 분할. 또는 각 문서 aspect 를 domain 별 전용 값으로 교체. |
| 4 | `system:interface:operation:api_contract` / root=`storage-system` | 4 | `browser-runtime-system`, `browser-system`, `pipeline-aggregator`, `pipeline-cache` | **D** | M | high | medium | browser-runtime / browser-system / pipeline-aggregator / pipeline-cache 는 서로 다른 API 계약. aspect 세분화 또는 browser-* 을 browser-system 자식으로 contains 재구성. |
| 5 | `system:feature:domain:func_def` / root=`partial-binder-spec` | 4 | `cq-system`, `partial-binder-spec`, `wi-pack-format-system`, `wi-system` | **D** | M | high | medium | cq-system / partial-binder-spec / wi-pack-format-system / wi-system 은 서로 다른 인코딩 도메인. partial-binder-spec 을 wi-system 아래로 contains 재구성하여 cluster 분리. cq-system 은 독립 root 유지하도록 정식 `owner_system` 설정. |
| 6 | `system:interface:mediation:api_contract` / root=`registry-system` | 4 | `decode-api`, `decode-service-spec`, `decode-system`, `registry-system` | **D** | M | high | medium | decode-api / decode-service-spec / decode-system 을 decode 계열 domain 으로 분리. 방법: decode-system 을 독립 domain root 로 승격(registry-system depends_on 을 refs 로 변경) 또는 aspect 를 `api_contract_decode` / `api_contract_registry` 로 세분화. |
| 7 | `system:interface:mediation:api_contract` / root=`gate-system` | 4 | `gate-api`, `gate-event-bus`, `query-api-spec`, `query-system` | **D** | M | high | medium | gate-api / gate-event-bus / query-api-spec / query-system 은 서로 다른 서비스 계약. query-* 를 query-system 독립 root 로 분리(현재 gate-system 에 흡수됨). aspect `api_contract` 유지. |
| 8 | `system:feature:domain:func_def` / root=`system-libraries` | 3 | `content-service-spec`, `payment-service-spec`, `shopping-backend-spec` | **D** | M | medium | medium | content-service-spec / payment-service-spec / shopping-backend-spec 은 platform-demo-api 내부의 서로 다른 도메인 서비스. owner_system 을 `platform-demo-api` 계열로 재지정하거나 aspect `func_def` → `domain_service` / 별도 도메인 aspect 로 세분화. |
| 9 | `system:feature:mediation:func_def` / root=`registry-system` | 3 | `decode-bigint`, `decode-service-system`, `registry-service-modules` | **D** | M | medium | medium | decode-bigint / decode-service-system / registry-service-modules 는 서로 다른 기능 영역. decode-* 은 decode-system 하위로, registry-service-modules 는 registry-system 하위로 명시. aspect 유지하되 domain_root 분리. |
| 10 | `system:flow:operation:process_flow` / root=`gate-system` | 3 | `gate-cache-invalidation`, `gate-consistency`, `query-quality-bundle` | **D** | S | medium | low | gate-cache-invalidation / gate-consistency 는 gate 흐름, query-quality-bundle 은 query 서비스. query 관련은 query-system 으로 분리. |
| 11 | `system:feature:none:func_def` / root=`motion-workspace-system` | 2 | `motion-workspace-service`, `motion-workspace-system` | **M** | M | medium | low | Phase 0 무변화 그룹. motion-workspace-service 내용을 motion-workspace-system 에 병합하거나, service 를 deprecated 처리. 또는 service 에 명확한 sub-aspect(runtime_service) 부여. |
| 12 | `system:flow:operation:process_flow` / root=`definition-catalog-spec` | 4 | `definition-management`, `definition-mgmt-observability-model`, `definition-service-quality-bundle`, `harness-architecture` | **A** | M | medium | low | definition-management 을 module 로 승격하고 definition-mgmt-observability-model / definition-service-quality-bundle / harness-architecture 를 `contains` 하위로 편입. 번들/observability 는 관리 흐름의 일부. |
| 13 | `system:feature:domain:func_def` / root=`decision-standard-group` | 3 | `df-analysis-group`, `df-narrative-group`, `df-system` | **A** | S | medium | low | df-analysis-group, df-narrative-group 을 df-system 의 `contains` 자식(group) 으로 재구성. df-system 을 module 로 승격, df-* sub-group 들은 그 하위. |
| 14 | `system:data:domain:domain_data` / root=`dkg-system` | 3 | `dkg-skill-catalog`, `dkg-state-store`, `dkg-system` | **A** | S | medium | low | dkg-skill-catalog / dkg-state-store 는 dkg-system 의 sub-domain. `contains` 명시하여 dkg-system 을 module/group 으로 승격. |
| 15 | `system:feature:domain:func_def` / root=`scope-nesting-system` | 3 | `scope-nesting-pattern-lifecycle`, `scope-nesting-provider-patterns`, `scope-nesting-system` | **A** | S | medium | low | scope-nesting-pattern-lifecycle 과 scope-nesting-provider-patterns 를 scope-nesting-system 의 `contains` 자식으로 편입. group 패턴. |
| 16 | `system:ui:experience:component` / root=`canvas-viewport-spec` | 3 | `viz-roleplay-system`, `viz-surface-system`, `viz-system` | **A** | S | medium | low | viz-roleplay-system / viz-surface-system 을 viz-system 의 `contains` 자식으로 편입. canvas-viewport-spec 흡수 해소. |
| 17 | `system:feature:domain:func_def` / root=`apm-system` | 2 | `apm-codegen-system`, `apm-system` | **A** | S | medium | low | apm-codegen-system 을 apm-system 의 자식으로 `contains` 변환 (이미 child→parent depends_on 존재) → apm-system 은 module/group 역할, codegen-system 은 sub-module. 또는 aspect 을 `codegen_func` 로 세분화. |
| 18 | `system:feature:experience:func_def` / root=`automation-skill-group` | 2 | `automation-skill-group`, `skill-catalog-system` | **A** | S | medium | low | skill-catalog-system 을 automation-skill-group 의 자식으로 명시(`contains` 또는 `refines`). automation-skill-group 을 module 로 승격. |
| 19 | `system:ui:experience:layout` / root=`canvas-viewport-spec` | 2 | `canvas-viewport-spec`, `viz-system-root` | **A** | S | medium | low | viz-system-root 을 tier: layout 로 승격(이미 system 이지만 role 가 root). canvas-viewport-spec 은 그 하위 component. 또는 viz-system-root → refs 로 canvas-viewport-spec 배치. |
| 20 | `system:flow:operation:process_flow` / root=`registry-system` | 2 | `decode-quality-bundle`, `registry-quality-bundle` | **A** | S | medium | low | decode-quality-bundle 과 registry-quality-bundle 을 각각 quality-gates-system 그룹에 `contains` 링크로 편입. registry-system root 흡수 해소. |
| 21 | `system:feature:domain:func_def` / root=`gate-system` | 2 | `gate-engine-group`, `gate-system` | **A** | S | medium | low | gate-engine-group 을 gate-system 의 `contains` 자식으로 편입. |
| 22 | `system:feature:operation:func_def` / root=`infra-verify-stage` | 2 | `infra-engine-pipeline`, `infra-verify-stage` | **A** | S | medium | low | infra-engine-pipeline 을 infra-verify-stage 의 상위 개념으로 재구성(pipeline 전체 > verify 단계). 즉 verify-stage 가 pipeline 의 자식이 되도록 `contains` 반전. |
| 23 | `system:feature:domain:func_def` / root=`pipe-gate` | 2 | `meta-semantic-pipe-impl`, `pipe-gate` | **A** | S | medium | medium | meta-semantic-pipe-impl 을 meta-semantic-system 하위 module 로 유지하고 pipe-gate 와 depends_on 으로 분리. 현재 pipe-gate root 흡수 이상. |
| 24 | `none:feature:operation:func_def` / root=`store-adapter-parity` | 2 | `clickhouse-analytics-todo`, `redis-cache-pipeline-todo` | **M** | S | low | low | Phase 0 무변화 그룹. clickhouse/redis todo 두 문서는 lifecycle=draft → 실제 구현/병합 완료 시 deprecated 처리. 지금은 cross-scope 태그 추가하여 warning 억제. |
| 25 | `system:flow:operation:process_flow` / root=`decision-flow-quality-bundle` | 2 | `decision-flow-quality-bundle`, `quality-gates-system` | **A** | S | low | low | decision-flow-quality-bundle 을 quality-gates-system 의 자식 bundle 로 `contains` 관계 명시. quality-gates-system 을 group/layout 역할로 유지. |
| 26 | `system:interface:operation:api_contract` / root=`definition-catalog-spec` | 2 | `definition-service`, `definition-service-sync` | **A** | S | low | low | definition-service-sync 를 definition-service 의 `contains` 자식으로 명시. 2건 단순 cluster. |
| 27 | `system:data:domain:domain_data` / root=`decision-standard-group` | 2 | `df-model-group`, `df-taxonomy` | **A** | S | low | low | df-model-group 과 df-taxonomy 를 df-system 의 data aspect 자식으로 편입. 또는 df-taxonomy 를 df-model-group 의 `contains` 로 편입. |
| 28 | `system:data:none:prefix_schema` / root=`prefix-service` | 2 | `entity-prefix-group`, `prefix-service` | **A** | S | low | low | entity-prefix-group 을 prefix-service(또는 prefix-catalog-system) 의 `contains` 자식으로 명시. |
| 29 | `system:data:none:prefix_schema` / root=`event-prefix-group` | 2 | `event-prefix-group`, `prefix-catalog-system` | **A** | S | low | low | event-prefix-group 과 prefix-catalog-system 의 관계를 명시 — prefix-catalog-system 하위에 entity-prefix-group 과 event-prefix-group 이 동일 level 로 존재. |
| 30 | `system:constraint:domain:biz_constraint` / root=`auth-permission-integration` | 2 | `permission-constraint`, `permission-system` | **A** | S | low | low | permission-constraint 을 permission-system 의 `contains` 자식으로 편입. 이미 같은 domain. |
| 31 | `system:feature:domain:scenario` / root=`sdk-system` | 2 | `sdk-scenario-multi-service`, `sdk-scenarios` | **A** | S | low | low | sdk-scenario-multi-service 를 sdk-scenarios 의 `contains` 자식으로 편입(또는 역). scenario group 과 그 특정 instance. |
| 32 | `layout:flow:operation:process_flow` / root=`system-libraries` | 2 | `system-infra`, `system-libraries` | **A** | S | low | low | system-infra 와 system-libraries 는 tier=layout 루트들. 서로 refs 로 cross-reference 하되 다른 aspect 부여(infra/library 분리). |
| 33 | `system:meta:none:proposal_design` / root=`tier-redesign-readme` | 18 | `tier-redesign-00-design`, `tier-redesign-01-migration`, `tier-redesign-02-tracking-roadmap`, `tier-redesign-03-decisions`, `tier-redesign-integration-scope-and-legacy`, `tier-redesign-integration-system-linkage-map`, `tier-redesign-integration-taxonomy-catalog`, `tier-redesign-phase-1a-phase-1a-classifier-ruleset`, `tier-redesign-phase-1a-phase-1a-depth-usage-report`, `tier-redesign-phase-1a-phase-1a-layout-contains-report`, `tier-redesign-phase-1a-phase-1a-meta-operational-policy`, `tier-redesign-reviews-2026-04-18-facet-flow-simulation-review`, `tier-redesign-reviews-2026-04-18-review-01`, `tier-redesign-reviews-2026-04-18-review-04-pivot`, `tier-redesign-reviews-2026-04-18-review-05-post-d18`, `tier-redesign-rules-classification`, `tier-redesign-rules-state-machine-delegation`, `tier-redesign-rules-system-independence` | **C** | S | low | low | tier-redesign-* 18건 proposal cluster. knowledge_kind=proposal 면제 규칙 적용 또는 cross-scope 태그. 작업 완료 후 archive. |
| 34 | `system:meta:none:proposal_design` / root=`domain-hierarchy-readme` | 15 | `domain-hierarchy-00-design`, `domain-hierarchy-01-migration`, `domain-hierarchy-02-proposals-integration`, `domain-hierarchy-phase0-simulation`, `domain-hierarchy-phase0b-q2-resim`, `domain-hierarchy-phase1-design-decision`, `domain-hierarchy-phase1-impl`, `domain-hierarchy-phase2-impl`, `domain-hierarchy-phase3-impl`, `domain-hierarchy-phase3a-antipattern-fix`, `domain-hierarchy-phase3b-option-b`, `domain-hierarchy-phase4-impl`, `domain-hierarchy-phase6-impl`, `domain-hierarchy-q1-vocab`, `domain-hierarchy-q2-parent-priority` | **C** | S | low | low | domain-hierarchy-* 15건 proposal 문서는 모두 review/draft 단계의 인수 문서. cross-scope 태그 혹은 knowledge_kind=proposal 로 duplicate-coordinate 면제 규칙 추가(validator 에 proposal 예외 옵션). 현상 유지도 허용. |
| 35 | `none:constraint:none:tech_constraint` / root=`guides-system` | 3 | `architecture-decisions`, `coding-conventions`, `spec-convention` | **C** | S | low | low | architecture-decisions/coding-conventions/spec-convention 은 개념적으로 모두 guides-system 하위 tech constraint. cross-scope 태그 부여하여 informational 로 강등하거나, 각각 aspect 을 `adr`/`convention_code`/`convention_spec` 로 세분화. |
| 36 | `layout:meta:none:proposal_design` / root=`tier-redesign-readme` | 3 | `tier-redesign-examples-readme`, `tier-redesign-readme`, `tier-redesign-tiers-readme` | **C** | S | low | low | layout 계열 readme 3건(examples/readme/tiers). 역시 proposal cluster 수용 규칙 적용. |


## 클래스 집계

| 클래스 | 그룹 수 | 비고 |
|---|---|---|
| **M** Merge | 2 | Phase 0 무변화 후보 2건 (motion-workspace, store-adapter todos) |
| **D** Diversify | 10 | aspect 어휘 세분화 또는 root 분리 필요 — 고위험 |
| **A** Abstract | 20 | `contains` 링크 명시 + tier 승격으로 해소 — 저위험 다수 |
| **C** Co-locate | 4 | proposal/convention cluster — 수용 또는 태그 |
| 합계 | 36 | |

**핵심 관찰**: A 클래스가 전체의 56% 로 가장 크다. Phase 3b 에서 자식→부모 `depends_on` 만 추가했을 뿐 `contains` 계층이 명시되지 않은 경우가 다수이며, Phase 5a 의 대부분 노력은 이 `contains` 선언만으로 처리 가능하다. D 클래스(10건)는 **aspect 어휘 변경 RFC** 를 전제로 하므로 별도 위험 평가 필요.

## 교차 분석

### 고-팬인 aspect (3 그룹 이상)

| aspect | 그룹 수 |
|---|---|
| `func_def` | 13 |
| `process_flow` | 6 |
| `api_contract` | 4 |
| `domain_data` | 3 |
| `proposal_design` | 3 |
| `prefix_schema` | 2 |
| `tech_constraint` | 1 |
| `layout` | 1 |
| `biz_constraint` | 1 |
| `scenario` | 1 |
| `component` | 1 |

- `func_def` (13 그룹) 는 거의 전 도메인의 "기능 정의" 문서가 공유하는 coarse 범용 aspect. 세분화 시 전파 범위가 광범위 — 별도 RFC 필수. 후보: `codegen_func`, `harness_func`, `gate_func`, `analyzer_func`, `tracker_func`, `pipeline_func`, `nesting_func`, `encoding_func` 등 domain-specific split.
- `process_flow` (6 그룹) 도 동일 문제 — lifecycle/ingest/pipeline/cache/consistency 흐름이 모두 동일 좌표. 후보: `lifecycle_flow` / `ingest_flow` / `pipeline_flow` / `gate_flow`.
- `api_contract` (4 그룹) 는 decode/registry/query/gate/browser/pipeline 이 혼재. 후보: service-specific suffix.
- `domain_data` (3 그룹) 는 taxonomy 계열 — `taxonomy` / `concept_meta` / `coordinate_model` 분할 가능.
- `proposal_design` (3 그룹) 은 의도적 수용 대상(Class C).

### 고-팬인 domain_root (2 그룹 이상)

| domain_root | 그룹 수 |
|---|---|
| `definition-catalog-spec` | 4 |
| `registry-system` | 3 |
| `gate-system` | 3 |
| `storage-system` | 2 |
| `canvas-viewport-spec` | 2 |
| `system-libraries` | 2 |
| `decision-standard-group` | 2 |
| `tier-redesign-readme` | 2 |

- `definition-catalog-spec` (4 그룹, 총 18 문서 흡수) — primary-parent 과잉 흡수의 대표 사례. Phase 0 시뮬레이션에서 이미 "90건을 흡수한다" 고 경고된 root. 근본 원인은 `refines`/`depends_on` 파생 규칙이 deep chain 을 타고 올라가는 것 + meta-semantic-system.md 등의 `depends_on: definition-catalog-spec` 링크.
- `registry-system` / `gate-system` (각 3 그룹) — decode/query 계열이 흡수되어 "서비스 경계" 혼합. Phase 5b 대상.
- `storage-system` (2 그룹, 8 문서) — browser-lifecycle/browser-runtime/pipeline/ingest 가 모두 storage 로 수렴. 과흡수.

## Phase 5a ~ 5d 실행 계획

### Phase 5a — Class M Merge (2건, ~4개 파일)

- **범위**: `motion-workspace-service ↔ motion-workspace-system` · `clickhouse-analytics-todo ↔ redis-cache-pipeline-todo`
- **조치**:
  - motion-workspace: `service` 문서를 `system` 의 자식으로 재구성하거나 service 본문을 system 에 병합 후 service 를 deprecated 표시.
  - todos: 두 문서는 draft 단계. 현 시점에서는 작업 중이므로 `cross-scope` 태그만 부여하여 warning 억제, 구현 완료 시 deprecated 로 전환.
- **의존성**: 없음. 각 그룹 독립 처리.
- **가역성**: 높음 (lifecycle 플래그 변경).
- **체크포인트**: motion-workspace 병합 방향은 owner 확인 필요(워크스페이스 전체 vs HTTP 서비스 어느 쪽이 정식 진입점인가).

### Phase 5b — Class D Diversify (10건, aspect 어휘 변경 검토 필요)

- **범위**: 10 그룹. `func_def`/`process_flow`/`api_contract`/`domain_data` aspect 가 "서로 다른 개념" 을 감싸는 경우.
- **공통 조치 옵션**:
  1. **owner_system / root 분리** — decode-system / query-system / pipeline-system 등을 독립 domain_root 로 승격. primary-parent 규칙이 흡수하지 못하도록 `depends_on` 방향 또는 owner_system 명시.
  2. **aspect 어휘 세분화 (고위험)** — 별도 RFC 필요. 어휘 추가는 `definition-taxonomy` 갱신 + 130+ 기존 문서 재분류 가능성.
- **권장**: 5b-1 (root 분리) 먼저, 5b-2 (aspect 변경) 는 별도 q-doc 으로 제안.
- **의존성**: 5b-2 는 `q1-vocab` (기존 open question) 의 해소에 의존.
- **가역성**: 링크 변경은 가역, aspect 변경은 문서 재분류 필요 → 부분 가역.
- **체크포인트**: 각 D 그룹마다 "aspect 분할 vs root 분리" 선택을 사람이 판단해야 함. 특히 정의-catalog 하위 7건 cluster (`definition-catalog-spec`) 는 각 서비스 owner_system 을 올바로 지정하는 것만으로도 다수 해소 가능.

### Phase 5c — Class A Abstract (20건, ~46개 파일 touch)

- **범위**: 20 그룹. 대부분 parent-child 관계가 명시되지 않아 sibling 으로 보이는 case.
- **조치**: parent 문서에서 child 로 `contains` 링크 추가 + parent 의 level/tier 를 group/module 또는 layout 로 승격. tier=`system` 을 유지하면 `system-contains-system` warning 이 뜨므로 필요 시 `contains` 대신 `refs` 또는 parent tier=layout 승격 검토.
- **의존성**: `system-contains-system` 예외 정책 확정(`validate.ts` §tier=system 체크).
- **가역성**: 매우 높음 (링크 추가/제거).
- **체크포인트**: 일부 case 는 parent 의 `contains` 자식 수 폭발(예: definition-management 4건, scope-nesting 3건, dkg 2건, df 3건). 계층 깊이 제한(`contains-depth-violation`) 경고 추가 발생 가능성 — 사전 시뮬레이션 필요.

### Phase 5d — Class C Co-locate (4건, validator 예외 또는 태그)

- **범위**: proposal cluster 2건 (tier-redesign 18+3=21 문서, domain-hierarchy 15 문서) · ADR/convention 1건 · layout root 1건.
- **조치 옵션**:
  1. `knowledge_kind=proposal` 문서에 대해 `duplicate-coordinate` 경고 면제 규칙을 validator 에 추가 (`packages/definition-catalog/src/validate.ts` §중복 좌표 블록).
  2. 각 proposal 문서에 `tags: [cross-scope]` 부여(validator 가 태그 인식 시 info 강등).
  3. 현상 유지 + 결과 문서에 "proposal cluster 는 의도적" 선언만.
- **의존성**: validator 확장 여부는 사람 판단 필요. Phase 5d 는 실행/미실행 선택 가능.
- **가역성**: 매우 높음.
- **체크포인트**: proposal 작업 종료 시 archival 정책 수립(deprecated + 별도 디렉토리 이동).

## 우선 처리 Top 10 (사람 리뷰 시작점)

1. **system:feature:operation:func_def:definition-catalog-spec** (members=7, class=D, effort=L) — 7건(!) 초대형 cluster: decision/definition-harness/definition-quality-gates/definition-service-system/spec-analyzer/spec-tracker/spec-verification. definition-catalog-spec root 흡수가 과도. aspect 세분화(e.g., `harness_func` / `gate_func` / `analyzer_func` / `tracker_func`) + owner_system 재분배 필수.
2. **system:data:domain:domain_data:definition-catalog-spec** (members=6, class=D, effort=L) — definition-taxonomy / dual-coordinate-system / meta-semantic-concepts / structural-taxonomy / taxonomy-boundaries 는 서로 다른 taxonomy 면. aspect `domain_data` → `taxonomy` / `concept_meta` / `coordinate_model` 로 세분화하거나 layer=`domain` 을 `mediation` 으로 이동(일부).
3. **system:flow:operation:process_flow:storage-system** (members=4, class=D, effort=L) — aspect 세분화 필수. browser-lifecycle / ingest / pipeline 은 서로 다른 runtime flow 영역. `process_flow` → `lifecycle_flow` / `ingest_flow` / `pipeline_flow` 분할. 또는 각 문서 aspect 를 domain 별 전용 값으로 교체.
4. **system:interface:operation:api_contract:storage-system** (members=4, class=D, effort=M) — browser-runtime / browser-system / pipeline-aggregator / pipeline-cache 는 서로 다른 API 계약. aspect 세분화 또는 browser-* 을 browser-system 자식으로 contains 재구성.
5. **system:feature:domain:func_def:partial-binder-spec** (members=4, class=D, effort=M) — cq-system / partial-binder-spec / wi-pack-format-system / wi-system 은 서로 다른 인코딩 도메인. partial-binder-spec 을 wi-system 아래로 contains 재구성하여 cluster 분리. cq-system 은 독립 root 유지하도록 정식 `owner_system` 설정.
6. **system:interface:mediation:api_contract:registry-system** (members=4, class=D, effort=M) — decode-api / decode-service-spec / decode-system 을 decode 계열 domain 으로 분리. 방법: decode-system 을 독립 domain root 로 승격(registry-system depends_on 을 refs 로 변경) 또는 aspect 를 `api_contract_decode` / `api_contract_registry` 로 세분화.
7. **system:interface:mediation:api_contract:gate-system** (members=4, class=D, effort=M) — gate-api / gate-event-bus / query-api-spec / query-system 은 서로 다른 서비스 계약. query-* 를 query-system 독립 root 로 분리(현재 gate-system 에 흡수됨). aspect `api_contract` 유지.
8. **system:feature:domain:func_def:system-libraries** (members=3, class=D, effort=M) — content-service-spec / payment-service-spec / shopping-backend-spec 은 platform-demo-api 내부의 서로 다른 도메인 서비스. owner_system 을 `platform-demo-api` 계열로 재지정하거나 aspect `func_def` → `domain_service` / 별도 도메인 aspect 로 세분화.
9. **system:feature:mediation:func_def:registry-system** (members=3, class=D, effort=M) — decode-bigint / decode-service-system / registry-service-modules 는 서로 다른 기능 영역. decode-* 은 decode-system 하위로, registry-service-modules 는 registry-system 하위로 명시. aspect 유지하되 domain_root 분리.
10. **system:flow:operation:process_flow:gate-system** (members=3, class=D, effort=S) — gate-cache-invalidation / gate-consistency 는 gate 흐름, query-quality-bundle 은 query 서비스. query 관련은 query-system 으로 분리.

## 오픈 이슈

1. **aspect 어휘 변경 RFC 필요 여부** — Class D 10건 중 최소 4건(`func_def`/`process_flow`/`api_contract`/`domain_data` cluster) 는 어휘 세분화가 근본 해결책. 별도 `q-aspect-vocabulary.md` RFC 제안 권장. 현재 `q1-vocab.md` 는 별도 주제.
2. **primary-parent 규칙 재검토** — `definition-catalog-spec` 이 18 문서를 흡수하는 현상(Phase 0 §"관찰" 재확인)은 구조적 문제. `domain-root.ts` 알고리즘의 depth 제한/우선순위 재튜닝 필요(Phase 0b `q2-parent-priority.md` 와 연계).
3. **proposal duplicate-coordinate 면제 정책** — validator 확장 vs tag 부여 중 선택. 전자는 코드 변경, 후자는 다건 tag 편집. (Class C 21+15+3+1=40 문서)
4. **tier=system `contains` 자식 정책** — Phase 5c A 클래스 실행 시 `system-contains-system` warning 이 다수 발생. 예외 허용(예: parent tier=layout 로 승격) 또는 refs 로 전환 결정 필요.
5. **motion-workspace 병합 방향** — service vs system 의 본질 규정(HTTP 서버 vs 도메인 워크스페이스 전체). Phase 5a 진행 전 owner 확인 필수.
6. **cq-system / wi-system 관계 재검토** — partial-binder-spec 가 root 로 파생되는 현상은 비정상. weighted-index 체인의 parent-child 를 재정의해야 함.
7. **decode / query 독립 root 승격 가능 여부** — registry-system / gate-system 에 흡수된 decode/query 계열을 독립 domain_root 로 분리할 때 svc 경계 재확인 필요.

## 산출물

- 구조화된 36-그룹 카탈로그: `/tmp/phase5-classified.json`
- 원본 validate 로그: `/tmp/phase5-audit.txt`
- 멤버 메타데이터 (131건): `/tmp/phase5-metadata.tsv`
- 본 보고서: `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase5-redesign.md`

## 참조

- [2026-04-20-phase3b-option-b.md](./2026-04-20-phase3b-option-b.md) — dup-coord 28→36 증가 근거
- [2026-04-20-phase0-simulation.md](./2026-04-20-phase0-simulation.md) — 무변화 그룹 3건 (Class M 근거)
- [2026-04-20-phase4-impl.md](./2026-04-20-phase4-impl.md) — 현재 상태 스냅샷
- [01-migration.md](../01-migration.md) §Phase 5 — 원 plan (5~8 쌍 가정)
- [00-design.md](../00-design.md) §"개념 구분" — scope/aspect/layer 의미론
- `packages/definition-catalog/src/validate.ts` §중복 좌표 블록 (line 342-367)
