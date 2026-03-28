# Ralph Progress Log

This file tracks progress across iterations. Agents update this file
after each iteration and it's included in prompts for context.

## Codebase Patterns (Study These First)

*Add reusable patterns discovered during development here.*

- `motion-content` editor를 새 스키마로 확장할 때는 `MotionEditorState`/`MotionEditorSession`을 제네릭으로 일반화하되 기본 타입은 v1으로 유지하고, `create*`/`apply*` 함수에 v1·v2 오버로드를 추가하는 패턴이 안전하다. 이렇게 하면 기존 v1 호출부 추론은 유지하면서 schema-specific command만 가드 분기할 수 있다.
- `motion-content` IO 버전업은 `io.ts`에서 공통 shape 검증(기본 메타/parameters/assets)과 버전별 envelope + referential integrity pass를 분리하는 패턴으로 구현한다. v1 parser는 유지하고 `*V2` 함수/문서 타입/`schemaVersion` 상수를 병렬 추가해 호환성을 지킨다.
- `motion-content` 스키마 진화는 v1 타입을 유지한 채 `model.ts`에 `*V2`/scene-target 계열 타입을 추가하고, `types.ts`에서 union(`MotionCompositionSchema`)과 V2 전용 selection 타입으로 확장하는 방식으로 진행한다. 기존 editor/runtime 흐름을 깨지 않고 새 스키마를 병행 도입할 때 이 패턴을 우선 고려한다.
- `motion-content`의 스키마 다운캐스트(v2 → v1)는 v2 객체에 legacy 전용 메타데이터(`transitions`, placement별 `layerId`/`label`)를 추가 필드로 실어두고, validator는 추가 키를 무시하게 유지한 채 assembler가 이를 읽어 lossless roundtrip을 복원하는 패턴이 안전하다.
- `motion-content`에서 scene placement를 편집할 때는 `scene.layers`만 수정하면 부족하다. placement 제거 시 같은 scene의 `sequences[].targetIds`와 optional `layers[]` slot 배열도 함께 정리해야 정규화 이후 참조 일관성이 유지된다.
- `motion-workspace`에서 scene별 undo/redo를 추가할 때는 글로벌 workspace session을 base로 두고 `Map<sceneId, MotionEditorSession>`을 별도로 유지한 뒤, scene session을 읽을 때마다 현재 글로벌 composition에 rebase하는 패턴이 안전하다. scene add/remove처럼 구조를 바꾸는 명령은 먼저 scene session을 글로벌 session으로 collapse한 뒤 처리해야 undo 시 scene별 working copy가 유실되지 않는다.
- `motion-workspace` 스키마를 v1에서 v2로 올릴 때는 최신 controller/save 경로는 v2를 사용하되, parser/validator/migrator는 v1·v2를 모두 허용하고 v1의 단일 revision을 `globalRevision`과 각 `sceneRevisions`의 초기 seed로 복제하는 패턴이 호환성과 동시성 기준선을 동시에 지킨다.
- `motion-workspace-service`에서 scene-level persistence를 추가할 때는 workspace row에 v2 snapshot의 메타데이터만 저장하고(`document.scenes=[]`, `sceneRevisions={}`), per-scene table에서 `scene_json + revision + position`을 관리한 뒤 `migrateMotionWorkspaceSnapshot()`으로 재조립하는 패턴이 안전하다. 이렇게 하면 snapshot validator/migrator를 그대로 SSOT로 재사용할 수 있다.
- `motion-workspace` 호환성 계층은 v1/v2 workspace schema와 v1/v2 composition schema를 각각 따로 분기하지 말고, IO boundary에서 `migrateMotionWorkspaceSnapshot()` 하나로 최신 scene-based snapshot으로 즉시 normalize하는 패턴이 안전하다. persistence layer는 `scene_rows`가 비어 있어도 `workspace_json` 안의 embedded scene payload를 fallback으로 유지해야 legacy row load가 깨지지 않는다.
- `motion-workspace-service`의 scene HTTP CRUD는 revision lane을 endpoint별로 분리해야 안전하다. scene 본문 저장(`GET/PUT`)은 `{ scene, revision }`와 `repository.saveScene()`을 기준으로 두고, 구조 변경(`POST/DELETE`)만 runtime workspace controller의 `add-scene`/`remove-scene` 후 workspace `save(expectedGlobalRevision)`로 흘려 `globalRevision`을 증가시키는 패턴이 가장 명확하다.
- Node 기반 Hono 서비스에 WebSocket endpoint를 붙일 때는 `createNodeWebSocket({ app })`를 app 생성 시점에 초기화하고, route factory에는 `upgradeWebSocket`만 주입한 뒤, 반환 app을 `injectWebSocket`/shared hub와 함께 확장하는 패턴이 런타임 wiring과 테스트 introspection을 동시에 단순하게 만든다.
- `motion-workspace-client` 같은 typed HTTP client는 쓰기 입력에서 legacy/v1과 최신/v2 snapshot을 모두 허용하더라도, 읽기 응답은 서비스가 정규화해 돌려주는 최신 타입(`MotionWorkspaceSnapshotV2`)으로 고정하는 편이 안전하다. lane-specific conflict helper는 공통 `revision_conflict` guard 위에 추가 식별자(`sceneId`)만 얹어 확장하면 중복 검증을 줄일 수 있다.
- `motion-workspace-service`의 WS 협업 상태는 transport parsing과 상태 저장을 분리하는 편이 안전하다. `ws-protocol.ts`에서 message shape를 SSOT로 두고, hub는 `workspaceId/sceneId/userId` 기준 lock state + `connectionIds` + heartbeat timestamp만 관리하게 두면 soft-lock warning, late-join snapshot, disconnect/timeout cleanup을 한 흐름으로 검증할 수 있다.
- `motion-workspace-service`의 협업 알림은 HTTP write route에서 persistence 성공 직후 broadcast하고, `ws-hub`는 presence/lock 같은 ephemeral 상태만 관리하게 두는 패턴이 안전하다. 이렇게 분리하면 scene 저장은 `scene:updated`, workspace-level 변경은 `resource:updated`로 분기하면서도 controller를 WS transport에 묶지 않을 수 있다.
- `motion-workspace-client`에 realtime transport를 붙일 때는 HTTP client constructor에서 `fetch`를 eager resolve하지 말고, WS 연결은 별도 `ws-client.ts`로 분리해 `desiredSceneLocks`와 마지막 presence를 로컬 상태로 보관했다가 서버의 `connected` snapshot 직후 replay하는 패턴이 안전하다. 이렇게 하면 fetch 없는 WS-only 환경도 지원되고 reconnect 후 ephemeral state 복구도 transport 내부에 캡슐화된다.
- `motion-content-editor`가 v2 scene composition을 받아야 할 때는 shell/panel/timeline에서 composition shape를 먼저 분기하고, stage player 같은 기존 v1 전용 런타임은 `assembleComposition()`으로 직전에만 브리지하는 패턴이 안전하다. 이렇게 하면 scene-aware UI를 추가하면서도 GSAP preview/runtime을 한 번에 갈아엎지 않아도 된다.
- `motion-content-editor`에서 scene focus mode를 추가할 때는 shell 로컬 상태로 `focusedSceneId`를 유지하고, 타임라인 렌더링만 선택된 scene의 placement를 v1-like synthetic state로 투영한 뒤 drag 결과를 `update-scene-placement-timing`으로 다시 매핑하는 패턴이 안전하다. 이렇게 하면 기존 timeline renderer/drag math를 재사용하면서 global scene overview와 scene-local placement view를 공존시킬 수 있다.
- `motion-content-editor`에 realtime scene presence를 붙일 때는 shell이 `onFocusedSceneChange` callback과 `setScenePresence()` imperative surface를 함께 노출하고, demo/client는 WS presence·lock 이벤트를 `sceneId -> users/locked` view-model로 압축해 패널과 타임라인 scene block에 주입하는 패턴이 transport 결합을 낮춘다.
- `motion-content-editor-demo`의 autosave는 scene workspace에서 `controller.getRevision()`만 보면 scene-local 편집을 놓친다. v2 workspace의 `globalRevision`은 구조 변경만 추적하므로, 저장 트리거는 `controller.isDirty()`를 기준으로 두고 실제 save에서 `sceneRevisions`를 계산하게 맡기는 편이 안전하다.
- `motion-content-editor`에서 v2 scene preview를 붙일 때는 workspace/controller를 건드리지 않고 shell-local `previewMode`만 두고, 선택된 preview target을 `assembleComposition()` 입력으로 축소한 뒤 GSAP player에 전달하는 패턴이 안전하다. transport 시간은 full↔scene 전환 시 scene startMs를 통해 global/local로 매핑해야 scrubber와 playhead가 즉시 맞는다.
- `@qa-sdk/cli`에서 scene create UX를 추가할 때는 먼저 workspace 전체를 읽어 `globalRevision` guard와 v2 composition duration을 확보한 뒤, editor와 같은 `scene-N` / `Scene N` draft 규칙을 재사용해 `startMs=min(lastSceneEnd,maxStart)`로 생성하는 패턴이 안전하다. 이렇게 하면 구조 변경 revision semantics와 기본 생성 위치가 UI/CLI 사이에서 어긋나지 않는다.

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

