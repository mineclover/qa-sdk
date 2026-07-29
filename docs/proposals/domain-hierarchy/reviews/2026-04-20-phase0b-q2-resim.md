---
def:
  id: domain-hierarchy-phase0b-q2-resim
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
status: under-review
date: 2026-04-20
part_of: domain-hierarchy
role: review
---

# Phase 0b — Q2 규칙(`refines > depends_on`) 재시뮬레이션

## 목적 ^purpose

이 문서는 Phase 0b — Q2 규칙(refines > depends_on) 재시뮬레이션에 대한 제안·검토 기록을 보존하고, 관련 설계 판단과 후속 작업의 근거를 제공한다.

Phase 0 시뮬레이션([2026-04-20-phase0-simulation.md](./2026-04-20-phase0-simulation.md))은 `selectPrimaryParent` 규칙 2로 **`depends_on > refines`**를 적용했고, GO 판정(17/30 완전 해소)을 받되 **`definition-catalog-spec`가 90건을 단일 root로 흡수**하는 과잉 수렴 문제를 남겼다.

Q2 리뷰([2026-04-20-q2-parent-priority.md](./2026-04-20-q2-parent-priority.md))는 그 반대인 **`refines > depends_on`**(Option B)을 권고한다. 본 Phase 0b는 동일 DB/필터/방어코드에서 규칙 2만 뒤집어 재시뮬레이션하고, Phase 0 결과와 정량적으로 비교한다.

---

## 방법론

Phase 0 스크립트에서 오직 `selectPrimaryParent` 우선순위 2번만 뒤집은 변형을 사용한다.

- **변경 전** (Phase 0, `/tmp/domain-root-sim.ts`): 동일 도메인 상위 여부 → **`depends_on`** > `refines` → `localeCompare`
- **변경 후** (Phase 0b, `/tmp/domain-root-sim-q2.ts`): 동일 도메인 상위 여부 → **`refines`** > `depends_on` → `localeCompare`

그 외 모든 것은 동일:

- DB: `/Users/junwoobang/workflow/qa-sdk/data/definition-service.sqlite` (문서 1,119 / 링크 2,898)
- `isDomainTier` = tier ∈ {system, layout}
- 후보 링크 타입 = {`depends_on`, `refines`}
- `visited` 순환 방어, depth cap 10
- duplicate-coordinate 그룹 필터: `lifecycle !== "deprecated"` AND `tier !== "component"`
- baseline 키 = `tier:scope:layer:aspect`, 확장 키 = 거기에 `:domain_root` 추가

산출물:

- 스크립트: `/tmp/domain-root-sim-q2.ts`
- Q2 원시 출력: `/tmp/domain-root-sim-q2-output.json`
- Phase 0 per-doc 덤프(diff용): `/tmp/domain-root-sim-phase0-perdoc.json`
- 비교 결과: `/tmp/compare-q2-vs-phase0.json`

---

## 비교 지표 (Phase 0 vs Phase 0b)

### Top-level

| 지표 | Phase 0 (`depends_on > refines`) | Phase 0b (`refines > depends_on`) | Δ |
|---|---|---|---|
| 총 문서 | 1,119 | 1,119 | — |
| baseline duplicate-coordinate 그룹 | 30 | 30 | — |
| 파생 후 duplicate-coordinate 그룹 | 25 | **25** | 0 |
| 완전 해소 그룹 | 17 | **17** | 0 |
| 부분 해소 그룹 | 10 | **10** | 0 |
| 무변화 그룹 | 3 | **3** | 0 |
| self-rooted system/layout 문서 | 128 | 128 | 0 |
| missing-root 후보(id prefix 휴리스틱) | 49 | 49 | 0 |
| ㄴ 부모 후보 DB 존재 | 34 | 34 | 0 |
| ㄴ 부모 후보 없음(신규 필요) | 15 | 15 | 0 |

**관찰**: 상위 집계 지표는 완전히 동일하다. Q2 규칙만으로는 baseline 해소 능력에 변화가 없다. 개선/저하는 root **분포**와 **어느 문서가 어느 root로 가는지**에서 일어난다.

