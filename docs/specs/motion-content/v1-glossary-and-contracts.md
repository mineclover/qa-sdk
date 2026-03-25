---
def:
  id: motion-content-glossary
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
---

# Motion Content V1 개념 용어집과 패키지 계약

## 목적 ^purpose

`motion-content` 계열 패키지는 Remotion식 개념층을 참고하되 런타임은 GSAP으로만 실행하는 선언형 모션 편집 스택이다. V1의 목적은 "작동하는 데모"를 넘어서 다른 앱이 붙일 수 있는 편집기/런타임 계약을 닫는 것이다.

## V1 개념 용어집

### Composition

- 모션 문서의 SSOT다.
- `MotionCompositionDef` 하나가 duration, parameters, assets, layers, sequences, captions, transitions를 모두 담는다.
- JSON import/export의 기준 단위이며, editor/runtime 모두 같은 구조를 사용한다.
- 파일 직렬화 포맷은 `schemaVersion: "qa-sdk.motion-composition/v1"` + `composition` envelope로 고정한다.

```json
{
  "schemaVersion": "qa-sdk.motion-composition/v1",
  "composition": {
    "id": "promo-grid",
    "title": "Promo Grid",
    "description": "..."
  }
}
```

- demo 앱은 `PROMO_GRID_COMPOSITION_V1_JSON`을 `parseMotionComposition()`으로 불러오고, editor 다운로드도 같은 포맷을 쓴다.

### Sequence

- 시간축 위의 장면 윈도우다.
- `startMs`, `durationMs`, `layerIds`, `captionIds`로 어느 장면이 언제 활성화되는지 정의한다.
- 런타임에서는 active sequence 계산의 기준이 되고, 에디터에서는 타임라인 lane의 장면 단위로 사용된다.

### Layer

- stage adapter가 해석할 cue 애니메이션 단위다.
- `target`, `startMs`, `durationMs`, `enter`, `exit`를 통해 어떤 stage node가 언제 어떤 방식으로 등장/퇴장하는지 표현한다.
- 런타임에서는 adapter가 target을 실제 스테이지 엘리먼트로 해석한 뒤 GSAP tween으로 실행하고, 에디터에서는 가장 세밀한 타이밍 편집 단위다.

### Asset Target / Layer Target

- V1에서 asset과 layer는 둘 다 동일한 `MotionStageTargetV1` 규칙을 쓴다.
- 표준 shape는 `{ kind: "stage-node", nodeId: string }` 하나로 고정한다.
- `nodeId`는 composition이 아는 유일한 식별자이며 CSS selector, DOM path, framework ref를 직접 담지 않는다.
- asset target은 해당 node에 text/style 값을 투영하고, layer target은 같은 node에 enter/exit cue를 적용한다.
- 즉, composition은 "무엇을 바꿀지"만 선언하고 "어떻게 DOM/Canvas/native view를 찾을지"는 stage adapter 책임으로 밀어낸다.

```json
{
  "target": {
    "kind": "stage-node",
    "nodeId": "headline"
  }
}
```

### Stage Adapter

- `MotionStageAdapter`는 composition target과 실제 스테이지 구현 사이의 표준 브리지다.
- 필수 입력은 `stageRoot`, `captionElement`, 그리고 asset/layer target을 실제 렌더 타깃으로 풀 수 있는 resolver다.
- 필수 책임은 세 가지다.
- `resolveAssetTarget(target)`으로 asset target을 해석한다.
- `resolveLayerTarget(target)`으로 layer target을 해석한다.
- `managedElements()`와 caption surface를 제공해 runtime이 cleanup과 caption 갱신을 adapter 경계 안에서 처리하게 한다.
- 기본 DOM 구현은 `createMotionDomStageAdapter()`이며, V1에서는 `data-motion-id="<nodeId>"`를 읽어 `stage-node` target을 DOM element로 매핑한다.
- 다른 렌더러가 붙더라도 composition 포맷은 유지하고 adapter만 교체하면 된다.

### Transition

- 두 sequence 사이의 연결 방식이다.
- `fromSequenceId`, `toSequenceId`, `style`, `durationMs`로 장면 전환의 스타일과 겹침 시간을 정의한다.
- V1 구현은 `crossfade`, `flash`, `lift` 세 가지 스타일만 지원한다.

### Caption

- 시간축에 따라 노출되는 자막 cue다.
- `startMs`와 `endMs` 사이에서만 활성화되며, 현재 활성 caption은 runtime snapshot과 editor debug panel에 그대로 반영된다.

### Transport

- 재생 제어 계약이다.
- `play`, `pause`, `restart`, `seek`, `setLoop`, `setPlaybackRate`와 현재 시간/길이 조회가 여기에 속한다.
- `MotionTransportApi`는 `getTransportState()`를 통해 `playing`, `currentTimeMs`, `durationMs`, `loop`, `playbackRate`를 같은 shape로 조회한다.
- editor state의 `transport`와 GSAP player snapshot의 `transport`가 같은 shape를 공유하므로, 소비자는 별도 매핑 없이 상태를 동기화할 수 있다.

```ts
const player = createMotionPlayer(adapter, resolveMotionComposition(composition, values));

player.setLoop(true);
player.setPlaybackRate(1.5);
player.seek(1200);
player.play();

const transport = player.getTransportState();
```

### Debug Snapshot

