---
def:
  id: domain-hierarchy-phase5c-abstract
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
date: 2026-04-20
part_of: domain-hierarchy
role: review
---

# Phase 5c — Class A Abstract (layout promotion) 실행

## 목적 ^purpose

Phase 5 redesign 의 Class A(20 그룹, Abstract) 전수 처리 중 **tier=layout 승격으로 중복 좌표를 실제로 해소할 수 있는 11 그룹**을 이번 라운드에서 집행하고, 나머지 9 그룹이 왜 지금 단계에서 보류되는지(boundary 제약 / 3+멤버 잔여 collision / 이중 layout aspect 문제)를 기록한다.

## 핵심 발견 — validator 제약 재평가

Phase 5 redesign 의 Class A 권고("contains 추가" · "module/group 승격")는 **validator 의 duplicate-coordinate 판정 규칙과 직접적으로 맞물리지 않는다**.

- `duplicate-coordinate` 키 = `${tier}:${scope}:${layer}:${aspect}:${domainRoot}`
- `domain_root` 파생은 `refines`/`depends_on` outgoing 링크만 사용 (`packages/definition-catalog/src/domain-root.ts`)
- `contains` 추가는 child 의 domain_root 도, 자신의 coord key 도 바꾸지 않음 → **A2 "missing contains link" 는 dup-coord 감소에 기여하지 않는다**
- 사용 가능한 tier 는 `system | layout | component | entry` 네 종류뿐. `module` tier 는 존재하지 않음 → **A3 "module tier promotion" 도 dup-coord 감소 수단이 아니다**

`domain_root` 가 동일한 상태에서 dup-coord 키를 분리하는 **유일한 저위험 수단은 parent 의 `tier` 를 system → layout 으로 승격**하는 것이며, 이것이 본 라운드의 핵심 패턴이다.

### layout 승격의 부작용 — `@def.boundary` 제약

`packages/definition-data-source/src/local-data-source.ts:619` 규칙:

```ts
const isBoundaryEligible = doc.level === "group" || doc.level === "module" || doc.tier === "system";
if (ref.relationType === "boundary" && !isBoundaryEligible) {
  // error: invalid-code-boundary
}
```

즉 `@def.boundary <doc-id>` 코멘트가 있는 소스 파일은 해당 문서가 `tier: system` 이어야만 유효하다. layout 승격 시 이 규칙이 **error** 로 승격한다. 파일럿 1차 시도에서 viz-system-root(72), definition-service(12), gate-system(23) 를 승격했을 때 총 107 건의 `invalid-code-boundary` 에러가 발생했다. 이 세 그룹은 **코드 상 boundary 연결이 완료된 도메인 루트들**로, tier 를 낮추려면 먼저 모든 `@def.boundary` annotation 을 다른 system 문서로 재지정해야 한다. 본 Phase 5c 의 범위를 초과한다.

## 실행 계획

### 파일럿 (3 그룹, 모두 `contains` 없고 `@def.boundary` 없음)

| # | 좌표 | 변경 파일 | 조치 |
|---|---|---|---|
| 18 | `system:feature:experience:func_def:automation-skill-group` | `docs/specs/skill-catalog/skill-catalog-system.md` | `tier: system → layout`, 기존 5 `depends_on` 유지 + 동일 대상에 `refs` 추가 |
| 29 | `system:data:none:prefix_schema:event-prefix-group` | `docs/specs/prefix-catalog/prefix-catalog-system.md` | `tier: system → layout`, 5 `depends_on` + 5 `refs` |
| 28 | `system:data:none:prefix_schema:prefix-service` | `docs/specs/prefix-catalog/entity-prefix-group/prefix-service.spec.md` | `tier: system → layout`, `refs: entity-prefix-group` 추가 |

파일럿 결과: errors=0, warnings 58→56, dup-coord 35→32 (-3) ✓

### 배치 (8 그룹, contains 를 refs 로 전환 필요)

| # | 좌표 | 변경 파일 | contains→refs |
|---|---|---|---|
| 17 | `system:feature:domain:func_def:apm-system` | `docs/specs/apm-system/apm-system.md` | 5건 |
| 22 | `system:feature:operation:func_def:infra-verify-stage` | `docs/specs/infra-engine/infra-engine-pipeline.spec.md` | 9건 (depends_on/traces_to 는 유지) |
| 23 | `system:feature:domain:func_def:pipe-gate` | `docs/specs/meta-semantic/pipe-impl/engine/pipe-gate.spec.md` | 3건 |
| 20 | `system:flow:operation:process_flow:registry-system` (decode bundle) | `docs/specs/quality-gates/decode-quality-bundle.md` | 4건 (decode-system depends_on 유지) |
| 25 | `system:flow:operation:process_flow:decision-flow-quality-bundle` | `docs/specs/quality-gates/decision-flow-quality-bundle.md` | 4건 |
| 27 | `system:data:domain:domain_data:decision-standard-group` (df-model) | `docs/specs/decision-flow/df-model-group.md` | 4건 (df-system depends_on 유지) |
| 30 | `system:constraint:domain:biz_constraint:auth-permission-integration` | `docs/specs/permission/permission-system.md` | 2건 (traces_to / depends_on 유지) |
| 31 | `system:feature:domain:scenario:sdk-system` | `docs/specs/index-meta-system/scenarios-sdk.spec.md` | 6건 (traces_to / depends_on 유지) |