### Top-10 root 분포 (Phase 0 vs Phase 0b)

| Rank | Phase 0 root | count | → Phase 0b root | count | Δ |
|---|---|---|---|---|---|
| 1 | definition-catalog-spec | **90** | definition-catalog-spec | **86** | **−4** |
| 2 | prefix-service | 43 | prefix-service | 43 | 0 |
| 3 | system-libraries | 24 | system-libraries | 24 | 0 |
| 4 | dkg-skill-catalog | 20 | scope-nesting-visualization | 22 | +3 |
| 5 | registry-system | 19 | dkg-skill-catalog | 20 | 0 |
| 6 | scope-nesting-visualization | 19 | registry-system | 19 | 0 |
| 7 | coord-foundation | **17** | pipe-gate | 17 | 0 |
| 8 | pipe-gate | 17 | rlsc | 14 | 0 |
| 9 | rlsc | 14 | service-manifest-assembly | 13 | 신규 등장 |
| 10 | partial-binder-spec | 13 | claude-skill-group | 13 | +1 |

빠져나간 root: `coord-foundation`은 17 → 12 (−5)로 분산, `partial-binder-spec` 13 → 12, `scope-nesting-pattern-lifecycle` 10 → 7.

### 전체 root 이동

- root가 바뀐 문서: **28건** (1,119건 중 2.5%)
- `definition-catalog-spec`에서 빠져나간 문서: **6건** (예: `skill-def-explore`, `skill-def-knowledge`, `spec-core-identifiers`, `spec-core-registry`, `viteplus-playbook-template-flow`, `dkg-state-store-observability`)
- `definition-catalog-spec`로 새로 들어온 문서: **2건** (`definition-mgmt-semantic-lint`, `doc-type-convention-cases`)
- 순효과: −4 (90 → 86)

---

## 과도 수렴 변화

### definition-catalog-spec 흡수율

| 지표 | Phase 0 | Phase 0b | 변화 |
|---|---|---|---|
| 전체 흡수 수 | 90 | 86 | **−4 (−4.4%)** |
| 단일 root 점유율(1,119 중) | 8.0% | 7.7% | −0.3pp |

**판정**: Q2 규칙은 과도 수렴을 **측정 가능하게 줄이긴 했지만(4건)**, 의미 있는 수준은 아니다. 여전히 86건이라는 1위 흡수량은 **전체 문서의 7.7%**를 차지하며, 2위(`prefix-service` 43)의 **2배**. 지배적 root 현상은 해소되지 않음.

### 남은 주요 흡수 사례(Phase 0b 기준)

부분 해소 그룹에서 여전히 `definition-catalog-spec`를 공유하는 서브그룹:

- `system:feature:operation:func_def` → `definition-catalog-spec`(7): `definition-harness`, `definition-quality-gates`, `decision-service-system`, `definition-service-system`, `spec-analyzer-system`, `spec-tracker-system`, `spec-verification-system`
- `system:data:domain:domain_data` → `definition-catalog-spec`(4): `definition-catalog-spec`, `definition-taxonomy`, `dual-coordinate-system`, `taxonomy-boundaries`
- `system:flow:operation:process_flow` → `definition-catalog-spec`(3): `harness-architecture`, `definition-management`, `definition-mgmt-observability-model`
- `system:interface:operation:api_contract` → `definition-catalog-spec`(2): `definition-service-sync`, `definition-service`

→ 이 16건은 `depends_on` 사슬을 **모두 `refines`로 전환해도** 여전히 `definition-catalog-spec`로 수렴한다. 즉 원인은 규칙 우선순위가 아니라 `definition-catalog-spec`가 **여러 구조적 상위 개념을 혼자 흡수**하고 있다는 데 있다(도메인 서브시스템 분할 부재).

### 개선된 사례

Q2 규칙이 의미적으로 올바른 결과를 낸 케이스:

