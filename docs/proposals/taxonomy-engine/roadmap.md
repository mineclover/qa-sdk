---
status: approved
date: 2026-05-21
part_of: taxonomy-engine
role: roadmap
supersedes: -
---

# Taxonomy Engine 진화 로드맵

## 비전 ^purpose

사용자 메모리 `feedback_decision-context-over-tracking`:

> 핵심 가치는 기록이 아니라 **일관된 컨텍스트 제공으로 결정을 쉽게 만드는 것**

현재 (v0.7): yaml로 텍소노미 선언 + 검증 + 코드생성 + 도그푸딩 + Web 리뷰 사이트까지 도달. **결정의 결과**를 잘 다룸.

다음 비전: **결정 자체**를 1급으로. 진화 중인 텍소노미 (확정 + 미정이 섞임, 결정 진행 중)를 자연스럽게 표현하고 추적.

## 케이스 (사용자 lesson-builder 정리)

사용자가 정리한 텍스트 구조가 시스템 결손을 드러냄:

- **"확정 10건"** — 결정 완료
- **"미정 3건"** — 결정 진행 중
- 각 확정 안에 nested sub-decisions
- 미정 항목에 "분리해서 정의하는게 맞아보임" 같은 메타 결정 의도

현재 yaml에 표현 불가:
- entry/axis마다 status (확정/미정)
- 결정 evidence (왜 그렇게)
- 미정 placeholder
- multi-version 동시 보관 (v1 검토 중에 v2 작성)
- 결정 chain (피드백 → 결정 → 영향)

## 8 영역 + 3 Stage 묶음

| # | 영역 | Stage |
|---|------|------|
| 1 | entry-level lifecycle | Stage 1 |
| 2 | 결정 ↔ 변경 link (decisionLink) | Stage 1 (부분) + Stage 3 (풀) |
| 3 | multi-version Registry | Stage 2 |
| 4 | DiffEntry breaking 분류 (semver) | Stage 2 |
| 5 | placeholder/TBD entry | Stage 1 |
| 6 | migration helper | Stage 2 |
| 7 | 결정 chain UI 시각화 | Stage 3 |
| 8 | decision-flow 양방향 통합 | Stage 3 |

---

## Stage 1 — Lifecycle 기반 (다음 라운드)

### 핵심 결정 (확정)

- **lifecycle 값 6단계**: `draft / review / approved / deprecated / archived / tbd`
  - 앞 5개: vocabulary.ts `DEF_LIFECYCLE` 그대로
  - `tbd`: placeholder 전용 (Stage 1 신규)
- **placeholder 표현**: entry에 `lifecycle: tbd` + 선택적 `placeholderReason`
- **decisionLink**: 단순 string (decision-flow URI 또는 markdown path) — Stage 3에서 양방향 sync로 진화

### yaml 스키마 확장

```yaml
axes:
  layer:
    description: lesson-builder Layer
    entries:
      - { id: type-schema, address: 0, lifecycle: approved }
      - { id: asset,       address: 1, lifecycle: approved, decisionLink: "../proposals/lesson-builder/decisions/asset-interface.md" }
      - { id: cue,         address: 12, lifecycle: tbd, placeholderReason: "interaction 정의 미정" }
      - { id: branch,      address: 13, lifecycle: tbd, placeholderReason: "분기 처리 vs cue 경계 미정" }
```

### Diagnostic 신규

| code | severity | 언제 |
|------|----------|------|
| `lifecycle-missing` | warning (strict: error) | entry에 lifecycle 누락 |
| `lifecycle-tbd` | info | placeholder entry 감지 (개수 보고) |
| `lifecycle-transition-invalid` | error | `archived → approved` 같은 부적절 전이 (validate 옵션) |
| `decision-link-broken` | warning | decisionLink 파일/URI 해소 실패 (registry/fs 확인) |

### diff 확장

새 DiffEntry kind:
- `entry-lifecycle-changed` — `{ axis, id, from, to }`

### CLI 확장

- `tax validate --lifecycle-strict` — lifecycle 누락이 error
- `tax show` 출력에 lifecycle 표시
- `tax doctor` — external SSOT의 lifecycle과 비교

### Web UI 확장