## 적용된 그룹 (총 11건, dup-coord -11)

| # | 좌표 | action | 변경 파일 | dup-coord delta |
|---|---|---|---|---|
| 17 | `system:feature:domain:func_def` @ apm-system | A1 layout-promotion | `docs/specs/apm-system/apm-system.md` | -1 |
| 18 | `system:feature:experience:func_def` @ automation-skill-group | A1 layout-promotion | `docs/specs/skill-catalog/skill-catalog-system.md` | -1 |
| 20 | `system:flow:operation:process_flow` @ registry-system (bundle) | A1 layout-promotion | `docs/specs/quality-gates/decode-quality-bundle.md` | -1 |
| 22 | `system:feature:operation:func_def` @ infra-verify-stage | A1 layout-promotion | `docs/specs/infra-engine/infra-engine-pipeline.spec.md` | -1 |
| 23 | `system:feature:domain:func_def` @ pipe-gate | A1 layout-promotion | `docs/specs/meta-semantic/pipe-impl/engine/pipe-gate.spec.md` | -1 |
| 25 | `system:flow:operation:process_flow` @ decision-flow-quality-bundle | A1 layout-promotion | `docs/specs/quality-gates/decision-flow-quality-bundle.md` | -1 |
| 27 | `system:data:domain:domain_data` @ decision-standard-group | A1 layout-promotion | `docs/specs/decision-flow/df-model-group.md` | -1 |
| 28 | `system:data:none:prefix_schema` @ prefix-service | A1 layout-promotion | `docs/specs/prefix-catalog/entity-prefix-group/prefix-service.spec.md` | -1 |
| 29 | `system:data:none:prefix_schema` @ event-prefix-group | A1 layout-promotion | `docs/specs/prefix-catalog/prefix-catalog-system.md` | -1 |
| 30 | `system:constraint:domain:biz_constraint` @ auth-permission-integration | A1 layout-promotion | `docs/specs/permission/permission-system.md` | -1 |
| 31 | `system:feature:domain:scenario` @ sdk-system | A1 layout-promotion | `docs/specs/index-meta-system/scenarios-sdk.spec.md` | -1 |

## 보류된 그룹 (총 9건)

### (a) `@def.boundary` 가 system-tier 문서를 가리키는 3 그룹

layout 승격 시 `invalid-code-boundary` error 가 대량 발생한다. 소스 코드 boundary 재지정이 선행되어야 함.

| # | 좌표 | parent 문서 | boundary ref 수 | 조치 |
|---|---|---|---|---|
| 19 | `system:ui:experience:layout` @ canvas-viewport-spec | `viz-system-root` | 72 (viz-web, viz-3d, viz-core) | Phase 5e 후보: `@def.boundary viz-system-root` 주석을 viz-system 또는 viz-core-system 으로 이동 후 승격 |
| 21 | `system:feature:domain:func_def` @ gate-system | `gate-system` | 23 (gate-service) | Phase 5e 후보: gate-service 의 `@def.boundary gate-system` 를 gate-state-model/gate-engine-func 로 분산 후 승격 |
| 26 | `system:interface:operation:api_contract` @ definition-catalog-spec | `definition-service` | 12 (definition-service) | Phase 5e 후보: definition-service src 의 `@def.boundary definition-service` 를 module 단위로 세분 (`definition-service-sync` 등) 후 승격 |

### (b) 3+ 멤버 그룹 — parent 승격 후에도 sibling 잔여

layout 승격으로 parent 만 제거되고, 남은 sibling 2~3 건이 여전히 동일 `domain_root` 에서 충돌.

| # | 좌표 | 멤버 | 잔여 | 필요한 추가 조치 |
|---|---|---|---|---|
| 12 | `system:flow:operation:process_flow` @ definition-catalog-spec | 4 (definition-management, observability-model, service-quality-bundle, harness-architecture) | 3 sibling 잔여 | 멤버별 aspect 세분화 (Class D RFC 대기) |
| 13 | `system:feature:domain:func_def` @ decision-standard-group | 3 (df-analysis, df-narrative, df-system) | df-system 제거해도 df-analysis + df-narrative 잔여 | sibling 한쪽을 다른쪽 하위로 명시 (`df-narrative depends_on df-analysis-group` 등) |
| 14 | `system:data:domain:domain_data` @ dkg-system | 3 (skill-catalog, state-store, system) | 2 sibling 잔여 | skill-catalog / state-store 에 세분 aspect 또는 한쪽을 다른쪽 하위로 |
| 15 | `system:feature:domain:func_def` @ scope-nesting-system | 3 (pattern-lifecycle, provider-patterns, nesting-system) | 2 sibling 잔여 | provider-patterns 가 이미 `depends_on: pattern-lifecycle` 보유 → primary-parent 규칙 재평가 필요 |
| 16 | `system:ui:experience:component` @ canvas-viewport-spec | 3 (viz-roleplay, viz-surface, viz-system) | 2 sibling 잔여 + viz-system 도 boundary ref 보유 | viz-roleplay / viz-surface 의 aspect 세분화 (groupware vs rendering) |