| doc | Phase 0 root | Phase 0b root | 코멘트 |
|---|---|---|---|
| `index-meta-store-contract` | `table-schema-spec` | **`index-meta-store-group`** | Q2 §2 케이스 7과 정확히 일치(ISA 승리) |
| `skill-def-explore`, `skill-def-knowledge` | `definition-catalog-spec` | `claude-skill-group` | skill은 claude-skill 도메인이지 definition-catalog가 아님 |
| `spec-core-identifiers`, `spec-core-registry` | `definition-catalog-spec` | `spec-core-types-group` | spec-core 도메인이 올바른 root |
| `dkg-state-store-observability` | `definition-catalog-spec` | `dkg-skill-catalog` | DKG 도메인으로 재배치 |
| `perm-codec-stack` | `perm-external-system` | `perm-codec-system` | `refines` 상위가 정확한 서브도메인 |
| `perm-migration-algorithm` | `permission-model` | `perm-migration-system` | 동일 |
| `bigint-addressing-runtime` | `coord-foundation` | `bigint-addressing-group` | 응집 향상 |
| `coord-states-taxonomy`, `coord-states-versioning` | `coord-foundation` | `coord-states-group` | 동일 |
| `data-design-catalog`, `data-design-compression` | `coord-foundation` | `data-design-group` | 동일 |
| `viz-3d-spec` | `partial-binder-spec` | `canvas-viewport-spec` | viz 도메인으로 정정 |

### 악화 사례

Q2 규칙으로 **덜 자연스러운 root**를 얻은 케이스(2건):

| doc | Phase 0 root | Phase 0b root | 코멘트 |
|---|---|---|---|
| `definition-mgmt-semantic-lint` | `scope-nesting-pattern-lifecycle` | `definition-catalog-spec` | Phase 0이 더 구체적 서브도메인에 배치 |
| `doc-type-convention-cases` | `decision-standard-group` | `definition-catalog-spec` | 동일 — 더 흡수 쪽으로 이동 |

또한 `dkg-harness-bridge`: `dkg-skill-catalog` → `decision-flow-quality-bundle`(도메인 경계를 넘음), `tracking-three-axes`: `meta-semantic-ir` → `observability-taxonomy`(의미 뒤바뀜 가능).

**순효과**: 10건 정도의 의미적 개선 대 2~4건의 애매해진 케이스. Q2가 유의미한 방향성을 갖긴 하지만, 과도 수렴의 **근본 원인**을 건드리지 못한다.

---

## 그룹별 변화

30개 baseline 그룹 중 **분류(resolved/partial/unchanged)가 바뀐 그룹은 0건**이다. 부분 해소 그룹의 서브 구조만 조금씩 재배치된다. 대표 사례:

- `system:feature:domain:func_def`(32 docs): 공유 root 집합은 동일(`partial-binder-spec`, `pipe-gate`, `system-libraries`, `apm-codegen-system`, `gate-engine-group`, `scope-nesting-pattern-lifecycle`, `address-scenarios-group`). Phase 0에서 동일 root 공유가 2~3건이었던 것이 Q2에서도 동일 수.
- `system:data:domain:domain_data`(32 docs): Phase 0 — `definition-catalog-spec` 4건 공유, Q2 — 동일 4건 공유.
- `system:flow:operation:process_flow`(22 docs): Phase 0 — `definition-catalog-spec` 3건, Q2 — 동일 3건(`harness-architecture`, `definition-management`, `definition-mgmt-observability-model`).
- `system:feature:operation:func_def`(12 docs): Phase 0 — `definition-catalog-spec` 7건, Q2 — 동일 7건.

무변화 그룹 3건도 완전히 동일(baseline 문서들은 `refines` 링크가 없음).

---

## Phase 1 권고

### 선택지

- **A** — Q2 규칙(Option B)만으로 충분
- **B** — Q2 규칙 + 추가 휴리스틱이 필요
- **C** — 원래 규칙(Option A)이 DB에 더 적합

### 권고: **B** (Q2 규칙 + 추가 휴리스틱 필요)

### 근거

