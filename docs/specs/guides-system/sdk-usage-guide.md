---
def:
  tier: component
  id: sdk-usage-guide
  type: knowledge
  knowledge_kind: guide
  scope: flow
  aspect: user_scenario
  depth: overview
  lifecycle: approved
  layer: mediation
  tags: [entry-point]
  links:
    - target: guides-system
      type: refines
    - target: platform-sdk-spec
      type: depends_on
    - target: quickstart-guide
      type: depends_on
---

# qa-sdk Usage Reference — 현재 환경 기준

## 목적 ^purpose

현재 qa-sdk 모노레포에서 `@qa-sdk/sdk`를 소비하는 기준 레퍼런스와 운영 베스트 프랙티스를 한 문서로 고정한다. 새 앱, 브라우저 브리지, 테스트 소비처가 같은 초기화 규칙과 종료 규칙을 따르도록 한다.

## 구성 ^overview

- **최소 소비처**: `packages/viteplus-sdk-smoke`는 Vite+ 앱에서 `@qa-sdk/sdk`를 바로 import하는 가장 얇은 레퍼런스다.
- **복사 가능한 브리지 템플릿**: `packages/viteplus-sdk-smoke/src/qa-bridge.ts`는 Vite 앱에서 그대로 가져다 쓸 최소 facade다.
- **소비처 로컬 catalog**: `packages/viteplus-sdk-smoke/src/browser-catalog.ts`는 service prefix proof에 쓰는 local browser catalog overlay다.
- **CLI 자동화**: `qa-sdk init --vite-consumer <path>`는 bridge 템플릿과 기본 의존성을 자동으로 넣는다.
- **브라우저 브리지**: `packages/roleplay-web/src/sdk/qa-bridge.ts`는 앱 코드가 직접 `QaLogger`를 만지지 않도록 감싼다.
- **브라우저 자동 수집**: `packages/browser-sdk/src/monitor.ts`는 세션 저장, pagehide flush, autoCapture가 필요한 경우의 기준 구현이다.
- **공통 규칙**: `source`, `owner`, `runtime`, `build`, `qa_session_id`, `flush/shutdown`은 어느 소비처에서도 같은 규칙으로 맞춘다.
- **온보딩 체크리스트**: 새 Vite 앱에 붙이는 순서는 `sdk-vite-onboarding-guide`가 기준이다.

## qa-bridge의 역할

`qa-bridge`는 `@qa-sdk/sdk` 위에 올린 소비처 로컬 facade다. 플랫폼 코어 레이어가 아니라 앱 레이어의 반복 로직을 묶는 목적이다.

- `QaLogger` 초기화와 transport 선택을 앱 밖으로 숨긴다.
- `newQaSessionId()` + `startTrace()`를 한 API로 묶는다.
- `event_version` 조회와 3자리 패딩 규칙을 공통화한다.
- 테스트에서는 `NoopTransport`와 debug envelope 조회를 쉽게 만든다.

현재 레포에서는 `packages/sdk` 공용 유틸로 올리지 않고, 소비처별 로컬 facade로 유지하는 것을 기본 정책으로 삼는다.

## 메타데이터와 prefix 증명의 차이

`source.service_name`과 `owner.owner_id`는 envelope 메타데이터다. 이 값이 존재한다고 해서 곧바로 prefix 축 값이 증명된 것은 아니다.

- **메타데이터 증명**: `TransmissionEnvelope.source.service_name`, `owner.owner_id`가 채워진다.
- **prefix 증명**: `infra_context.service` 또는 record `address_context.service`에 `service:vX:ADDR`가 들어가고, decode 시 `env/region/svc_name/namespace`가 나온다.
- **overlay 증명**: canonical catalog에 서비스가 아직 없어도, 로컬 browser catalog overlay로는 같은 `service:vX:ADDR`를 만들 수 있다.

현재 bridge는 두 단계를 구분한다.

