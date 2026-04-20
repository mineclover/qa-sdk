---
def:
  id: browser-lifecycle-system-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: browser-sdk
  tags: [scenario, browser, lifecycle]
  links:
    - target: browser-lifecycle-system
      type: refines
    - target: browser-system
      type: depends_on
---

# 브라우저 생명주기 그룹 — 소비자 기대 시나리오

## 목적 ^purpose

`browser-lifecycle-system`(QaMonitor 상태 전이, 세션 사용 패턴)이 `browser-system`에 의존할 때 기대하는 계약. lifecycle 그룹은 browser-system이 제공하는 monitor factory, transport 포트, trace 컨텍스트가 세션 경계와 상태 전이에 일관된 결과를 보장해야 동작한다.

## 시나리오 1: monitor 생성 경로 2종의 catalog 해결 ^overview

**전제**: `browser-system`이 `createQaMonitor` (동기 / 정적 BROWSER_CATALOG) 와 `createQaMonitorAsync` (비동기 / registry fetch + fallback) 두 진입점을 노출한다.

**동작**: lifecycle 컴포넌트가 앱 부팅 시점에 monitor 인스턴스 하나를 생성하여 세션 전체 수명에서 재사용한다.

**기대**:
- 동기 경로 → 첫 이벤트 emit까지 catalog fetch 왕복 없음
- 비동기 경로 → fetch 실패 시 fallback 정적 catalog 로드, throw 없음
- 두 경로 모두 동일한 QaMonitor public 메서드 표면 반환 (track/setUser/flush)

**실패 시 수정 대상**: `browser-system.md` §"생성 경로 2가지" — 동기/비동기 진입점의 catalog 공급 책임과 fallback 정책이 분명해야 lifecycle 재시도 로직이 중복되지 않는다.

## 시나리오 2: 세션 전이 중 이벤트 유실 금지 ^overview

**전제**: `browser-system`이 BeaconTransport로 unload 타이밍 전송을 보장한다고 선언한다.

**동작**: 사용자가 탭을 닫거나 SPA 라우트 변경으로 pagehide가 발생한 직후 `QaMonitor.flush` 또는 session-end hook이 호출된다.

**기대**:
- 큐에 남은 이벤트가 beacon POST `/v1/ingest` 로 전송됨 (성공/실패 무관하게 drain)
- 세션 ID(qa_session_id)가 마지막 이벤트까지 유지
- unload 이후 생성된 새 세션은 신규 qa_session_id 할당

**실패 시 수정 대상**: `browser-system.md` §"에러 처리 전략 요약" — 좌표 인코딩 실패 시 "좌표 없이 emit"을 허용하는 규칙이 lifecycle 전이 시점 flush 의미를 포섭해야 한다.

## 시나리오 3: trace-context 재진입 안정성 ^overview

**전제**: `browser-system`이 `trace-context-spec`(trace_id / span stack / qa_session_id)을 thread-local 유사 런타임 컨텍스트로 제공한다.

**동작**: 세션 안에서 비동기 작업(setTimeout, Promise chain)을 통해 발생한 후속 이벤트가 lifecycle 리스너로 유입된다.

**기대**:
- 비동기 경계를 넘어도 동일 trace_id 유지
- span stack이 시작/종료 쌍을 유지 (dangling span → warning but not crash)
- 같은 tick 안의 병렬 emit도 직렬 순서대로 span 기록

**실패 시 수정 대상**: `browser-system.md`의 `trace-context-spec` — 비동기 경계 전파 방식(explicit pass vs zone) 명문화. lifecycle 레이어에서 독자 구현하면 다중 진입점에서 drift 발생.

## 시나리오 4: ownedPrefixes 위임 규약 ^overview

**전제**: `browser-system`이 "browser-sdk는 범용 SDK — 특정 도메인 prefix/데이터가 들어가면 안 됨. ownedPrefixes는 사용하는 서비스가 선언"을 규정한다.

**동작**: lifecycle 리스너가 session start/end 이벤트에 도메인 prefix를 부여해야 하는 상황.

**기대**:
- monitor config에 ownedPrefixes 주입 인자가 존재
- 미주입 시 prefix 없는 raw 이벤트로 emit (reserved 처리 허용, CON-006)
- 런타임 도중 ownedPrefixes 변경은 새 세션부터 반영

**실패 시 수정 대상**: `browser-system.md` §"SDK 정체성" — ownedPrefixes 주입 API 시그니처 명시. monitor 내부 하드코딩은 SDK 범용성 위반.
