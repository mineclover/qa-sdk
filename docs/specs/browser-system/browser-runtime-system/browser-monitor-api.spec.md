---
def:
  tier: component
  id: browser-monitor-api
  address: def_document:v2:412803
  scope: interface
  aspect: api_contract
  depth: specification
  lifecycle: approved
  layer: mediation
  svc: browser-sdk
  tags: [observability, contract, entry-point]
  links:
    - target: browser-runtime-system
      type: refines
---

# 브라우저 모니터 API

## 목적 ^purpose

`@qa-sdk/browser` 패키지의 공개 API, config, 초기화 순서를 분리해 브라우저 monitor의 단일 진입점 계약을 정리한다.

## 구성 ^overview

`QaMonitor` 클래스가 브라우저 모니터링의 단일 진입점이다. 동기 생성(`createQaMonitor`), 비동기 생성(`createQaMonitorAsync`), 이벤트 발행(`emit`, `emitWithCoords`), 메트릭 기록(`metric`), 세션 관리(`newSession`, `getSession`), 사용자 식별(`setUser`, `clearUser`), 전송 제어(`flush`, `shutdown`)를 제공한다.

## 생성자 — QaMonitorConfig

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `ingestUrl` | `string` | Y | ingest-server URL |
| `serviceConfig` | `ServiceBootConfig` | N | 통합 서비스 설정 (meta보다 우선) |
| `owner` | `{ owner_type, owner_id }` | N | 엔벨로프 소유자. 기본 `browser-monitor` |
| `scenarioId` | `string` | N | session_start payload에 포함할 시나리오 ID |
| `autoCapture` | `AutoCaptureConfig` | N | 자동 수집 설정 (clicks, forms, navigation) |
| `storageKey` | `string` | N | sessionStorage 키 prefix. 기본 `"qa_monitor"` |
| `onError` | `(err, ctx) => void` | N | 에러 핸들러 |
| `infraContext` | `Record<string, string>` | N | 엔벨로프 전체 인프라 주소 컨텍스트 |
| `entrySnapshot` | `string` | N | 배포 시점 entry snapshot ID |
| `registry` | `string` | N | registry URL — 최신 BROWSER_CATALOG API fetch |
| `catalogId` | `string` | N | catalog ID (registry 모드). 기본 `"demo"` |

## 초기화 순서

1. **세션 복원/생성** — `getOrCreateSession(storageKey)` → sessionStorage에서 복원 또는 신규 발급
2. **Transport 생성** — `BeaconTransport(ingestUrl + "/v1/ingest")`
3. **source/build 결정** — `serviceConfig` → `toTransmissionSource()` / `toTransmissionBuild()` 또는 meta fallback
4. **infraContext 계산** — `serviceConfig` 존재 시 `browserTrack(BROWSER_CATALOG, { service: serviceDims })` 자동 생성
5. **QaLogger 초기화** — transport, owner, source, runtime, build, flushInterval(5초) 주입
6. **TraceContext 연결** — `trace_id`, `qa_session_id` 설정
7. **시나리오 시작** — `scenarioId` 있으면 `session_start` 이벤트 자동 발행
8. **자동 수집** — `autoCapture` 설정 시 `createAutoCapture()` 호출 + infraContext 자동 주입
9. **pagehide 리스너** — 페이지 언로드 시 fire-and-forget flush

## 공개 메서드

| 메서드 | 설명 |
|--------|------|
| `emit(eventKey, payload?, options?)` | 수동 이벤트 발행. event-catalog에서 버전 자동 조회 |
| `emitWithCoords(eventKey, prefixes, payload?)` | 좌표 인코딩 + 이벤트 발행 원샷 |
| `metric(name, value, opts?)` | 메트릭 이벤트 기록 |
| `setUser(opts)` | 행위 주체 설정 (actor_id, user_id) |
| `clearUser()` | Actor 해제 (로그아웃) |
| `getSession()` | 현재 세션 정보 복사본 반환 |
| `newSession()` | 세션 초기화 + 새 sessionId/traceId 발급 |
| `flush()` | 버퍼 즉시 전송 |
| `shutdown()` | ACTIVE → STOPPED 전환. 리스너 제거 + 버퍼 전송 + 타이머 정리 |

## 비동기 생성 — createQaMonitorAsync

`registry` URL이 설정되면 `loadBrowserCatalog()` 으로 최신 BROWSER_CATALOG를 API에서 fetch한다. 실패 시 콘솔 경고 후 정적 BROWSER_CATALOG fallback으로 동기 생성한다.

## 공개 export (index.ts)

- `QaMonitor`, `createQaMonitor`, `createQaMonitorAsync`, `BeaconTransport`
- 타입: `QaMonitorConfig`, `AutoCaptureConfig`, `MonitorSession`, `MonitorStatus`
- ID 생성: `newTransmissionId`, `newLogId`, `newTraceId`, `newSpanId`, `newQaSessionId`
- 좌표 인코딩: `encode`, `decode`, `track`, `decodeContext`, `BROWSER_CATALOG`