## [2026-03-27] - US-002
- `packages/motion-content/src/io.ts`에 v2 전용 IO surface를 추가했다. `qa-sdk.motion-composition/v2` envelope, `createMotionCompositionDocumentV2`, `validateMotionCompositionV2`, `validateMotionCompositionDocumentV2`, `parseMotionCompositionV2`, `serializeMotionCompositionV2`, v2 type guard를 구현했고 v1 API는 유지했다.
- v2 참조 무결성을 추가했다. scene placement `targetId`는 composition `targets[].id`를 검증하고, scene 내부 sequence의 `targetIds`/slot `targetId`는 같은 scene의 `layers` 배치를, `captionIds`는 같은 scene의 `captions`를 참조하도록 검증한다. scene placement의 cue preset 참조도 함께 검증한다.
- `packages/motion-content/src/io-v2.test.ts`로 v2 envelope/roundtrip/invalid schema/target 참조/scene sequence-caption 참조 오류 테스트를 추가했고, `pnpm --filter motion-content build`와 `cd packages/motion-content && npx vitest run`이 모두 통과했다.
- Files changed: `packages/motion-content/src/io.ts`, `packages/motion-content/src/io-v2.test.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - v2 IO는 v1 validator를 치환하지 않고 공통 필드 검증 helper 위에 버전별 referential integrity pass를 얹는 구조가 가장 안전하다.
  - Gotchas encountered
  - scene 내부 sequence 무결성은 global `targets[]`만 보면 부족하고, 실제 편집 semantics에 맞게 같은 scene의 `layers`/`captions` 집합을 기준으로 따로 검증해야 한다.
---

## [2026-03-27] - US-003
- `packages/motion-content/src/migrate-v2.ts`에 `migrateCompositionV1toV2`를 추가했다. v1 layer를 target/placement로 분리하고, `main` scene 하나에 sequences/captions를 옮기며, 기존 v1 복원을 위해 `transitions`, placement별 `layerId`/`label` 메타데이터도 함께 실었다.
- `packages/motion-content/src/assemble.ts`에 `assembleComposition`을 추가했다. v2 scene의 placement/sequence/caption을 v1 flat composition으로 평탄화하고, 각 layer/caption/sequence의 `startMs`를 `scene.startMs` 기준 글로벌 절대 좌표로 변환했다. sequence timing이 placement와 어긋나는 경우에는 explicit `offsetMs`로 정규화해 기존 GSAP player가 placement 타이밍대로 재생하도록 맞췄다.
- `packages/motion-content/src/migrate-v2.test.ts`로 단일 `main` scene 마이그레이션, v1 → v2 → serialize/parse → assemble → v1 라운드트립, `createPromoGridComposition` 호환성, 겹치는 scene 절대 좌표 어셈블리 테스트를 추가했고, `packages/motion-content/src/index.ts` export surface도 갱신했다.
- `pnpm --filter motion-content build`와 `cd packages/motion-content && npx vitest run`이 모두 통과했다.
- Files changed: `packages/motion-content/src/migrate-v2.ts`, `packages/motion-content/src/assemble.ts`, `packages/motion-content/src/migrate-v2.test.ts`, `packages/motion-content/src/index.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - v2가 더 적은 구조를 가지더라도 validator가 extra key를 허용하면, migration 전용 compatibility metadata를 실어 lossless roundtrip과 하위 플레이어 호환을 동시에 유지할 수 있다.
  - Gotchas encountered
  - v1 runtime은 sequence slot `offsetMs`가 있으면 layer 절대 시작 시간을 덮어쓰므로, assemble 시 placement 기반 절대 시간을 유지하려면 sequence timing과 placement timing의 정합성을 확인하고 필요하면 explicit offset으로 재정규화해야 한다.
