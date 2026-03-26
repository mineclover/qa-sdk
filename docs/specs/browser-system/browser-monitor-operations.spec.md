---
def:
  id: browser-monitor-operations
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  svc: browser-sdk
  tags: [tier-frontend]
  links:
    - target: browser-monitor-spec
      type: refines
    - target: browser-lifecycle-spec
      type: depends_on
---

# 브라우저 모니터 운영 규칙

## 목적 ^purpose

브라우저 monitor의 내부 파라미터, 오류 처리, 빌드 산출물, 사용 예시를 분리해 운영 중 변경 규칙을 정리한다.

## 구성 ^overview

QaMonitor는 고정 내부 파라미터(flush 주기, 타임아웃), fail-open 에러 처리 전략, BeaconTransport 이중 전송 경로를 운영 규칙으로 가진다. 이 규칙들은 SDK 내부 안전장치이며 외부 config로 노출하지 않는다.

## 고정 내부 파라미터

| 파라미터 | 값 | 근거 |
|----------|-----|------|
| `flushIntervalMs` | 5,000ms | QaLogger 주기적 flush 간격 |
| 페이지 언로드 flush | fire-and-forget | pagehide 타이밍에서 await 불가 |
| 텍스트 truncate | 100자 | 클릭 수집 시 textContent 제한 |
| registry fetch 타임아웃 | 5,000ms (catalog-loader) | AbortSignal.timeout(5_000) |
| localStorage 캐시 TTL | 5분 (catalog-loader) | 브라우저 catalog 캐시 만료 |

## 에러 처리 — fail-open 전략

### 좌표 인코딩 실패

`emitWithCoords()` 에서 `browserTrack()` 호출이 실패하면 try-catch로 흡수하고, 좌표 없이 이벤트를 발행한다. **이벤트 유실보다 좌표 누락이 낫다**.

### registry fetch 실패

`createQaMonitorAsync()` 에서 registry catalog fetch가 실패하면 `console.warn` 후 정적 `BROWSER_CATALOG` fallback으로 동기 생성한다. fetch 실패가 모니터 생성을 차단하지 않는다.

### infraContext 생성 실패

`serviceConfig`로 infraContext 자동 생성 시 `BROWSER_CATALOG`에 service prefix가 없으면 try-catch로 흡수한다.

### Transport 전송 실패

- `BeaconTransport`: `sendBeacon` 실패 시 `fetch(keepalive)` fallback
- `fetch` 실패 시 throw — QaLogger가 onError 콜백으로 전파
- onError 미설정 시 `console.error` 기본 동작

### stopped 상태 호출

`emit()`, `metric()`, `newSession()` 을 stopped 상태에서 호출하면 `console.warn` 후 무시한다. 앱 크래시를 유발하지 않는다.

## BeaconTransport — 이중 전송 경로

```
navigator.sendBeacon (우선)
  ├── 성공 → 완료
  └── 실패 (payload 초과 등)
        └── fetch(keepalive) fallback
              ├── 성공 → 완료
              └── 실패 → throw Error
```

- `sendBeacon`: Blob(`application/json`) 방식. 페이지 언로드 타이밍에서도 동작
- `fetch(keepalive: true)`: sendBeacon 미지원 환경이나 payload 크기 초과 시 fallback
- 두 경로 모두 `Content-Type: application/json`

## 빌드 산출물

`@qa-sdk/browser-sdk` 패키지의 index.ts는 단일 번들(`qa-browser-sdk.js`)로 전체 기능을 제공한다.

- QaMonitor + Transport + Session
- ID 생성 유틸 (`newTraceId`, `newQaSessionId` 등)
- 좌표 인코딩 (`encode`, `decode`, `track`, `decodeContext`)
- `BROWSER_CATALOG` 정적 사본

## 사용 예시

```typescript
// 동기 생성 — 정적 catalog 사용
const monitor = createQaMonitor({
  ingestUrl: "http://localhost:3200",
  autoCapture: { clicks: true, navigation: true },
});

// 비동기 생성 — registry에서 최신 catalog fetch
const monitor = await createQaMonitorAsync({
  ingestUrl: "http://localhost:3200",
  registry: "http://localhost:3300",
  serviceConfig: { /* ServiceBootConfig */ },
});

// 좌표 인코딩 + 이벤트 발행
monitor.emitWithCoords("page.home", {
  page_view: { page: "home", locale: "ko", userType: "member" },
  tracking: { trackAction: "view", page: "home", userType: "member" },
});

// 종료
await monitor.shutdown();
```

## createQaMonitorAsync 상세 경로

```
createQaMonitorAsync(config)
  ├─ config.registry 있으면:
  │   └─ loadBrowserCatalog({ registryUrl, cacheKey })
  │       ├─ localStorage 캐시 확인 (TTL 5분)
  │       ├─ 캐시 히트 → 캐시된 catalog 사용
  │       └─ 캐시 미스 → fetch(registryUrl, { signal: AbortSignal.timeout(5_000) })
  │           ├─ 성공 → catalog + localStorage 캐시 저장
  │           └─ 실패 → console.warn + 정적 BROWSER_CATALOG fallback
  ├─ serviceConfig + catalog → infraContext 재계산
  │   └─ browserTrack(loadedCatalog, { service: serviceDims })
  └─ new QaMonitor(config)
```

- `cacheKey`: `qa-catalog-${catalogId ?? "demo"}`
- catalog fetch 실패가 모니터 생성을 차단하지 않음 (fail-open)
- infraContext는 serviceConfig가 있고 명시적 infraContext가 없을 때만 자동 생성

## 이벤트 버전 자동 조회

`emit(eventKey)` 호출 시 `getCoreEvent(eventKey)` (event-catalog)로 등록된 이벤트 정의를 조회한다.

- 등록된 이벤트: `event_version`을 3자리 zero-pad (`"1"` → `"001"`)
- 미등록 이벤트: `event_version = "001"` (기본)

## Actor 설정 흐름

```
setUser({ actorId, userId?, attributes? })
  → logger.setActor({
      actor_id: actorId,
      user_id: userId ?? actorId,
      identification_mode: "identified",
      user_attributes: attributes,
    })
  → 이후 모든 이벤트에 actor 정보 자동 포함

clearUser()
  → logger.clearActor()
  → 이후 이벤트에서 actor 정보 제거
```
