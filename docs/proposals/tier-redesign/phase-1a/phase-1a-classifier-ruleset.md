---
status: draft
date: 2026-04-18
part_of: tier-redesign
role: phase-1a-evidence
phase: 1.A
topic: auto-classifier-ruleset
---

# Phase 1.A — 자동 분류 룰 초안 (`def tier classify`)

> **의존**: [phase-1a-depth-usage-report](./phase-1a-depth-usage-report.md) · [phase-1a-layout-contains-report](./phase-1a-layout-contains-report.md) · [phase-1a-meta-operational-policy](./phase-1a-meta-operational-policy.md)

## 요약

1,056개 문서 자동 tier 추천을 위한 의사결정 트리 초안. 6-단계 체크(exempt → depth-hint → layout-hint → contains-analysis → R-7 heuristic → component sub-type) 순차 적용. 커버리지 목표 ≥ 80% (DKG CON-004 기준). 나머지 20%는 `needs-review` 마킹 + 수동 판정.

## 입/출력 계약

### 입력
```ts
interface DocSignature {
  path: string                              // 파일 경로
  level?: "group" | "module" | "leaf"       // 기존 레벨 (deprecated 중)
  scope?: ScopeId                           // 16값
  aspect?: AspectId                         // 64값
  depth?: "overview" | "specification" | "implementation" | "validation"
  contains?: string[]                        // def.links.contains 배열
  depends_on?: string[]
  implements?: string[]
  refines?: string[]
  hasOperations: boolean                    // function/method 블록 감지
  hasStateList: boolean                     // states: [...] 블록 감지
  hasSchemaDef: boolean                     // TS interface / zod schema 감지
  hasEvidenceShape: boolean                 // evidence/output shape 감지
  childLevels: ("group" | "module" | "leaf")[]  // contains 자식들의 level
}
```

### 출력
```ts
interface ClassificationSuggestion {
  type: "design" | "knowledge"              // D-19 신규 최상위 분류
  tier?: "component" | "entry" | "system" | "layout" | "exempt" // type: knowledge면 생략 허용
  component_subtype?: "data-shape" | "state-enum" | "evidence-shape"
                    | "data-facet-role" | "validation-rule" | "constant-literal"
  confidence: "high" | "medium" | "low"
  reason: string                            // 매칭된 룰 id + 근거
  warnings?: string[]                       // 예: "System-contains-System 위반 감지"
  needs_review: boolean                     // confidence=low 또는 multi-match
}
```

## 의사결정 트리

### Step 0 — 지식 문서 및 Exempt 선검사 (D-19, D-2 Extended)
`path` 기준 **positive list 매칭** 및 파일 확장자(`doc-type-ext`) 확인:

| 패턴 | 판정 | 비고 |
|------|------|------|
| 루트 `/CLAUDE.md`, `/AGENTS.md`, `/README.md` 등 | `type: knowledge`, `exempt` | root docs |
| `docs/*.md` 최상위 (docs/specs/ 바깥) | `type: knowledge`, `exempt` | knowledge |
| `docs/skills/**` | `type: knowledge`, `exempt` | operational playbook |
| `skills/**/*.md` | `type: knowledge`, `exempt` | skill SSOT |
| `tasks/**` | `type: knowledge`, `exempt` | task/roadmap |
| `.claude/**` | `type: knowledge`, `exempt` | system config |

**Exempt 매칭 시**: 즉시 반환 `{type: "knowledge", tier: "exempt", confidence: "high", reason: "STEP0-knowledge-or-exempt"}`. 이후 룰 적용 없음.
그 외 문서는 기본적으로 `type: design`으로 간주하고 Step 1 진행.

### Step 1 — depth 힌트로 1차 필터

| depth | tier 후보 축소 | 신호 강도 |
|-------|-------------|---------|
| `overview` | Layout / System(그룹 수준) | 강 (69% group은 Layout-like) |
| `specification` | Component / System / Entry | 중 (70% 문서 — 거의 모두 해당) |
| `implementation` | Component(data-shape) / System | 중 |
| `validation` | Component(validation-rule) / System test harness | 약 |

depth만으로 확정 불가 — 다음 step 계속.

### Step 2 — Layout 후보 감지 (`contains` 분석)

**Layout 확정 조건 (A ∧ B ∧ ¬C)**:
- A: `level === "group"` **또는** `depth === "overview"`
- B: `contains.length ≥ 2` **그리고** `childLevels`에 `"module"`이 **2건 이상** 포함
- C: `hasOperations === true` (Layout은 operations 없음)

**매칭 시**: `{tier: "layout", confidence: "high", reason: "STEP2-layout-group-with-modules"}`

**layout-contains 조사 근거**: 9개 group 문서가 이 패턴 (system-design-tools, system-libraries, system-infra, system-support, meta-semantic-system 등).

### Step 3 — System 후보 (R-7 3-check heuristic)

Layout 아니면 System 검사. **R-7 3-check**를 signature 기반으로 근사:

| check | signature 근거 | 신호 |
|-------|-------------|-----|
| **명명 가능성** | path에 `-system` 접미사, 또는 id가 고유(중복 0건) | 있음 → +1 |
| **독립 운용** | `hasOperations === true` | 있음 → +1 |
| **Lifecycle 유무** | `hasStateList === true` **또는** `lifecycle_ref` frontmatter | 있음 → +1 |

