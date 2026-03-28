---
def:
  id: motion-content-contract
  address: def_document:v2:273556
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: platform-demo
  tags: [tier-frontend]
  links:
    - target: motion-content-glossary
      type: refines
---

# Motion Content 계약

## 목적 ^purpose

motion-content 계열 패키지의 용어집, 책임 경계, 런타임 비목표를 분리해 선언형 모션 편집 스택의 계약을 정리한다.

## 구성 ^overview

motion-content는 Remotion식 Composition/Sequence/Layer 모델을 참고하되, 런타임은 GSAP 기반으로 한정한다. 세 패키지(코어 모델, 에디터 셸, 데모 앱)로 책임을 분리하고, IO 검증/직렬화/히스토리를 코어에 포함한다.

## 용어집

| 용어 | 정의 |
|------|------|
| **Composition** | 전체 모션 콘텐츠 단위. durationMs, parameters, layers, sequences, transitions를 포함 |
| **Sequence** | 시간축 위의 구간. 여러 layer를 slot으로 묶어 그룹 시간 좌표를 부여 |
| **Layer** | 단일 DOM 타겟의 진입/퇴장 애니메이션을 정의하는 시간 슬라이스 |
| **Cue** | 애니메이션 종류(fade, slide-up, slide-left, slide-right, scale-pop)와 파라미터 |
| **CuePreset** | 재사용 가능한 cue 정의. ID + label로 참조 |
| **CueRef** | 인라인 MotionCueDef 또는 `{ preset: "id" }` 참조 |
| **Transition** | 시퀀스 간 전환 효과. crossfade, flash, lift 세 가지 스타일 |
| **Caption** | 시간 구간에 바인딩된 자막 텍스트. tone(neutral/accent/warning) 포함 |
| **Asset** | 파라미터 값을 DOM에 바인딩하는 텍스트/스타일 자산 |
| **StageTarget** | `{ kind: "stage-node", nodeId }` — `data-motion-id` 속성으로 DOM 매칭 |

## 패키지 책임 경계

### motion-content (코어)

- 모델 타입: Composition, Sequence, Layer, Cue, Transition, Caption, Asset
- 에디터 상태: EditorState, EditorCommand, Selection, Viewport
- 히스토리: EditorSession (undo/redo)
- IO: JSON 직렬화/역직렬화/검증 (`io.ts`)
- 런타임: GSAP 기반 MotionPlayer (`runtime.ts`)
- 프리셋: 예시 composition (`presets.ts`)
- 이벤트 로그: 세션 내 액션 기록 (`event-log.ts`)
- 콘텐츠 타입 축: dom/image/video/svg/canvas (`content-types.ts`)

### motion-content-editor (에디터 셸)

- 타임라인 UI, 파라미터 폼, 트리 뷰
- motion-content 코어 소비

### motion-content-editor-demo (데모 앱)

- 브라우저 검증 앱
- motion-content + motion-content-editor 통합

## 런타임 계약

- **GSAP 전용**: `gsap.timeline()` + `fromTo`/`set` 으로 애니메이션 구성
- **MotionPlayer**: play/pause/restart/seek/setPlaybackRate/setLoop/destroy
- **MotionStageAdapter**: DOM 타겟 해석 인터페이스 — `data-motion-id` 기반
- **캡션 동기화**: onUpdate 콜백에서 현재 시각에 해당하는 캡션 자동 표시
- **자산 적용**: composition resolve 시점에 텍스트/스타일 자산 일괄 적용

## Done Definition

- Composition 모델 타입 완성 + IO 검증 100% 커버
- GSAP 런타임 player 동작 (play/pause/seek/destroy)
- 에디터 state/command/session/history 동작
- JSON 라운드트립: serialize → parse → validate = 동일 구조

## 비목표

- 서버사이드 렌더링 (SSR) — 브라우저 전용
- 비디오 내보내기 (ffmpeg 등) — 런타임 미리보기만
- 전역 좌표계 매핑 — 로컬 이벤트 로그 전용 (ownedPrefixes 없음)
- 다중 사용자 동시 편집 — 단일 세션 전용
