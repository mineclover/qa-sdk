---
def:
  id: domain-hierarchy-phase3b-option-b
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

# Phase 3b — Option B 실행 보고 (부모→자식 `depends_on` 제거 + 자식→부모 추가)

## 목적 ^purpose

Phase 3 차단 원인(부모→자식 `depends_on` 안티패턴이 자식→부모 `depends_on` 추가 시 직접 2-노드 cycle 유발)을 Option B — **parent→child `depends_on` 링크 삭제 + child→parent `depends_on` 추가** — 로 해소한다. 단일 일괄 편집으로 중간 error 상태 없이 baseline의 0 errors를 유지하며 Phase 3의 목표(도메인 멤버십 선언 자동화)를 실증한다.

## 실행 요약

- **제거**: 39건 parent→child `depends_on` 링크 (14 parent-system 문서)
- **추가**: 46건 child→parent `depends_on` 링크 (46 child 문서; 계획 47 중 **viz-language-system** 1건은 사전 존재하던 4-edge cycle 때문에 보류)
- **보류 사유**: `viz-language-system → viz-system (depends_on)` 추가 시 `viz-system → platform-demo-api-spec (depends_on, pre-existing)` + `platform-demo-api-spec → motion-content-contract (refines, pre-existing)` + `motion-content-contract → viz-language-system (refines, pre-existing)` 경로로 cycle 완성. Phase 3b 범위 외 cross-domain 링크 수정 필요 → 보류
- **실행 흐름**: APM-first shadow (3 files, errors=0) → 나머지 11 domains batch → cycle 발견 → viz-language-system 항목 revert → 재검증
- **최종 결과**: errors **0 유지**, warnings 64→78. duplicate-coordinate 28→36 (+8), orphan 18→24 (+6), owner-root-mismatch 7→15 (+8). 

Phase 3 목표 metric (dup-coord ≤12, missing-root ≤15) **미달**. 원인: Option B는 cycle error를 해소하지만, children이 parent root로 **합쳐지면서** 같은 좌표를 가진 형제가 같은 도메인 내에 모여 dup-coord가 증가함. Phase 3 report가 예측한 "Category C re-root absorption" 현상이 전영역에서 발생. Phase 5 (scope/aspect 다양화) 선행 필요.

## APM 섀도우 결과

APM 3 files (apm-system, apm-codegen-system, apm-schema-system) 단독 적용:

| 지표 | baseline | APM-only | Δ |
|---|---|---|---|
| errors | 0 | **0** | 0 |
| warnings | 64 | 64 | 0 |
| duplicate-coordinate | 28 | 28 | 0 |
| APM dup-coord 그룹 | `apm-codegen-system: 도메인 루트 apm-codegen-system: [apm-codegen-system, apm-system]` | `apm-codegen-system: 도메인 루트 apm-system: [apm-codegen-system, apm-system]` | root 전환 (self→apm-system) |

**APM 판정**: PASS. 새 error 0건, APM children이 apm-system root로 흡수됨을 확인. **Phase 3 blocker가 Option B로 해소됨을 실증**.

APM 검증 로그: `/tmp/phase3b-apm-after.txt`

## 전체 적용 결과

| 지표 | baseline | APM-only | full-batch (최종) | Δ vs baseline |
|---|---|---|---|---|
| errors | 0 | 0 | **0** | 0 |
| warnings | 64 | 64 | 78 | +14 |
| duplicate-coordinate | 28 | 28 | 36 | +8 |
| orphan | 18 | 18 | 24 | +6 |
| multi-parent | 16 | 16 | 16 | 0 |
| owner-root-mismatch (info) | 7 | 7 | 15 | +8 |
| level-violation | 2 | 2 | 2 | 0 |
| 총 문서 | 1148 | 1154 | 1154 | +6 (신규 harness docs 추가 반영) |
| 총 링크 | 3008 | — | 2974 | -34 net |

