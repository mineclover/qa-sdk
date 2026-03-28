---
def:
  id: form-builder-structure
  address: def_document:v1:9
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  layer: experience
  svc: platform-demo
  tags: [tier-frontend]
  links:
    - target: form-builder-spec
      type: refines
---

# Form Builder 구조

## 목적 ^purpose

form-builder의 DOM 트리 모델, 트리 뷰, 속성 편집기 사이의 구조적 책임을 분리해 편집기 셸을 안정화한다.

## 구성 ^overview

motion-content 편집기는 `MotionCompositionDef` 트리를 중심으로 구성된다. Composition → Sequence → Layer → Cue 계층이 편집 트리이고, `MotionEditorState`가 현재 선택/뷰포트/transport를 추적하며, `MotionEditorSession`이 undo/redo 히스토리를 관리한다.

## 편집 트리 모델

```
MotionCompositionDef
  ├── parameters: MotionParameterDef[]      ← 폼 입력 정의
  ├── cuePresets: MotionCuePreset[]         ← 재사용 애니메이션 프리셋
  ├── assets: MotionAssetDef[]              ← 텍스트/스타일 바인딩
  ├── layers: MotionLayerDef[]              ← 타임라인 레이어
  │     ├── target: MotionStageTargetV1     ← DOM 타겟 (nodeId)
  │     ├── content?: MotionLayerContent    ← dom/image/video/svg/canvas
  │     ├── enter: MotionCueRef             ← 진입 애니메이션
  │     └── exit?: MotionCueRef             ← 퇴장 애니메이션
  ├── sequences: MotionSequenceDef[]        ← 시퀀스 (레이어 그룹)
  │     ├── layers?: SequenceLayerSlot[]    ← 슬롯 기반 구성
  │     ├── stagger?: SequenceStaggerPattern ← 자동 오프셋 파생
  │     └── captionIds?: string[]           ← 자막 참조
  ├── captions: MotionCaptionCue[]          ← 자막 큐
  └── transitions: MotionTransitionDef[]    ← 시퀀스 간 전환
```

## 선택 상태 — MotionEditorSelection

5가지 선택 대상을 discriminated union으로 표현한다:

| kind | 대상 | 편집 시 표시 |
|------|------|-------------|
| `composition` | 전체 컴포지션 | 제목, 설명, durationMs |
| `layer` | 개별 레이어 | label, target, enter/exit cue, content type |
| `sequence` | 시퀀스 | title, startMs, durationMs, slots |
| `caption` | 자막 | text, tone, startMs, durationMs |
| `transition` | 전환 | style, durationMs, params |

`describeMotionSelection(state)` 으로 현재 선택의 읽기 좋은 라벨을 반환한다.

## 에디터 상태 — MotionEditorState

```typescript
interface MotionEditorState {
  composition: ResolvedMotionComposition;  // 파라미터 적용된 composition
  values: MotionParameterValues;           // 현재 파라미터 값
  selection: MotionEditorSelection | null; // 현재 선택
  transport: MotionTransportState;         // 재생 상태
  viewport: MotionEditorViewport;          // 줌, 스크롤, 가시 구간
  activeSequenceIds: string[];             // 현재 시각 활성 시퀀스
  activeLayerIds: string[];                // 현재 시각 활성 레이어
  activeCaptionId: string | null;          // 현재 자막
}
```

## 커맨드 체계 — MotionEditorCommand

11가지 커맨드를 `applyMotionEditorCommand(state, command)` 로 처리한다:

| 커맨드 | 설명 | 체크포인트 |
|--------|------|-----------|
| `select` | 선택 변경 | ignore |
| `set-composition` | 전체 교체 | reset |
| `set-parameter` | 파라미터 값 변경 | append |
| `set-current-time` | 재생 시각 변경 | ignore |
| `play`/`pause`/`restart` | transport 제어 | ignore |
| `set-loop`/`set-playback-rate` | 재생 옵션 | ignore |
| `update-item-timing` | 레이어/시퀀스/캡션 타이밍 변경 | append |
| `update-transition-duration` | 전환 길이 변경 | append |

## 히스토리 — MotionEditorSession

```typescript
interface MotionEditorSession {
  past: MotionEditorState[];     // undo 스택
  present: MotionEditorState;    // 현재 상태
  future: MotionEditorState[];   // redo 스택
}
```

- **체크포인트 전략**: `ignore`(선택/재생), `append`(편집), `reset`(전체 교체)
- `append`: past에 현재를 push, future 초기화 — 중복 방지(동일 checkpointKey면 무시)
- `reset`: past/future 모두 초기화
- `undoMotionEditorSession()` / `redoMotionEditorSession()` 으로 이력 탐색
- `isMotionEditorSessionDirty()` 로 변경 여부 판별
