---
def:
  id: motion-content-editor-demo-system
  type: spec
  tier: system
  level: leaf
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: experience
  svc: motion-content-editor-demo
  tags: [motion, demo, frontend]
  links:
    - target: viz-language-system
      type: refines
    - target: motion-content-editor-demo
      type: depends_on
    - target: inspector-engine
      type: depends_on
  sources:
    - packages/motion-content-editor-demo/src/inspector-engine.ts
    - packages/motion-content-editor-demo/src/inspector.ts
    - packages/motion-content-editor-demo/src/main.ts
---

# motion-content-editor-demo system

## 목적 ^purpose

motion-content-editor를 시연하는 데모 앱이다. `motion-content-editor` 라이브러리의 기능을 실제 브라우저 surface로 시연하고, 편집기 셸, 트리 뷰, 속성 편집기, 프리뷰 연결을 통합한 standalone reference implementation을 제공한다.

## 구성 ^overview

- `main.ts` — motion-content, motion-content-editor, motion-workspace, motion-workspace-client를 연결하는 데모 앱 entrypoint.
- `inspector-engine.ts` — MotionCompositionDefV2 트리 변환, 선택/펼침/디테일 추출, 타임라인 계산을 담당하는 순수 로직.
- `inspector.ts` — inspector-engine 결과를 브라우저 DOM surface로 렌더링하는 inspector UI.