최종 검증 로그: `/tmp/phase3b-after.txt`, `/tmp/phase3b-after-audit.txt`, `/tmp/phase3b-by-domain.txt`

### 핵심 관찰: dup-coord 증가 원인

Phase 3 리포트 §"safe 20건만 유지 시도 → 결과도 부적합"에서 예측한 대로, child → parent `depends_on` 추가가 자식을 parent root로 **흡수**시키며 "서로 다른 self-root이었던 문서들이 동일 parent root 공유"로 인해 dup-coord가 악화.

예시 (post-batch):
- `browser-lifecycle-system` → 이전 self-root → 이제 `storage-system` root (browser-system → ingest-system → storage-system 체인 통과). `{ingest-quality-bundle, ingest-system, pipeline-system}`와 합쳐짐.
- `decode-bigint, decode-quality-bundle, decode-api` → 이전 self-root → 이제 `registry-system` root (decode-system → registry-system 체인).
- `df-analysis-group, df-narrative-group, df-model-group, df-taxonomy` → 이전 self-root → 이제 `decision-standard-group` root (df-system → decision-standard-group 체인, pre-existing peer link).
- `viz-roleplay-system, viz-surface-system` → `canvas-viewport-spec` root (viz-system → canvas-viewport-spec 체인, pre-existing).

이 현상은 **parent system이 peer/cross-domain `depends_on`을 가진 채로 child 흡수를 허용**하기 때문이다. Phase 5에서 peer link의 실제 의존 여부 재검토 및 scope/aspect 다양화가 필요.

## resolved 도메인 그룹 (Phase 0b 예측 → 실제 해소)

Phase 0 simulation이 "완전 해소"로 예측한 그룹은 Option B 적용 시점에 여전히 부분 해소 또는 무변화 상태. 대표 예시:

| baseline 그룹 키 | Phase 0 예측 | Phase 3b 실측 |
|---|---|---|
| `system:feature:domain:func_def` | resolved | 부분 해소 — apm/df/gate/scope-nesting/wi 그룹들이 parent root로 흡수 (dup 재발) |
| `system:data:domain:domain_data` | resolved | 부분 해소 — dkg/meta-semantic children이 parent root로 흡수 |
| `system:interface:mediation:api_contract` | resolved | 부분 해소 — decode-api, gate-api가 registry-system/gate-system으로 흡수 |
| `system:flow:operation:process_flow` | resolved | 무변화/악화 — browser-lifecycle이 storage-system에 흡수, decode-quality 흡수로 clusters 확대 |

**판정**: Phase 0 simulation이 "해소 후 cluster가 분산된 root로 퍼진다"고 가정했으나, 실제로는 parent system들의 peer link 때문에 여러 도메인이 동일 root cluster(storage-system, registry-system, decision-standard-group, canvas-viewport-spec)로 재수렴.

## 남은 중복 그룹 (Phase 5 타깃)

36건 dup-coord 중 Phase 5에서 해결해야 할 주요 cluster:

1. **storage-system root cluster** (4건): browser-lifecycle-system, ingest-quality-bundle, ingest-system, pipeline-system — 모두 `system:flow:operation:process_flow`. scope or aspect 다양화 필요.
2. **registry-system root cluster** (4건): decode-api, decode-service-spec, decode-system, registry-system — 모두 `system:interface:mediation:api_contract`.
3. **gate-system root cluster** (3건): gate-api, gate-event-bus, query-api-spec, query-system — 모두 `system:interface:mediation:api_contract`.
4. **decision-standard-group root cluster** (3건): df-analysis-group, df-narrative-group, df-system — 모두 `system:feature:domain:func_def`.
5. **canvas-viewport-spec root cluster** (3건): viz-roleplay-system, viz-surface-system, viz-system — 모두 `system:ui:experience:component`.
6. **tier-redesign-readme** (18건): proposal 문서 cluster — type: knowledge로 분리 검토.
7. **domain-hierarchy-readme** (13건): proposal 문서 cluster — 동일.

