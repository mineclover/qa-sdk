---
def:
  id: domain-hierarchy-phase0-simulation
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

# Phase 0 Simulation — domain_root 파생 효과 측정

## 목적 ^purpose

이 문서는 Phase 0 Simulation — domain_root 파생 효과 측정에 대한 제안·검토 기록을 보존하고, 관련 설계 판단과 후속 작업의 근거를 제공한다.

## 방법론

1. **데이터 소스**: `/Users/junwoobang/workflow/qa-sdk/data/definition-service.sqlite`
   - documents: 1,119건
   - document_links: 2,898건 (link types: `depends_on`, `refines`, `contains`, `implements`, `refs`, `traces_to`, `constrains`)

2. **파생 알고리즘** — [00-design.md §1.5 / §2.1](../00-design.md) 준수:
   - `isDomainTier(doc) === (tier === "system" || tier === "layout")`
   - `outgoing` 링크 중 `depends_on` | `refines` 만 후보
   - 후보의 target이 `isDomainTier`인 것만 선정
   - 후보 없음 → `self`가 루트
   - 다중 후보 → `selectPrimaryParent`:
     1. target이 더 이상 상위 domain 링크를 갖지 않음 (계층 상위) 우선
     2. `depends_on` > `refines`
     3. `localeCompare`(알파벳 tiebreak)
   - `visited` set 기반 순환 방어, depth cap 10

3. **Duplicate-coordinate 키**:
   - Baseline: `tier:scope:layer:aspect`
   - After: `tier:scope:layer:aspect:domain_root`
   - 필터: `lifecycle !== "deprecated"` AND `tier !== "component"` (현행 validator 규칙 일치)

4. **스크립트**: `/tmp/domain-root-sim.ts` (이 리뷰와 함께 보존된 원시 결과: `/tmp/domain-root-sim-output.json`)

---

## 현재 상태 (baseline)

현행 `pnpm exec qa-sdk def validate` 결과:

| 지표 | 값 |
|------|---|
| 총 문서 | 1,119 |
| `duplicate-coordinate` 경고 그룹 수 | **30** |
| 영향 받은 문서 수 | 237 |
| 전체 validate 경고 | 66 |

30개 그룹 중 대형 그룹:
- `system:feature:domain:func_def` — 32건 (APM/DF/CQ/WI/gate/... 시스템들이 좌표 충돌)
- `system:data:domain:domain_data` — 32건 (taxonomy/catalog 계열)
- `system:flow:operation:process_flow` — 22건
- `none:none:none:none` — 22건 (좌표 미부여 문서, 주로 `tier-redesign/*` proposal)
- `system:interface:mediation:api_contract` — 15건

---

## 파생 결과

### 집계

| 지표 | Baseline | After derivation | 변화 |
|------|---------|------------------|------|
| duplicate-coordinate 그룹 | 30 | **25** | −5 |
| 완전 해소된 그룹 | — | **17** | (groups where every doc ended with a distinct domain_root) |
| 부분 해소 | — | 10 | (multiple roots surfaced, but ≥1 root still shares) |
| 무변화 | — | 3 | (all docs still map to the same root) |

**핵심 지표**: 30개 baseline 그룹 중 **17개가 완전 해소**, **10개가 부분 해소**, **3개만 무변화**.

"resolved" = 그룹 내 모든 문서가 서로 다른 `domain_root`로 분기되어 extended-key 상 중복이 0인 경우.
"partially resolved" = extended-key로는 여전히 중복 서브그룹이 남지만, 1개 이상의 문서가 다른 root로 분리된 경우.

### 완전 해소 그룹 (17)

| baseline key | docs → roots |
|-------------|-------------|
| `none:none:none:none` | 22 → 22 (proposal 문서들: 모두 self-root) |
| `none:flow:none:process_flow` | 10 → 10 |
| `system:flow:domain:process_flow` | 6 → 6 |
| `system:flow:mediation:process_flow` | 5 → 5 |
| `exempt:data:domain:domain_data` | 5 → 5 |
| `system:data:domain:system_data` | 5 → 5 |
| `system:constraint:domain:tech_constraint` | 5 → 5 |
| `system:ui:experience:component` | 5 → 5 |
| `system:feature:mediation:func_def` | 4 → 4 |
| `system:ui:experience:layout` | 3 → 3 |
| `system:state:domain:domain_state` | 3 → 3 |
| `system:data:operation:system_data` | 3 → 3 |
| `system:constraint:domain:biz_constraint` | 3 → 3 |
| `system:constraint:operation:infra_constraint` | 2 → 2 |
| `system:constraint:operation:tech_constraint` | 2 → 2 |
| `none:flow:domain:process_flow` | 2 → 2 |
| `system:constraint:domain:infra_constraint` | 2 → 2 |

