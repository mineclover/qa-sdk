# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

- `motion-content` 스키마 진화는 v1 타입을 유지한 채 `model.ts`에 `*V2`/scene-target 계열 타입을 추가하고, `types.ts`에서 union(`MotionCompositionSchema`)과 V2 전용 selection 타입으로 확장하는 방식으로 진행한다. 기존 editor/runtime 흐름을 깨지 않고 새 스키마를 병행 도입할 때 이 패턴을 우선 고려한다.

---

## [2026-03-27] - US-001
- `packages/motion-content`에서 v2 composition 스키마가 이미 구현되어 있음을 검증했다. `MotionTargetDef`, `MotionSceneDef`, `SceneLayerPlacement`, scene 내부 `sequences`/`captions`, `MotionCompositionDefV2`, `ResolvedMotionCompositionV2`, `MotionEditorSelectionV2`가 정의되어 있고, scene overlap도 `startMs` 제약 없이 허용된다.
- `pnpm --filter motion-content build`와 `cd packages/motion-content && npx vitest run`를 실행해 모두 통과함을 확인했다.
- Files changed: `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - v1/v2 공존이 필요할 때 기존 모델을 교체하지 않고 suffix 타입 + union 타입으로 확장하는 패턴을 사용한다.
  - Gotchas encountered
  - 이번 스토리 범위의 실제 구현은 이미 선행 반영되어 있었고, 완료 판정에는 타입 정의 존재 여부뿐 아니라 빌드와 vitest 전체 통과 확인이 필요했다.
---