**권장**: Phase 5에서 각 cluster의 sibling 문서에 구체적 sub-aspect/sub-scope 부여 (e.g., `api_contract` → `api_contract_rest` / `api_contract_grpc`).

## 82 new-root-needed 현황

변경 없음. Phase 3b scope 외. Phase 3 report (`2026-04-20-phase3-impl.md` §"82개 new-root-needed 확장 목록 분류") 그대로 유효. 별도 리뷰 필요.

## 7 → 15 owner-root-mismatch 처리

baseline 7건 → 15건 (+8). 신규 8건 전부 meta-semantic-ir-* 계열:

| 신규 건 | owner_system | 파생 root | 원인 |
|---|---|---|---|
| meta-semantic-extraction | meta-semantic-system | definition-catalog-spec | 신규 `meta-semantic-concepts → meta-semantic-system` 링크 추가 후 체인이 meta-semantic-system → definition-catalog-spec으로 연장됨 |
| meta-semantic-folding | 동일 | definition-catalog-spec | 동일 |
| meta-semantic-ir | 동일 | definition-catalog-spec | Phase 3b 추가로 meta-semantic-ir → meta-semantic-system 직접 링크 생겼지만, meta-semantic-system 자신의 `depends_on: definition-catalog-spec`이 파생 체인 상위로 walk |
| meta-semantic-ir-data | 동일 | definition-catalog-spec | 동일 |
| meta-semantic-ir-module | 동일 | definition-catalog-spec | 동일 |
| meta-semantic-ir-pipe | 동일 | definition-catalog-spec | 동일 |
| meta-semantic-ir-rule | 동일 | scope-nesting-system | 다른 체인 (아마 cross-refines) |
| meta-semantic-ir-usecases | 동일 | definition-catalog-spec | 동일 |

**근본 원인**: `meta-semantic-system.md`의 `depends_on: definition-catalog-spec` 링크 자체가 의미론적으로 재검토 대상. meta-semantic-system이 definition-catalog-spec에 "의존"한다는 선언이 맞는지, 아니면 peer/cross-reference인지 결정 필요.

**처리 방침** (instructions §Step 5 option b/c 준수):

- **자동 수정 없음** (aligned with instructions: "Don't auto-fix meta-semantic-system's link")
- 기존 7건 + 신규 8건 = 15건 모두 **deferred**
- **root cause action item**: `meta-semantic-system.md`에서 `depends_on: definition-catalog-spec` 링크의 의미 재정의 필요. 선택지:
  - (a) 링크 유지 + `tag: cross-scope` 부여 → mismatch info를 의도적 선언으로 격상
  - (b) 링크 제거 → meta-semantic-system이 self-rooted 도메인이 됨. 15건 모두 meta-semantic-system root로 수렴.
  - (c) 링크 방향 반전 (definition-catalog-spec → meta-semantic-system) 검토 — meta-semantic이 더 근본 개념인지 아닌지에 따라.

## 발견된 추가 anti-pattern (Phase 3b 범위 외)

Phase 3a가 "경계 케이스 — 건드리지 않은 링크"로 보존한 `viz-system → platform-demo-api-spec (depends_on)` 링크는 **Phase 3b 적용 후 latent cycle을 노출**시켰다. Cycle 경로:

```
viz-language-system → viz-system (depends_on, NEW)
  → platform-demo-api-spec (depends_on, pre-existing — Phase 3a 경계 케이스)
  → motion-content-contract (refines, pre-existing)
  → viz-language-system (refines, pre-existing)
```

**조치**: 본 보고서 작성 시점에 `viz-language-system → viz-system (depends_on)` 추가만 revert 하여 0 errors 복구. viz-language-system은 parent link 없이 remain.

