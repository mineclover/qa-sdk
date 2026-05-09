---
def:
  id: motion-content-system
  type: spec
  tier: system
  level: leaf
  scope: feature
  aspect: func_def
  depth: overview
  lifecycle: approved
  layer: domain
  svc: motion-content
  tags: [motion, frontend, runtime, contract]
  links:
    - target: viz-language-system
      type: refines
    - target: motion-content-contract
      type: depends_on
  sources:
    - packages/motion-content/src/assemble.ts
    - packages/motion-content/src/content-types.ts
    - packages/motion-content/src/editor.ts
    - packages/motion-content/src/event-log.ts
    - packages/motion-content/src/events.ts
    - packages/motion-content/src/examples.ts
    - packages/motion-content/src/history.ts
    - packages/motion-content/src/index.ts
    - packages/motion-content/src/io.ts
    - packages/motion-content/src/model.ts
    - packages/motion-content/src/presets.ts
    - packages/motion-content/src/query.ts
    - packages/motion-content/src/runtime.ts
    - packages/motion-content/src/service.ts
    - packages/motion-content/src/snapshot.ts
    - packages/motion-content/src/state.ts
    - packages/motion-content/src/types.ts
    - packages/motion-content/src/utils.ts
---

# motion-content system

## 목적 ^purpose

Declarative motion composition model and GSAP runtime inspired by Remotion concepts, without Remotion runtime. Composition, Sequence, Layer, Cue, Transition, Caption, Asset 모델과 에디터 상태, IO 검증/직렬화, 히스토리, GSAP 기반 MotionPlayer 런타임을 제공하는 motion-content 코어 시스템이다.

## 구성 ^overview

- `model.ts`, `types.ts`, `content-types.ts` — 모션 composition 모델, 선택 타입, 콘텐츠 타입 축.
- `io.ts`, `assemble.ts`, `examples.ts`, `presets.ts` — JSON 파싱/직렬화/검증, V1↔V2 composition 변환/조립, 예시/프리셋 문서.
- `editor.ts`, `state.ts`, `history.ts`, `query.ts`, `snapshot.ts` — 에디터 상태, command/session/history, 시간축 조회와 스냅샷 계산.
- `runtime.ts`, `service.ts`, `event-log.ts`, `events.ts`, `utils.ts`, `index.ts` — GSAP 런타임 player, 서비스 계층, 이벤트 로그/이벤트 export, 공용 유틸과 public barrel.
