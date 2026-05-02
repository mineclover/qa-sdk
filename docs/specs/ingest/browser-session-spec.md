---
def:
  tier: component
  id: browser-session-spec
  address: def_document:v2:68745
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  svc: shopping-web
  tags: [runtime, observability, structural]
  links:
    - target: session-spec
      type: depends_on
    - target: trace-spec
      type: depends_on
---

# SessionManager

## 목적 ^purpose

브라우저 탭 범위의 세션을 `sessionStorage`에 영속화한다.
탭 내 새로고침 후에도 동일 세션을 복원하고, 탭 닫힘 시 자동 만료된다.

## 구성 ^overview

- **핵심 API**: `getOrCreateSession(storageKey?)` — 기존 세션 복원 또는 신규 생성, `clearSession(storageKey?)` — 세션 강제 만료
- **세션 구조**: `MonitorSession { sessionId: "ses_" ULID, traceId: "trc_" ULID }` — sessionStorage에 JSON으로 영속
- **탭 격리**: sessionStorage 특성에 따라 탭별 독립 세션이 보장되며, 탭 닫기 시 자동 삭제된다
- **복원 전략**: 새로고침 시 sessionStorage에서 복원하고, JSON 파싱 실패·필드 누락 시 신규 세션을 생성한다
- **키 격리**: `storageKey`를 다르게 설정하면 같은 탭 내에서 독립 세션을 운용할 수 있다
- **에러 처리**: sessionStorage write quota 초과 시 silently ignore하며, 메모리에만 세션이 존재한다
- **SSR 안전**: Node.js 환경에서는 sessionStorage가 없으므로 호출자가 브라우저 환경을 보장해야 한다
- **불변성**: sessionId/traceId는 생성 후 불변이며, clearSession + getOrCreateSession으로만 갱신한다

## 상태

implemented

---

## 함수 시그니처

```typescript
function getOrCreateSession(storageKey?: string): MonitorSession;
function clearSession(storageKey?: string): void;
```

```typescript
interface MonitorSession {
  sessionId: string;   // "ses_" prefix ULID
  traceId: string;     // "trc_" prefix ULID
}
```

---

## 저장 스키마

`sessionStorage[storageKey]` 에 저장되는 JSON:

```json
{ "sessionId": "ses_01ABCD...", "traceId": "trc_01ABCD..." }
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `sessionId` | string | `newQaSessionId()` 생성 ULID (`ses_` prefix) |
| `traceId` | string | `newTraceId()` 생성 ULID (`trc_` prefix) |

기본 `storageKey`: `"qa_monitor"`

---

## `getOrCreateSession(storageKey?)` 동작

```
sessionStorage.getItem(storageKey) 가 null이면 → 신규 생성
JSON.parse 실패(손상)이면 → 신규 생성
parsed.sessionId 또는 parsed.traceId 가 falsy이면 → 신규 생성
```

1. `sessionStorage.getItem(storageKey)` 조회
2. 조회된 값이 존재하면 JSON.parse — 실패 시 catch 후 신규 생성
3. 파싱 결과에 `sessionId`, `traceId` 가 모두 있으면 그대로 반환
4. 없거나 누락 시 `newQaSessionId()` + `newTraceId()` 로 신규 생성
5. 신규 생성된 세션을 `sessionStorage.setItem` — quota 초과 등 실패 시 silently ignore
6. `MonitorSession` 반환

**SSR 안전**: `sessionStorage` 는 브라우저 전용 API이므로 Node.js 환경에서 사용하지 않을 것.
Node에서 호출 시 `sessionStorage is not defined` ReferenceError. 호출자가 환경을 보장해야 한다.

---

## `clearSession(storageKey?)` 동작

- `sessionStorage.removeItem(storageKey)` 호출
- 키가 존재하지 않아도 에러 없음 (no-op)
- 실패 시 silently ignore

---

## 세션 생명주기

| 이벤트 | 결과 |
|---|---|
| 탭 최초 방문 | `sessionStorage` 없음 → 신규 세션 생성 |
| 같은 탭 새로고침 | `sessionStorage` 유지 → 동일 세션 복원 |
| `clearSession()` + `getOrCreateSession()` | 강제 만료 후 새 세션 |
| 탭 닫기 / 브라우저 종료 | `sessionStorage` 삭제 → 다음 방문 시 새 세션 |
| 새 탭 열기 | `sessionStorage` 탭 격리 → 독립 세션 |
| 동일 `storageKey` 다중 인스턴스 | 같은 세션 공유 — flush 타이머만 중복 |

---

## 키 격리

`storageKey` 를 다르게 설정하면 같은 탭 내에서 독립 세션을 운용할 수 있다.

```typescript
const monitorA = new QaMonitor({ ..., storageKey: "qa_service_a" });
const monitorB = new QaMonitor({ ..., storageKey: "qa_service_b" });
// monitorA.getSession() !== monitorB.getSession()
```

---

## 제약 조건

- `sessionId` / `traceId` 는 생성 후 불변. `clearSession` + `getOrCreateSession` 을 통해서만 갱신.
- `storageKey` 충돌 시 동일 세션 공유 → 같은 앱 인스턴스를 하나만 생성하는 것이 원칙.
- `sessionStorage` write quota 초과 시 세션이 저장되지 않음 — 메모리에만 존재, 새로고침 시 새 세션.

---

## 테스트 커버리지

`packages/browser-sdk/src/session.test.ts`:

- 최초 호출 시 새 세션 생성
- 동일 키 재호출 시 동일 세션 복원
- 손상된 JSON → 새 세션 생성
- `sessionId` / `traceId` 중 하나만 존재 → 새 세션 생성 (부분 유효 데이터 거부)
- 서로 다른 `storageKey` → 독립 세션
- `clearSession()` 호출 후 재호출 → 새 세션
- 빈 키 `clearSession()` → 에러 없음 (no-op)