- `serviceName`, `owner`는 메타데이터를 만든다.
- `serviceConfig`가 있을 때만 `toServiceDims()` + `browserTrack()`으로 `infra_context.service`를 만든다.
- canonical browser catalog에 서비스가 없으면 local overlay를 먼저 씌워 prefix proof를 수행한다.
- overlay 생성조차 불가능한 경우에만 fail-open으로 `infra_context.service`를 생략하고 `onError("infra-context")`로만 알린다.
- 따라서 새 소비처 이름은 로컬에서는 바로 prefix로 증명할 수 있지만, shared decode/registry 정합성이 필요하면 결국 `svc_name` 축 등록이 필요하다.

## 레퍼런스 맵

| 시나리오                  | 레퍼런스                                             | 복사할 포인트                                                                       |
| ------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Vite+ local catalog       | `packages/viteplus-sdk-smoke/src/browser-catalog.ts` | consumer-local service overlay, shared catalog와 분리된 proof artifact              |
| Vite+ 브리지 템플릿       | `packages/viteplus-sdk-smoke/src/qa-bridge.ts`       | `HttpTransport/NoopTransport`, session 시작, event version fallback, debug snapshot |
| Vite+ 최소 소비처         | `packages/viteplus-sdk-smoke/src/smoke.ts`           | 브리지 사용, `NoopTransport`, smoke event/metric 확인                               |
| 브라우저 앱용 얇은 facade | `packages/roleplay-web/src/sdk/qa-bridge.ts`         | `HttpTransport`, event version 조회, `startSession()/flush()/shutdown()` 래핑       |
| 브라우저 자동 수집 SDK    | `packages/browser-sdk/src/monitor.ts`                | session persistence, `pagehide` flush, `emitWithCoords()`, fail-open                |
| API surface 확인          | `packages/sdk/src/index.ts`                          | 실제 export 목록 확인용 SSOT                                                        |

## 최소 소비처 패턴

개발 중 import/번들링 확인만 필요하면 `qa-bridge`에 `NoopTransport`를 주입한다.

```ts
import { NoopTransport } from '@qa-sdk/sdk';
import { createQaBridge } from './qa-bridge';

const bridge = createQaBridge({
  serviceName: 'my-vite-app',
  owner: { owner_type: 'workspace', owner_id: 'my-team' },
  buildEnv: import.meta.env.MODE,
  flushIntervalMs: 0,
  transport: new NoopTransport(),
});

bridge.startSession('smoke');
bridge.emitEvent('sdk_smoke_loaded');
await bridge.shutdown();
```

이 패턴은 네트워크 의존 없이 다음 4가지를 한 번에 검증한다.

1. `@qa-sdk/sdk` import 가능 여부
2. 브라우저 번들 호환 여부
3. trace/session 생성 여부
4. `TransmissionEnvelope` shape 생성 여부

## 브라우저 앱 패턴

실서비스 브라우저 앱은 보통 `QaLogger`를 직접 흩뿌리지 말고 작은 브리지를 둔다. 현재 레포에서 바로 복사할 기준은 `packages/viteplus-sdk-smoke/src/qa-bridge.ts`와 `packages/roleplay-web/src/sdk/qa-bridge.ts`다.

```ts
const transport = new HttpTransport({ endpoint: `${ingestUrl}/v1/ingest` });
const logger = new QaLogger({
  transport,
  owner: { owner_type: 'tenant', owner_id: 'qa-roleplay' },
  source: {
    service_name: 'roleplay-web',
    sdk_name: '@qa-sdk/sdk',
    sdk_version: '0.1.0',
  },
  runtime: { platform: 'browser', os_version: navigator.userAgent },
  build: { env: 'local' },
  flushIntervalMs: 3_000,
  onError,
});
```

권장 이유는 다음과 같다.

- 앱 코드가 `event_version` 조회 규칙을 중복 구현하지 않는다.
- 세션 시작과 종료 API를 한 곳에서 통제할 수 있다.
- 추후 `address_context`, actor, masking 규칙을 facade 내부에서 강제할 수 있다.