---

## [2026-03-27] - US-004
- `packages/motion-content/src/types.ts`에 scene CRUD 커맨드(`add-scene`, `remove-scene`, `rename-scene`, `update-scene-timing`)와 v2-friendly `set-composition`/selection typing을 추가했다.
- `packages/motion-content/src/state.ts`와 `packages/motion-content/src/history.ts`를 일반화해 v1 editor surface는 유지하면서 v2 scene composition도 편집 세션에 올릴 수 있게 했다. scene 추가/이름 변경/글로벌 타임라인 이동/삭제를 구현했고, 삭제 시 해당 scene의 placements/sequences/captions가 함께 사라지도록 처리했다.
- `packages/motion-content/src/state.test.ts`와 `packages/motion-content/src/history.test.ts`에 scene command 적용, clamp/rename 동작, scene 삭제 cascade, append checkpoint, undo/redo 복원 테스트를 추가했다.
- `pnpm --filter motion-content build`와 `cd packages/motion-content && npx vitest run`이 모두 통과했다.
- Files changed: `packages/motion-content/src/types.ts`, `packages/motion-content/src/state.ts`, `packages/motion-content/src/history.ts`, `packages/motion-content/src/state.test.ts`, `packages/motion-content/src/history.test.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - editor/session 타입을 제네릭 + 오버로드로 일반화하면 v1 편집 경로를 그대로 둔 채 v2 전용 command만 schema guard로 추가할 수 있다.
  - Gotchas encountered
  - TypeScript overload는 구현 시그니처를 호출 해석에 쓰지 않아서, 내부에서 union schema/state를 재호출하는 helper에도 별도의 union overload를 같이 선언해야 DTS 빌드가 통과한다.
---

## [2026-03-27] - US-005
- `packages/motion-content/src/types.ts`와 `packages/motion-content/src/state.ts`에 scene placement command(`add-scene-placement`, `remove-scene-placement`, `update-scene-placement-timing`, `update-scene-placement-cue`)를 추가했다. placement command는 모두 `sceneId + targetId`를 기준으로 동작하고, 같은 target을 다른 scene에 다시 배치할 수 있게 유지했다.
- shared target pool 배치 흐름을 지원했다. `target` selection 상태에서 placement를 추가하면 새 배치를 `scene-layer` selection으로 승격시키고, placement 제거 시 해당 scene 내부 sequence의 `targetIds`/slot references를 함께 정리하도록 구현했다.
- `packages/motion-content/src/state.test.ts`와 `packages/motion-content/src/history.test.ts`에 placement 추가/타이밍 clamp/cue 편집/sequence reference pruning/history undo-redo 테스트를 추가했고, `pnpm --filter motion-content build`와 `cd packages/motion-content && npx vitest run`이 모두 통과했다.
- Files changed: `packages/motion-content/src/types.ts`, `packages/motion-content/src/state.ts`, `packages/motion-content/src/state.test.ts`, `packages/motion-content/src/history.test.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - scene placement는 shared target pool을 참조하므로 삭제 시 target 자체는 남기고, scene 로컬 참조(`layers`, `sequences[].targetIds`, `sequences[].layers`)만 정리하는 패턴이 재사용 가능하다.
  - Gotchas encountered
  - v2 scene sequence는 `layers`가 존재하면 그 배열이 `targetIds`의 실질 SSOT처럼 동작하므로, placement 제거/편집 로직은 두 필드를 따로 다뤄도 최종적으로는 둘 다 함께 갱신해야 normalize 단계에서 예상치 못한 재참조가 생기지 않는다.
---

## [2026-03-27] - US-006
- `packages/motion-workspace/src/controller.ts`에 씬별 editor session routing을 추가했다. v2 composition에서는 `Map<sceneId, MotionEditorSession>`으로 rename/timing/placement 계열 명령의 undo/redo를 씬 단위로 분리하고, scene 전환 시 해당 session의 selection/transport/dirty/checkpoint를 복원하도록 구현했다.
- 글로벌 구조 변경은 별도 lane으로 처리했다. `add-scene`/`remove-scene`/`set-composition`은 scene session들을 먼저 글로벌 session으로 collapse한 뒤 적용하도록 해서 구조 변경 undo 시 기존 scene working copy가 사라지지 않게 했다.
- `packages/motion-workspace/src/types.ts`와 `packages/motion-workspace/src/io.ts`를 v2-aware로 확장했다. workspace snapshot이 `MotionCompositionDocumentV2`와 `scene`/`scene-layer` selection을 받아들일 수 있게 했고, controller/export/loadDocument도 v1·v2 document를 모두 다루게 했다.
- `packages/motion-workspace/src/controller.test.ts`와 `packages/motion-workspace/src/io.test.ts`에 scene별 undo/redo isolation, scene switch session restore, v2 scene-layer selection roundtrip 테스트를 추가했다.
- `pnpm --filter motion-content build`, `pnpm --filter motion-workspace build`, `cd packages/motion-content && npx vitest run`, `cd packages/motion-workspace && npx vitest run`이 모두 통과했다.
- Files changed: `packages/motion-workspace/src/controller.ts`, `packages/motion-workspace/src/types.ts`, `packages/motion-workspace/src/io.ts`, `packages/motion-workspace/src/controller.test.ts`, `packages/motion-workspace/src/io.test.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - workspace controller에서 scene별 history를 분리할 때는 scene session이 전체 composition snapshot을 들고 있어도 된다. 핵심은 읽기 시점에 현재 글로벌 composition으로 rebase해 다른 scene의 최신 working copy를 합성하는 것이다.
  - Gotchas encountered
  - scene add/remove를 글로벌 base에만 직접 적용하면 undo 시 scene session overlay가 빠진 예전 scene으로 복원된다. 구조 변경 직전에 scene session을 글로벌 session으로 collapse해야 remove/undo가 현재 working copy를 기준으로 동작한다.
---

## [2026-03-27] - US-007
- `packages/motion-workspace/src/types.ts`에 `MotionWorkspaceSnapshotV2`와 `qa-sdk.motion-workspace/v2`를 추가했다. 최신 snapshot은 `globalRevision + sceneRevisions`를 가지며, v1 타입은 그대로 유지했다.
- `packages/motion-workspace/src/io.ts`와 `packages/motion-workspace/src/migrate.ts`를 확장해 v1/v2 validator·parser·serializer를 모두 지원하고, v1 snapshot을 v2로 마이그레이션할 때 기존 단일 revision을 `globalRevision`과 각 scene revision의 초기값으로 옮기도록 구현했다.
- `packages/motion-workspace/src/controller.ts` save 로직을 분리했다. scene-aware composition에서는 씬 추가/삭제에만 `globalRevision`이 증가하고, 기존 scene 내용 변경은 해당 `sceneRevisions[sceneId]`만 증가한다. legacy composition은 기존 단일 revision 감각을 유지하도록 global lane만 증가시킨다.
- `packages/motion-workspace/src/io.test.ts`, `packages/motion-workspace/src/migrate.test.ts`, `packages/motion-workspace/src/controller.test.ts`에 v2 snapshot roundtrip, scene revision validation, v1→v2 migration, scene별/global revision 증가 규칙 테스트를 추가했다.
- `pnpm --filter motion-workspace build`와 `cd packages/motion-workspace && npx vitest run`이 모두 통과했다.
- Files changed: `packages/motion-workspace/src/types.ts`, `packages/motion-workspace/src/io.ts`, `packages/motion-workspace/src/migrate.ts`, `packages/motion-workspace/src/controller.ts`, `packages/motion-workspace/src/io.test.ts`, `packages/motion-workspace/src/migrate.test.ts`, `packages/motion-workspace/src/controller.test.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - workspace schema version-up은 최신 write path를 v2로 고정하고, parser/migrator가 v1 input을 받아 v2로 정규화하는 형태가 이후 repository/service story와 가장 자연스럽게 이어진다.
  - Gotchas encountered
  - legacy v1 revision은 역사적으로 scene별로 분리돼 있지 않아서, 마이그레이션 시 특정 scene만 0으로 두면 이후 optimistic concurrency 기준선이 어긋난다. 기존 revision을 모든 revision lane의 seed로 복제해야 안전하다.
