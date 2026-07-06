---
def:
  id: taxonomy-engine-plan-v0-1-follow-up-out-of-scope
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: meta
  aspect: implementation_plan
  tier: component
  depth: implementation
status: historical-plan-with-open-followups
date: 2026-07-06
part_of: taxonomy-engine
role: v0-1-follow-up-boundary
sources:
  - docs/proposals/taxonomy-engine/plans/v0.1.md
  - packages/taxonomy-engine/package.json
  - packages/taxonomy-engine/src/index.ts
  - packages/taxonomy-engine/src/registry/index.ts
  - packages/taxonomy-engine/__tests__/unit/public-api.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-lesson-builder.test.ts
  - packages/taxonomy-engine/__tests__/dogfooding-dkg.test.ts
  - packages/cli/src/commands/taxonomy/index.ts
  - packages/cli/src/command-groups/taxonomy.commands.ts
  - packages/cli/src/commands/taxonomy.test.ts
  - packages/taxonomy-web/package.json
  - scripts/taxonomy-web-build-data.mjs
  - scripts/package-surfaces.mjs
  - docs/specs/system/package-surface-separation.rule.md
  - docs/specs/system/taxonomy-boundaries.spec.md
---

# Taxonomy Engine v0.1 — 후속 (Out of Scope — Open Issues)

## 목적 ^purpose

v0.1에서 제외한 후속 범위 원문을 보존한다.

## 후속 (Out of Scope — Open Issues)

이 plan은 spec §9의 Open Issues 중 핵심 라이브러리 + 도그푸딩까지 다룬다 (T-0~T-9). **T-10 CLI 통합은 후속 별도 PR로 분리** (사유: `taxonomy-engine`이 main에 머지되기 전 worktree에서 CLI가 같은 패키지를 의존하면 pnpm workspace symlink가 main의 stub을 우선시하는 문제). 후속 별도 plan:

- **T-10 재개 — CLI `tax validate` 통합** (`packages/cli`에 taxonomy.ts + command-groups + index.ts wiring). taxonomy-engine이 main에 머지된 후 별도 branch에서 진행. 코드 자체는 본 plan §Task 10 그대로 사용 가능.
- **Web UI** — 시각화/탐색 (라이브러리 + 진단 형식 공유)
- **lesson-builder 적용** — Layer 6단을 텍소노미로 표현, mono-story 런타임 연결
- **DKG 표현 PoC** — 15노드/18엣지를 텍소노미로 표현 가능한지
- **frontmatter 승격** — `docs/proposals/taxonomy-engine/` → `docs/specs/taxonomy-engine/` 이동 + def-catalog frontmatter 부여
- **Taxonomy registry 영속화** — 메모리 → 파일 / 서비스화
- **CLI 추가 명령** — §6.3 승격 기준 만족 시 (`show`, `codegen`, `diff` 등)

## 현재 source-backed 판정 ^evidence

이 문서는 v0.1 시점의 out-of-scope 원문을 보존한다. 현재 구현 상태는 아래처럼 분리해 판정한다.

| 항목 | 현재 판정 | 근거 |
|------|-----------|------|
| T-10 CLI `tax validate` 통합 | 구현됨 | `packages/cli/src/commands/taxonomy/index.ts`, `packages/cli/src/command-groups/taxonomy.commands.ts`, `packages/cli/src/commands/taxonomy.test.ts` |
| CLI 추가 명령 (`show`, `codegen`, `diff`, `doctor`, `git-diff`, `migration`) | 구현됨 | taxonomy command dispatcher와 command descriptor/test surface |
| Web UI | consumer surface로 구현됨 | `@qa-sdk/taxonomy-web`와 `scripts/taxonomy-web-build-data.mjs`; vocabulary ownership은 engine에 남김 |
| lesson-builder 적용 | dogfooding fixture 수준 구현됨 | `dogfooding-lesson-builder.test.ts`가 cross-tax import, validation, codegen, query/walk를 검증 |
| DKG 표현 PoC | dogfooding fixture 수준 구현됨 | `dogfooding-dkg.test.ts`가 16 node-kind, 18 edge-kind, doctor drift, relation walk를 검증 |
| frontmatter 승격 | 부분 구현 | taxonomy proposal 문서 일부가 def frontmatter/sources를 갖지만, 전체 `docs/specs/taxonomy-engine/` 이동은 완료 상태로 보지 않는다 |
| Taxonomy registry 영속화 | 미구현 | `TaxonomyRegistry`는 현재 in-memory `Map` registry다 |

기능 surface 경계는 `package-surface-separation-rule`과 `taxonomy-boundaries`가 소유한다. `taxonomy-engine`은 유한 vocabulary parse/validate/diff/codegen tooling을 소유하고, decision bridge/web preview/profile measurement는 별도 surface로 남긴다.
