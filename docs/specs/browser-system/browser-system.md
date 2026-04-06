---
def:
  id: browser-system
  level: module
  address: def_document:v2:412674
  scope: interface
  aspect: api_contract
  depth: overview
  lifecycle: approved
  layer: operation
  svc: shopping-web
  tags: [structural, entry-point]
  links:
    - target: browser-runtime-system
      type: contains
    - target: browser-transport-spec
      type: contains
    - target: browser-lifecycle-system
      type: contains
    - target: trace-context-spec
      type: contains
    - target: shop-web-spec
      type: contains
    - target: ingest-system
      type: depends_on
---

## 목적 ^purpose

브라우저 SDK의 이벤트 수집, 세션 관리, 생명주기, 전송을 담당하는 클라이언트 시스템.

## 구성 ^overview

- `browser-runtime-system`: opt-in DOM 자동 수집과 monitor 초기화/오류 처리 규칙을 묶은 그룹.
- `browser-transport-spec`: 브라우저 언로드 타이밍에서도 이벤트를 누락하지 않는 전송 구현체.
- `browser-lifecycle-system`: QaMonitor의 상태 전이와 세션 사용 패턴을 분리한 그룹.
- `trace-context-spec`: trace_id, span stack, qa_session_id를 관리하는 런타임 컨텍스트 객체.

## 운영 개요

### SDK 정체성

- 패키지: `@qa-sdk/browser-sdk`
- browser-sdk는 범용 SDK — 특정 도메인 prefix/데이터가 들어가면 안 됨
- ownedPrefixes는 SDK가 아닌 **사용하는 서비스**가 선언

### 서비스 의존

```
QaMonitor (브라우저)
  → ingest-server (BeaconTransport → POST /v1/ingest)
  → registry-service (createQaMonitorAsync 시 BROWSER_CATALOG fetch, 선택적)
```

### 생성 경로 2가지

| 함수 | 동기/비동기 | catalog | 적합 환경 |
|------|-----------|---------|----------|
| `createQaMonitor(config)` | 동기 | 정적 `BROWSER_CATALOG` | 빌드 시점 catalog 확정 |
| `createQaMonitorAsync(config)` | 비동기 | registry fetch → fallback 정적 | 최신 catalog 필요 시 |

### 에러 처리 전략 요약

| 실패 지점 | 처리 | 근거 |
|-----------|------|------|
| 좌표 인코딩 | try-catch → 좌표 없이 emit | 이벤트 유실보다 좌표 누락이 낫다 |
| registry fetch | console.warn → 정적 fallback | fetch 실패가 모니터 생성 차단 금지 |
| infraContext 생성 | try-catch → 무시 | BROWSER_CATALOG에 service prefix 없을 수 있음 |
| BeaconTransport | sendBeacon → fetch(keepalive) fallback | 이중 경로 |
| stopped 상태 호출 | console.warn → 무시 | 앱 크래시 방지 |

### 공개 export

`@qa-sdk/browser-sdk` 단일 번들로 전체 기능 제공:
- QaMonitor + Transport + Session
- ID 생성 (`newTraceId`, `newQaSessionId` 등)
- 좌표 인코딩 (`encode`, `decode`, `track`, `decodeContext`)
- `BROWSER_CATALOG` 정적 사본
- `ServiceBootConfig` 파생 유틸 (`toTransmissionSource`, `toTransmissionBuild`, `toServiceDims`)
