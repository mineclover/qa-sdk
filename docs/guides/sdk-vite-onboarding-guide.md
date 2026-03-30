---
def:
  id: sdk-vite-onboarding-guide
  scope: flow
  aspect: user_scenario
  depth: overview
  lifecycle: approved
  layer: mediation
  tags: [entry-point]
  links:
    - target: guides-system
      type: refines
    - target: sdk-usage-guide
      type: depends_on
    - target: platform-sdk-user-scenarios
      type: depends_on
---

# Vite 소비처 온보딩 체크리스트

## 목적 ^purpose

`vp create` 또는 `create-vite`로 새 앱을 만든 뒤, `qa-sdk` 소비처를 현재 모노레포 규칙에 맞게 붙이는 절차를 체크리스트로 고정한다. 신규 프론트엔드 개발자가 import/build smoke, 로컬 facade, 운영 ingest 연결을 같은 순서로 수행하도록 한다.

## 구성 ^overview

- **스캐폴드 직후 정리**: 패키지명, 의존성, `catalog:` 정리
- **bridge 복사**: `viteplus-sdk-smoke/src/qa-bridge.ts`를 기준으로 시작
- **local catalog overlay**: `viteplus-sdk-smoke/src/browser-catalog.ts`로 소비처별 service proof를 고정
- **smoke 연결**: `NoopTransport`로 네트워크 없는 검증 먼저 통과
- **운영 연결**: 필요 시 `HttpTransport`와 ingest endpoint를 연결
- **승격 판단**: autoCapture가 필요하면 `@qa-sdk/browser`로 이동

## 체크리스트

### 1. 패키지 스캐폴드 정리

- 가능하면 먼저 CLI helper를 사용한다.

```bash
qa-sdk init --vite-consumer packages/my-web --service-name my-web --owner-id frontend-team --build-env local
```

- 이 명령은 `src/sdk/qa-bridge.ts`, `src/sdk/qa-bridge.test.ts`, `package.json` 의존성/`test` 스크립트를 보강한다.
- 패키지명은 `@qa-sdk/*` 스코프로 맞춘다.
- `vite`, `vite-plus` 의존성이 `catalog:`로 들어오면 버전을 명시적으로 pin한다.
- `tsconfig`는 루트 설정을 따르되 `rootDir`, `outDir`, `noEmit` 등 앱 기준으로 override한다.
- `pnpm install --filter <pkg>...`가 통과하는지 먼저 확인한다.

### 2. bridge 템플릿 복사

- CLI helper를 쓰지 않는 경우에만 이 단계를 수동으로 수행한다.
- `packages/viteplus-sdk-smoke/src/qa-bridge.ts`를 앱 내부 `src/sdk/qa-bridge.ts` 같은 위치로 복사한다.
- `packages/viteplus-sdk-smoke/src/browser-catalog.ts`를 앱 내부 `src/sdk/browser-catalog.ts`로 함께 복사한다.
- 첫 버전은 bridge를 공용 SDK로 올리지 말고 앱 내부에 둔다.
- 앱 값으로 바꿔야 하는 것은 `serviceName`, `owner`, `buildEnv`, `ingestUrl`뿐이다.

### 3. 네트워크 없는 smoke 먼저 만들기

- `NoopTransport`를 주입한다.
- `startSession()`, `emitEvent()`, `shutdown()`만 연결한다.
- `getDebugEnvelopes()`로 event key, version, session id가 나오는지 본다.
- prefix 라이프사이클까지 확인하려면 catalog에 존재하는 `serviceConfig`를 넣고 `infra_context.service`를 decode한다.

권장 이유:

- import 문제와 ingest 문제를 분리할 수 있다.
- `event_version` padding, trace/session 생성이 먼저 검증된다.
- QA 회귀 테스트에서 같은 bridge를 그대로 재사용할 수 있다.

### 4. 기본 검증

다음 3개가 통과해야 다음 단계로 넘어간다.

```bash
pnpm --filter <pkg> test
pnpm --filter <pkg> build
pnpm --filter <pkg> dev
```

완료 기준:

- 브라우저에서 앱이 뜬다.
- `@qa-sdk/sdk` import가 번들 단계에서 깨지지 않는다.
- `NoopTransport` 엔벨로프가 테스트에서 검증된다.

### 5. 운영 ingest 연결

실제 전송이 필요해지면 이 단계로 간다.

- bridge의 `transport`를 `HttpTransport`로 바꾼다.
- endpoint는 `<ingestUrl>/v1/ingest` 규칙으로 정규화한다.
- `source.service_name`, `owner.owner_id`, `build.env`를 실제 앱 값으로 바꾼다.
- `serviceConfig`를 넣으면 local browser overlay를 통해 `infra_context.service`까지 함께 남길 수 있다.
- shared catalog/registry에서도 같은 서비스명을 canonical하게 decode해야 할 때만 `svc_name` 축 entry를 추가한다.

```bash
qa-sdk dkg add-entry svc_name my-web --apply
```

- 현재 demo 카탈로그는 `packages/demo-snapshot/src/demo-catalog.ts`의 특수 파생 체인을 쓰므로, `--apply`만으로 TS 원본이 자동 갱신되지는 않는다. shared catalog 반영이 필요하면 별도 카탈로그 파일에 기록하거나 catalog 관리 전략을 먼저 정한다.
- UI 레이어는 계속 bridge API만 호출하고 `QaLogger`는 직접 만지지 않는다.

### 6. browser SDK로 승격할 시점 판단

아래가 하나라도 필요하면 로컬 bridge에서 멈추지 말고 `@qa-sdk/browser`를 고려한다.

- session persistence
- `pagehide` best-effort flush
- autoCapture
- `emitWithCoords()`
- shutdown 이후 생명주기 상태 관리

## 흔한 실수

- `QaLogger`를 화면 컴포넌트 여러 군데서 직접 생성한다.
- `event_version`을 raw 문자열로 흩뿌린다.
- 네트워크 검증 전에 `HttpTransport`부터 붙인다.
- `address_context`를 문자열로 하드코딩한다.
- Vite 스캐폴드가 만든 `catalog:` 의존성을 그대로 둔다.

## 관련 문서

- `sdk-usage-guide`: reference map과 베스트 프랙티스
- `platform-sdk-user-scenarios`: 어떤 사용자 흐름을 기준으로 이 절차를 유지하는지
- `packages/viteplus-sdk-smoke/README.md`: 복사 원본 패키지 설명
