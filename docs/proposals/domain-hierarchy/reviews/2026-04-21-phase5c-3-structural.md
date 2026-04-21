---
def:
  id: domain-hierarchy-phase5c-3-structural
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

# Phase 5c-3 — Opp 2 후속 dup-coord 13건 구조적 해소

## 목적 ^purpose

Phase Opp 2 실행 후 self-root 95 → 48 감소 효과로 **13개 신규 duplicate-coordinate 경고**가 노출되었다. Phase 3b Option B 가 예측한 "children이 parent root로 흡수되며 같은 좌표의 sibling 이 함께 모인다" 현상의 2차 파동이다. 본 라운드에서는 Phase 5c-2 가 정립한 layout-promotion / cross-scope 패턴으로 13 그룹 전체를 해소한다.

## 13 그룹 인벤토리

| # | 좌표 (tier:scope:layer:aspect) | 도메인 루트 | 멤버 | 크기 | 분류 | 조치 |
|---|---|---|---|---:|---|---|
| 1 | system:feature:domain:func_def | registry-system | address-scenarios-group, index-meta-system | 2 | A | address-scenarios-group → layout |
| 2 | system:feature:experience:func_def | dkg-system | 5 skill-groups | 5 | C | cross-scope (all 5) |
| 3 | system:data:domain:domain_data | conventions-system | bigint-addressing-group, data-design-group, indexing-core-system, slot-marker-group | 4 | C | cross-scope (all 4) |
| 4 | system:data:domain:domain_data | meta-semantic-system | data-object-binding, meta-semantic-concepts, pipe-connection-catalog, pipe-flow-catalog | 4 | C | cross-scope (data-object-binding + meta-semantic-concepts; 나머지 2는 기보유) |
| 5 | system:flow:operation:process_flow | registry-system | dx-lifecycle-group, registry-quality-bundle | 2 | C | cross-scope (both) ← pilot |
| 6 | system:data:none:prefix_schema | prefix-service | 5 prefix-groups | 5 | C | cross-scope (all 5) |
| 7 | system:data:domain:domain_data | registry-system | index-meta-store-group, table-schema-spec | 2 | A | index-meta-store-group → layout |
| 8 | system:feature:domain:func_def | meta-semantic-system | meta-semantic-pipe-impl, pipe-static-lineage, pipe-zoom | 3 | C | cross-scope (all 3) |
| 9 | system:interface:operation:api_contract | operational-ontology-system | operational-ontology-registry-allocation, programming-artifact-ontology-system | 2 | C | cross-scope (both) |
| 10 | system:feature:domain:func_def | system-support | perm-codec-system, perm-migration-system | 2 | A | perm-codec-system → layout |
| 11 | layout:data:none:prefix_schema | prefix-service | prefix-catalog-system, prefix-service | 2 | C | cross-scope (both) |
| 12 | system:flow:domain:process_flow | spec-architecture-system | spec-architecture-system, spec-engine-system, spec-phases-group | 3 | C | cross-scope (all 3) |
| 13 | system:data:domain:domain_data | weighted-index-system | weighted-index-system, wi-trace-group | 2 | A | wi-trace-group → layout |

**분류 요약**: A(Abstract/layout promotion) 4 그룹 · C(Cross-scope tag) 9 그룹 · M(Merge) 0 그룹.

## 파일럿 결과

그룹 5 (dx-lifecycle-group / registry-quality-bundle) 를 파일럿으로 선정.

1차 시도: dx-lifecycle-group → layout 승격. **실패** — `layout:flow:operation:process_flow` @ registry-system 에 이미 decode-quality-bundle 이 존재하여 충돌 재발.

2차 시도: 양쪽에 `cross-scope` 태그 부여 (Class C). **성공** — dup-coord 15 → 14, errors=0, 신규 경고 없음.

**발견**: Phase 5c-2 의 primary-parent layout promotion 이 항상 통하지 않는다. 같은 root 의 다른 sibling 이 이미 layout 으로 있으면 2차 충돌이 발생한다. 따라서 본 Phase 에서는 사전에 target coord 에 기존 layout 이 있는지 확인하고, 있을 경우 cross-scope 를 사용한다.

## 그룹별 적용 결과

### Class A — layout promotion (4 그룹, 4 문서)

| # | 승격 대상 | 변경 파일 | contains → refs | 확인 |
|---|---|---|---|---|
| 1 | address-scenarios-group | `docs/specs/index-meta-system/address-scenarios-group.md` | 2건 | 해소 |
| 7 | index-meta-store-group | `docs/specs/index-meta-system/index-meta-store-group.md` | 2건 | 해소 |
| 10 | perm-codec-system | `docs/specs/permission/perm-codec-system.md` | 2건 | 해소 |
| 13 | wi-trace-group | `docs/specs/weighted-index-system/wi-trace-group.md` | 3건 | 해소 |

승격 전 target coord 에 동일 root 의 기존 layout 이 없음을 SQL 사전 확인.

### Class C — cross-scope tag (9 그룹, ~26 문서)

