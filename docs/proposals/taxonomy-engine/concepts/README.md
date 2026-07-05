---
def:
  id: taxonomy-engine-concepts-index
  type: knowledge
  knowledge_kind: proposal
  lifecycle: approved
  owner_system: taxonomy-engine
  projection_plane: intent
  scope: meta
  aspect: proposal_design
  tier: layout
  depth: overview
  sources:
    - docs/proposals/taxonomy-engine/concepts/axis.md
    - docs/proposals/taxonomy-engine/concepts/entry.md
    - docs/proposals/taxonomy-engine/concepts/coordinate.md
    - docs/proposals/taxonomy-engine/concepts/relation.md
    - packages/taxonomy-engine/src/schema/ir.ts
    - packages/taxonomy-engine/src/indexer/index.ts
    - packages/taxonomy-engine/src/registry/index.ts
    - packages/taxonomy-engine/src/query/index.ts
    - packages/taxonomy-engine/__tests__/unit/schema.test.ts
    - packages/taxonomy-engine/__tests__/unit/indexer.test.ts
    - packages/taxonomy-decision-bridge/src/to-flow-schema.ts
    - packages/taxonomy-decision-bridge/__tests__/to-flow-schema.test.ts
status: implemented
date: 2026-07-05
part_of: taxonomy-engine
role: concepts-index
supersedes: -
superseded_by: -
---

# Taxonomy Engine — 1급 개념

## 목적 ^purpose

taxonomy-engine의 핵심 개념 문서를 한 화면에서 찾게 하는 layout 문서다. Axis, Entry,
Coordinate, Relation 4개를 1급 개념으로 고정하고, validation/query/codegen/decision
bridge 같은 지원 개념은 별도 문서로 연결한다.

> 텍소노미 좌표 공간을 구성하는 1급(first-class) 추상 4종. 다른 모든 시스템 요소는 이것들의 조합 또는 위의 도구.

## 4개념

| 개념 | 한 줄 |
|------|------|
| [Axis](./axis.md) | 좌표 공간의 한 차원 (방향). |
| [Entry](./entry.md) | Axis 위의 한 점. id(가변)와 address(불변) 이중 이름. |
| [Coordinate](./coordinate.md) | 여러 Axis의 Entry를 묶은 좌표 튜플 — 공간의 한 점. |
| [Relation](./relation.md) | Coordinate/Entry 간 의미적 화살표. 직교성을 깨지 않고 구조 표현. |

## 관계도

```
Taxonomy (공간)
  │
  ├── Axis ──────► Entry (axis의 원소)
  │     │             │
  │     │             │ ▲
  │     ▼             │ │
  │   (직교 곱) ──► Coordinate (점)
  │                     │
  │                     ▼
  └── Relation (점/entry 사이 화살표)
```

## 지원 개념 (supporting)

1급은 아니지만 시스템 동작에 필수:

- [Constraint](./constraint.md) — 좌표/관계 조합의 선언적 무결성 규칙
- [Taxonomy](./taxonomy.md) — Axis + Relation + Constraint의 묶음 (yaml 파일 단위)
- [Registry](./registry.md) — 여러 Taxonomy를 보관하는 메모리 store
- [Diagnostic](./diagnostic.md) — 검증/진단 결과 단위
- [Lifecycle](./lifecycle.md) — entry/axis의 결정 진행 상태 (Stage 1, v0.8+)
- [Semver + Migration](./semver-migration.md) — diff breakingLevel 분류 + id rename 추정 (Stage 2, v0.9+)
- [Decision Sync](./decision-sync.md) — taxonomy yaml lifecycle ↔ decision markdown lifecycle sync (Stage 3, v0.10+)
- [Decision-Flow Bridge](./decision-flow-bridge.md) — decision markdown ↔ FlowSchema projection, analyze/render (Stage 4+, v0.11~v0.13)

## 다른 문서에서 인용 시

본문에서 1급 개념을 처음 언급할 때는 `[[axis]]` 같은 wiki-link 또는 `[Axis](concepts/axis.md)` 명시 링크로 참조. 각 개념 파일이 SSOT, 본문은 사용 맥락만.

## 참조

- spec 본문: `../00-design.md`
- 구현 plan: `../plans/v0.1.md` (v0.1) + `../plans/v0.2.md` (v0.2)
- 좌표계 시스템 철학: `docs/definition-system-philosophy.md`

## 구현/검증 증거 ^implementation-evidence

1급 개념은 `packages/taxonomy-engine/src/schema/ir.ts`의 IR shape와 indexer/query/registry
구현에서 소비된다. decision-flow 연동 개념은 `taxonomy-decision-bridge`의 FlowSchema 변환
테스트가 대표 증거다.

검증 명령:

```bash
pnpm --filter taxonomy-engine test
pnpm --filter taxonomy-decision-bridge test
node packages/cli/dist/index.js def validate
pnpm arch:feedback
```
