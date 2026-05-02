---
def:
  id: domain-hierarchy-final-cleanup
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

# Phase 5g — final validator cleanup (13 → 3)

## 목적 ^purpose

Phase 5c-2 / 5f 이후 남은 validator warning 13건을 최종 정리한다.
- Level-violation 3건 (component + contains 자식): 2건은 tier 승격 + link 재분류, 1건은 link type 정정.
- Duplicate-coordinate 10건: 7건은 `cross-scope` 태그 + validator extension으로 의도적 공유로 허용, 3건은 "aspect 세분화 필요"로 deferred.

목표치 대비 달성: errors=0 유지, warnings 13 → **3** (목표 ≤ 5).

## 사전 현황 (pre-cleanup)

```
errors=0, warnings=13
- level-violation: 3 (doc-envelope-test, operational-ontology-system, ralph-tui-integration-test)
- duplicate-coordinate: 10 (이하 상세)
```

task 설명에는 level-violation 2건으로 기재됐지만 실제 빌드에서는 doc-envelope-test가 동일 패턴으로 함께 감지되어 3건 모두 처리했다.

## Part A — Level-violation 처리 (3건 → 0)

### operational-ontology-system (35 contains 자식)

**판정**: tier 승격 + 일부 link 재분류.

`operational-ontology-system`은 operational ontology 전체의 entry-point로 schema/validation/pack/governance/registry allocation/instance/persistence/interpretation/runtime 등 9개 plane을 묶고 35개의 하위 스펙을 조율한다. 실질적으로 system-level aggregator이므로 `tier: component` → `tier: system`으로 승격이 정답.

단, 자식 35개 중 3건이 이미 `tier: system`이라 system-contains-system 규칙 충돌 발생:
- `operational-ontology-registry-allocation` (registry allocation system — 이미 `refines operational-ontology-system`)
- `operational-ontology-runtime-interface` (runtime projector family system)
- `programming-artifact-ontology-system` (programming artifact system)

이 3건은 `contains` → `refs`로 전환 (ADR-004 STC D-4: "Layout/System이 System을 카탈로그로 참조"). 나머지 32개 component 자식은 `contains` 유지.

### ralph-tui-integration-test (1 contains 자식)

**판정**: link type 정정.

`contains: deterministic-label-architecture` 링크는 오타성 오류 — 테스트 스펙이 아키텍처 스펙을 "소속"시킬 수는 없다. 테스트가 아키텍처 정의를 참조(trace)하는 것이 정확한 의미. `contains` → `traces_to`로 교체.

### doc-envelope-test (1 contains 자식)

**판정**: 동일 패턴 — `contains: deterministic-label-architecture` → `traces_to`.

두 test 스펙이 동일한 copy-paste 실수로 같은 오류를 공유하고 있었다.

## Part B — Dup-coord 처리 (10 → 3)

### Validator extension

`packages/definition-catalog/src/validate.ts`의 dup-coord 검사 블록에 `cross-scope` 태그 opt-out 경로를 추가했다 (+10 LOC).

```ts
// 그룹 전원에 cross-scope 태그가 있으면 의도적 공유로 보고 skip
const allCrossScope = docs.every(id => {
  const entry = registry.get(id);
  return entry?.tags?.includes("cross-scope") ?? false;
});
if (allCrossScope) continue;
```

근거:
- `cross-scope`는 이미 `allowsSemanticMultiParent` (semantic-lint.ts)에서 multi-parent opt-out으로 사용 중. 동일 의미("다중 scope에 의도적으로 걸친다")를 dup-coord에도 확장.
- "그룹 전원"에 태그 요구 — 일부만 태그시 의도성이 불명확하므로 경고 유지하여 실제 구조 이슈를 감춤 방지.
- `proposal/adr/convention` knowledge_kind exemption과 같은 패턴.

### Group-by-group 결정

