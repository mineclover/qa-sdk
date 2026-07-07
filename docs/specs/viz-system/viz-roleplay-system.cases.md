---
def:
  id: viz-roleplay-system-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: experience
  svc: roleplay-web
  tags: [scenario, viz, roleplay]
  links:
    - target: viz-roleplay-system
      type: refines
    - target: viz-system
      type: depends_on
sources:
  - packages/roleplay-web/src/main.ts
  - packages/roleplay-web/src/form-builder/dom-tree.ts
  - packages/roleplay-web/src/form-builder/form-renderer.ts
  - packages/roleplay-web/src/sdk/qa-bridge.ts
  - packages/roleplay-web/src/sdk/event-emitter.ts
  - packages/viz-web/src/iframe/roleplay-host.ts
---

# Viz Roleplay 그룹 — 소비자 기대 시나리오

## 목적 ^purpose

`viz-roleplay-system`(form-builder 구조/렌더러, QA bridge 런타임)이 `viz-system`에 의존할 때 기대하는 계약. roleplay 는 viz-system 이 제공하는 iframe-protocol과 ingest/session context 위에서 편집/계측을 분리한다.

## 시나리오 1: iframe-protocol 기반 부모↔자식 통신 ^overview

**전제**: `viz-system`의 `iframe-protocol-spec`이 viz-web(부모)과 roleplay-web(자식 iframe) 간 `postMessage` 양방향 프로토콜을 정의.

**동작**: roleplay-web 이 preview DOM 이벤트를 부모에게 broadcast.

**기대**:
- 메시지 타입은 프로토콜에 선언된 whitelist 외 거부
- origin 검증 실패 시 silent drop
- iframe reload 후 `ready` 메시지로 마지막 session context 재전송

**실패 시 수정 대상**: `viz-system.md`의 `iframe-protocol-spec` — 메시지 타입과 ready/context 재전송 규약이 없으면 roleplay 의 런타임이 부모 기대 외 이벤트를 emit 하여 CORS-like 보안 경계 이탈.

## 시나리오 2: api-client ingest 전송 신뢰성 ^overview

**전제**: `viz-system`의 `api-client-spec`이 ingest-server REST fetch + stream 구독 클라이언트 계층을 제공.

**동작**: `qa-bridge-runtime`이 사용자 상호작용을 QA 이벤트로 변환하여 `@qa-sdk/sdk` HttpTransport를 통해 `/v1/ingest` 전송.

**기대**:
- shutdown 시 bridge가 logger flush/shutdown 경로를 호출
- transport는 HttpTransport/NoopTransport/custom으로 교체 가능
- emit 실패는 UI 크래시 대신 local error log로 남김

**실패 시 수정 대상**: `qa-bridge-runtime` — transport 교체와 shutdown flush가 없으면 roleplay가 이벤트 전송 실패를 UI 상태와 섞는다.

## 시나리오 3: form-builder renderer auto-layout ^overview

**전제**: roleplay renderer가 `DomNode` 트리와 CSS style map을 기준으로 preview DOM을 생성.

**동작**: `form-builder-renderer`가 같은 `DomNode` 입력을 같은 DOM preview로 렌더링.

**기대**:
- 같은 입력 DOM tree → 같은 tag/attributes/styles/text/children 결과 (결정론적)
- 모든 element가 `data-node-id`를 가져 preview 클릭 선택이 가능
- auto-layout은 flex style map으로 읽고 쓴다

**실패 시 수정 대상**: `form-builder-renderer` — renderer가 editor state나 transport에 의존하면 preview/계측 경계가 섞인다.

## 시나리오 4: QA bridge 이벤트 템플릿 통합 ^overview

**전제**: `qa-bridge-runtime`이 preview DOM 이벤트를 QA 이벤트로 변환한다.

**동작**: 사용자 상호작용(click/input/change/submit)이 `qa-bridge-runtime` 에서 QA 이벤트로 매핑되어 emit.

**기대**:
- event key는 `click`, `input_change`, `form_submit` 등 허용된 DOM 이벤트 경로에서 생성
- serviceConfig가 있으면 service prefix address_context를 계산
- 이벤트 emit try-catch 필수, UI 크래시 금지

**실패 시 수정 대상**: `qa-bridge-runtime` — event key/payload 소유권이 명확하지 않으면 form-builder가 transport 세부 구현을 직접 알게 된다.