- `LifecycleBadge` 컴포넌트 (draft=blue, review=amber, approved=green, deprecated=gray, archived=dark, tbd=red dashed)
- TaxonomyTree: 각 entry 옆에 LifecycleBadge
- FeedbackList: ref가 가리키는 entry의 lifecycle 표시
- Filter: lifecycle별 entry 필터 (예: "tbd만 보기")
- UnitDetailPanel: lifecycle + decisionLink + placeholderReason 표시

### 작업 분량

7-8 task:
- 라이브러리: yaml schema (zod) + IR + validate (4 진단) + diff
- CLI: 옵션 추가 + show 출력 갱신
- Web UI: LifecycleBadge + 4 컴포넌트 통합 + filter
- 도그푸딩: 5 yaml에 lifecycle 부여 (마이그레이션)
- 문서: concepts/lifecycle.md + diagnostics-catalog 갱신

→ taxonomy-engine v0.8 + taxonomy-web v0.4 라운드.

---

## Stage 2 — Multi-version + Breaking 분류

### 핵심 결정 (확정)

- **Registry 재설계**: `Map<slug, Map<version, IR>>` — 완전 다중 보존
  - **breaking change** (v0.7 사용자 영향 있음)
- **ref grammar 갱신**:
  - 기본 `tax:scope.apm` → latest version (현 동작 유지)
  - `tax@v1:scope.apm` 명시 사용은 그 version으로 정확 해소
  - Registry에 여러 version이 있을 때 `@latest` 명시 가능
- **DiffEntry breakingLevel**:
  - `major`: axis/entry 제거, address 변경, kind 변경
  - `minor`: axis/entry 추가, capacity 증가
  - `patch`: label/meta 변경
- **migration helper**: 두 IR 비교 → id rename map 후보 + address conflict 보고

### API 확장

```typescript
// Registry
class TaxonomyRegistry {
  add(ir: TaxonomyIR): void                          // 기존: 같은 slug 덮어씀
  addVersion(ir: TaxonomyIR): void                   // 신규: 같은 slug 다른 version 동시 보관
  get(slug: string): TaxonomyIR | undefined          // latest 반환
  getVersion(slug: string, version: number): TaxonomyIR | undefined
  versions(slug: string): number[]                   // 보관 중인 version 목록
  list(): string[]
}

// Diff
diff(a: TaxonomyIR, b: TaxonomyIR): {
  same: boolean
  changes: DiffEntry[]
  breakingLevel: "major" | "minor" | "patch" | "none"
}

// Migration
migrationPlan(from: TaxonomyIR, to: TaxonomyIR): {
  idRenames: Array<{ axis: string; from: string; to: string }>  // 자동 추정
  addressConflicts: Array<{ axis: string; address: number; ids: string[] }>
  manualReview: string[]    // 자동 처리 못 함
}
```

### CLI 확장

- `tax diff --semver` — breakingLevel 출력
- `tax migration <a.yaml> <b.yaml>` — migration plan 출력
- `tax registry list` — multi-version 보관 상황 표시

### Web UI 확장

- 다중 version 동시 보기 (탭 또는 사이드바)
- DiffViewer에 breakingLevel 배지
- Migration plan 페이지

### 작업 분량

10-12 task. taxonomy-engine v0.9 라운드.

### Migration 정책 (사용자 영향)

- Registry `add()`는 기존 호환 유지 (slug 덮어씀)
- `addVersion()`이 신규 API
- v0.8까지의 yaml은 그대로 작동 — version 명시 안 하면 1 default
- 멀티 version 활용은 opt-in

---

## Stage 3 — 결정 Chain (구현 연기, roadmap에만)

### 핵심 결정

- **decision-flow와 양방향 sync** — 구현 연기 (decision-flow 자체 안정도 필요)
- 진행 조건:
  - decision-flow API 안정 (현재 evidence kind 5종 정의됨)
  - 외부 시스템에서 yaml ref를 subject로 받을 수 있음
- 구현 시:
  - yaml entry의 decisionLink가 decision-flow decision id
  - decision-flow에서 "이 결정 완료" 시 yaml lifecycle 자동 갱신 (`tbd → approved`)
  - 결정 evidence (kind/source/content/weight) 가 lifecycle change 의 trigger

### 예상 API

```typescript
// decision-flow 통합 (Stage 3 시점)
import { observeDecision } from "decision-flow";
import { syncLifecycleFromDecision } from "taxonomy-engine/decision-bridge";

observeDecision(decisionId, (decision) => {
  if (decision.status === "completed") {
    syncLifecycleFromDecision(decision, taxonomyRegistry);
  }
});
```

