---
def:
  id: tier-redesign-phase-1a-phase-1a-layout-contains-report
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
    - target: tier-redesign-readme
      type: depends_on
status: under-review
date: 2026-04-19
part_of: tier-redesign
role: phase-1a-evidence
supersedes: -
superseded_by: -
sources:
  - docs/proposals/tier-redesign/README.md
  - docs/proposals/tier-redesign/00-design.md
  - docs/proposals/tier-redesign/03-decisions.md
  - docs/proposals/tier-redesign/rules/system-independence.md
  - docs/proposals/tier-redesign/phase-1a/phase-1a-classifier-ruleset.md
  - docs/specs/definition-catalog/definition-metadata-links.spec.md
  - docs/specs/definition-catalog/definition-metadata-tier.spec.md
  - docs/specs/definition-catalog/definition-taxonomy/definition-level.spec.md
  - docs/specs/system/link-type-usage.rule.md
  - packages/definition-catalog/src/frontmatter.ts
  - packages/definition-catalog/src/validate.ts
  - packages/definition-catalog/src/assemble.ts
  - packages/definition-catalog/src/assemble.test.ts
---

# Phase 1.A — Layout-like `contains` 전환 대상 조사

## 요약

2026-04-18 전수조사 당시 codebase의 **995개 contains 엣지** 중 **117개(12%)는 System-contains-System 위반**(module→module), **9개 group 문서는 Layout-like 패턴**(여러 module을 조직)을 보였다. 전환 규모: 위반 정정(depends_on 변경) 117건 + Layout 패턴 정규화 9건. Phase 2 자동화 규칙은 scope 기반 필터링으로 충분할 것으로 예상했다.

현재 실행 근거는 `packages/definition-catalog/src/validate.ts`가 소유한다. 이 validator는 `tier: layout` 문서의
`contains` 사용을 error로 보고, `tier: system` 또는 legacy `level: module` 문서가 System/module을
`contains`하면 `system-contains-system` warning을 낸다.

---

## A. contains 링크 전수

| 항목 | 수량 |
|------|------|
| **총 contains 엣지** | 995 |
| frontmatter 직접 `contains:` | 13 |
| `def.links.contains` (YAML def 내부) | 982 |

**해석**: 거의 대부분의 contains가 spec 문서의 def.links에 선언됨. frontmatter 선언은 소수.

---

## B. System-contains-System 위반 (규칙 1 위반)

### 위반 정의
module 레벨 문서(System 후보)가 다른 module을 `contains`하는 경우.

### 위반 통계

- **총 위반 수**: 117건
- **포함된 module 문서**: 173개 중 ~45개 (26%)
- **포함하는 module 문서**: 27개 (각각 평균 4.3개 자식 contains)

### Scope 분포

| Scope | 위반 수 | 점유율 |
|-------|--------|--------|
| feature | 39 | 33% |
| data | 33 | 28% |
| flow | 25 | 21% |
| constraint | 8 | 7% |
| interface | 8 | 7% |
| ui | 4 | 3% |

**주요 집중**: feature (33%) + data (28%) — 총 61% 차지.

### 대표 위반 사례 (파일:라인)

1. **docs/specs/query-system/query-system.md**: query-system (module) → query-rules (module)
2. **docs/specs/query-system/query-rules.spec.md**: query-rules (module) → query-rule-migration (module)
3. **docs/specs/definition-catalog/definition-catalog.spec.md**: definition-catalog-spec (module) → 5개 module 자식
4. **docs/specs/index-meta-system/index-meta-system.md**: index-meta-system (module) → 6개 module 자식
5. **docs/specs/realization/realization-service-control-plane.spec.md**: realization-service-control-plane → service-manifest-assembly

#### 패턴 분석
- **다단 계층**: query-system → query-rules → query-rule-migration (3단 module 체인)
- **다자녀**: definition-catalog-spec, index-meta-system (각 5~6개 module 자식)
- **분포**: 정의 카탈로그(definition-catalog, index-meta)에 집중

---

## C. Layout-like 패턴 (전환 후보)

### 정의
`level: group` 이면서 **여러 `level: module` 자식을 contains**하는 패턴. 기존 group 구조가 STC의 Layout tier와 일치.

### 통계

- **총 group 문서**: 13개
- **module을 contains하는 group**: 9개 (69%)
- **group이 contains하는 module 총 수**: 35개

### Layout 후보 (상위 5개, module 자식 수 기준)

| ID | Scope | Module 자식 수 | 예시 자식 |
|-------|-------|-----------------|-----------|
| **system-design-tools** | flow | 7 | dkg-system, df-system, taxonomy-boundaries |
| **system-libraries** | flow | 6 | wi-system, cq-system, indexing-core-system |
| **system-infra** | flow | 6 | ingest-system, gate-system, decode-system |
| **system-support** | flow | 5 | permission-system, apm-system, event-vocab-system |
| **meta-semantic-system** | data | 5 | definition-catalog-spec, meta-semantic-concepts, ... |

### 전환 규칙
현 group → STC Layout으로 정규화:
- `contains` → `refs` (소속 관계)
- frontmatter에 `tier: layout` 추가
- 각 자식 module의 독립성 검증

---

## D. 분포 & 저장소

### 디렉토리별 집중도 (위반 수)

| 디렉토리 | 위반 수 | 비고 |
|---------|--------|------|
| docs/specs/definition-catalog/ | 14 | 가장 집중 (catalog 구조) |
| docs/specs/index-meta-system/ | 10 | 계층화된 meta 시스템 |
| docs/specs/query-system/ | 3 | module 체인 구조 |
| docs/specs/realization/ | 3 | 실현 제어 평면 |
| 기타 | 72 | 분산 (각 1~2건씩) |

### 고아 group (module 자식 없는)
- 4개 group: 순수 leaf 포함만 (contains 전환 대상 아님)

---

## E. 권고

### Phase 1 전환 전략

1. **위반 정정** (117건)
   - module→module `contains` → `depends_on` 변경
   - 자동화 규칙: 출발지 level=module, 도착지 level=module이면 `contains` → `depends_on`
   - 추정 작업: 검증 + 의존성 순서 재확인 (2~3시간)

2. **Layout 정규화** (9건 group)
   - group → Layout tier로 마크
   - 기존 `contains` 링크 유지 (leaf module 포함은 아직 허용)
   - `refs` LinkType 신규 도입은 Phase 2 (문제 없으면 자동 변환 가능)

### Phase 2 복잡도 예측

- **자동 변환 규칙 수**: 3~4개 (level 기반 필터링만으로 충분)
- **수동 검증 필요 케이스**: 의존성 재검토 필요 (10~15건 예상)
- **리스크**: definition-catalog 계층 구조 정합성 확인 필수

---

## 미확실 / 후속 조사 필요

1. **Module→Module `depends_on` 변경 시 순환 의존성** 여부 확인 (query-system → query-rules → query-system 등)
2. **Layout 정규화 후 `refs`와 기존 `depends_on` 혼재** 처리 규칙
3. **definition-catalog의 계층 의도** 검증 (catalog 구조인지, 실제 System hierarchy인지)
4. **일부 module이 "실제로 Component 또는 leaf여야 하는가"** 판단 (R-7 3-check 재적용 필요)
