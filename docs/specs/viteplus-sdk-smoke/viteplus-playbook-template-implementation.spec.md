---
def:
  tier: component
  id: viteplus-playbook-template-implementation
  scope: feature
  aspect: func_def
  depth: implementation
  lifecycle: approved
  layer: experience
  svc: viteplus-sdk-smoke
  tags: [frontend, observability, testing]
  links:
    - target: viteplus-sdk-smoke-system
      type: refines
    - target: viteplus-playbook-boundary-relation
      type: depends_on
    - target: sdk-usage-guide
      type: depends_on
    - target: browser-monitor-operations
      type: depends_on
    - target: context-action-convention
      type: depends_on
sources:
  - packages/viteplus-sdk-smoke/src/features/shared/runtime/playbookStore.ts
  - packages/viteplus-sdk-smoke/src/features/shared/runtime/playbookPersist.ts
  - packages/viteplus-sdk-smoke/src/features/shared/runtime/playbookHandlers.ts
  - packages/viteplus-sdk-smoke/src/features/shared/views/playbookDom.ts
  - packages/viteplus-sdk-smoke/src/qa-bridge.ts
  - packages/viteplus-sdk-smoke/src/context-action-contract.ts
---

# Vite+ Playbook Template 구현

## 목적 ^purpose

canonical review와 incident escalation 두 feature가 함께 재사용하는 공통 런타임과 DOM helper를 템플릿 구현 단위로 고정한다.

## 정의 ^defines

- `shared/runtime/playbookStateMachine.ts` — 공통 `idle/editing/invalid/submitting/success/error` 전이
- `shared/runtime/playbookStore.ts` — app-local store/subscribe/update helper
- `shared/runtime/playbookPersist.ts` — refs 생성과 기본 async persist stub
- `shared/runtime/playbookHandlers.ts` — activity append, field focus, bridge flush helper
- `shared/views/playbookDom.ts` — input/select/textarea 렌더링과 active-field 복원 helper
- `context-action-contract.ts` — context-action provider order, boundary manifest, mount-flow 검증 graph

## 소비 ^consumes

- `@qa-sdk/sdk` — NoopTransport, logging facade (`sdk-usage-guide`)
- `browser-monitor` — createQaMonitorAsync, emitWithCoords (`browser-monitor-operations`)
- `@qa-sdk/core` — ScopeNesting, validateScopeNesting, validateMountFlow (`scope-nesting-system`)
- `context-action-convention` — boundary manifest와 검증 체크리스트

## 구성 ^overview

- template는 코드 재사용 단위이므로 `feature/func_def`가 맞다.
- 여기 정의된 shared 파일은 domain 규칙을 모르고, feature-specific draft/validation/result만 상위 레이어에서 주입받는다.
- 둘째 feature가 추가되어도 DOM helper와 state/store/persist helper는 그대로 유지된다.
- context-action contract는 두 feature가 같은 provider order와 boundary 책임을 유지하는지 검증하는 content contract로 분리한다.

## scope/aspect 배정 이유

- `scope: feature`
  템플릿은 문서 생성 절차가 아니라 실제 구현이 가져다 쓰는 기능 단위다.
- `aspect: func_def`
  공통 helper의 책임과 조합 방법을 정의하는 문서이므로 process flow보다 function/module definition에 가깝다.
