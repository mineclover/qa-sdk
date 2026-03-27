---
def:
  id: motion-editor-component
  scope: ui
  aspect: component
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [tier-frontend]
  links:
    - target: motion-content-glossary
      type: depends_on
---
# Motion Content Editor 컴포넌트

## 목적 ^purpose

motion-content 코어를 소비하는 DOM 기반 편집기 셸. 타임라인 UI, 패널 렌더링, GSAP 스테이지 어댑터를 관리하되, 모든 컴포지션 로직은 motion-content 코어에 위임한다.

## 구성 ^overview

shell(편집기 오케스트레이션), panels(진단/캡션/레이어/시퀀스/트랜지션/파라미터), timeline(드래그/렌더링), styles(CSS).
public API: MotionEditorShell(getState/dispatch/destroy), MotionEditorShellOptions.

## 퍼블릭 API

```typescript
interface MotionEditorShellOptions {
  container: HTMLElement;
  composition?: MotionCompositionDef;
  values?: Partial<MotionParameterValues>;
  renderStage?: (host: HTMLElement, state: MotionEditorState) => MotionEditorShellStage;
  onStateChange?: (state: MotionEditorState) => void;
  tracker?: MotionTracker;
}

interface MotionEditorShell {
  getState(): MotionEditorState;
  dispatch(command: MotionEditorCommand): void;
  destroy(): void;
}
```

## 책임 경계

### 이 컴포넌트가 하는 것

- 에디터 레이아웃과 DOM 셸 제공
- 타임라인 조작 UI (레이어/시퀀스/캡션/트랜지션)
- 트랜스포트 툴바와 스크러버 연결
- loop/playbackRate/snapshot.transport 동기화
- JSON 업로드/다운로드와 에러 노출
- 디버그 스냅샷 표시
- 드래그 프리뷰 계산 (previewMotionEditorSessionCommand)
- undo 체크포인트는 pointer-up 커밋 시 (프리뷰 아님)

### 이 컴포넌트가 하지 않는 것

- MotionCompositionDef 정의 자체 (motion-content 코어)
- GSAP 런타임 계약 재정의 (motion-content 런타임)
- 데모 앱 초기화 및 프리셋 선택 UX (motion-content-editor-demo)
