# motion-content-editor

`motion-content-editor`는 `motion-content`를 소비하는 DOM 기반 편집기 셸 패키지다. 타임라인, 패널, scrubber, JSON import/export, debug panel을 제공하지만 상태 모델과 stage adapter 계약 자체는 코어 패키지 정의를 그대로 따른다.

## 책임

- 편집기 레이아웃과 DOM 셸 제공
- layer/sequence/caption/transition 타임라인 조작 UI
- transport toolbar와 scrubber 연결
- loop / playbackRate / snapshot.transport 동기화
- JSON 업로드/다운로드와 에러 노출
- debug snapshot 표시
- drag preview는 `previewMotionEditorSessionCommand()`로만 계산하고, pointer up commit만 undo checkpoint로 반영
- JSON import는 코어 `set-composition` reset checkpoint 전략을 그대로 따라 새 clean baseline으로 전환

## 포함하지 않는 것

- MotionCompositionDef 자체 정의
- GSAP runtime 계약 재정의
- 데모 앱 초기화와 preset 선택 UX

## 패키지 경계

- 코어 로직은 `motion-content`에서 가져온다.
- 이 패키지는 브라우저 편집 경험을 조립하는 thin UI 계층이다.

상세 용어집과 V1 계약은 [docs/specs/motion-content/v1-glossary-and-contracts.md](/Users/junwoobang/workflow/qa-sdk/docs/specs/motion-content/v1-glossary-and-contracts.md)에서 본다.
