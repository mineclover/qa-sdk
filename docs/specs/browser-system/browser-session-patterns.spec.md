---
def:
  id: browser-session-patterns
  type: knowledge
  knowledge_kind: pattern
  address: def_document:v2:137345
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: browser-sdk
  tags: []
  links:
    - target: browser-lifecycle-spec
      type: refines
---

# 브라우저 세션 패턴

## 목적 ^purpose

브라우저 세션 생명주기와 표준 사용 패턴을 분리해 앱이 QaMonitor를 일관되게 초기화하고 종료하도록 돕는다.

## 구성 ^overview

세션은 `sessionStorage` 기반으로 탭 범위 내에서 유지된다. `getOrCreateSession()` 으로 복원/생성하고, `clearSession()` + `getOrCreateSession()` 조합으로 새 세션을 발급한다. 세션 식별자는 `qa_session_id`(사용자 행동 단위)와 `trace_id`(전송 단위)로 구성된다.

## 세션 모델 — MonitorSession

> 타입 정의: packages/browser-sdk/src/types.ts — MonitorSession

- `sessionId`: `newQaSessionId()` 로 생성. 같은 탭 내 연속 행동을 묶는 단위
- `traceId`: `newTraceId()` 로 생성. QaLogger가 전송 엔벨로프에 포함

## 세션 저장소 — sessionStorage

- 키: `storageKey` (기본 `"qa_monitor"`)
- 값: `JSON.stringify({ sessionId, traceId })`
- **탭 범위**: 탭을 닫으면 세션이 자동 만료되어 다음 방문 시 새 세션 시작
- `localStorage`가 아닌 `sessionStorage` 사용 — 탭 간 세션 공유 방지

## 복원/생성 로직 — getOrCreateSession

```
sessionStorage.getItem(key)
  ├── 존재 + JSON 파싱 성공 + sessionId/traceId 유효
  │     └── 기존 세션 반환 (복원)
  ├── 존재하지 않음 / 파싱 실패 / 필드 누락
  │     └── 새 세션 생성 → sessionStorage에 저장
  └── 저장 실패 (quota 초과 등)
        └── 무시 — 메모리에서만 세션 유지
```

## 표준 사용 패턴

### 1. 앱 부팅 — 단일 모니터 생성

```typescript
const monitor = createQaMonitor({
  ingestUrl: "/api/ingest",
  autoCapture: { clicks: true, navigation: true },
});
// 이 시점에 sessionStorage에서 기존 세션이 복원되거나 새로 생성됨
```

### 2. 사용자 로그인 — 세션 교체

```typescript
// 로그인 성공 후 새 세션 시작
monitor.setUser({ actorId: "user-123" });
monitor.newSession();
// 이전 세션 데이터는 sessionStorage에서 제거되고 새 세션 발급
```

### 3. 페이지 전환 — SPA 내비게이션

- `autoCapture.navigation = true` 설정 시 `pushState` 패치로 자동 `page_view` 이벤트
- 세션은 유지됨 — 같은 탭 내 연속 행동

### 4. 로그아웃

```typescript
monitor.clearUser();
monitor.newSession();
// 익명 세션으로 전환
```

### 5. 앱 종료

```typescript
await monitor.shutdown();
// 남은 버퍼 전송 + 리스너 정리
// pagehide 리스너가 이미 등록되어 있어 탭 닫기 시에도 flush 시도
```

## 세션 교체 — newSession()

1. `clearSession(storageKey)` — sessionStorage에서 기존 세션 제거
2. `getOrCreateSession(storageKey)` — 새 sessionId + traceId 발급
3. `TraceContext` 재설정 — logger에 새 컨텍스트 주입
4. 내부 `this.session` 갱신

## 설계 결정

| 결정 | 근거 |
|------|------|
| sessionStorage 사용 | 탭 범위 세션 — 탭 닫으면 자연 만료 |
| JSON.parse 실패 무시 | 손상된 데이터로 인한 앱 중단 방지 |
| 저장 실패 무시 | private mode 등에서 quota 초과 시에도 동작 |
| 세션 재사용 기본 | 같은 탭에서 새로고침 시 기존 세션 유지 |
| 명시적 newSession() | 세션 경계를 앱이 제어 — 자동 교체 없음 |