1. **Q2 규칙은 의미적으로 옳고 약간의 개선을 제공**
   - 케이스 7/8(Q2 리뷰)와 같이 진짜 conflict일 때 ISA 선택이 올바른 답. 시뮬레이션에서 10건 수준의 명확한 개선(skill-def-*, spec-core-*, perm-codec/migration, bigint/coord-states/data-design 재분류)이 관측됨.
   - 악화 사례 2~4건이 있으나 개선의 규모(10+)가 더 큼. 방향성은 맞다.

2. **그러나 Q2만으로 과도 수렴을 고치지 못한다**
   - `definition-catalog-spec` 흡수 90 → 86 (−4, −4.4%)에 그침. Phase 0 리뷰의 주요 우려("90건은 의미론적으로 과도")가 그대로 유지됨.
   - 상위 집계(resolved 17, partial 10, unchanged 3)가 **전혀 변하지 않음** — 규칙 우선순위는 개별 문서 재배치엔 영향을 주지만 duplicate-coordinate 해소율에는 영향 없음.
   - 남은 대형 흡수군(`definition-harness`, `definition-quality-gates`, `spec-analyzer-system` 등 7건이 한 root로 수렴)은 **링크 데이터 자체가 structural sub-root를 구분하지 않는 문제**이며 우선순위 규칙으로는 풀리지 않음.

3. **필요한 추가 휴리스틱**
   Phase 0 리뷰의 후보 B/C가 여전히 유효. 다음을 권고:
   - **prefix-match gating**: `selectPrimaryParent`가 domain tier 링크를 선택할 때, **source id와 target id가 동일 도메인 prefix(예: `definition-`, `apm-`, `df-`)를 공유**하지 않으면 해당 링크를 root 후보에서 제외하고 self-root로 남긴다. definition-`catalog`-spec가 `spec-core-*`나 `skill-*` 문서까지 흡수하는 현상을 차단.
   - **owner_system fallback 승격**: 링크가 비어도 `owner_system`이 있으면 이를 root로 우선 사용(Phase 0 후보 C).
   - **hop distance penalty**: `refines`에 hop당 가중치를 주어 2-hop 이상 떨어진 root로의 수렴을 억제. `definition-catalog-spec`로의 3-5 hop 수렴을 자연스럽게 끊음.

4. **Phase 1 구현 방침**
   - `packages/definition-catalog/src/domain-root.ts`에 Q2 규칙을 기본으로 구현.
   - 추가 휴리스틱(prefix-match, owner_system fallback, hop penalty)은 feature flag 또는 구성 가능한 policy로 둔다.
   - Phase 0 리뷰의 resolved/partial/unchanged 분류를 fixture로 고정한 unit test를 먼저 작성한다(Q2 규칙 기준 17/10/3).
   - Phase 3에서 `definition-catalog-spec` 흡수군에 대한 **자동 서브도메인 분할 제안**(예: `definition-harness-system`, `spec-verification-system` 신규 도메인 생성)을 제시하고 사람 리뷰에 올린다.

### 정리

Q2 권고는 방향성이 옳지만 *단독 해법은 아니다*. Option B를 기본 규칙으로 채택하되, 과도 수렴을 실제로 깎아낼 **추가 휴리스틱 1~2개**를 Phase 1 또는 Phase 2 초기에 추가하는 것이 목표(duplicate-coordinate ≤ 8)에 도달하는 합리적 경로다.

---

## 산출물

- 시뮬레이션 스크립트: `/tmp/domain-root-sim-q2.ts`
- Q2 원시 출력: `/tmp/domain-root-sim-q2-output.json`
- Phase 0 per-doc 덤프(diff용): `/tmp/domain-root-sim-phase0-perdoc.json`, `/tmp/domain-root-sim-phase0-fulldump.ts`
- Phase 0 ↔ Phase 0b 비교 보고: `/tmp/compare-q2-vs-phase0.json`, `/tmp/compare-q2-vs-phase0.ts`
- 본 리뷰: `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase0b-q2-resim.md`