### 결정 Chain UI (Web)

- chain 시각화: 결정 → 영향 entries → 변경 (diff) → 검증 통과
- 미정 entry 선택 시 "어떤 결정이 필요한지" 표시
- 결정 evidence 표시 (data/rule/precedent/intuition/external)

### 작업 분량

큰 spec 필요 — decision-flow 안정도에 따라 결정. 별도 brainstorming 세션.

---

## 도그푸딩 케이스 매핑 (lesson-builder)

사용자 정리 텍스트의 항목별 시스템 표현:

| 사용자 정리 | yaml 표현 | Stage |
|------------|----------|------|
| 확정 1. 에셋 파라미터 인터페이스 | `{ id: asset, lifecycle: approved, decisionLink: ... }` | Stage 1 |
| 확정 2. 에셋 매니저 | axes에 `asset-manager` 추가, `lifecycle: approved` | Stage 1 |
| 확정 3.x clip 식별자/런타임 변경 | clip-mode axis 추가 + relations | Stage 1 |
| 미정 1. cue (interaction) | `{ id: cue, lifecycle: tbd, placeholderReason: "interaction 정의 미정" }` | Stage 1 |
| 미정 2. branch (transition) | `{ id: branch, lifecycle: tbd, placeholderReason: "분기 처리 vs cue 경계" }` | Stage 1 |
| 미정 3. beat 분리 결정 | `{ id: beat, lifecycle: tbd, decisionLink: "...beat-consumption-layer.md" }` | Stage 1 |
| v1과 v2 동시 검토 | `addVersion()` + ref `@v1` / `@v2` | Stage 2 |
| 어떤 변경이 breaking? | DiffEntry breakingLevel | Stage 2 |
| 미정 → 확정 워크플로 | decision-flow trigger | Stage 3 |

Stage 1만으로 사용자 케이스의 80%가 표현됨. Stage 2는 진짜 multi-version 작업 시점. Stage 3은 결정 워크플로 자동화.

---

## 의존도 + 권장 순서

```
Stage 1 (lifecycle + placeholder + decisionLink)
  ↓ (도그푸딩 5 yaml + lesson-builder 마이그레이션)
Stage 2 (multi-version + breaking + migration)
  ↓ (Web UI Registry tab + diff semver)
Stage 3 (decision-flow 통합)
  ↓ (전체 결정 chain 시각화)
```

Stage 1만으로 사용자 케이스 충분. Stage 2는 도그푸딩 yaml 중 어느 것이 v2 작업 시작될 때. Stage 3는 decision-flow 안정 시.

---

## 미결 (Stage별 spec 작성 시 결정)

### Stage 1
- [ ] lifecycle 누락 시 default — `approved` (안전) vs `draft` (보수적)
- [ ] `lifecycle-transition-invalid` 규칙 — 허용 전이 매트릭스
- [ ] decisionLink 형식 validation — URI? path? slug? 모두 허용?
- [ ] doctor의 external SSOT lifecycle 비교 — vocabulary.ts 외 어디서?

### Stage 2
- [ ] Registry breaking change deprecation 정책 — 1 minor 후 deprecated, 1 major 후 제거?
- [ ] migration helper의 id rename 추론 알고리즘 — 유사도 기반? 사용자 입력 요구?
- [ ] address conflict 자동 해결 vs 보고만
- [ ] `@latest` ref가 기본인가 명시 필수인가

### Stage 3
- [ ] decision-flow API contract (현재 시점)
- [ ] sync 방향 — yaml → decision (편집 시 trigger) vs decision → yaml (완료 시 trigger)
- [ ] 결정 chain UI 데이터 모델

---

## 참고

- 시스템 부족 진단: 위 §케이스 분석 + v0.7 기능 리뷰
- 사용자 메모리: `feedback_decision-context-over-tracking`
- vocabulary.ts (DEF_LIFECYCLE): `packages/definition-catalog/src/vocabulary.ts`
- decision-flow 컨벤션: CLAUDE.md §Decision Flow
- 도그푸딩 5 yaml: `docs/taxonomies/*.yaml`
- v0.7 구조 리뷰: `plans/v0.7.md`
- 사용자 lesson-builder 정리 (2026-05-21 대화)