**권장 추가 조치** (Phase 3c 또는 별도 PR):
1. `viz-system.md`에서 `depends_on: platform-demo-api-spec` 제거 (platform-demo-api-spec이 platform-demo-system 자식이므로 viz-system과 peer 관계 아님)
2. 이후 `viz-language-system → viz-system (depends_on)` 재추가
3. 또는 motion-content-contract의 `refines: viz-language-system` 재검토 (의미상 viz-language-system이 더 추상이므로 역방향 적절)

이는 Phase 3a의 "경계 케이스 | viz-system | canvas-viewport-spec, platform-demo-api-spec | 이름에 viz- 프리픽스 없음" 휴리스틱이 오판한 케이스. Phase 3a table 업데이트 권장.

## 커밋 제안 (human이 수행할 단위)

Phase 3b 변경은 **단일 커밋 또는 domain-by-domain 커밋** 선택 가능. 도메인별 커밋 권장:

```
1) fix(def): phase3b — remove parent→child depends_on in apm-system + add child→parent
   - docs/specs/apm-system/apm-system.md (remove 3)
   - docs/specs/apm-system/apm-codegen-system.md (add 1)
   - docs/specs/apm-system/apm-schema-system.md (add 1)

2) fix(def): phase3b — browser domain
   - docs/specs/browser-system/browser-system.md (remove 2)
   - docs/specs/browser-system/browser-lifecycle-system.md (add 1)
   - docs/specs/browser-system/browser-runtime-system.md (add 1)

3) fix(def): phase3b — df domain
   - docs/specs/decision-flow/df-system.md (remove 5)
   - docs/specs/decision-flow/df-analysis-group.md (add)
   - docs/specs/decision-flow/df-interface-group.md (add)
   - docs/specs/decision-flow/df-model-group.md (add)
   - docs/specs/decision-flow/df-narrative-group.md (add)
   - docs/specs/decision-flow/df-narrative-group/df-narrative-proofs.spec.md (add)
   - docs/specs/decision-flow/df-taxonomy.spec.md (add)

4) fix(def): phase3b — gate domain
   - docs/specs/gate/gate-system.md (remove 2)
   - docs/specs/gate/gate-consistency.spec.md (add)
   - docs/specs/gate/gate-engine-group.md (add)
   - docs/specs/gate/gate-event-bus.spec.md (add)

5) fix(def): phase3b — ingest domain
   - docs/specs/ingest/ingest-system.md (remove 3)
   - docs/specs/ingest/ingest-api-system.md (add)
   - docs/specs/quality-gates/ingest-quality-bundle.md (add)

6) fix(def): phase3b — decode + decode-service domain
   - docs/specs/decode-system/decode-system.md (remove 1)
   - docs/specs/decode-system/decode-bigint.spec.md (add)
   - docs/specs/quality-gates/decode-quality-bundle.md (add)
   - docs/specs/decode-service/decode-service-system.md (add)
   - docs/specs/decode-service-spec.spec.md (add)

7) fix(def): phase3b — decision-service domain
   - docs/specs/decision-service-spec.spec.md (add)

8) fix(def): phase3b — definition-service domain
   - docs/specs/quality-gates/definition-service-quality-bundle.md (add)

9) fix(def): phase3b — dkg domain
   - docs/specs/dkg-system/dkg-system.md (remove 2)
   - docs/specs/dkg-system/dkg-skills-system/dkg-skill-catalog.spec.md (add)
   - docs/specs/dkg-system-root.spec.md (add)

10) fix(def): phase3b — index-meta/sdk domain
    - docs/specs/index-meta-system/index-meta-system.md (remove 7)
    - docs/specs/index-meta-system/index-meta-store-group.md (add)
    - docs/specs/index-meta-system/sdk-scenarios/sdk-scenario-multi-service.spec.md (add)

11) fix(def): phase3b — meta-semantic domain
    - docs/specs/meta-semantic/meta-semantic-concepts.spec.md (add)
    - docs/specs/meta-semantic/meta-semantic-ir.spec.md (add)

12) fix(def): phase3b — motion-workspace domain
    - docs/specs/motion-workspace/motion-workspace-system.md (remove 1)
    - docs/specs/motion-workspace/motion-workspace-service.md (add)
    - docs/specs/motion-content/motion-workspace.spec.md (add)

13) fix(def): phase3b — permission domain
    - docs/specs/permission/permission-system.md (remove 5)
    - docs/specs/permission/permission-constraint.spec.md (add)
    - docs/specs/permission/permission-model.spec.md (add)
    - docs/specs/permission-engine-spec.spec.md (add)

14) fix(def): phase3b — pipeline domain
    - docs/specs/pipeline-system/pipeline-aggregator.spec.md (add)
    - docs/specs/pipeline-system/pipeline-cache.spec.md (add)

15) fix(def): phase3b — query domain
    - docs/specs/query-system/query-system.md (remove 1)
    - docs/specs/query-system/query-rules.spec.md (add)
    - docs/specs/ingest/query.spec.md (add)
    - docs/specs/quality-gates/query-quality-bundle.md (add)

16) fix(def): phase3b — registry domain
    - docs/specs/quality-gates/registry-quality-bundle.md (add)

17) fix(def): phase3b — scope-nesting domain
    - docs/specs/scope-nesting/scope-nesting-system.md (remove 2)
    - docs/specs/scope-nesting/scope-nesting-pattern-lifecycle.spec.md (add)
    - docs/specs/scope-nesting/scope-nesting-visualization.spec.md (add)

18) fix(def): phase3b — viz + platform-demo domain (NOTE: viz-language-system not added due to latent cycle with platform-demo-api-spec)
    - docs/specs/viz-system/viz-system.md (remove 3)
    - docs/specs/viz-system/viz-roleplay-system.md (add)
    - docs/specs/viz-system/viz-surface-system.md (add)
    - docs/specs/viz-system-root.spec.md (add)
    - docs/specs/viz-system/platform-demo-api.spec.md (add)

19) fix(def): phase3b — wi domain
    - docs/specs/weighted-index-system/wi-system.md (remove 2)
    - docs/specs/weighted-index-system/wi-pack-format-system.md (add)
    - docs/specs/weighted-index-system/wi-trace-group.md (add)

20) docs: add phase3b report
    - docs/proposals/domain-hierarchy/reviews/2026-04-20-phase3b-option-b.md
```

