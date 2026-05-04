---
def:
  id: motion-content-editor-system
  type: spec
  tier: system
  level: leaf
  scope: ui
  aspect: component
  depth: overview
  lifecycle: approved
  layer: experience
  svc: motion-content-editor
  tags: [motion, frontend, runtime]
  links:
    - target: viz-language-system
      type: depends_on
    - target: motion-content-contract
      type: depends_on
    - target: motion-editor-component
      type: depends_on
  sources:
    - packages/motion-content-editor/src/color-input.ts
    - packages/motion-content-editor/src/design-tokens.ts
    - packages/motion-content-editor/src/index.ts
    - packages/motion-content-editor/src/inline-text-input.ts
    - packages/motion-content-editor/src/panel-layout.ts
    - packages/motion-content-editor/src/panels.ts
    - packages/motion-content-editor/src/prefs-store.ts
    - packages/motion-content-editor/src/scene-presence.ts
    - packages/motion-content-editor/src/scrub-input.ts
    - packages/motion-content-editor/src/shell.ts
    - packages/motion-content-editor/src/styles.ts
    - packages/motion-content-editor/src/timeline.ts
    - packages/motion-content-editor/src/workspace.ts
---

# motion-content-editor system

## 목적 ^purpose

DOM-based editor shell for motion-content compositions and GSAP runtime debugging. motion-content 코어를 소비해 편집기 레이아웃, 타임라인 UI, 패널 렌더링, 스테이지 어댑터, workspace 연결을 제공하는 motion-content-editor 시스템이다.

## 구성 ^overview

- `shell.ts`, `workspace.ts`, `index.ts` — MotionEditorShell public API, workspace shell, public barrel.
- `panels.ts`, `panel-layout.ts`, `timeline.ts`, `scene-presence.ts` — 진단/캡션/레이어/시퀀스/트랜지션/파라미터 패널, 패널 레이아웃, 타임라인 렌더링, scene presence view model.
- `design-tokens.ts`, `styles.ts`, `prefs-store.ts` — editor theme, CSS, preference storage.
- `color-input.ts`, `inline-text-input.ts`, `scrub-input.ts` — 에디터 입력 컨트롤.
