# motion-content

`motion-content`는 Motion Content V1의 코어 계약 패키지다. `MotionCompositionDef`를 중심으로 모델, JSON IO, editor state/history, GSAP runtime, stage adapter, preset composition을 제공한다.

## 책임

- V1 편집 포맷 타입 정의
- JSON serialize/parse 계약
- `MotionStageTargetV1` / `MotionStageAdapter` 계약
- command 기반 editor state 전이
- undo/redo session 관리
- GSAP 기반 runtime/transport와 debug snapshot

## Runtime Surface

`createMotionPlayer()`가 안정적인 런타임 표면을 제공한다. transport 제어는 `play()`, `pause()`, `restart()`, `seek(ms)`, `setLoop(loop)`, `setPlaybackRate(rate)`로 수행하고, 현재 transport 상태는 `getTransportState()`로 읽는다. `snapshot()`은 `transport`와 active sequence/layer/caption, resolved asset 결과를 한 번에 돌려준다.

```ts
const player = createMotionPlayer(adapter, resolveMotionComposition(composition, values));

player.setLoop(true);
player.setPlaybackRate(1.25);
player.play();

const transport = player.getTransportState();
const snapshot = player.snapshot();
```

## Session / Checkpoint Surface

`MotionEditorSession`의 checkpoint 전략은 세 가지로 고정한다.

- `ignore`: `select`, `play`, `pause`, `restart`, `set-current-time`, `set-loop`, `set-playback-rate`
- `append`: `set-parameter`, `update-item-timing`, `update-transition-duration`
- `reset`: `set-composition`

`previewMotionEditorSessionCommand()`는 drag preview처럼 세션을 더럽히지 않는 임시 상태 계산에만 쓰고, 실제 checkpoint는 `applyMotionEditorSessionCommand()`가 만든다. `set-composition`은 import/new document 경계로 취급해 undo/redo를 비우고 새 clean checkpoint를 만든다. dirty 판단은 `isMotionEditorSessionDirty()`로 하며, 마지막 `createMotionEditorSession()` 또는 `set-composition` 이후 append checkpoint가 하나라도 있으면 `true`다.

## V2 방향: Transport 커맨드 역할 재정의

현재 `play`/`pause`/`restart`/`seek`/`setLoop`/`setPlaybackRate`는 EditorState와 Player 양쪽에서 처리된다. EditorState에 transport 필드(`playing`, `currentTimeMs` 등)가 있고, shell이 이를 Player로 포워딩한다. Player의 실제 상태는 `syncMotionEditorState()`로 다시 EditorState에 반영된다.

이 이중 진실 원천은 V2에서 다음 방향으로 정리한다:

- **Transport 커맨드 → Player 직접 제어 전용**: `play`/`pause`/`seek` 등은 Player API를 직접 호출하는 "intent"로만 취급. EditorState에서 transport 관련 필드를 제거하거나 읽기 전용으로 강등
- **`syncMotionEditorState()` → 유일한 Player→Editor 동기화 경로**: Player의 `onTimeUpdate` 콜백에서 snapshot을 통해 EditorState의 active* 필드와 시간 정보를 갱신하는 단방향 흐름
- **EditorState는 composition + selection + viewport만 소유**: transport 상태는 Player가 단일 소유

이를 통해 커맨드 시스템은 composition 편집에만 집중하고, transport 제어는 Player 계층에서 완결된다.

## 포함하지 않는 것

- DOM 패널, 타임라인 UI, toolbar 같은 브라우저 편집기 표면
- 데모 앱 조립 코드

## 패키지 경계

- 이 패키지는 UI를 알지 않는다.
- 상위 패키지는 여기서 export한 타입과 함수만 소비해야 한다.

상세 용어집과 계약은 [docs/specs/motion-content/motion-content-contract.spec.md](/Users/junwoobang/workflow/qa-sdk/docs/specs/motion-content/motion-content-contract.spec.md)에서 본다.