## 기대 유저 시나리오

이 가이드는 아래 사용자 흐름을 기준으로 유지한다. 상세 수집 문서는 `platform-sdk-user-scenarios`다.

- **신규 Vite 앱 개발자**: bridge 템플릿을 복사해 import/build smoke를 먼저 통과시킨다.
- **브라우저 제품 개발자**: 앱 내부 로컬 facade를 두고 운영 ingest endpoint만 연결한다.
- **QA 엔지니어**: `NoopTransport` 기반으로 네트워크 없는 회귀 테스트를 작성한다.
- **플랫폼 메인터너**: 자동 수집이 필요해지면 로컬 bridge가 아니라 `@qa-sdk/browser`로 승격한다.

## 브라우저 자동 수집 패턴

세션 저장, `pagehide` flush, autoCapture가 필요하면 `@qa-sdk/browser`를 우선 고려한다. 현재 레포 기준 reference는 `packages/browser-sdk/src/monitor.ts`다.

- `QaLogger` 위에 `BeaconTransport`를 올린다.
- `createQaMonitorAsync()`는 registry에서 받은 catalog 위에도 service overlay를 적용할 수 있다.
- 세션은 storage 기반으로 보존하고 `TraceContext`를 교체한다.
- `emitWithCoords()`는 인코딩 실패 시 coordinate 없이 emit하는 fail-open을 유지한다.
- shutdown 이후 emit/metric/newSession은 경고 후 무시한다.

## 베스트 프랙티스

- **통합 진입점은 `@qa-sdk/sdk`로 고정한다.** 내부 패키지를 직접 조합하지 말고, 소비처 코드는 가능한 한 `@qa-sdk/sdk`만 import한다.
- **`source.service_name`은 소비처 이름, `source.sdk_name`은 패키지 이름으로 둔다.** `service_name`은 앱 정체성, `sdk_name`은 계측 라이브러리 정체성이다.
- **개발/테스트는 `NoopTransport`, 실제 전송은 `HttpTransport` 또는 `@qa-sdk/browser`를 쓴다.** import 확인과 네트워크 검증을 분리해야 디버깅이 쉽다.
- **세션은 `newQaSessionId()`로 만들고 trace 시작 시 주입한다.** 레코드마다 수동으로 `qa_session_id`를 넣기보다 `startTrace()`에서 일괄 연결한다.
- **`event_version`은 3자리 문자열로 맞춘다.** event-catalog를 쓴다면 거기서 조회하고, fallback이 필요하면 `padStart(3, "0")` 규칙을 고정한다.
- **브라우저 UI는 절대 SDK 오류로 죽지 않게 한다.** 자동 수집, 좌표 인코딩, 네트워크 flush는 모두 fail-open이 기본이다.
- **종료 지점에서 `flush()` 또는 `shutdown()`을 명시한다.** 테스트와 페이지 종료 시점에서 버퍼 유실을 막아야 한다.
- **`address_context`는 하드코딩하지 않는다.** 브라우저 쪽은 `browserTrack`, flow 선택 컨텍스트는 전용 builder를 써서 생성한다.
- **현재 모노레포의 Vite+ 소비처는 `catalog:` 의존성에 기대지 않는다.** 이 레포는 pnpm catalog를 쓰지 않으므로 `vite`, `vite-plus` 버전을 명시적으로 pin한다.

## 권장 조합

| 목적                  | 권장 조합                                 |
| --------------------- | ----------------------------------------- |
| import/번들 스모크    | `QaLogger + NoopTransport`                |
| 일반 웹앱 이벤트 전송 | `QaLogger + HttpTransport + facade`       |
| 브라우저 자동 수집    | `@qa-sdk/browser`                         |
| 좌표 인코딩/해석      | `createQaContext()` 또는 `browserTrack()` |
| 회귀 테스트           | `NoopTransport.sent` 검사                 |
