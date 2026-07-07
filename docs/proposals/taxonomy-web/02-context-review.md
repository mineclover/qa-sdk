---
status: implemented
date: 2026-05-21
part_of: taxonomy-web
role: spec
supersedes: -
superseded_by: -
sources:
  - docs/proposals/taxonomy-web/plans/v0.2.md
  - packages/taxonomy-web/package.json
  - packages/taxonomy-web/vite.config.ts
  - packages/taxonomy-web/src/routes/TaxonomyViewPage.tsx
  - packages/taxonomy-web/src/components/UnitDetailPanel.tsx
  - packages/taxonomy-web/src/components/RelatedRulesPanel.tsx
  - packages/taxonomy-web/src/components/RelatedConstraintsPanel.tsx
  - packages/taxonomy-web/src/components/GitLogPanel.tsx
  - packages/taxonomy-web/src/components/RelatedDocsPanel.tsx
  - packages/taxonomy-web/src/components/DiffContextPanel.tsx
  - packages/taxonomy-web/src/components/FeedbackHistoryPanel.tsx
  - packages/taxonomy-web/src/components/SiblingEntriesView.tsx
  - packages/taxonomy-web/src/components/CoordinateFlowView.tsx
  - packages/taxonomy-web/src/data/gitLogApi.ts
  - packages/taxonomy-web/src/data/relatedDocsApi.ts
  - packages/taxonomy-web/src/data/gitDiffApi.ts
  - packages/taxonomy-web/plugins/git-log-api.ts
  - packages/taxonomy-web/plugins/git-log-api.test.ts
  - packages/taxonomy-web/plugins/related-docs-api.ts
  - packages/taxonomy-web/plugins/related-docs-api.test.ts
  - packages/taxonomy-web/plugins/git-diff-api.ts
  - packages/taxonomy-web/plugins/git-diff-api.test.ts
  - scripts/package-surfaces.mjs
  - scripts/verify-analysis-os.ts
---

# Taxonomy Web v0.2 — 컨텍스트 제공 중심 재정의

## 비전 재확인 ^purpose

사용자 메모리 `feedback_decision-context-over-tracking`:

> 핵심 가치는 기록이 아니라 **일관된 컨텍스트 제공으로 결정을 쉽게 만드는 것**

v0.1은 결과물(피드백) 받는 UI만. v0.2는 **결정 보조 UI** 추가 — 피드백 당사자가 결정을 내릴 만큼 충분한 컨텍스트를 한 화면에 제공.

## 현재 구현 근거

v0.2는 `packages/taxonomy-web/src/routes/TaxonomyViewPage.tsx`의 3-pane 화면에서 구현되어 있다.
가운데 Context Panel은 `UnitDetailPanel`, `SiblingEntriesView`, `CoordinateFlowView`,
`RelatedRulesPanel`, `RelatedConstraintsPanel`, `DiffContextPanel`, `GitLogPanel`,
`RelatedDocsPanel`, `FeedbackHistoryPanel`을 collapsible 섹션으로 조립한다.

git/문서/diff 컨텍스트는 `packages/taxonomy-web/vite.config.ts`에 등록된 dev plugin
3종(`gitLogApiPlugin`, `relatedDocsApiPlugin`, `gitDiffApiPlugin`)과 대응 client
wrapper(`src/data/gitLogApi.ts`, `src/data/relatedDocsApi.ts`, `src/data/gitDiffApi.ts`)가 제공한다.
각 endpoint helper는 `packages/taxonomy-web/plugins/*-api.test.ts`에서 빈 결과와 정상 결과의
기본 형태를 검증한다.

패키지 경계는 별도 유지된다. `scripts/package-surfaces.mjs`는 `taxonomy-engine`을
finite vocabulary tooling, `taxonomy-decision-bridge`를 decision bridge,
`@qa-sdk/taxonomy-web`을 consumer-only preview surface로 분리하고,
`scripts/verify-analysis-os.ts`가 이 분리를 `arch:feedback` 경로에서 검증한다.

## 보완할 사용 사례

v0.1의 사용 사례 (조회/작성/상태 변경) 외에 추가:

1. **단위 자체 이해** — 선택된 ref의 풀 정보 (description, meta, 관련 relations, 관련 constraints)
2. **역사적 맥락 조회** — git log, 관련 plan/concept 문서, 이전 피드백 (resolved/rejected 포함), 변경 이력
3. **관계 시각화** — 형제 entries, 연결된 좌표
4. **인라인 컨텍스트** — 피드백 폼 옆에 단위 요약

## 추가 컴포넌트 (v0.2)

