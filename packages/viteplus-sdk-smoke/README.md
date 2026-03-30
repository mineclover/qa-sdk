# @qa-sdk/viteplus-sdk-smoke

Vite+로 생성한 최소 `qa-sdk` 소비처 레퍼런스.

이 패키지는 실제 제품 앱이 아니라, 현재 모노레포에서 다음이 성립하는지 빠르게 확인하는 용도다.

- `@qa-sdk/sdk`가 Vite+ 브라우저 앱에서 바로 import된다.
- `QaLogger + NoopTransport` 조합으로 `TransmissionEnvelope`가 생성된다.
- `newQaSessionId()`와 `startTrace()`가 브라우저 번들에서 정상 동작한다.
- `vp dev`, `vp build`, `vitest` 기준이 통과한다.

## 실행

```bash
pnpm install --filter @qa-sdk/viteplus-sdk-smoke...
pnpm --filter @qa-sdk/viteplus-sdk-smoke dev
pnpm --filter @qa-sdk/viteplus-sdk-smoke test
pnpm --filter @qa-sdk/viteplus-sdk-smoke build
```

기본 dev 서버 포트는 `5224`다.

## 핵심 파일

- `src/browser-catalog.ts`: 소비처 로컬 browser catalog overlay
- `src/qa-bridge.ts`: Vite 앱에서 복사해 쓸 최소 QA bridge template
- `src/smoke.ts`: 최소 SDK 초기화 reference
- `src/main.ts`: 생성된 엔벨로프를 화면에 표시하는 데모
- `src/features/canonical-review/**`: implementation-convention 책임 분리를 적용한 canonical feature
- `src/features/incident-escalation/**`: 같은 템플릿에서 파생한 두 번째 feature
- `src/features/shared/**`: 두 feature가 재사용하는 state/store/dom helper
- `src/smoke.test.ts`: `NoopTransport.sent` 기반 회귀 테스트
- `src/qa-bridge.test.ts`: bridge session/transport/fallback 규칙 검증
- `src/features/canonical-review/CanonicalReviewExample.test.ts`: invalid focus, success, reopen, reset 검증
- `src/features/incident-escalation/IncidentEscalationExample.test.ts`: second feature orchestration 검증

## 무엇을 복사할 것인가

- 새 소비처를 붙일 때는 `src/browser-catalog.ts`와 `src/qa-bridge.ts`를 같이 가져간다.
- 자동화를 쓰면 `qa-sdk init --vite-consumer <path>`로 같은 템플릿을 넣을 수 있다.
- 새 소비처를 붙일 때는 `src/qa-bridge.ts`를 먼저 복사하고, `src/smoke.ts`는 검증용 샘플로 쓴다.
- feature 구조 참고가 필요하면 `src/features/canonical-review/**`를 읽고, app-local feature 폴더에 같은 책임 분리를 적용한다.
- 실전 앱에서는 `NoopTransport`를 `HttpTransport` 또는 `@qa-sdk/browser`로 교체한다.
- `source.service_name`, `owner.owner_id`, `build.env`, `event_key`는 소비처 성격에 맞게 바꾼다.

## 무엇을 그대로 쓰면 안 되는가

- `owner_id: "qa-sdk"`는 스모크 전용 값이다.
- `event_key: "sdk_smoke_loaded"`는 레퍼런스 확인용이다.
- 네트워크 전송이 필요한 앱에서 `NoopTransport`를 그대로 쓰면 안 된다.

## 현재 모노레포 주의사항

Vite+ 기본 스캐폴드는 `vite: "catalog:"`, `vite-plus: "catalog:"` 의존성을 생성할 수 있다. 현재 qa-sdk 모노레포는 pnpm catalog를 사용하지 않으므로, 새 소비처는 버전을 명시적으로 pin해야 한다.

## 관련 문서

- `docs/guides/sdk-usage-guide.md`
- `docs/guides/sdk-vite-onboarding-guide.md`
- `docs/specs/platform-chain/platform-sdk-user-scenarios.spec.md`
- `docs/specs/viteplus-sdk-smoke/viteplus-sdk-smoke.md`