### (c) 양쪽 모두 이미 `tier: layout` 인 1 그룹

| # | 좌표 | 멤버 | 조치 |
|---|---|---|---|
| 32 | `layout:flow:operation:process_flow` @ system-libraries | system-infra, system-libraries (둘 다 tier=layout) | aspect 세분화 필요 (`infra_flow` vs `library_flow` 등) — Class D RFC 영역 |

## 검증 결과

`pnpm exec qa-sdk def sync && pnpm exec qa-sdk def audit` 결과.

| 지표 | Before (5a 완료, 5c 시작) | After (5c 적용 + 본 보고서 포함) | Delta |
|---|---|---|---|
| errors | 0 | 0 | 0 |
| warnings (총합) | 58 | 48 | **-10** |
| duplicate-coordinate 그룹 | 35 | 24 | **-11** |
| multi-parent 경고 | 15 | 15 | 0 |
| orphan | 6 | 7 | +1 (본 작업 무관 — docs-control-plane-cases 신규 수집) |
| level-violation | 2 | 2 | 0 |
| owner-root-mismatch (info) | 15 | 15 | 0 |
| system-contains-system | 0 | 0 | 0 |
| invalid-code-boundary (error) | 0 | 0 | 0 (보류 그룹 덕분) |

- Phase 5 redesign 목표 "33 → ≤ 16" 은 미달 (24). 차이 11 건 중 9 건은 본 단계에서 구조적으로 해소 불가(보류 사유 참조), 2 건은 Phase 5b(Class D) 영역과 겹침.
- Phase 5 목표 ≤ 16 에 도달하려면 (a) 보류 3 그룹을 Phase 5e 에서 boundary 재지정 후 승격하고, (b) 3+ 멤버 그룹 5 건에 대해 sibling 분리 또는 aspect 세분화가 추가로 필요.

## Phase 5b / 5d 연결

- **Phase 5b(Class D)**: 보류된 3+ 멤버 그룹(12, 13, 14, 15, 16) 은 aspect 세분화 또는 sibling 계층화로만 완전 해소 가능. Class D 에서 이미 계획된 `func_def` / `process_flow` / `domain_data` aspect 분할 RFC 의 부산물로 자연 해소될 것으로 전망.
- **Phase 5d(Class C)**: proposal cluster 는 본 Phase 에서 미처리. 그룹 수 24 중 proposal cluster 2건(tier-redesign, domain-hierarchy 총 18+3+15=36 문서) 를 validator 예외 / cross-scope tag 로 처리하면 그룹 수 24→22 로 추가 감소 가능.
- **Phase 5e(신규 제안)**: boundary 선행 재지정 3 그룹(19, 21, 26) 을 위한 리팩토링 단위. `@def.boundary` 대상 이전을 sub-module 단위로 내리는 작업.

## 가역성 / 롤백

- 모든 변경은 frontmatter 의 `tier` 와 `links[].type` 만 수정. 파일 본문 무수정.
- `tier: layout` 을 `tier: system` 으로 복귀하고 `type: refs` 를 다시 `type: contains` 로 되돌리면 1:1 원복. 파일럿 단계에서 실제 원복 왕복 검증 완료.

## 산출물

- 수정 파일 11건 (각 그룹 1 parent 문서)
- 본 보고서: `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase5c-abstract.md`
- 실행 계획: `/tmp/phase5c-plan.json`
- baseline/after 로그: `/tmp/phase5c-before.txt` · `/tmp/phase5c-before-audit.txt` · `/tmp/phase5c-pilot-after.txt` · `/tmp/phase5c-batch1-after.txt` · `/tmp/phase5c-after.txt` · `/tmp/phase5c-by-domain.txt`

## 참조

- [2026-04-20-phase5-redesign.md](./2026-04-20-phase5-redesign.md) — Class A 20 그룹 분류 근거
- [2026-04-20-phase5a-merge.md](./2026-04-20-phase5a-merge.md) — Class M 2 그룹 실행(직전 단계)
- [00-design.md](../00-design.md) §"개념 구분" — tier 의미론 (system/layout/component/entry)
- `packages/definition-catalog/src/validate.ts` §tier 검증 블록 (line 208-257) — layout 제약
- `packages/definition-catalog/src/domain-root.ts` — domain_root 파생 규칙
- `packages/definition-data-source/src/local-data-source.ts` §invalid-code-boundary (line 619-627) — boundary 제약