### 부분 해소 그룹 (10) — 남은 하위 중복

파생 후에도 `tier:scope:layer:aspect:domain_root` 키로 여전히 중복인 서브그룹:

| baseline key | 남은 중복 (동일 root 공유) |
|-------------|----------------------------|
| `system:data:domain:domain_data` (32 docs, 26 roots) | `definition-catalog-spec` 하위 4건 · `dkg-skill-catalog` 하위 3건 · `meta-semantic-concepts` 하위 2건 |
| `system:feature:domain:func_def` (32 docs, 23 roots) | `pipe-gate`/2 · `scope-nesting-pattern-lifecycle`/2 · `system-libraries`/3 · `partial-binder-spec`/3 · `apm-codegen-system`/2 · `gate-engine-group`/2 · `address-scenarios-group`/2 |
| `system:flow:operation:process_flow` (22 docs, 18 roots) | `definition-catalog-spec`/3 · `admin-api-system`/2 · `decision-flow-quality-bundle`/2 |
| `system:interface:mediation:api_contract` (15 docs, 14 roots) | `registry-system`/2 (decode-system, registry-system) |
| `system:feature:operation:func_def` (12 docs, 5 roots) | `definition-catalog-spec`/7 · `infra-verify-stage`/2 |
| `system:interface:operation:api_contract` (8 docs, 7 roots) | `definition-catalog-spec`/2 |
| `system:data:none:prefix_schema` (7 docs, 5 roots) | `prefix-service`/2 · `event-prefix-group`/2 |
| `system:feature:experience:func_def` (7 docs, 6 roots) | `automation-skill-group`/2 |
| `system:feature:domain:scenario` (5 docs, 4 roots) | `sdk-scenario-multi-service`/2 |
| `layout:flow:operation:process_flow` (3 docs, 2 roots) | `system-libraries`/2 (system-infra, system-libraries) |

관찰: **`definition-catalog-spec`가 과도하게 많은 문서(90건)의 root로 선정되고 있다.** 알고리즘이 `depends_on` 사슬을 너무 깊이 타고 올라가서 모든 definition-catalog 하위 개념이 한 root로 수렴한다. Phase 1에서 primary-parent 규칙을 보완해야 한다(§ 다음 단계 참조).

### 무변화 그룹 (3)

| baseline key | docs | 공유 root |
|-------------|------|----------|
| `none:constraint:none:tech_constraint` | architecture-decisions · coding-conventions · spec-convention | guides-system |
| `none:feature:operation:func_def` | clickhouse-analytics-todo · redis-cache-pipeline-todo | store-adapter-parity |
| `system:feature:none:func_def` | motion-workspace-service · motion-workspace-system | motion-workspace-service |

이 3개는 Phase 5 "내용 중복 제거" 후보로 명확 — 진짜 의미 중복 또는 문서 merge 대상.

### Missing-domain-root 현황

- Self-rooted tier:system|layout 문서: **128건**
- 휴리스틱(id prefix 매칭) 기반 missing-domain-root 후보: **49건**
  - 부모 후보가 DB에 존재 (Phase 3에서 `depends_on` 링크 추가만으로 해결): **34건**
  - 부모 후보 없음 (신규 도메인 루트 생성 필요): **15건**

주요 후보 (Phase 3에 바로 연결 가능):
- `apm-codegen-system`, `apm-schema-system` → `apm-system`
- `df-taxonomy`, `df-analysis-group`, `df-interface-group`, `df-model-group`, `df-narrative-group`, `df-narrative-proofs` → `df-system`
- `gate-consistency`, `gate-event-bus`, `gate-engine-group` → `gate-system`
- `query-api-spec`, `query-rules`, `query-quality-bundle` → `query-system`
- `ingest-api-system`, `ingest-quality-bundle` → `ingest-system`
- `decode-service-spec`, `decode-bigint`, `decode-service-system`, `decode-quality-bundle` → `decode-system`
- `dkg-system-root`, `dkg-skill-catalog` → `dkg-system`
- `scope-nesting-pattern-lifecycle`, `scope-nesting-visualization` → `scope-nesting-system`
- `browser-lifecycle-system`, `browser-runtime-system` → `browser-system`
- `viz-system-root` → `viz-system`
- `registry-quality-bundle` → `registry-system`