| 컴포넌트 | 책임 | 활용 자원 |
|---------|------|----------|
| `UnitDetailPanel` | ref kind별 풀 정보 표시 | `parseRef()` + `StaticTaxonomy` read model |
| `RelatedRulesPanel` | 이 entry가 등장하는 relation rules 목록 | `StaticTaxonomy.relations` walk |
| `RelatedConstraintsPanel` | 이 axis/entry에 관련된 constraints | `StaticTaxonomy.constraints` filter |
| `GitLogPanel` | yaml 파일의 commit 목록 (선택 ref touch 우선) | 신규 `/api/git-log` plugin endpoint |
| `RelatedDocsPanel` | plan/concept 문서 중 이 axis/entry 언급 | 신규 `/api/related-docs` plugin endpoint |
| `FeedbackHistoryPanel` | 같은 ref의 전체 피드백 (resolved/rejected 포함) | 기존 fetchFeedbacks + filter |
| `DiffContextPanel` | 이 ref 관련 최근 변경 (DiffEntry) | `diff()` API + git base 비교 |
| `SiblingEntriesView` | 같은 axis의 다른 entries | selected axis entries filter |
| `CoordinateFlowView` | 이 entry와 연결된 다른 좌표 | relation rule reachability walk |

## 구현된 Vite plugin endpoint

### `GET /api/git-log?file=<path>&ref=<ref>`

- `file`: yaml 경로 (예: `docs/taxonomies/qa-sdk-coordinate-system.yaml`)
- `ref` (optional): 3-tier ref — 이 ref의 entry id를 포함하는 commit만 우선

응답: `[{ sha, author, date, subject }]`

구현: `packages/taxonomy-web/plugins/git-log-api.ts`의 `fetchGitLog()`가
`git log --max-count=<limit>`과 ref-derived search term을 사용한다.

### `GET /api/related-docs?term=<term>`

- `term`: 검색어 (axis/entry/relation 이름)

응답: `[{ path, lineNumber, snippet }]`

구현: `packages/taxonomy-web/plugins/related-docs-api.ts`의 `searchRelatedDocs()`가
`docs/proposals/taxonomy-engine/` + `docs/proposals/taxonomy-web/` 안에서 검색한다.

### `GET /api/git-diff?file=<path>&base=<ref>`

- `file`: yaml 경로
- `base`: git base ref (default `main`)

응답: `DiffResult` (taxonomy-engine `diff()` 결과)

구현: `packages/taxonomy-web/plugins/git-diff-api.ts`의 `computeFileDiff()`가
`git show <base>:<file>` + working tree를 `taxonomy-engine`의 parse/diff/migration plan으로 비교한다.

## 레이아웃 변경

v0.1의 2-pane (트리 / RefBar+FeedbackPanel) → v0.2 3-pane:

```
┌─ Sidebar ─┬─ Tree ─┬─ Context Panel ──────────────────┐
│           │        │ ┌─ Unit Detail (선택 ref 정보)   │
│ taxonomy  │ axes/  │ ├─ Related Rules/Constraints   │
│   list    │ entries│ ├─ Sibling Entries             │
│           │ ...    │ ├─ Git Log (50)                │
│           │        │ ├─ Related Docs                │
│           │        │ ├─ Diff Context                │
│           │        │ ├─ Feedback History (open/all) │
│           │        │ └─ ➡ Feedback Form (인라인)    │
└───────────┴────────┴────────────────────────────────┘
```

Context Panel은 collapsible 섹션들로 — 정보 과부하 방지.

## 동시 갱신

- 모든 dev plugin endpoint는 dev 모드 only (v0.1 정책 그대로)
- vite build 시점에 git log/related-docs는 빌드 시점 snapshot으로 미리 생성? — 부담. v0.2는 dev 모드만 풀 컨텍스트, 빌드는 read-only (정적 정보만).

## fail 정책

- git plugin 실패 (repo 외 등) → UI에 "git 정보 없음" + skip
- related-docs 실패 → skip
- 모든 plugin 실패 fail-open

## 테스트

- dev plugin endpoint 각각 unit test:
  - `corepack pnpm --filter @qa-sdk/taxonomy-web exec vitest run plugins/git-log-api.test.ts plugins/related-docs-api.test.ts plugins/git-diff-api.test.ts`
- 패키지 전체 회귀:
  - `corepack pnpm --filter @qa-sdk/taxonomy-web test`
  - `corepack pnpm --filter @qa-sdk/taxonomy-web typecheck`
- 패키지 경계 회귀:
  - `corepack pnpm arch:feedback`

## CI 통합

`@qa-sdk/taxonomy-web` package script의 `test`, `typecheck`, `build`를 사용한다.
dev plugin은 Vite dev server 경계에 등록되고, taxonomy/profile 기능 분리는 `arch:feedback`의
Analysis OS 검증에서 함께 확인한다.

## 미결 (v0.3+)

- 검색 (전체 텍스트, 빠른 navigation)
- diff 시각화 향상 (라인 highlighting)
- 다른 yaml 사이 의존 추적 (cross-tax projects-to)
- 멘션 (@username) — multi-user 시
- 외부 host (인증)

## 참고

- v0.1 spec: [`01-review-mvp.md`](./01-review-mvp.md)
- 큰 비전: [`00-design.md`](./00-design.md)
- 메모리: `feedback_decision-context-over-tracking`
- 라이브러리: `../taxonomy-engine/concepts/`
