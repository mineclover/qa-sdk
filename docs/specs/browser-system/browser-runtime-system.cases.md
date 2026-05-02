---
def:
  id: browser-runtime-system-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: operation
  svc: browser-sdk
  tags: [scenario, browser, runtime]
  links:
    - target: browser-runtime-system
      type: refines
    - target: browser-system
      type: depends_on
---

# 브라우저 런타임 그룹 — 소비자 기대 시나리오

## 목적 ^purpose

`browser-runtime-system`(자동 수집, monitor 초기화, codec 계약)이 `browser-system`에 의존할 때 기대하는 계약. 런타임 그룹은 browser-system이 제공하는 공개 API 진입점, transport, 좌표 인코딩 규칙이 opt-in 모드에서도 누수 없이 구성되어야 동작한다.

## 시나리오 1: opt-in 자동 수집 활성화 ^overview

**전제**: `browser-system`이 `browser-runtime-system`의 `browser-capture-contract`로 DOM 이벤트 자동 수집을 opt-in 모드로 제공한다.

**동작**: 앱이 `createQaMonitor({ autoCapture: true, scopes: ["click","submit"] })`로 초기화한다.

**기대**:
- 해당 scope 외 이벤트(예: mousemove)는 수집 대상 아님
- cleanup 함수가 monitor.stop() 호출 시 등록된 리스너를 전부 해제
- `autoCapture: false` (기본) → 런타임이 리스너 등록 자체를 수행하지 않음

**실패 시 수정 대상**: `browser-system.md`가 참조하는 `browser-capture-contract` — opt-in 기본값과 scope whitelist 구조가 browser-system 공개 문서에 명시되지 않으면 런타임이 수집 범위를 로컬에서 결정.

## 시나리오 2: monitor 초기화 오류 격리 ^overview

**전제**: `browser-system.md` §"에러 처리 전략 요약"이 "좌표 인코딩 실패 → 좌표 없이 emit"을 규정한다.

**동작**: registry에서 가져온 BROWSER_CATALOG에 axis 하나가 누락된 상태로 `createQaMonitorAsync`가 catalog hydration 중 encode 실패를 만난다.

**기대**:
- monitor 인스턴스는 생성 성공 (throw 아님)
- 실패한 이벤트는 좌표 없이 raw payload로 큐잉
- console.warn 또는 logger.warn로 한 번만 경고 (스팸 금지)

**실패 시 수정 대상**: `browser-system.md` §"에러 처리 전략 요약" — 좌표 실패 fallback 행동이 "emit" 인지 "drop+metric" 인지 정의. 런타임이 독자 결정하면 UI 크래시 방지 규칙과 충돌.

## 시나리오 3: codec 버전 해결 ^overview

**전제**: `browser-system`이 `browser-codec` 문서를 통해 `@qa-sdk/browser-codec`의 `track()` 래퍼 사용을 필수 규정한다 (인라인 encode 금지).

**동작**: 런타임이 이벤트 emit 전에 `track(prefix, version, payload)` 를 호출한다.

**기대**:
- 최신 prefix version은 `latestPrefixVersion(catalog, prefixId)` 기반 동적 조회 (하드코딩 `"v1"` 금지)
- version 미지정 호출 → catalog의 최신 approved version 자동 주입
- catalog에서 prefix 미정의 → reserved 처리 + warning 1회

**실패 시 수정 대상**: `browser-system.md`의 `browser-codec` 계약 — version 해결 책임(monitor vs track)을 명시. 런타임이 하드코딩 version 호출을 허용하면 CON-006 위반 경로가 생김.

## 시나리오 4: monitor API 공개 표면 안정성 ^overview

**전제**: `browser-system`이 `browser-monitor-api` 문서로 `QaMonitor` public 인터페이스를 고정한다 (track/setUser/identify/flush/stop).

**동작**: 런타임의 형제 컴포넌트(session-patterns, capture-contract)가 monitor 인스턴스 메서드를 소비한다.

**기대**:
- 메서드 시그니처 breaking change 시 `browser-system`이 먼저 major version bump
- 새 메서드 추가 시 기존 runtime 소비 경로는 빌드 성공
- deprecated 메서드는 최소 한 minor 버전 유지 + console.warn

**실패 시 수정 대상**: `browser-system.md` §"SDK 정체성" — QaMonitor 공개 API 표면을 SemVer 규칙과 함께 명문화. 표면 안정성 선언이 없으면 런타임 소비 코드가 방어적 구현으로 오염.