신규 루트 생성 필요 후보 (부모 DB 미존재):
- `decision-service-spec`, `decision-standard-group`, `decision-flow-quality-bundle`
- `definition-catalog-spec`, `definition-service-quality-bundle`
- `motion-workspace-spec`, `motion-workspace-service`
- `perm-codec-system`, `perm-external-system`, `perm-migration-system`
- `spec-arch-group`

---

## Go/No-Go 판정

**판정: GO** (Phase 1 진행 권고)

### 근거

Phase 0 성공 기준: "30건 중 ≥ 15건이 domain_root로 구별됨"
- **완전 해소만 세어도 17/30** (Go threshold 15 초과)
- 부분 해소 10건을 포함하면 **27/30이 구조적으로 개선**됨
- 무변화는 3건뿐이며 모두 "진짜 내용 중복" 의심 케이스로, Phase 5에서 merge/refactor 대상으로 다루기 적합

### 기대 효과 재평가

| 지표 | 기존 목표 (00-design §4) | Phase 0 실증 기반 전망 |
|------|------------------------|------------------------|
| duplicate-coordinate (링크 미보완 시) | ≤ 15 | **25** (완전 해소 17 + 부분 해소 10 - 신규 세분화 key 2개) |
| duplicate-coordinate (Phase 3 링크 보완 후) | ≤ 8 | **≤ 10** 예상 (Phase 3에서 34건 후보 연결 시 부분 해소 그룹 대부분 추가 분할) |

Phase 2 단독(링크 보완 없이) 만으로도 30 → 25로 17% 감소. Phase 3 완료 후에는 기존 목표인 ≤ 8건 달성 가능성이 높다.

---

## 다음 단계

### 즉시 (Phase 1 시작 시)

1. **primary-parent 규칙 재검토 필요**. `definition-catalog-spec`가 90건의 root를 흡수하는 현상은 의미론적으로 과도하다.
   - 후보 A: `depends_on` vs `refines` 우선순위 재고 ([q2 open question](./2026-04-20-q2-parent-priority.md)와 연계)
   - 후보 B: "동일 도메인 prefix" heuristic — target의 id가 source id의 prefix(예: `apm-`)와 일치할 때만 상위 루트로 간주
   - 후보 C: `owner_system` fallback을 primary로 올려서, 링크가 없어도 `owner_system`이 있으면 그것을 root로 사용
2. `packages/definition-catalog/src/domain-root.ts` 구현 (01-migration Phase 1)
3. unit test — 본 시뮬레이션의 resolved/partial/unchanged 분류를 fixture로 고정

### Phase 3 작업 목록 (실증 기반)

- 34개 후보에 `depends_on` 링크 추가 (미결 fallback 없이 자동 제안 가능)
- 15개 "새 루트 필요" 케이스는 사람 리뷰: 기존 루트에 흡수 vs 신규 도메인 선언
- APM 도메인(apm-codegen-system / apm-schema-system → apm-system)을 [섀도우 리팩토링](../01-migration.md#실증-의무-empirical-validation) 첫 대상으로 확정 권고

### Phase 5 후보 (진짜 내용 중복)

무변화 3건 + 부분 해소 중 동일 root 공유가 2건 이상인 쌍 (`decode-system/registry-system` 공유의 `decode-system`↔`registry-system` 등)을 대상으로 사람 리뷰.

---

## 부록: 도메인 루트 분포 (Top 10)

| root | 소속 문서 수 |
|------|-----------|
| definition-catalog-spec | 90 ← **과도함, Phase 1에서 재조정 필요** |
| prefix-service | 43 |
| system-libraries | 24 |
| dkg-skill-catalog | 20 |
| registry-system | 19 |
| scope-nesting-visualization | 19 |
| coord-foundation | 17 |
| pipe-gate | 17 |
| rlsc | 14 |
| partial-binder-spec | 13 |

관찰: top-heavy 분포는 파생 규칙 튜닝의 여지를 시사한다. 평균 분포를 목표로 primary-parent 규칙을 검증하는 것이 Phase 1의 주요 과제.

---

## 산출물

- 시뮬레이션 스크립트: `/tmp/domain-root-sim.ts`
- 원시 출력: `/tmp/domain-root-sim-output.json`
- 본 리뷰: `docs/proposals/domain-hierarchy/reviews/2026-04-20-phase0-simulation.md`