**판정**:
- 점수 ≥ 2 → `{tier: "system", confidence: "high", reason: "STEP3-R7-3check-N"}`
- 점수 = 1 → Step 4로 이동 (Component 후보 우세)
- 점수 = 0 → Step 4로 이동

**System-contains-System 위반 감지**: `tier=system`이고 `contains`에 다른 `module` 레벨 자식이 있으면 `warnings: ["CON-VIOLATION-system-contains-system"]` + 자식을 `depends_on` 전환 제안. 조사 결과 117건 예상.

### Step 4 — Component 판정 + sub-type

System 탈락 후 Component 후보. 먼저 Component인지 확정:

**Component 확정 조건**: `hasSchemaDef || hasStateList || hasEvidenceShape` 중 하나 이상 `true`.

**Component sub-type (첫 매칭 우선)**:

| 순서 | 조건 | sub-type |
|-----|------|---------|
| 1 | `hasStateList && !hasSchemaDef && !hasOperations` | `state-enum` |
| 2 | `hasEvidenceShape && id/path 에 "evidence"/"readiness"` 힌트 | `evidence-shape` |
| 3 | aspect가 meta-semantic facet 매핑 (production/consumption/...) | `data-facet-role` |
| 4 | `hasSchemaDef && validation 조건만 담음` (zod/schema rules) | `validation-rule` (후보) |
| 5 | 불변 상수 리스트만 담음 (`values: [...]`) | `constant-literal` (후보) |
| 6 | 기본 fallback | `data-shape` |

**매칭 시**: `{tier: "component", component_subtype, confidence: 매칭 순서별 high/medium}`

### Step 5 — Entry 후보 (희소)

Component 탈락 후:
- `level === "leaf"` **그리고** 특정 인스턴스 서술 (id가 유명 singleton, 예: "production-registry" 등)
- 매칭 매우 드묾 → 대체로 `confidence: "low"` + `needs_review: true`

**R-2 재평가 trigger**: Phase 2 결과 Entry 후보 **< 3건** → Option B 자동 전환 (Entry tier 제거) 검토.

### Step 6 — Fallback (needs_review)

모든 step 매칭 실패:
- `{tier: undefined, confidence: "low", reason: "STEP6-no-rule-matched", needs_review: true}`

**예상 비율**: ≤ 20% (DKG CON-004 80% 커버리지 기준 역산).

## Confidence 할당 기준

| 매칭 단계 | 기본 confidence |
|---------|---------------|
| Step 0 (exempt positive list) | high |
| Step 2 (Layout, 강한 구조 신호) | high |
| Step 3 (System, R-7 2+ 충족) | high |
| Step 4 (Component, sub-type #1-3) | high |
| Step 4 (Component, sub-type #4-5 후보) | medium |
| Step 4 (Component, fallback #6) | medium |
| Step 5 (Entry) | low |
| Step 6 (매칭 실패) | low |

**medium/low confidence** + **multi-match 감지** (2개 이상 규칙 충족) → `needs_review: true`.

## Phase 2 예상 출력

| 분포 | 예상 비율 | 근거 |
|-----|---------|-----|
| `exempt` | ~10% | 116 / 1,056 |
| `layout` | ~1% | 9 group |
| `system` | ~20% | 27 module × R-7 고득점 + 다수 `-system` 접미사 |
| `component` | ~55% | 70% spec 중 Component 성격 다수 |
| `entry` | <1% | 희소 |
| `needs_review` | ~15% | fallback + multi-match |

**커버리지 (non-exempt 중 확정 tier 할당 ≥ 80%)**: ~85% 예상.

## 자동화 대상 위반 정정 (Phase 2 warn → Phase 4B error)

| 위반 | 자동 제안 | 규모 |
|-----|---------|-----|
| System-contains-System (module → module contains) | `contains` → `depends_on` 전환 | 117건 |
| Group이 `tier: layout` + `contains` → `refs` 전환 | 링크 타입만 변경 | 9 group × 35 자식 엣지 |
| `level` 필드 미제거 + `tier` 필드 추가 | 병행 유지 (Phase 4B까지) | 1,056 전수 |

## 구현 힌트 (Phase 1.B)

- TypeScript AST 파싱 필요 (`hasSchemaDef`, `hasOperations` 감지)
- frontmatter / def.links 파서는 기존 `packages/definition-catalog/src/frontmatter.ts` 재사용
- dry-run 기본 (`def tier classify --dry-run`), `--apply` 플래그로 실제 저장
- 출력: JSON 리포트 + 파일별 diff. Phase 2 evidence JSON 산출물로 보관

## 미확실 / 후속 조사 필요

1. **R-7 3-check signature 근사의 정확도** — `-system` 접미사가 실제 R-7 판정과 얼마나 일치하는지 Phase 3 Pilot에서 측정
2. **Component sub-type #4/#5 후보 승격/탈락 기준** — `validation-rule` / `constant-literal`이 data-shape 하위로 흡수될지 별도 sub-type 유지할지 Pilot 결과로 결정
3. **multi-match 비율** — Phase 2 dry-run 결과 multi-match가 20% 초과하면 룰 보강 필요
4. **Entry tier signature** — R-2에서 Option B 자동 전환 트리거 (Entry < 3건) 확인은 Phase 2 후 명시적 evidence 파일로 기록
