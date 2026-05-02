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
---

# Viz Roleplay 그룹 — 소비자 기대 시나리오

## 목적 ^purpose

`viz-roleplay-system`(form-builder 구조/렌더러, QA bridge 런타임)이 `viz-system`에 의존할 때 기대하는 계약. roleplay 는 viz-system 이 제공하는 api-client, iframe-protocol, mermaid-gen, viz-core 인프라 위에서만 편집/계측을 분리한다.

## 시나리오 1: iframe-protocol 기반 부모↔자식 통신 ^overview

**전제**: `viz-system`의 `iframe-protocol-spec`이 viz-web(부모)과 roleplay-web(자식 iframe) 간 `postMessage` 양방향 프로토콜을 정의.

**동작**: roleplay-web 이 form-builder 상태 변경을 부모에게 broadcast.

**기대**:
- 메시지 타입은 프로토콜에 선언된 whitelist 외 거부
- origin 검증 실패 시 silent drop + warning metric
- 부모/자식 프로토콜 버전 mismatch → 명시적 handshake 실패 에러

**실패 시 수정 대상**: `viz-system.md`의 `iframe-protocol-spec` — 메시지 타입/버전 handshake 규약이 없으면 roleplay 의 런타임이 부모 기대 외 이벤트를 emit 하여 CORS-like 보안 경계 이탈.

## 시나리오 2: api-client ingest 전송 신뢰성 ^overview

**전제**: `viz-system`의 `api-client-spec`이 ingest-server REST fetch + EventSource SSE 구독 래퍼를 제공.

**동작**: `qa-bridge-runtime`이 사용자 상호작용을 QA 이벤트로 변환하여 api-client 를 통해 `/v1/ingest` 전송.

**기대**:
- api-client 는 브라우저 unload 시점에도 이벤트 드롭 없이 beacon 전송 fallback
- 5xx 응답 → 지수 backoff 재시도 (최대 3회)
- 4xx 응답 → 재시도 없이 drop + metric (malformed payload 보호)

**실패 시 수정 대상**: `viz-system.md`의 `api-client-spec` — retry/backoff 정책이 spec 에 없으면 roleplay 가 자체 재시도를 구현하여 이중 전송 risk.

## 시나리오 3: form-builder renderer auto-layout ^overview

**전제**: `viz-system`의 `viz-core` 가 레이아웃 추상(계산 함수 + 도형 primitive)을 제공.

**동작**: `form-builder-renderer`가 viz-core 의 auto-layout 호출하여 폼 컴포넌트 배치.

**기대**:
- 같은 입력 DOM tree → 같은 layout 결과 (결정론적)
- 컴포넌트 수 증가에 따른 linear scale (O(n²) 금지)
- viz-core 버전 bump 시 roleplay 는 변경 없이 build 통과

**실패 시 수정 대상**: `viz-system.md`의 `viz-core` — layout API 가 계산 함수 로 추상화되지 않고 UI 코드에 embed 되면 roleplay 가 직접 viz-web 을 import 하여 의존 방향 위반.

## 시나리오 4: QA bridge 이벤트 템플릿 통합 ^overview

**전제**: `viz-system`이 viz-core 로부터 템플릿 기반 이벤트 스키마를 roleplay 에 위임.

**동작**: 사용자 상호작용(form submit) 이 `qa-bridge-runtime` 에서 QA 이벤트로 매핑되어 emit.

**기대**:
- 템플릿에 선언된 field 만 이벤트 payload 에 포함 (추가 필드 드롭)
- prefix 는 roleplay-web 의 ownedPrefixes 로 부여 (browser-sdk 는 범용이므로 prefix 미보유)
- 이벤트 emit try-catch 필수, UI 크래시 금지

**실패 시 수정 대상**: `viz-system.md` — 이벤트 템플릿 스키마 소유권(roleplay vs viz-core)이 명확하지 않으면 roleplay 가 schema 정의와 runtime 변환을 모두 수행하여 drift.
