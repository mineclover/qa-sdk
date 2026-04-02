# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- `@qa-sdk/core`에 새 공개 도메인 타입을 추가할 때는 `src/<domain>/index.ts` 서브배럴을 만들고, 루트 `src/index.ts`에 수동으로 다시 re-export한다.

---

## [2026-04-02] - US-001
- What was implemented: `packages/core/src/data-object/types.ts`에 `ColumnAxisMapping`, `DataObjectBinding`, `BoundDataObject<S, P>`를 추가하고 `packages/core/src/data-object/index.ts` 및 루트 `packages/core/src/index.ts`에서 export 연결을 완료했다.
- Files changed: `packages/core/src/data-object/types.ts`, `packages/core/src/data-object/index.ts`, `packages/core/src/index.ts`
- **Learnings:**
  - Patterns discovered: `@qa-sdk/core`의 공개 표면은 서브배럴 + 루트 수동 re-export 패턴으로 확장된다.
  - Gotchas encountered: 스토리의 `core/src/...` 경로는 실제 워크스페이스에서는 `packages/core/src/...`에 대응한다.
---
