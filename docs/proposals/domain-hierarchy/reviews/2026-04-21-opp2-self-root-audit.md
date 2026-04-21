---
def:
  id: domain-hierarchy-opp2-self-root-audit
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

# Opp2 — 자가-루트(system/layout) 감사 보고

## 목적 ^purpose

`def doctor`가 보고하던 517개 domain root 중 tier:`system`|`layout` 문서의 "self-root" 상태를 정리한다. Phase 3b Option B 패턴(`child → parent depends_on` 만 사용, `parent → child depends_on` 금지)을 mirror 하여 잘못된 self-root를 정당한 상위 도메인에 연결한다.

## 인벤토리

| 지표 | 값 |
|---|---|
| 총 활성 문서 | 1,248 |
| tier:`system`\|`layout` 활성 문서 | 272 |
| opp2 시작 시점 self-root (system/layout) | **95** |
| `def doctor` 총 root (모든 tier 포함) | 517 |

자가-루트 판정 기준 — SQL:
```sql
WITH sysl AS (SELECT doc_id FROM documents WHERE lifecycle != 'deprecated' AND tier IN ('system','layout')),
op AS (SELECT DISTINCT l.source_id FROM document_links l JOIN sysl s ON s.doc_id = l.source_id JOIN sysl t ON t.doc_id = l.target_id WHERE l.link_type IN ('depends_on','refines'))
SELECT COUNT(*) FROM sysl s LEFT JOIN op ON op.source_id=s.doc_id WHERE op.source_id IS NULL;
```

## 분류 결과

| 분류 | 건수 | 조치 |
|---|---|---|
| Legit top-level (상위 부모 없음이 정상) | 44 | 건드리지 않음 |
| Auto-patch 고신뢰 (id prefix / override) | 49 | child→parent depends_on 추가 |
| Flag for human (부모 후보 불명확 또는 cycle) | 3 | 리뷰 필요 |
| 신규 untracked 파일 (scope 외) | 1 | scope 외로 revert |

### Legit top-level (44)

| group | ids |
|---|---|
| Root layouts | `system-root`, `system-frontend`, `system-support`, `system-libraries`, `system-design-tools`, `system-specs-rules-index` |
| Top-level domain systems | `apm-system`, `gate-system`, `dkg-system`, `registry-system`, `storage-system`, `analysis-system`, `guides-system`, `meta-semantic-system`, `canvas-viewport-spec`, `definition-catalog-spec`, `prefix-service`, `admin-api-system`, `infra-engine-system`, `rlsc`, `platform-demo-system`, `motion-workspace-system`, `weighted-index-system`, `authorization-ontology-system`, `operational-ontology-system` |
| Core SDK & architecture | `qa-sdk-core-system`, `qa-sdk-engine-system`, `sdk-system`, `scope-nesting-system`, `spec-architecture-system`, `spec-reference-system`, `conventions-system` |
| Taxonomy / coord foundations | `observability-taxonomy`, `coord-foundation`, `observability-system-root`, `persistence-system-root` |
| Proposal knowledge | `aspect-evolution-index`, `aspect-schema-hierarchy-readme`, `aspect-vocab-split-readme`, `domain-hierarchy-readme`, `tier-redesign-readme` |
| Quality bundles | `work-domain-quality-bundle`, `decision-flow-quality-bundle` |
| df-system | `df-system` (layout) |

### Auto-patched 도메인 배치 (49 additions)

| 도메인 | + links | - links (Option B) | 커밋 |
|---|---|---|---|
| apm | 1 | 0 | `3f5c272a` |
| indexing-core | 7 | 7 | `02ae8395` |
| skill-catalog | 4 | 4 | `1fedfe07` |
| df | 1 | 1 | `b816ed5d` |
| index-meta | 4 | 0 | `f2d8d81a` |
| spec-architecture | 5 | 0 | `892523ff` |
| prefix-catalog | 4 | 0 | `72d1a8b0` |
| meta-semantic | 6 | 0 | `106cc560` |
| permission | 3 | 0 | `bc6d4031` |
| operational-ontology | 2 | 0 | `207d210d` |
| infra | 2 | 0 | `1eab00ee` |
| ingest | 1 | 0 | `5a070808` |
| system-support | 3 | 0 | `7217ea7d` |
| event-vocab | 2 | 0 | `623fa060` |
| weighted-index | 1 | 0 | `80916d6a` |
| rlsc | 1 | 0 | `3ccfc15e` |
| viz | 1 | 0 | `4a4cb6e8` |
| **합계** | **48** | **12** | 17 commits |

