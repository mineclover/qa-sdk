---
def:
  id: browser-lifecycle-spec
  address: def_document:v2:206976
  scope: state
  aspect: system_state
  depth: specification
  lifecycle: deprecated
  layer: operation
  svc: shopping-web
  tags: [tier-frontend]
  links:
    - target: trace-context-spec
      type: depends_on
---
# 브라우저 모니터링 SDK — 표준 생명주기

## 목적 ^purpose

QaMonitor의 상태 전환 규칙, 각 단계의 계약, 올바른 사용 패턴을 정의한다.

## 상태

implemented

---

## 상태 다이어그램

```
                    createQaMonitor()
                          │
                          ▼
                     ┌─────────┐
             ┌──────▶│ ACTIVE  │◀──────┐
             │       └────┬────┘       │
             │            │            │
        newSession()   shutdown()   (생성 시)
             │            │
             │            ▼
             │       ┌─────────┐
             └───────│ STOPPED │
                     └─────────┘
```

### 상태 정의

| 상태 | 설명 |
|---|---|
| `"active"` | 이벤트 수집 중. emit, autoCapture, 자동 flush 모두 동작. |
| `"stopped"` | 종료됨. emit은 경고 후 무시, flush는 no-op, newSession은 경고 후 무시. |

```typescript
monitor.status    // "active" | "stopped"
monitor.isActive  // status === "active" 의 boolean 단축형
```

---

## 단계별 계약

### Phase 1 — INIT (`createQaMonitor()`)

```typescript
const monitor = createQaMonitor({
  ingestUrl: "http://localhost:3100",
  scenarioId: "checkout_v1",       // optional
  autoCapture: { clicks: true },   // optional
  meta: { serviceName: "my-app", env: "production" },
});
```

**보장:**
- `sessionStorage`에서 세션 복원 또는 신규 생성
- `BeaconTransport` + `QaLogger` (flush 5초 주기) 초기화
- `scenarioId` 제공 시 `session_start` 이벤트 즉시 버퍼 추가
- `autoCapture` 제공 시 DOM 이벤트 리스너 등록
- `pagehide` 리스너 등록 (언로드 시 flush)
- 반환 직후 `status === "active"`

---

### Phase 2 — ACTIVE (정상 수집)

```typescript
monitor.emit("item_added_to_cart", { productId: "p_001" });
```

**Flush 발동 조건:**

| 트리거 | 동작 |
|---|---|
| 버퍼 50개 도달 | 즉시 자동 flush (batch) |
| 5초 인터벌 | 자동 flush (interval) |
| `monitor.flush()` 명시 호출 | 즉시 flush, 실패 시 throw |
| `pagehide` 이벤트 | fire-and-forget flush (언로드 타이밍) |
| `monitor.shutdown()` | flush 후 STOPPED 전환 |

**오류 처리:**
- 자동 flush(batch/interval) 실패 → `onError` 콜백 (미지정 시 `console.error`)
- 실패한 레코드는 버퍼에 재삽입 (버퍼 상한까지)
- `monitor.flush()` 명시 호출 실패 → throw (호출자가 처리)

---

### Phase 3 — SESSION_CHANGE (`newSession()`)

```typescript
// 로그아웃, 시나리오 전환, 사용자 교체 등
const { sessionId, traceId } = monitor.newSession();
```

**보장:**
- `sessionStorage` 초기화 → 신규 sessionId / traceId 생성 및 저장
- `QaLogger`의 `TraceContext` 교체 — 이후 emit은 새 세션 컨텍스트 사용
- `status`는 `"active"` 유지
- 반환값 = 새 세션 (이전 세션 복구 불가)
- `stopped` 상태에서 호출 시: 경고(`console.warn`) 후 현재 세션 반환, storage 변경 없음

---

### Phase 4 — SUSPEND (`pagehide` / bfcache)

**자동 처리 — 개발자가 별도로 처리할 필요 없음.**

```
pagehide 발생
  └─ logger.flush() fire-and-forget
       └─ BeaconTransport.send() (sendBeacon 또는 fetch keepalive)
```

- 모니터 인스턴스는 메모리에 유지 (bfcache 복원 시 재사용 가능)
- `pageshow` 이벤트 복귀 시 별도 처리 불필요 — 리스너가 유지되어 있으므로 자동 재개
- `status`는 변경되지 않음

---

### Phase 5 — STOP (`shutdown()`)

```typescript
await monitor.shutdown();
```

**보장:**
- `autoCapture` DOM 리스너 즉시 제거
- `pagehide` 리스너 즉시 제거
- `QaLogger.shutdown()` 호출: setInterval 정리 → 남은 버퍼 flush → transport.shutdown()
- 완료 후 `status === "stopped"`
- **멱등** — 두 번 호출해도 에러 없음, 두 번째는 즉시 반환

**Stopped 상태의 각 메서드 동작:**

| 메서드 | 동작 |
|---|---|
| `emit()` | `console.warn` 출력 후 이벤트 드롭 |
| `flush()` | no-op (즉시 반환, HTTP 호출 없음) |
| `newSession()` | `console.warn` 출력 후 현재 세션 반환, storage 변경 없음 |
| `shutdown()` | no-op (멱등) |
| `getSession()` | 마지막 세션 정보 반환 (정상 동작) |
| `status` / `isActive` | `"stopped"` / `false` 반환 |

---

## 세션 생명주기

```
탭 최초 방문              → sessionStorage 없음 → 신규 세션 생성
탭 내 새로고침            → sessionStorage 유지 → 동일 세션 복원
monitor.newSession()      → sessionStorage 초기화 → 새 세션
탭 닫기 / 브라우저 종료   → sessionStorage 삭제 → 다음 방문 시 새 세션
새 탭 열기               → sessionStorage 탭 격리 → 독립 세션
```

---

## 표준 사용 패턴

### SPA (Single Page App)

```typescript
// 앱 진입점에서 1회 생성
const monitor = createQaMonitor({
  ingestUrl: import.meta.env.VITE_INGEST_URL,
  scenarioId: "app_session",
  autoCapture: { clicks: true, forms: true, navigation: true },
  meta: { serviceName: "my-spa", env: import.meta.env.MODE },
});

// 라우트 전환은 autoCapture.navigation이 처리
// 로그아웃 시
function onLogout() {
  monitor.newSession();
}

// SPA 언마운트 시 (optional — pagehide가 이미 처리)
window.addEventListener("beforeunload", () => {
  void monitor.shutdown();
});
```

### 시나리오 전환

```typescript
async function startScenario(scenarioId: string) {
  const { sessionId } = monitor.newSession();
  monitor.emit("session_start", { scenario_id: scenarioId });
  return sessionId;
}
```

### 상태 확인이 필요한 경우

```typescript
if (monitor.isActive) {
  monitor.emit("custom_event", payload);
}
```

---

## 제약 조건

- `createQaMonitor()`는 탭당 1회만 호출하는 것이 원칙이다. 같은 `storageKey`로 여러 인스턴스를 생성하면 세션이 공유되지만 flush 타이머가 중복 실행된다.
- `shutdown()` 이후 재활성화는 지원하지 않는다. 새 수집이 필요하면 `createQaMonitor()`를 다시 호출한다.
- `pagehide` flush는 fire-and-forget이므로 완료를 보장하지 않는다. 중요 이벤트는 `monitor.flush()`를 명시적으로 호출해야 한다.
- `flush()` 실패 시 레코드는 버퍼에 재삽입되고 다음 flush에서 재시도된다. 버퍼 상한(500) 초과 시 가장 오래된 레코드가 드롭된다.