각 커밋 후 `def sync && def validate` errors=0 유지 확인 필수.

## 산출물

- 편집 계획: `/tmp/phase3b-plan.json` (removals 39 + additions 47)
- 적용 스크립트: `/tmp/phase3b-apply.mjs` (YAML-aware, yaml@2.8.3 사용)
- baseline 검증: `/tmp/phase3b-baseline.txt`, `/tmp/phase3b-baseline-audit.txt`
- APM-only 검증: `/tmp/phase3b-apm-after.txt`, `/tmp/phase3b-apm-audit.txt`
- 최종 검증: `/tmp/phase3b-after.txt`, `/tmp/phase3b-after-audit.txt`, `/tmp/phase3b-by-domain.txt`
- 본 리포트: `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase3b-option-b.md`

## 참조

- [2026-04-20-phase3a-antipattern-fix.md](./2026-04-20-phase3a-antipattern-fix.md) — Option A/B/C/D 분석
- [2026-04-20-phase3-impl.md](./2026-04-20-phase3-impl.md) — 47+82 후보 분석, Category C 흡수 예측
- [2026-04-20-phase0-simulation.md](./2026-04-20-phase0-simulation.md) — 도메인 root 파생 시뮬레이션
- validator: `packages/definition-catalog/src/validate.ts:116-131` (cyclic-ref 탐지)
- validator: `packages/definition-catalog/src/validate.ts:231-245` (system-contains-system error)
