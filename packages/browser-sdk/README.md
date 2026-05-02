# @qa-sdk/browser

`@qa-sdk/browser`는 브라우저 자동 수집 SDK다. 사용법보다 먼저 `browser-system`과 하위 계약 문서를 읽는 편이 좋다.

## 먼저 볼 문서

- [browser-system.md](../../docs/specs/browser-system/browser-system.md) — 전체 진입점
- [monitor.spec.md](../../docs/specs/browser-system/browser-runtime-system/browser-monitor-api.spec.md) — QaMonitor API
- [lifecycle.spec.md](../../docs/specs/browser-system/browser-lifecycle-system/browser-lifecycle-states.spec.md) — 상태 전이 규칙
- [session.spec.md](../../docs/specs/browser-system/browser-lifecycle-system/browser-session-patterns.spec.md) — 세션 저장/복원
- [transport.spec.md](../../docs/specs/browser-system/browser-runtime-system/browser-capture-contract.spec.md) — 자동 수집/전송 관련 계약
- [auto-capture.spec.md](../../docs/specs/browser-system/browser-runtime-system/browser-monitor-operations.spec.md) — 런타임 동작 표면

## 패키지 역할

- QaMonitor, session, transport, auto-capture를 단일 브라우저 번들로 제공한다.
- 좌표 인코딩 실패는 fail-open으로 처리해 이벤트 유실보다 좌표 누락을 우선한다.
- 서비스별 ownedPrefixes는 이 패키지가 아니라 consumer 서비스가 선언한다.

## 코드 진입점

- `src/index.ts` — public export
- `src/monitor.ts` — QaMonitor
- `src/session.ts` — 세션 관리
- `src/transport.ts` — 전송 구현
- `src/auto-capture.ts` — DOM 자동 수집
- `src/types.ts` — 브라우저 SDK 타입

## 실행

```bash
pnpm --filter @qa-sdk/browser build
pnpm --filter @qa-sdk/browser test
```
