---
def:
  id: browser-lifecycle-states
  address: def_document:v1:1073
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  svc: browser-sdk
  tags: [tier-frontend]
  links:
    - target: browser-lifecycle-spec
      type: refines
---

# 브라우저 생명주기 상태

## 목적 ^purpose

QaMonitor의 상태 다이어그램과 단계별 계약을 분리해 브라우저 SDK가 언제 어떤 동작을 해도 되는지 명확히 한다.

## 구성 ^overview

QaMonitor는 `active`와 `stopped` 두 가지 상태를 가진다. 생성 시 즉시 `active`로 진입하며, `shutdown()` 호출로 `stopped`에 도달한다. 상태 전이는 단방향이고 멱등이다.

## 상태 다이어그램

```
                    ┌──────────────────────────────────────────────┐
                    │                   ACTIVE                     │
                    │                                              │
  new QaMonitor() ──►  emit() ────────────► 버퍼 축적              │
                    │  emitWithCoords() ──► 좌표 인코딩 + 버퍼 축적 │
                    │  metric() ──────────► 메트릭 버퍼 축적        │
                    │  flush() ───────────► 버퍼 즉시 전송          │
                    │  newSession() ──────► 세션 교체              │
                    │  setUser() ─────────► Actor 설정             │
                    │  clearUser() ───────► Actor 해제             │
                    │  pagehide ──────────► fire-and-forget flush  │
                    │                                              │
                    │  shutdown() ────────┐                        │
                    └─────────────────────┼────────────────────────┘
                                          │
                                          ▼
                    ┌──────────────────────────────────────────────┐
                    │                   STOPPED                    │
                    │                                              │
                    │  emit() ────────────► warn + 무시            │
                    │  metric() ──────────► warn + 무시            │
                    │  newSession() ──────► warn + 현재 세션 반환   │
                    │  flush() ───────────► no-op                  │
                    │  shutdown() ────────► no-op (멱등)           │
                    └──────────────────────────────────────────────┘
```

## 상태 정의

### ACTIVE

- `MonitorStatus = "active"`
- 모든 public 메서드가 정상 동작
- QaLogger 타이머가 5초 간격으로 자동 flush
- autoCapture 리스너가 DOM 이벤트를 감지
- pagehide 리스너가 페이지 언로드 시 버퍼를 전송

### STOPPED

- `MonitorStatus = "stopped"`
- `emit()`, `metric()` 호출 시 `console.warn` + 이벤트 드롭
- `newSession()` 호출 시 `console.warn` + 현재 세션 복사본 반환
- `flush()`, `shutdown()` 은 no-op (멱등)
- autoCapture 리스너 해제됨
- pagehide 리스너 해제됨
- QaLogger 타이머 정리됨

## shutdown 절차

1. `_status`를 `"stopped"`로 변경
2. `destroyAutoCapture()` 호출 — DOM 이벤트 리스너 일괄 해제
3. `window.removeEventListener("pagehide", ...)` — 언로드 리스너 해제
4. `logger.shutdown()` — 남은 버퍼 전송 + 내부 타이머 정리

## 상태 조회

| 프로퍼티 | 타입 | 설명 |
|----------|------|------|
| `status` | `"active" \| "stopped"` | 현재 생명주기 상태 |
| `isActive` | `boolean` | `status === "active"` 단축 |

## 설계 원칙

- **단방향 전이**: active → stopped 만 허용. 재활성화 없음
- **멱등 shutdown**: 여러 번 호출해도 안전
- **graceful degradation**: stopped 상태에서 메서드 호출 시 예외 대신 경고
- **생성 즉시 active**: 별도 init/start 단계 없이 생성자에서 모든 초기화 완료