---

## [2026-03-27] - US-008
- `packages/motion-workspace-service/src/repository.ts`에 v2 snapshot 기준 repository 계약과 `saveScene(workspaceId, sceneId, sceneData, expectedRevision)` API를 추가했다. scene stale write는 `sceneId`를 포함한 `revision_conflict` shape를 반환하도록 확장했다.
- `packages/motion-workspace-service/src/sqlite-repository.ts`를 workspace meta row + `motion_workspace_scenes` 별도 테이블 구조로 재작성했다. workspace row는 stripped v2 snapshot(`document.scenes=[]`, `sceneRevisions={}`)과 `global_revision`만 저장하고, scene row는 `scene_json`, `position`, `revision`으로 관리한다. `saveScene()`은 `WHERE revision = ?` guard로 개별 scene revision만 증가시키며 다른 scene row와 충돌하지 않는다.
- `packages/motion-workspace-service/src/controller.ts`와 `src/errors.ts`를 v2 workspace/globalRevision 기준으로 정리했고, `test/repository.test.ts`에 scene 독립 저장/scene conflict 증명 테스트를 추가했다. `test/app.test.ts`도 v2 snapshot naming에 맞춰 갱신했다.
- `pnpm --filter @qa-sdk/motion-workspace-service build`와 `cd packages/motion-workspace-service && npx vitest run`이 모두 통과했다.
- Files changed: `packages/motion-workspace-service/src/repository.ts`, `packages/motion-workspace-service/src/sqlite-repository.ts`, `packages/motion-workspace-service/src/controller.ts`, `packages/motion-workspace-service/src/errors.ts`, `packages/motion-workspace-service/test/repository.test.ts`, `packages/motion-workspace-service/test/app.test.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - scene-aware persistence는 full snapshot을 row 하나에 그대로 보관하지 말고, workspace meta snapshot과 per-scene rows로 분리한 뒤 read 시점에 재합성하는 편이 optimistic concurrency lane을 명확하게 유지하기 쉽다.
  - Gotchas encountered
  - `MotionCompositionDefV2` fixture는 `targets`/`scenes`만으로는 부족하고 `assets`도 필수 필드다. repository test fixture를 만들 때 content validator 요구사항을 같이 맞춰야 migration/parser 단계에서 막히지 않는다.
---

## [2026-03-27] - US-009
- `packages/motion-workspace-service/src/controller.ts`와 `packages/motion-workspace-service/src/routes/workspaces.ts`에 scene CRUD endpoint를 추가했다. `GET /workspaces/:id/scenes`, `GET /workspaces/:id/scenes/:sceneId`, `PUT /workspaces/:id/scenes/:sceneId`, `POST /workspaces/:id/scenes`, `DELETE /workspaces/:id/scenes/:sceneId`가 모두 동작하고, `PUT`은 scene revision guard, `POST/DELETE`는 globalRevision lane을 사용한다.
- scene 본문 저장은 `repository.saveScene()`으로 연결하고, scene 추가/삭제는 runtime workspace controller의 `add-scene`/`remove-scene` 후 workspace `save()`를 호출해 구조 변경 시에만 `globalRevision`이 증가하도록 맞췄다.
- `packages/motion-workspace-service/test/app.test.ts`에 scene list/read/update/create/delete와 stale scene save `409 revision_conflict` 응답 테스트를 추가했다.
- `pnpm --filter @qa-sdk/motion-workspace-service build`와 `cd packages/motion-workspace-service && npx vitest run`이 모두 통과했다.
- Files changed: `packages/motion-workspace-service/src/controller.ts`, `packages/motion-workspace-service/src/routes/workspaces.ts`, `packages/motion-workspace-service/test/app.test.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - scene endpoint는 content lane과 structure lane을 섞지 말고, scene 본문 저장은 `saveScene()`에만 보내고 scene 추가/삭제는 controller `add-scene`/`remove-scene` 후 workspace `save()`로 보내야 revision semantics가 일관된다.
  - Gotchas encountered
  - scene payload만 받아서는 optimistic concurrency가 성립하지 않는다. HTTP 계층에서 현재 revision lane을 함께 받도록 명시해야 하고, 특히 추가/삭제는 scene revision이 아니라 `globalRevision` guard를 써야 충돌 검출이 맞게 동작한다.
---

