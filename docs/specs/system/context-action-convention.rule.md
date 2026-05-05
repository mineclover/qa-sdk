---
def:
  id: context-action-convention
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural, frontend, testing, convention]
  links:
    - target: doc-type-convention
      type: refines
    - target: architecture-revealing-code-convention
      type: refines
    - target: definition-mgmt-consistency-rules
      type: constrains
    - target: definition-mgmt-verification-loop
      type: depends_on
    - target: scope-nesting-system
      type: depends_on
    - target: scope-nesting-simulation-layers
      type: traces_to
    - target: viteplus-sdk-smoke-system
      type: constrains
---

# Context-Action Convention — UI Scope Boundary 규칙

## 목적 ^purpose

context-action UI 패턴을 scope-nesting 검증 엔진, architecture-revealing code convention, definition 문서 관리 규칙에 연결하여 boundary 순서와 문서 책임이 drift 없이 검증되도록 한다.

## 정의 ^defines

- **context-action** — UI feature를 page root, bridge, context, handlers/actions, view boundary로 나누고 상위 scope가 하위 scope에 계약을 제공하는 구현 컨벤션.
- **provider order** — Page Root -> qa-bridge -> feature context -> handlers/actions -> view render 순서.
- **boundary documentation** — 각 boundary는 하나의 책임 문서 또는 하위 spec으로 고정하고, 세부 상태/interaction/validation은 별도 문서에 위임한다.

## 소비 ^consumes

- `scope-nesting-system` — contract descent 기반 정적/동적 검증 엔진.
- `scope-nesting-simulation-layers` — L0 guard, L1 structure, L1.5 mount/timing, L2 transition, L3 path 검증 계층.
- `architecture-revealing-code-convention` — 코드와 문서가 같은 책임 topology를 드러내야 한다는 상위 규칙.
- `doc-type-convention` — spec/rule/cases/test/todo/memo/plan 역할 분리.
- `definition-mgmt-verification-loop` — sync, validate, audit, scan-audit 검증 순서.

## 책임 경계 ^overview

| boundary | 코드 책임 | 문서 책임 | 검증 |
|----------|-----------|-----------|------|
| page root | feature mount와 provider 조립 시작 | flow/process_flow | provider order 포함 |
| qa-bridge | session, trace, logging side effect | feature/func_def 또는 interface contract | optional 여부 확인 |
| feature context | state, refs, persistence adapter | feature/func_def + state/app_state | state shape와 consumer 공유 |
| handlers/actions | orchestration, dispatch, side effect adapter | feature/func_def | PipeSpec 또는 handler graph |
| view | input, rendering, focus/feedback | ui/interaction | 소비 계약만 확인 |

## 문서화 규칙 ^constraint

1. context-action 자체의 공통 규칙은 이 문서가 소유한다.
2. scope-nesting API와 검증 계층은 `scope-nesting-system` family가 소유한다.
3. 특정 앱의 boundary 5종, provider 순서, state, interaction, validation은 앱별 system 문서가 소유한다.
4. 앱별 system 문서는 이 문서를 `depends_on` 또는 이 문서의 `constrains` 대상으로 연결한다.
5. boundary overview에는 목적과 결합만 쓰고, state shape, interaction rule, validation detail은 별도 spec/rule/test/cases 문서로 분리한다.
6. 같은 설명을 system overview, rule, cases, test에 반복하지 않는다. 각 문서는 `doc-type-convention`의 owner 압축 규칙을 따른다.

## 링크 규칙 ^constraint

| 관계 | link type | 예 |
|------|-----------|----|
| 앱 system이 context-action 규칙을 소비 | `depends_on` | `viteplus-sdk-smoke-system -> context-action-convention` |
| context-action 규칙이 앱 example을 제약 | `constrains` | `context-action-convention -> viteplus-sdk-smoke-system` |
| 앱 boundary 문서가 provider order를 상세화 | `refines` | `provider-stack -> app system` |
| 검증 시나리오가 구현 문서를 확인 | `verifies` 또는 `traces_to` | `.test.md -> implementation spec` |
| boundary 결합 규칙이 문서 링크 정책을 소비 | `depends_on` | `boundary-coupling -> definition-mgmt-graph-links` |

`contains`는 앱 system 내부 소속에만 사용한다. 공용 컨벤션이나 scope-nesting 엔진을 앱 system의 `contains` 자식으로 넣지 않는다.

## 검증 체크리스트 ^constraint

- provider order가 Page Root -> qa-bridge -> feature context -> handlers/actions -> view render 순서로 표현되는가.
- 하위 scope가 소비하는 계약은 상위 scope에서 제공되는가.
- optional logging 같은 경량 모드는 `required: false`로 선언되는가.
- handler/action boundary는 view rendering과 state shape 정의를 동시에 소유하지 않는가.
- view boundary는 orchestration이나 persistence write를 직접 수행하지 않는가.
- 앱별 문서가 context-action 공통 규칙을 복제하지 않고 이 문서 또는 scope-nesting 문서를 참조하는가.
- `.cases.md`는 사용자 흐름을, `.test.md`는 공급자 검증 evidence를, `.rule.md`는 소비 체크를 소유하는가.

## 구현 컨텐츠 ^implements

`viteplus-sdk-smoke` canonical example은 이 컨벤션을 실행 가능한 content contract로 고정한다.

| 파일 | 역할 |
|------|------|
| `packages/viteplus-sdk-smoke/src/context-action-contract.ts` | provider order, boundary manifest, ScopeNesting, MountFlow graph 생성 |
| `packages/viteplus-sdk-smoke/src/context-action-contract.test.ts` | canonical-review와 incident-escalation feature가 컨벤션을 만족하는지 검증 |

이 구현은 앱 런타임 UI에서 직접 import하지 않는 검증 surface다. 실제 화면 동작은 feature별 `contexts`, `handlers`, `actions`, `views`가 소유하고, 이 파일은 문서 컨벤션과 scope-nesting 검증 엔진 사이의 content contract만 소유한다.

## 검증 루프 ^consumes

문서 또는 코드 boundary를 바꾼 뒤 최소 루프:

```bash
node packages/cli/dist/index.js def sync
node packages/cli/dist/index.js def validate
node packages/cli/dist/index.js def scan-audit
node packages/cli/dist/index.js def audit-db
pnpm --filter @qa-sdk/core test -- scope-nesting
```

앱별 context-action 구현을 바꾼 경우 해당 앱 package test를 추가한다. `viteplus-sdk-smoke`는 canonical example이므로 context-action 규칙 변경 시 우선 확인 대상이다.