- 특정 시점의 런타임 해석 결과다.
- `timeMs`, `activeSequenceIds`, `activeLayerIds`, `activeCaptionId`, `captionText`, `resolvedAssets`를 포함한다.
- V1 snapshot은 위 debug 필드에 더해 `transport`를 포함한다.
- editor는 이 스냅샷 하나로 selection/debug 패널, scrubber, transport 토글을 함께 동기화한다.

```ts
const snapshot = player.snapshot();

snapshot.transport.playing;
snapshot.activeLayerIds;
snapshot.captionText;
```

### Editor Session / Checkpoint

- `MotionEditorSession`은 `past/present/future`로 undo stack을 표현하지만, 모든 command가 checkpoint를 만들지는 않는다.
- checkpoint 전략은 세 가지다.
- `ignore`: selection과 transport command. UI 포커스, scrub, playback 토글은 undo stack을 오염시키지 않는다.
- `append`: parameter/layer/sequence/caption/transition 편집. 실제 문서 내용이 바뀔 때만 새 checkpoint가 추가된다.
- `reset`: `set-composition`. JSON import나 외부 composition 교체는 새 문서 baseline으로 취급해 과거/future checkpoint를 비우고 깨끗한 시작점으로 바꾼다.
- drag UX는 pointer move 동안 `previewMotionEditorSessionCommand()`로 임시 state만 만들고, pointer up에서만 `applyMotionEditorSessionCommand()`를 호출해 commit한다.
- dirty state는 `isMotionEditorSessionDirty()` 기준으로 정의한다. 마지막 session 생성 또는 `set-composition` 이후 append checkpoint가 남아 있으면 dirty다.

## 패키지 책임 경계

### `motion-content`

- V1 편집 포맷의 타입과 JSON IO를 소유한다.
- `serializeMotionComposition()` / `parseMotionComposition()`이 버전 고정된 V1 JSON 문서 포맷을 단일 진입점으로 제공한다.
- `MotionStageTargetV1`, `MotionStageAdapter`, `createMotionDomStageAdapter()`로 stage 투영 계약을 소유한다.
- `model`, `editor`, `state`, `history`, `runtime`, `presets`를 export하는 코어 계약 패키지다.
- 브라우저 UI 없이도 composition 생성, command 적용, undo/redo, GSAP 재생, snapshot 조회가 가능해야 한다.
- 다른 패키지가 기대해야 하는 것은 오직 여기의 타입/함수 계약이다.

### `motion-content-editor`

- `motion-content`를 소비하는 얇은 DOM 편집기 셸이다.
- 타임라인 lane, 패널, toolbar, JSON import/export, debug panel 같은 브라우저 편집 경험을 제공한다.
- 상태 모델 자체를 재정의하지 않고 `MotionEditorCommand`, `MotionEditorSession`, `MotionDebugSnapshot`을 그대로 사용한다.
- 새 앱은 이 패키지를 임베드해서 빠르게 편집기를 붙일 수 있어야 한다.

### `@qa-sdk/motion-content-editor-demo`

- 가장 얇은 소비 앱이다.
- preset composition과 editor shell을 연결해 브라우저에서 즉시 검증 가능한 샌드박스를 제공한다.
- 라이브러리 계약을 확장하지 않고, 소비 예제와 acceptance QA 기준 소비처 역할만 맡는다.

## 의존 방향

```text
motion-content-editor-demo
  -> motion-content-editor
      -> motion-content
```

- `motion-content`는 UI를 알지 않는다.
- `motion-content-editor`는 코어 계약을 소비하지만, 코어 타입을 다시 정의하지 않는다.
- demo는 셸 조립과 preset 선택만 담당하며, 비즈니스 로직을 패키지 밖으로 끌고 가지 않는다.

## V1 Done Definition

- `MotionCompositionDef`가 V1 편집 포맷으로 문서화되고 JSON import/export 기준이 명확하다.
- asset/layer target이 selector가 아니라 `stage-node` target 규칙으로 닫혀 있고, stage adapter 책임이 분리돼 있다.
- runtime/transport API가 명시적이며 GSAP player가 같은 제어 의미를 유지한다.
- runtime snapshot이 transport state와 active debug state를 한 번에 제공한다.
- layer, sequence, caption, transition 편집이 같은 command 모델로 동작한다.
- editor session이 undo/redo와 시간축 편집을 예측 가능하게 다룬다.
- debug snapshot으로 현재 active 상태와 resolved asset 결과를 확인할 수 있다.
- demo 앱에서 preset 기반 검증과 브라우저 수동 검증 루프를 수행할 수 있다.

## V1 비목표

- Remotion 런타임이나 비디오 렌더 파이프라인을 제공하지 않는다.
- React 전용 편집기나 프레임워크별 wrapper를 V1 범위에 포함하지 않는다.
- 서버 동기화, 멀티 유저 협업, 저장소 백엔드 계약을 정의하지 않는다.
- 오디오 트랙, 키프레임 곡선 편집기, 고급 이펙트 DSL까지 확장하지 않는다.
- `MotionStageAdapter`를 넘는 복합 asset pipeline이나 원격 asset fetch 계약까지 V1에서 닫지 않는다.

## 개발자 진입점

- 패키지별 빠른 책임 요약: 각 패키지의 `README.md`
- 코어 타입과 구현: `packages/motion-content/src`
- 브라우저 편집기 셸: `packages/motion-content-editor/src`
- 소비 예제: `packages/motion-content-editor-demo/src/main.ts`
- V1 JSON 예제 상수: `packages/motion-content/src/examples.ts`