## [2026-03-27] - US-010
- `packages/motion-workspace-client/src/client.ts`에 `listScenes`, `getScene`, `updateScene`, `createScene`, `deleteScene` 메서드를 추가했다. scene-specific `revision_conflict` payload에서 `sceneId`를 감지하는 `isMotionWorkspaceSceneConflictErrorShape`/`isMotionWorkspaceSceneConflictError` helper도 함께 추가했다.
- `packages/motion-workspace-client/src/types.ts`를 scene-aware 응답/요청 타입으로 확장했고, workspace CRUD는 create/update 입력에 `MotionWorkspaceSnapshot` union을 허용하면서 get/create/update 응답은 최신 `MotionWorkspaceSnapshotV2`로 정규화되도록 맞췄다.
- `packages/motion-workspace-client/src/client.test.ts`에 scene CRUD request/response shape 검증과 scene conflict helper 테스트를 추가했다.
- `pnpm --filter motion-workspace-client typecheck`, `pnpm --filter motion-workspace-client build`, `cd packages/motion-workspace-client && npx vitest run`이 모두 통과했다.
- Files changed: `packages/motion-workspace-client/src/client.ts`, `packages/motion-workspace-client/src/types.ts`, `packages/motion-workspace-client/src/client.test.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - typed client는 쓰기 입력 타입과 읽기 응답 타입을 동일하게 묶지 말고, 서버가 정규화해 돌려주는 최신 snapshot 타입을 응답 SSOT로 삼는 편이 이후 schema migration과 호환성 유지에 유리하다.
  - Gotchas encountered
  - 기존 client 테스트가 이미 v2 snapshot fixture를 쓰고 있었는데 client surface는 아직 v1 기준으로 남아 있었다. scene API 추가 시 새 메서드만 붙이면 끝나지 않고 기존 workspace CRUD typing도 함께 최신 서비스 계약에 맞춰 정리해야 build가 안정적으로 통과한다.
---

## [2026-03-27] - US-011
- `packages/motion-workspace-service/src/ws-hub.ts`에 workspace별 연결 registry를 추가했다. 각 연결은 `connectionId + userId + workspaceId`로 추적되고, workspace membership은 별도 `Map<string, Set<string>>`로 관리되어 같은 workspace의 모든 연결에 broadcast할 수 있다.
- `packages/motion-workspace-service/src/routes/workspaces.ts`에 `GET /workspaces/:id/ws` endpoint를 추가했다. `userId` query를 요구하고, connect 시 `connected` 이벤트를 보내며, 클라이언트가 보낸 JSON payload는 같은 workspace에 `workspace-message` envelope로 fan-out된다. close/error 시 hub에서 자동 정리된다.
- `packages/motion-workspace-service/src/app.ts`, `src/main.ts`, `src/index.ts`, `package.json`을 갱신해 `@hono/node-ws` 기반 app wiring과 `injectWebSocket()` runtime hook을 연결했다.
- `packages/motion-workspace-service/test/ws-hub.test.ts`와 `test/app.test.ts`에 hub broadcast/cleanup, route registration, websocket event fan-out 검증을 추가했고, `pnpm --filter @qa-sdk/motion-workspace-service build`와 `cd packages/motion-workspace-service && npx vitest run`이 모두 통과했다.
- Files changed: `packages/motion-workspace-service/package.json`, `packages/motion-workspace-service/src/app.ts`, `packages/motion-workspace-service/src/index.ts`, `packages/motion-workspace-service/src/main.ts`, `packages/motion-workspace-service/src/routes/workspaces.ts`, `packages/motion-workspace-service/src/ws-hub.ts`, `packages/motion-workspace-service/test/app.test.ts`, `packages/motion-workspace-service/test/ws-hub.test.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - WebSocket hub는 socket 객체 자체를 workspace별 `Set`에 직접 들고 있기보다, 전역 connection map + workspace membership set으로 분리해 두면 userId/workspaceId 메타데이터 조회와 stale cleanup을 같이 처리하기 쉽다.
  - Gotchas encountered
  - 이 sandbox에서는 test 중 실제 TCP listen이 막혀 있어서, WS endpoint 검증은 live socket 대신 Hono route table 확인 + `createWorkspaceWsEvents()` 직접 호출 방식으로 구성해야 안정적으로 재현된다.
---