| # | 그룹 | 좌표 | 처리 | 근거 |
|---|---|---|---|---|
| 1 | clickhouse-analytics-todo / redis-cache-pipeline-todo | `feature:operation:func_def @ store-adapter-parity` | **tagged** | 서로 다른 백엔드 (OLAP vs L2 cache) — 독립 peer |
| 2 | content-service-spec / payment-service-spec | `feature:domain:domain_service_func @ system-libraries` | **tagged** | shopping backend 도메인의 독립 peer services |
| 3 | cq-system / partial-binder-spec / wi-pack-format-system | `feature:domain:encoding_func @ partial-binder-spec` | **deferred** | 인코딩 레이어 구조적 의존 (cq → partial-binder + pack-format). 의도적 공유 아님. aspect 세분화 필요 |
| 4 | decode-api / decode-service-spec | `interface:mediation:decode_contract @ registry-system` | **deferred** | 동일 서비스의 두 facet (HTTP API vs service def). 독립 peer 아님. aspect 세분화 필요 |
| 5 | dkg-skill-catalog / dkg-state-store | `data:domain:domain_data @ dkg-system` | **tagged** | skill 카탈로그 (registry) vs state store (persistence) — 독립 facet |
| 6 | definition-mgmt-observability-model / definition-service-quality-bundle / harness-architecture | `flow:operation:definition_mgmt_flow @ definition-catalog-spec` | **deferred** | definition 관리의 3개 sibling subsystem. 단일 flow 좌표에 공존하는 것은 구조적 중복. aspect 세분화 필요 |
| 7 | scope-nesting-pattern-lifecycle / scope-nesting-provider-patterns | `feature:domain:nesting_func @ scope-nesting-system` | **tagged** | lifecycle 분석 vs provider 패턴 4종 — 독립 facet |
| 8 | spec-analyzer-system / spec-tracker-system | `feature:operation:analyzer_func @ definition-catalog-spec` | **tagged** | 정적 분석 (코드↔스펙) vs 런타임 수집 (테스트↔스펙) — 상보적 독립 tool |
| 9 | structural-taxonomy / taxonomy-boundaries | `data:domain:taxonomy_data @ definition-catalog-spec` | **tagged** (pre-existing) | taxonomy 축 정의 vs taxonomy 경계 정의 — 두 문서 모두 이미 `cross-scope` 태그 보유. validator extension으로 이제 silent |
| 10 | viz-roleplay-system / viz-surface-system | `ui:experience:component @ canvas-viewport-spec` | **tagged** | roleplay-web form builder vs platform-demo panel layout — 서로 다른 웹 표면 |

적용: **7 group tagged** (그룹 9는 pre-existing, 신규 edit 6 group) / **3 group deferred**.

### 적용된 cross-scope 태그

| doc_id | 기존 tags | 추가 |
|---|---|---|
| clickhouse-analytics-todo | pre-existing | — |
| redis-cache-pipeline-todo | pre-existing | — |
| content-service-spec | [external] → [external, cross-scope] | + |
| payment-service-spec | [external] → [external, cross-scope] | + |
| dkg-skill-catalog | [structural, decision, entry-point] → + cross-scope | + |
| dkg-state-store | [observability, persistence, data] → + cross-scope | + |
| scope-nesting-pattern-lifecycle | [structural] → [structural, cross-scope] | + |
| scope-nesting-provider-patterns | [structural] → [structural, cross-scope] | + |
| spec-analyzer-system | [testing] → [testing, cross-scope] | + |
| spec-tracker-system | [testing, observability] → + cross-scope | + |
| viz-roleplay-system | [structural] → [structural, cross-scope] | + |
| viz-surface-system | [structural] → [structural, cross-scope] | + |
| structural-taxonomy | pre-existing [cross-scope, ...] | — |
| taxonomy-boundaries | pre-existing [cross-scope, ...] | — |

## Part C — Aspect split deferred (향후 RFC)

### 잔여 3 warning (의도적 유지)

| # | 그룹 | 분석 | 해소 경로 |
|---|---|---|---|
| 3 | cq-system / partial-binder-spec / wi-pack-format-system | 3개 모두 `encoding_func` aspect에 몰림. cq(coord-query)가 partial-binder + pack-format을 조합하여 사용하는 계층 구조. `encoding_func` 단일 aspect로 범람한 것이 문제 | aspect 세분화: `encoding_func` → {`binding_encoding_func`(partial-binder), `format_encoding_func`(pack-format), `query_encoding_func`(cq)} 또는 aspect 계층형 전환 |
| 4 | decode-api / decode-service-spec | 동일 서비스의 HTTP 계약과 서비스 정의가 같은 `decode_contract` aspect에 배치 | aspect 세분화: `decode_contract` → {`decode_api_contract`, `decode_service_contract`} 또는 decode-api를 `tier: component`로 재배치 (API는 서비스의 하위 계약) |
| 6 | definition-mgmt-observability-model / definition-service-quality-bundle / harness-architecture | 3개가 definition-catalog 도메인의 서로 다른 subsystem (관측/품질/하네스)이지만 `definition_mgmt_flow` 단일 aspect 좌표에 몰림 | aspect 세분화: `definition_mgmt_flow` → {`definition_observability_flow`, `definition_quality_flow`, `definition_harness_flow`} 또는 harness-architecture를 별도 domain_root로 분리 (이미 `definition-harness-architecture`가 독자 하네스 시스템을 가지므로) |

