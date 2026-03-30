---
def:
  id: platform-sdk-user-scenarios
  type: knowledge
  knowledge_kind: guide
  level: leaf
  scope: flow
  aspect: user_scenario
  depth: overview
  lifecycle: approved
  layer: experience
  tags: [entry-point]
  links:
    - target: platform-chain-system
      type: refines
    - target: platform-sdk-spec
      type: depends_on
---

# @qa-sdk/sdk 소비 유저 시나리오

## 목적 ^purpose

`@qa-sdk/sdk`와 소비처 로컬 `qa-bridge`를 어떤 사용자가 어떤 순서로 채택하는지 공통 시나리오로 수집한다. 새 Vite 앱 개발, 브라우저 운영 앱 통합, QA 회귀 테스트 작성이 같은 선택 기준을 따르도록 한다.

## 구성 ^overview

- **신규 앱 개발자**: `viteplus-sdk-smoke`의 `qa-bridge` 템플릿을 복사해 import/build smoke를 먼저 통과시킨다.
- **브라우저 제품 개발자**: 앱 내부 로컬 facade를 두고 `owner`, `source`, `build`, `ingestUrl`만 앱에 맞게 바꾼다.
- **QA/테스트 작성자**: `NoopTransport`와 `getDebugEnvelopes()`로 네트워크 없는 회귀 테스트를 만든다.
- **플랫폼 메인터너**: 자동 수집, 세션 persistence, pagehide flush까지 필요해지면 로컬 bridge가 아니라 `@qa-sdk/browser`로 올린다.

## 시나리오 1. 신규 Vite+ 앱에 최소 계측 붙이기

**사용자:** 프론트엔드 개발자  
**목표:** 새 앱이 `@qa-sdk/sdk`를 브라우저에서 import하고 번들할 수 있는지 확인

1. `packages/viteplus-sdk-smoke/src/qa-bridge.ts`를 앱 내부로 복사한다.
2. `NoopTransport`를 주입한 뒤 `startSession()`, `emitEvent()`, `shutdown()`만 연결한다.
3. `pnpm build`와 `vitest` 기준이 통과하는지 확인한다.

**완료 조건:** 네트워크 없이 `TransmissionEnvelope`가 생성되고 import/build/test가 통과한다.

## 시나리오 2. 운영 브라우저 앱에 로컬 facade로 연결하기

**사용자:** 제품 프론트엔드 개발자  
**목표:** 앱 코드에 `QaLogger` 초기화 로직을 흩뿌리지 않고 운영 계측을 붙인다

1. 앱 패키지 내부에 `qa-bridge.ts`를 둔다.
2. `HttpTransport`를 기본 transport로 사용하고 endpoint는 `<ingestUrl>/v1/ingest` 규칙으로 정규화한다.
3. `source.service_name`, `owner.owner_id`, `build.env`만 앱 전용 값으로 바꾼다.
4. UI 레이어는 `emitEvent()`, `flush()`, `shutdown()`만 호출한다.

**완료 조건:** 이벤트 버전 조회, 세션 시작, flush/shutdown 규칙이 앱 바깥으로 새지 않는다.

## 시나리오 3. QA 회귀 테스트를 네트워크 없이 작성하기

**사용자:** QA 엔지니어 또는 테스트 작성자  
**목표:** ingest 서버 없이도 수집 레코드 내용을 검증한다

1. bridge에 `NoopTransport`를 주입한다.
2. 테스트에서 `startSession()`, `emitEvent()` 또는 `emitMetric()`을 호출한다.
3. `getDebugEnvelopes()`를 읽어 `event_key`, `event_version`, `qa_session_id`를 검증한다.

**완료 조건:** 네트워크 mock 없이도 회귀 테스트가 안정적으로 돈다.

## 시나리오 4. 로컬 bridge에서 browser SDK로 승격하기

**사용자:** 플랫폼 메인터너 또는 프론트엔드 리드  
**목표:** 단순 facade를 넘어서 자동 수집이 필요한지 판단한다

다음 요구가 생기면 로컬 `qa-bridge`만으로는 부족하다.

- 세션 persistence가 필요하다.
- `pagehide`에서 best-effort flush가 필요하다.
- autoCapture나 `emitWithCoords()`가 필요하다.
- shutdown 이후 생명주기 상태를 관리해야 한다.

이 경우는 `@qa-sdk/browser`의 책임이며, `@qa-sdk/sdk` 또는 로컬 bridge에 억지로 넣지 않는다.

## 시나리오 5. 공용 SDK로 승격할지 판단하기

**사용자:** 플랫폼 메인터너  
**목표:** `qa-bridge`를 `packages/sdk`로 올릴지 결정한다

현재 기준은 다음과 같다.

- 앱 3개 이상이 거의 같은 bridge shape를 쓴다.
- 차이가 `serviceName`, `owner`, `buildEnv` 정도뿐이다.
- 브라우저 전용 정책이 아니라 런타임 중립 API로 정의할 수 있다.

이 기준을 넘기 전까지는 로컬 facade를 유지한다.