| # | 대상 파일 | 추가 태그 |
|---|---|---|
| 2 | skill-catalog/{automation,claude,cli-command,dkg,ralph-tui}-skill-group.md (5건) | cross-scope |
| 3 | indexing-core-system/{bigint-addressing,data-design,slot-marker}-group.md + indexing-core-system.md (4건) | cross-scope |
| 4 | meta-semantic/pipe-impl/model/data-object-binding.spec.md + meta-semantic-concepts.spec.md (2건; 나머지 2는 기보유) | cross-scope |
| 5 | index-meta-system/dx-lifecycle-group.md + quality-gates/registry-quality-bundle.md (2건) | cross-scope |
| 6 | prefix-catalog/{entity,event,observation,policy,relation}-prefix-group.md (5건) | cross-scope |
| 8 | meta-semantic/{meta-semantic-pipe-impl.spec.md, pipe-impl/pipe-static-lineage.spec.md, pipe-impl/engine/pipe-zoom.spec.md} (3건) | cross-scope |
| 9 | operational-ontology/{operational-ontology-registry-allocation.spec.md, programming-artifact-ontology-system.spec.md} (2건) | cross-scope |
| 11 | prefix-catalog/{prefix-catalog-system.md, entity-prefix-group/prefix-service.spec.md} (2건) | cross-scope |
| 12 | spec-engine-system/{spec-architecture-system.md, spec-engine-system.md, spec-phases-group.md} (3건) | cross-scope |

group 3 의 초기 시도는 layout promotion (3 of 4) 이었으나 승격된 3 문서가 layout-level 에서 자기들끼리 재충돌 → 4 문서 모두 cross-scope 로 전환.

## 잔여 dup-coord

**0 건.** 13 → 0 로 완전 해소. 목표 ≤ 3 을 초과 달성.

## Orphan handling

| 문서 | 처리 |
|---|---|
| `slot-marker-group` | `indexing-core-system` 에 `refs` 링크 추가로 해소. `indexing-core-system.md` README 본문은 이미 slot-marker-group 을 언급하고 있었으나 공식 링크가 누락된 상태였다. |
| `bdd-contract-cli-rule` | 병행 에이전트 작업 결과물. 범위 외 — 건드리지 않음. |

## Metrics before/after

| 지표 | Opp 2 완료 (baseline) | Phase 5c-3 완료 | Δ |
|---|---:|---:|---:|
| errors | 0 | **0** | 0 |
| warnings (총합) | 15 | **1** | **-14** |
| duplicate-coordinate 그룹 | 13 | **0** | **-13** (-100%) |
| orphan | 2 | 1 | -1 (slot-marker-group 해소; bdd-contract-cli-rule 잔존) |
| def sync 문서 | 1,248 | 1,249 | +1 (본 보고서) |
| def sync 링크 | 3,233 | 3,235 | +2 (orphan fix refs link + 내부 조정) |
| system-contains-system (error) | 0 | 0 | 0 |
| invalid-code-boundary (error) | 0 | 0 | 0 |

각 커밋 후 errors=0 불변식 유지 확인.

## 패턴 학습

1. **layout promotion pre-check 필수**: 승격 전에 `SELECT FROM documents WHERE tier='layout' AND scope=? AND layer=? AND aspect=?` 쿼리로 동일 root 의 기존 layout 존재 여부를 확인해야 한다. 없으면 A 진행, 있으면 C 로 전환.
2. **3+ 멤버 그룹은 대부분 C**: primary-parent 승격 후에도 sibling 2+ 건 잔존 → 추가 승격은 layout-level 재충돌 유발. Class C 가 구조적으로 더 안전.
3. **cross-scope 는 opt-out 의 명시적 선언**: "의도적 peer" 관계를 문서화하는 수단으로 정당. 의미 있게 공유 가능한 그룹 (이커머스 prefix taxonomy, skill 카테고리) 에 적합.

## 커밋 목록

| # | hash | 제목 |
|---|---|---|
| 1 | 5d591abc | refactor(def): phase5c-3 pilot — dx-lifecycle-group cross-scope |
| 2 | 1881af30 | refactor(def): phase5c-3 — layout promotion + cross-scope (6 groups resolved) |
| 3 | 4993b22d | refactor(def): phase5c-3 — cross-scope tagging for peer dup-coord groups |
| (본 보고서) | — | docs(proposals): phase5c-3 structural resolution report |

## 가역성

- 모든 변경은 frontmatter `tier` / `tags` / `links[].type` 만 수정. 파일 본문 무수정.
- 태그 제거 시 13 dup-coord 그룹 재발. layout 복귀 시 addressing 변경 없음 (address 정수 유지).

## 참조

- [2026-04-21-opp2-self-root-audit.md](./2026-04-21-opp2-self-root-audit.md) — Opp 2 self-root 해소 (95→48)
- [2026-04-20-phase5c-abstract.md](./2026-04-20-phase5c-abstract.md) — layout promotion 패턴 정립
- [2026-04-21-phase5c-2-structural.md](./2026-04-21-phase5c-2-structural.md) — Phase 5c-2 구조적 해소 (20→10)
- `packages/definition-catalog/src/validate.ts` §duplicate-coordinate (line 350-389) — 키 파생 + cross-scope opt-out
- `packages/definition-catalog/src/domain-root.ts` — domain_root 파생 규칙
