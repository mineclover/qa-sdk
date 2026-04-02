# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- PipeSpec 확장 패턴: optional 필드를 추가할 때는 `types/pipe-spec.ts` 정의만 바꾸지 말고 `packages/core/src/index.ts`와 `packages/core/src/pipe/index.ts` 공개 export, `validatePipeSpec` 시맨틱 검증, `pipe-serialize` 라운드트립 테스트를 함께 갱신한다.

---

## 2026-04-02 - US-001
- What was implemented
  - `PipePort` 인터페이스와 `PipeSpec.ports?: PipePort[]` optional 필드를 추가했다.
  - `validatePipeSpec`에 같은 방향 내 `portId` 중복 검증을 추가하고, 직렬화/역직렬화 라운드트립 테스트를 보강했다.
  - `PipePort`를 core 공개 export 표면에도 포함했다.
- Files changed
  - `packages/core/src/types/pipe-spec.ts`
  - `packages/core/src/pipe/pipe-validate.ts`
  - `packages/core/src/pipe/pipe-serialize.ts`
  - `packages/core/src/pipe/pipe-validate.test.ts`
  - `packages/core/src/pipe/pipe-serialize.test.ts`
  - `packages/core/src/pipe/index.ts`
  - `packages/core/src/index.ts`
- **Learnings:**
  - Patterns discovered
    - Pipe 관련 스키마 변경은 타입 정의, validator, serializer, 두 개의 export surface, 관련 fixture/테스트를 같이 맞추는 구조다.
  - Gotchas encountered
    - 루트 `pnpm lint`는 이번 변경과 무관한 기존 워크스페이스 lint 오류 때문에 실패했고, 변경 파일 대상 `oxlint`는 0 warning/0 error로 통과했다.
---