## [2026-03-27] - US-012
- `packages/motion-workspace-service/src/ws-protocol.ts`에 협업 WS 메시지 SSOT를 추가했다. `scene:lock { sceneId, userId }`, `scene:unlock { sceneId, userId }`, `connected.sceneLocks`, `workspace-message`, `error` shape를 타입/파서로 정의했다.
- `packages/motion-workspace-service/src/ws-hub.ts`에 scene soft-lock 상태를 추가했다. lock은 `workspaceId + sceneId + userId` 단위로 유지되고, repeated `scene:lock`은 heartbeat로 간주된다. 같은 scene에 다른 user lock이 있으면 broadcast되는 `scene:lock` 메시지에 `warning: true`와 `holders[]`가 포함되어 hard block 없이 경고만 띄울 수 있다. disconnect 시 즉시 `scene:unlock`, silent drop은 heartbeat timeout prune으로 자동 해제된다.
- `packages/motion-workspace-service/src/routes/workspaces.ts`는 scene lock/unlock 메시지를 파싱해 hub API에 연결하고, 새 연결에는 현재 `sceneLocks` snapshot을 포함한 `connected` 이벤트를 보낸다. generic 협업 payload fan-out은 기존 `workspace-message`로 유지했다.
- `packages/motion-workspace-service/test/ws-hub.test.ts`와 `packages/motion-workspace-service/test/app.test.ts`에 soft-lock warning, late-join snapshot, disconnect unlock, heartbeat timeout unlock 테스트를 추가했다.
- `pnpm --filter @qa-sdk/motion-workspace-service build`와 `cd packages/motion-workspace-service && npx vitest run`이 모두 통과했다.
- Files changed: `packages/motion-workspace-service/src/ws-protocol.ts`, `packages/motion-workspace-service/src/ws-hub.ts`, `packages/motion-workspace-service/src/routes/workspaces.ts`, `packages/motion-workspace-service/src/index.ts`, `packages/motion-workspace-service/test/ws-hub.test.ts`, `packages/motion-workspace-service/test/app.test.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - WS collaboration state는 route에서 raw JSON을 바로 다루기보다 protocol parser와 hub state machine으로 분리할수록 message validation, reconnect snapshot, timeout cleanup 테스트가 단순해진다.
  - Gotchas encountered
  - soft lock는 단일 owner mutex보다 scene별 user presence에 가깝다. lock을 connection이 아니라 `userId` 기준으로 집계하고 내부에 `connectionIds`를 매달아야 같은 사용자의 다중 탭과 disconnect cleanup을 동시에 자연스럽게 처리할 수 있다.
---

## [2026-03-27] - US-013
- `packages/motion-workspace-service/src/ws-protocol.ts`에 `presence { userId, activeSceneId?, cursor? }`, `scene:updated { sceneId, revision }`, `resource:updated { revision }` 메시지를 추가하고, `connected.presences` snapshot 및 presence parser를 정의했다.
- `packages/motion-workspace-service/src/ws-hub.ts`와 `src/routes/workspaces.ts`에 presence 상태 저장/cleanup과 저장 후 broadcast 흐름을 연결했다. scene PUT은 `scene:updated`, workspace-level 변경(전체 workspace update, scene create/delete, set-composition apply-command)은 `resource:updated`를 broadcast한다.
- `packages/motion-workspace-service/test/app.test.ts`와 `test/ws-hub.test.ts`에 presence snapshot/cleanup, notification broadcast, notification 수신 후 `MotionWorkspaceClient.getScene()`/`get()`으로 최신 데이터를 pull하는 통합 테스트를 추가했다.
- `pnpm --filter @qa-sdk/motion-workspace-service build`와 `cd packages/motion-workspace-service && npx vitest run`이 모두 통과했다.
- Files changed: `packages/motion-workspace-service/src/ws-protocol.ts`, `packages/motion-workspace-service/src/ws-hub.ts`, `packages/motion-workspace-service/src/routes/workspaces.ts`, `packages/motion-workspace-service/test/ws-hub.test.ts`, `packages/motion-workspace-service/test/app.test.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - collaboration notification은 controller 내부보다 HTTP route 경계에서 write 성공 직후 emit하는 편이, revision/result payload를 그대로 재사용하면서 transport 의존성을 분리하기 쉽다.
  - Gotchas encountered
  - scene workspace에서 shared resource를 전체 snapshot으로 갱신할 때는 현재 저장된 `globalRevision` 기준으로 다음 revision을 싣고 POST `/workspaces/:id`를 호출해야 한다. scene PUT은 lane이 다르므로 `sceneRevisions`만 증가하고 `globalRevision`은 그대로 남는다.
---

## [2026-03-27] - US-014
- `packages/motion-workspace-client/src/ws-client.ts`를 추가해 typed WS transport를 구현했다. `MotionWorkspaceClient.connectWorkspace(workspaceId, handlers)`가 `MotionWorkspaceWsConnection`을 반환하고, 이 연결은 `lockScene`, `unlockScene`, `sendPresence`, `disconnect`를 제공한다. 서버 `connected`/`scene:lock`/`scene:unlock`/`presence`/`scene:updated`/`resource:updated`/`workspace-message`/`error` 메시지에 대응하는 typed handler interface도 함께 정의했다.
- auto-reconnect + exponential backoff를 추가했다. 연결이 비정상 종료되면 backoff로 재접속하고, 클라이언트가 보유한 scene lock/presence desired state를 다음 `connected` snapshot 직후 자동 replay한다. HTTP fetch는 lazy resolve로 바꿔 fetch가 없는 WS-only 환경에서도 client 생성과 `connectWorkspace()`가 가능하게 했다.
- `packages/motion-workspace-client/src/ws-client.test.ts`에 fake WebSocket 기반 테스트를 추가해 URL 생성, typed handler dispatch, scene lock/unlock/presence 송신, reconnect backoff, reconnect 후 state replay를 검증했다. 기존 `client.test.ts`는 lazy fetch 동작에 맞게 no-fetch 오류 시점을 request 시점으로 조정했다.
- `pnpm --filter motion-workspace-client typecheck`, `pnpm --filter motion-workspace-client build`, `cd packages/motion-workspace-client && npx vitest run`이 모두 통과했다.
- Files changed: `packages/motion-workspace-client/src/ws-client.ts`, `packages/motion-workspace-client/src/ws-client.test.ts`, `packages/motion-workspace-client/src/client.ts`, `packages/motion-workspace-client/src/client.test.ts`, `packages/motion-workspace-client/src/index.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - WS client는 HTTP layer와 분리된 connection object로 두고, transport-local desired state(`sceneLocks`, latest presence)를 보관했다가 `connected` 이후 replay하는 구조가 reconnect 복구와 테스트 작성 모두에 유리하다.
  - Gotchas encountered
  - `MotionWorkspaceClient`가 constructor에서 `fetch`를 eager resolve하면 WS만 쓰는 CLI/browser path도 초기화 단계에서 막힌다. fetch는 실제 HTTP request 직전에 resolve해야 WS-only 사용과 기존 HTTP 에러 semantics를 같이 만족시킬 수 있다.
---

## [2026-03-27] - US-015
- `packages/motion-content-editor/src/timeline.ts`에 v2 scene composition 지원을 추가했다. global timeline 상단에 scene block을 겹침 기준으로 subtrack에 pack해서 렌더링하고, scene bar drag가 `update-scene-timing`으로 연결되도록 구현했다. scene block 클릭/드래그 시작 시 selection이 `{ kind: "scene", id }`로 진입한다.
- editor shell을 최소 v2-aware로 정리했다. `shell.ts`, `panels.ts`, `workspace.ts`에서 scene composition을 분기하고, JSON import/export는 v1/v2 schema를 모두 처리하도록 바꿨다. stage preview/player는 v2 composition일 때 `assembleComposition()`으로 v1 runtime input으로 브리지해 기존 GSAP preview 경로를 유지했다.
- `styles.ts`에 scene lane 전용 시각 스타일을 추가해 overlap lane별 색상과 stacked scene 강조를 넣었고, `timeline.test.ts`에 scene render/selection/drag command 회귀 테스트를 추가했다.
- `pnpm --filter motion-content-editor build`, `cd packages/motion-content-editor && npx vitest run`, `pnpm --filter @qa-sdk/motion-content-editor-demo build`가 모두 통과했다. `motion-content-editor-demo preview` 브라우저 QA는 sandbox에서 `listen EPERM`으로 서버 bind가 막혀 실제 실행은 못 했다.
- Files changed: `packages/motion-content-editor/src/timeline.ts`, `packages/motion-content-editor/src/styles.ts`, `packages/motion-content-editor/src/shell.ts`, `packages/motion-content-editor/src/panels.ts`, `packages/motion-content-editor/src/workspace.ts`, `packages/motion-content-editor/src/timeline.test.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - scene-aware editor surface는 전체 UI를 한 번에 v2로 갈아타기보다 shell/timeline/panel에서 composition shape를 먼저 분기하고, runtime preview만 assemble bridge로 연결하는 방식이 회귀 위험이 낮다.
  - Gotchas encountered
  - v2 import schema를 감지하려고 `JSON.parse`를 직접 호출하면 기존 parser가 제공하던 사용자-facing 에러 메시지가 바뀐다. schema sniffing은 regex/light inspection으로 하고 실제 parse/validation은 기존 parser 함수에 맡겨야 diagnostics 회귀가 없다.
  - sandbox 환경에서는 `vite preview` 서버 bind가 `listen EPERM`으로 차단될 수 있어, demo build까지는 자동화 가능하지만 실제 브라우저 QA는 별도 로컬 환경에서 마저 확인해야 한다.