(49 additions 계획이었으나 work-lifecycle-plan 1건은 untracked 파일이라 scope 외로 revert → 실제 commit 반영 48건)

### Flag for human (3)

| id | 제안 부모 | 보류 사유 |
|---|---|---|
| `coord-states-group` | `indexing-core-system` | peer-chain cycle: `indexing-core-system → schema-layer-spec → coord-states-group`. schema-layer-spec/coord-states-group 관계를 먼저 재검토 필요. |
| `table-system-group` | `indexing-core-system` | peer-chain cycle: `indexing-core-system → dim-ops-system → table-system-group`. dim-ops-system의 peer depends_on 재검토 필요. |
| `realization-service-control-plane` | `realization-system` (미존재) | 부모 문서 `realization-system`이 DB에 없음. 신규 루트 생성 또는 다른 상위 도메인으로 배속 결정 필요. |

Option B 제약 (`parent → child depends_on` 금지) 유지하면서 위 3건의 부모 링크를 추가하려면 선행 리팩토링(peer 링크 재분배 또는 신규 루트 선언)이 필요해 본 opp2 범위에서 유보.

## 전후 metrics

| 지표 | baseline | after opp2 | Δ |
|---|---|---|---|
| `def validate` errors | 0 | **0** | 0 |
| `def validate` warnings | 1 | 15 | +14 (duplicate-coordinate — Phase 3b 예측과 동일 absorption 효과) |
| `def sync` 문서 | 1,248 | 1,248 | 0 |
| `def sync` 링크 | 3,197 | 3,233 | +36 (+48 adds − 12 removes) |
| `def doctor` 총 roots | 517 | **470** | **−47** |
| 자가-루트 (system/layout) | 95 | **48** | **−47** |
| legit top-level (변하지 않음) | 44 | 44 | 0 |
| 비-legit self-root (flag) | 51 → human 후보 | 3 | −48 |

경고 증가는 Phase 3b와 동일한 "children이 parent root로 흡수되며 같은 좌표를 가진 형제가 동일 root로 모여 duplicate-coordinate 경고 증가"로 설명 가능. errors=0 불변식은 모든 배치에서 유지.

## 커밋 목록 (시간순)

```
3f5c272a fix(def): opp2 — apm self-root parent link
02ae8395 fix(def): opp2 — indexing-core self-root parent links
1fedfe07 fix(def): opp2 — skill-catalog self-root parent links
b816ed5d fix(def): opp2 — decision-flow self-root parent links
f2d8d81a fix(def): opp2 — index-meta self-root parent links
892523ff fix(def): opp2 — spec-architecture self-root parent links
72d1a8b0 fix(def): opp2 — prefix-catalog self-root parent links
106cc560 fix(def): opp2 — meta-semantic pipe-impl self-root parent links
bc6d4031 fix(def): opp2 — permission self-root parent links
207d210d fix(def): opp2 — operational-ontology self-root parent links
1eab00ee fix(def): opp2 — infra-engine self-root parent links
5a070808 fix(def): opp2 — ingest self-root parent link
7217ea7d fix(def): opp2 — system-support self-root parent links
623fa060 fix(def): opp2 — event-vocab self-root parent links
80916d6a fix(def): opp2 — weighted-index self-root parent link
3ccfc15e fix(def): opp2 — rlsc self-root parent link
4a4cb6e8 fix(def): opp2 — viz self-root parent link
```

## 다음 단계

1. **Flag for human 3건**: coord-states-group / table-system-group / realization-service-control-plane 결정
   - schema-layer-spec / dim-ops-system의 peer 링크 역할 재정의
   - realization-system 신규 루트 vs 기존 도메인 흡수 결정
2. **duplicate-coordinate 15건**: Phase 5 (scope/aspect 다양화) 대상 후보 재평가
3. **target ≤ 20 roots 검토**: 현재 44 legit top-level이 하한선. 도메인 merge(예: observability-* 통합, system-* layout 재편)를 통해 추가 축소 가능한지는 별도 proposal 필요

## 참조

- [2026-04-20-phase0-simulation.md](./2026-04-20-phase0-simulation.md) — 자가-루트 초기 후보 49+15 분석
- [2026-04-20-phase3b-option-b.md](./2026-04-20-phase3b-option-b.md) — Option B 패턴 정립, APM shadow
- `packages/definition-catalog/src/domain-root.ts` — 파생 알고리즘
- 시뮬레이터: `/tmp/opp2-simulate.mjs` (cycle-safe sort validator)
- 적용 스크립트: `/tmp/opp2-apply.mjs`
- 클린 스테이지 스크립트: `/tmp/opp2-stage-only-my-changes.sh`