위 3 그룹은 cross-scope 태그를 부여하지 않는다. 이는 의도적 공존이 아니라 "aspect vocabulary 부족"이라는 **실제 구조적 문제**를 드러내기 때문이다. 태그로 숨기면 Phase C (aspect-schema-hierarchy RFC) 후보에서 누락될 위험이 있다.

향후 RFC 대상:
- **encoding_func 분화** (Phase C: aspect-schema-hierarchy)
- **decode_contract 분화** 또는 decode-api tier 재배치
- **definition_mgmt_flow 분화** 또는 harness-architecture를 별도 domain_root로 분리

## 최종 metrics

```
errors:    0 → 0
warnings: 13 → 3

Before (Phase 5f 완료):
  level-violation:       3
  duplicate-coordinate: 10
  multi-parent:          0
  orphan:                0

After (Phase 5g 완료):
  level-violation:       0
  duplicate-coordinate:  3 (aspect-split deferred)
  multi-parent:          0
  orphan:                0
```

### 테스트 회귀

`pnpm --filter definition-catalog test`:
- 575/600 passing (baseline 동일)
- 25 pre-existing failure 그대로 (validate 무관, assemble/scan-real/tag-coverage 등 assertion drift)
- `validate-semantic.test.ts` 5/5 통과 (내 edit에 의한 회귀 없음)

## 세션 누적 최종 상태

### 전체 정리 경로

Phase 5f 전 (baseline): errors=0, warnings=68
Phase 5f 완료: errors=0, warnings=12
Phase 5g 완료 (본 작업): errors=0, warnings=**3**

총 warning 감소: **68 → 3** (-96%)

### 좌표 인프라 완결도

| 항목 | 상태 |
|---|---|
| errors (circular-ref, broken-link, self-ref, system-contains-system 외) | 0 (유지) |
| multi-parent | 0 (Phase 5f에서 처리) |
| orphan | 0 (Phase 5f에서 .cases.md/.test.md/archived exemption으로 처리) |
| level-violation | 0 (Phase 5g) |
| duplicate-coordinate | 3 (aspect-split 대기) |
| cross-scope opt-out 메커니즘 | multi-parent + dup-coord 양쪽 지원 |
| STC tier taxonomy | layout/system/component/entry 각 체크 구현 |
| domain_root 기반 collision 해소 | 구현 (Phase 2) |
| knowledge_kind exemption (proposal/adr/convention) | 구현 (Phase 5d) |

### Commits

| # | hash | 제목 |
|---|---|---|
| 1 | (TBD) | fix(def): level-violation — operational-ontology + ralph-tui tier correction |
| 2 | (TBD) | fix(def): dup-coord — cross-scope tag for peer service groups |
| 3 | (TBD) | docs(proposals): final cleanup — session consolidation report |

### 다음 단계 (Phase C 후보)

1. **aspect-schema-hierarchy RFC**: 남은 3 dup-coord 그룹 해소. `encoding_func`, `decode_contract`, `definition_mgmt_flow` 세분화 또는 계층형 aspect.
2. **Large-scale aspect vocab cleanup**: aspect-vocab-split 작업의 후속. 재검토 후 새 aspect 값 도입.
3. **test-types aspect 정리**: .test.md 파일 lifecycle 검증과 함께 test aspect vocabulary 강화.

## 산출물

- 수정 파일: 14건
  - level-violation: 3 (operational-ontology-system, ralph-tui-integration-test, doc-envelope-test)
  - dup-coord cross-scope tag: 10 (위 표 참조)
  - validator extension: 1 (packages/definition-catalog/src/validate.ts)
- 본 보고서: `docs/proposals/domain-hierarchy/reviews/2026-04-21-final-cleanup.md`
- validate 결과 로그: `/tmp/final-cleanup-after.txt`

## 참조

- [2026-04-21-warning-cleanup.md](./2026-04-21-warning-cleanup.md) — Phase 5f (multi-parent + orphan 정리)
- [2026-04-21-phase5c-2-structural.md](./2026-04-21-phase5c-2-structural.md) — Phase 5c-2 (primary-parent layout promotion, tier 축 한계 지적)
- `packages/definition-catalog/src/validate.ts` §dup-coord (line 350-390) — cross-scope opt-out 추가
- ADR-004 STC D-4 — Layout/System이 System을 `refs`로 카탈로그 참조