---

## [2026-03-28] - US-016
- 기존 dock에 `Scenes` 탭을 추가하고, v2 composition에서 scene 목록 CRUD(추가/삭제/이름변경), shared target pool 배치, scene-local placement list를 렌더링하도록 `packages/motion-content-editor/src/shell.ts`와 `packages/motion-content-editor/src/panels.ts`를 확장했다.
- scene selection과 분리된 shell-local `focusedSceneId`를 도입해, scene 선택 시 하단 timeline이 global scene overview에서 scene-local placement focus view로 전환되도록 구현했다. focus timeline drag는 synthetic v1 layer state를 통해 기존 timeline renderer를 재사용하고, 결과는 `update-scene-placement-timing`으로 다시 투영한다.
- `packages/motion-content-editor/src/shell.test.ts`에 scene panel CRUD/shared target pool 회귀와 scene focus timeline 전환/placement drag 테스트를 추가했다.
- `pnpm --filter motion-content-editor build`, `cd packages/motion-content-editor && npx vitest run`, `pnpm --filter motion-content-editor-demo build`는 모두 통과했다. `npx vite preview --host 127.0.0.1 --port 4173`는 sandbox의 `listen EPERM` 때문에 실행되지 않아 브라우저 QA는 이 환경에서 완료하지 못했다.
- Files changed: `packages/motion-content-editor/src/shell.ts`, `packages/motion-content-editor/src/panels.ts`, `packages/motion-content-editor/src/shell.test.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - scene focus UI는 selection만으로 관리하면 target inspection 같은 보조 선택에서 focus가 쉽게 풀린다. shell-local focus 상태를 따로 두고 selection은 inspector용으로만 쓰는 편이 안정적이다.
  - Gotchas encountered
  - existing timeline drag를 그대로 쓰려면 scene placement를 가짜 v1 layer로 투영한 뒤 drag command를 scene-aware command로 되돌리는 매핑이 필요하다. 이 매핑 없이 fake state를 직접 preview/commit하면 `update-item-timing`이 발생해 v2 편집에 반영되지 않는다.
---

## [2026-03-28] - US-017
- `packages/motion-content-editor/src/scene-presence.ts`, `shell.ts`, `panels.ts`, `timeline.ts`, `styles.ts`를 확장해 scene panel과 global scene block에 편집자 아바타/이름 배지와 lock 표시를 렌더링하도록 구현했다. shell은 `setScenePresence()`와 `onFocusedSceneChange`를 노출해 realtime collaboration state를 외부에서 주입할 수 있게 했다.
- `packages/motion-content-editor-demo/src/main.ts`와 `index.html`에서 demo workspace를 scene(v2) 기준으로 seed하도록 바꾸고, tab별 user id 입력/저장을 추가했다. `MotionWorkspaceClient.connectWorkspace()`로 WS presence·lock을 연결해 scene focus에 따라 `lockScene`/`unlockScene`/`sendPresence`를 동기화하고, 접속 중인 편집 scene 요약도 상단 meta에 실시간 반영했다.
- `packages/motion-content-editor/src/shell.test.ts`에 presence badge/lock render와 focused scene callback 회귀를 추가했다.
- `pnpm --filter motion-content-editor typecheck`, `pnpm --filter motion-content-editor test`, `pnpm --filter motion-content-editor build`, `pnpm --filter @qa-sdk/motion-content-editor-demo exec tsc --noEmit`, `pnpm --filter @qa-sdk/motion-content-editor-demo build`가 모두 통과했다.
- `vite preview --host 127.0.0.1 --port 4173`는 sandbox의 `listen EPERM`으로 실패했고, 대체 headless Playwright 실행도 Mach port 권한 오류로 브라우저 런치가 막혀 이 환경에서는 2탭 브라우저 QA를 끝까지 수행하지 못했다.
- Files changed: `packages/motion-content-editor/src/scene-presence.ts`, `packages/motion-content-editor/src/shell.ts`, `packages/motion-content-editor/src/panels.ts`, `packages/motion-content-editor/src/timeline.ts`, `packages/motion-content-editor/src/styles.ts`, `packages/motion-content-editor/src/index.ts`, `packages/motion-content-editor/src/shell.test.ts`, `packages/motion-content-editor-demo/src/main.ts`, `packages/motion-content-editor-demo/index.html`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - realtime collaboration UI는 shell 내부 state와 WS transport를 직접 엮지 말고, shell은 focus callback + presence setter만 노출하고 demo/app이 collaboration view-model을 만들어 주입하는 편이 회귀 위험이 낮다.
  - Gotchas encountered
  - scene workspace autosave는 `globalRevision` 비교로 저장 여부를 판단하면 scene-local 편집이 누락된다. `controller.isDirty()`로 저장 필요 여부를 보고 `saveWorkspace()`가 `sceneRevisions`를 계산하게 두어야 한다.
---

## [2026-03-28] - US-018
- `packages/motion-content-editor/src/shell.ts`에 shell-local preview mode(`전체`/`씬`)를 추가했다. v2 composition은 현재 preview target에 맞춰 `assembleComposition()`으로 v1 어셈블리를 만든 뒤 기존 GSAP player에 전달하고, full↔scene 전환 시 transport 시간을 global/local로 재매핑해 scrubber와 playhead가 즉시 맞도록 했다.
- toolbar에 `Preview` 토글과 `Export v1` 액션을 추가했다. source `Download`는 그대로 유지하고, 새 export는 현재 preview target의 assembled 결과를 v1 JSON으로 내려받는다. scene preview export는 선택한 scene만 0ms 기준으로 평탄화한 v1 문서를 생성한다.
- `packages/motion-content-editor/src/shell.test.ts`에 overlapping scene 전체 재생, 선택 scene 재생, assembled v1 export 회귀 테스트를 추가했다.
- `pnpm --filter motion-content-editor test -- --run shell.test.ts`, `pnpm --filter motion-content-editor build`, `pnpm --filter @qa-sdk/motion-content-editor-demo build`가 모두 통과했다. `pnpm --filter @qa-sdk/motion-content-editor-demo exec vite preview --host 127.0.0.1 --port 4173 --strictPort`는 sandbox의 `listen EPERM`으로 실패해 이 환경에서는 브라우저 preview 검증을 끝까지 수행하지 못했다.
- Files changed: `packages/motion-content-editor/src/shell.ts`, `packages/motion-content-editor/src/shell.test.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - scene preview는 GSAP player를 수정하지 않고도 shell에서 preview target만 축소 조립해 주입하면 된다. 대신 preview mode가 transport duration/currentTime을 바꾸므로, mode switch 시 snapshot을 즉시 state에 반영해야 scrub/max 값이 늦게 갱신되는 문제가 없다.
  - Gotchas encountered
  - focused scene를 먼저 null로 만든 뒤 preview mode를 full로 바꾸면 scene-local 시간이 global 시간으로 복원되지 않는다. clear-focus/scene-preview 해제 시에는 이전 preview target을 캡처한 상태에서 full로 전환해야 시간축이 안정적으로 이어진다.
