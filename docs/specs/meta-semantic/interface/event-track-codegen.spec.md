---
def:
  id: event-track-codegen
  level: leaf
  scope: interface
  aspect: event_contract
  depth: implementation
  lifecycle: approved
  layer: mediation
  links:
    - target: meta-semantic-system
      type: depends_on
---

# Event Catalog → SDK Track 코드 자동 생성

## 목적 ^purpose

event-catalog의 이벤트 정의(CoreEventDef) + prefix 매핑(EventPrefixMapping) +
payload 가이드(PayloadFieldGuide)로부터 타입 안전한 track 함수 코드를 자동 생성한다.
수동으로 track 코드를 작성하던 것을 codegen으로 대체한다.

## 정의 ^defines

- `generateTrackCode()` — 이벤트 정의 → TypeScript 파일 생성 순수 함수
- 생성 파일 4종: event-keys / event-payloads / track-functions / index
- `EventKey` 유니온 + 카테고리별 서브 유니온
- `EventPayloadMap` — 이벤트 키 → payload 타입 매핑
- `Tracker` 최소 인터페이스 (event-catalog 비의존)

## 소비 ^consumes

- `CoreEventDef`, `EventCategory` (event-catalog/types)
- `EventPrefixMapping`, `PayloadFieldGuide` (event-catalog)
- `toPascal` (codegen-core/naming) — 네이밍 변환

---

## 생성 파일

### event-keys.ts

```typescript
export type EventKey = "page.view" | "cart.add" | "auth.login" | ...;
export type NavigationEventKey = "page.view" | ...;
export const EVENT_KEYS: readonly EventKey[] = [...];
```

### event-payloads.ts

```typescript
export interface PageViewPayload {
  page: string;       // required
  title?: string;     // optional
  referrer?: string;
}
export interface EventPayloadMap {
  "page.view": PageViewPayload;
  ...
}
```

### track-functions.ts

```typescript
export interface Tracker {
  track(eventKey: string, payload?: Record<string, unknown>): void;
}

// 이벤트별 타입 안전 함수
export function trackPageView(tracker: Tracker, payload: PageViewPayload): void;
export function trackCartAdd(tracker: Tracker, payload?: CartAddPayload): void;

// 제네릭 typed track
export function track<K extends EventKey>(
  tracker: Tracker, eventKey: K, payload?: EventPayloadMap[K]
): void;
```

## 설계 판단

| 판단 | 결정 | 이유 |
|------|------|------|
| 입력 타입 | codegen 자체 인터페이스 | event-catalog 패키지 비의존 (순수 함수) |
| 필수 payload | required 필드가 하나라도 있으면 payload 필수 | 타입 안전성 |
| 매핑 없는 이벤트 | track 함수 생성 안 함 | prefix 바인딩 불가 |
| hash | SHA-256 12자 | 결정론성 (같은 입력 → 같은 hash) |
| Tracker 인터페이스 | 생성 코드에 포함 | AutoTracker 외에도 사용 가능 |

## 관련 소스

| 파일 | 역할 |
|------|------|
| `codegen-core/src/event-track-typescript.ts` | 구현 |
| `codegen-core/src/event-track-typescript.test.ts` | 테스트 (19 tests) |

## 검증

```bash
pnpm --filter codegen-core test   # 19 tests
```
