# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

- `@qa-sdk/core`에 새 공개 도메인 타입을 추가할 때는 `src/<domain>/index.ts` 서브배럴을 만들고, 루트 `src/index.ts`에 수동으로 다시 re-export한다.
- `@qa-sdk/core`에 새 공개 클래스/값을 추가할 때도 도메인 서브배럴과 루트 `src/index.ts` 양쪽에 명시적으로 export를 연결해야 외부 패키지에서 안정적으로 소비된다.
- `addressModel: "sum"` 관련 검증은 `PrefixVersionDef.segments`의 최상위 배열만 보면 안 되고, 재귀 `children`까지 순회해 `segmentId`를 수집해야 version-local segment 참조를 놓치지 않는다.

---

## [2026-04-02] - US-001
- What was implemented: `packages/core/src/data-object/types.ts`에 `ColumnAxisMapping`, `DataObjectBinding`, `BoundDataObject<S, P>`를 추가하고 `packages/core/src/data-object/index.ts` 및 루트 `packages/core/src/index.ts`에서 export 연결을 완료했다.
- Files changed: `packages/core/src/data-object/types.ts`, `packages/core/src/data-object/index.ts`, `packages/core/src/index.ts`
- **Learnings:**
  - Patterns discovered: `@qa-sdk/core`의 공개 표면은 서브배럴 + 루트 수동 re-export 패턴으로 확장된다.
  - Gotchas encountered: 스토리의 `core/src/...` 경로는 실제 워크스페이스에서는 `packages/core/src/...`에 대응한다.
---

## [2026-04-02] - US-002
- What was implemented: `packages/core/src/data-object/registry.ts`에 `BindingRegistry`를 추가해 `register`, `getBySchema`, `getByPrefix`, `listAll`, `remove`를 구현했고, `packages/core/src/data-object/registry.test.ts`에 CRUD 및 조회 불변성 테스트 7건을 추가했다. 또한 `packages/core/src/data-object/index.ts`와 루트 `packages/core/src/index.ts`에 공개 export를 연결했다.
- Files changed: `packages/core/src/data-object/registry.ts`, `packages/core/src/data-object/registry.test.ts`, `packages/core/src/data-object/index.ts`, `packages/core/src/index.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: 인메모리 레지스트리는 기본 `Map` 저장소와 보조 인덱스(`prefixId -> schemaId Set`)를 함께 유지해 O(1) 단건 조회와 그룹 조회를 동시에 만족시키는 방식이 잘 맞는다.
  - Gotchas encountered: `pnpm --filter @qa-sdk/core test -- --run <file>`는 이 패키지 스크립트 구성에서는 파일 단위로 제한되지 않고 전체 `vitest run`이 실행될 수 있어, 검증 시간 예측 시 전체 스위트 실행 가능성을 감안해야 한다.
---

## [2026-04-02] - US-003
- What was implemented: `packages/core/src/data-object/validate.ts`에 `validateBindings(bindings, catalog)`를 추가해 identity 컬럼 매핑, prefix/version 존재 여부, dimLabel 존재 여부, sum segment 재귀 검증, 같은 `prefixId:prefixVersion` 중복 바인딩 검사를 구현했다. `BindingValidation` 타입을 `packages/core/src/data-object/types.ts`에 추가했고, `packages/core/src/data-object/validate.test.ts`에 정상/경고/에러 케이스 7건을 고정했다. 공개 표면은 `packages/core/src/data-object/index.ts`와 `packages/core/src/index.ts`에 연결했다.
- Files changed: `packages/core/src/data-object/validate.ts`, `packages/core/src/data-object/validate.test.ts`, `packages/core/src/data-object/types.ts`, `packages/core/src/data-object/index.ts`, `packages/core/src/index.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered: sum prefix의 `segmentId` 검증은 top-level `segments`만이 아니라 재귀 `children`까지 평탄화해서 검사해야 실제 version-local segment 참조와 맞는다.
  - Gotchas encountered: 현재 `validateBindings(bindings, catalog)` 시그니처만으로는 `DataSchema.facetRole === "identity"`를 직접 읽을 수 없어, 카탈로그 기반 CI 검증에서는 `catalog.tables[schemaId].columns.id`를 최소 identity 규약으로 보고 테이블 메타데이터가 없을 때는 warning으로 강등하는 편이 안전하다.
---