---

## [2026-03-28] - US-019
- `packages/cli/src/commands/motion-workspace.ts`를 v2 workspace/globalRevision 기준으로 정리하고, `qa-sdk motion scene list/show/create/delete`를 추가했다. scene create는 기존 editor 패턴과 맞춰 자동으로 `scene-N` / `Scene N` draft를 만들고, scene delete는 current workspace의 `globalRevision` guard로 구조 변경을 수행한다.
- `packages/cli/src/index.ts`에 scene command usage와 subcommand routing을 연결했고, `packages/cli/src/commands/motion.ts`도 v2 workspace snapshot inspect를 이해하도록 갱신했다.
- `packages/cli/src/commands/motion-workspace.test.ts`에 scene CLI CRUD 테스트를 추가하고 기존 workspace/import/apply 테스트를 v2 snapshot semantics로 갱신했다. `packages/cli/src/commands/motion.test.ts`도 v2 inspect expectation에 맞게 수정했다.
- `pnpm --filter @qa-sdk/cli build`와 `cd packages/cli && npx vitest run`이 모두 통과했다.
- Files changed: `packages/cli/src/commands/motion-workspace.ts`, `packages/cli/src/commands/motion-workspace.test.ts`, `packages/cli/src/commands/motion.ts`, `packages/cli/src/commands/motion.test.ts`, `packages/cli/src/commands/motion-shared.ts`, `packages/cli/src/index.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - CLI가 scene 구조 변경을 호출할 때는 `listScenes()`만으로는 부족하고, create draft 위치 계산과 `globalRevision` guard를 위해 full workspace `get()`을 먼저 읽는 편이 안전하다.
  - Gotchas encountered
  - CLI는 이미 `motion-workspace-client`의 v2 응답 타입으로 이동했지만 `motion inspect`와 기존 workspace command 일부가 여전히 v1 `revision`/selection shape를 가정하고 있었다. scene command를 추가하면 관련 helper와 inspect surface도 같이 v2 semantics로 정리해야 테스트가 안정적으로 통과한다.
---

## [2026-03-28] - US-020
- `packages/motion-workspace/src/migrate.ts`를 확장해 legacy workspace snapshot load 시 workspace envelope뿐 아니라 embedded composition도 자동으로 `qa-sdk.motion-composition/v2` 단일 `main` scene 구조로 승격되게 했다. legacy `layer` selection은 `scene-layer(main/targetId)`로 정규화하고, legacy revision은 `globalRevision`과 `sceneRevisions.main` seed로 복제했다.
- `packages/motion-workspace-service/src/sqlite-repository.ts`에 legacy persistence fallback을 추가했다. `scene_rows`가 없는 기존 row는 `workspace_json` 안의 full scene payload를 그대로 사용해 load 시 자동 업그레이드되고, service create/load 및 repository load 테스트를 추가했다.
- `packages/cli/src/commands/motion-workspace.ts`는 scene-based workspace export 시 `assembleComposition()`을 거쳐 항상 v1 composition document를 내보내도록 유지했고, scene workspace export 회귀 테스트를 추가했다. `packages/motion-workspace/src/controller.test.ts`와 `src/migrate.test.ts`에도 workspace-level migration/roundtrip/load 회귀를 보강했다.
- `pnpm --filter motion-workspace build`, `pnpm --filter @qa-sdk/motion-workspace-service build`, `cd packages/motion-workspace && npx vitest run`, `cd packages/motion-workspace-service && npx vitest run`, `pnpm --filter @qa-sdk/cli build`, `cd packages/cli && npx vitest run`이 모두 통과했다.
- Files changed: `packages/motion-workspace/src/migrate.ts`, `packages/motion-workspace/src/migrate.test.ts`, `packages/motion-workspace/src/controller.test.ts`, `packages/motion-workspace-service/src/sqlite-repository.ts`, `packages/motion-workspace-service/test/repository.test.ts`, `packages/motion-workspace-service/test/app.test.ts`, `packages/cli/src/commands/motion-workspace.ts`, `packages/cli/src/commands/motion-workspace.test.ts`, `.ralph-tui/progress.md`
- **Learnings:**
  - Patterns discovered
  - legacy workspace 호환성은 parser/validator가 v1을 허용하더라도 controller/service/repository 경계에서는 즉시 최신 scene snapshot으로 normalize해야 downstream branch가 폭증하지 않는다.
  - Gotchas encountered
  - per-scene persistence로 마이그레이션한 뒤에는 `scene_rows`가 비어 있는 old sqlite row를 새 형식처럼 재조립하면 scene payload가 통째로 사라진다. load fallback은 stripped metadata row와 legacy full snapshot row를 둘 다 구분해야 한다.
---
