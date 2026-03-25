---
def:
  id: infra-logger-spec
  scope: data
  aspect: system_data
  depth: specification
  lifecycle: approved
  tags: [observability]
  links:
    - target: logger-spec
      type: depends_on
---

# Logger

## 목적 ^purpose

구조화 JSON 로깅. pino 호환 인터페이스 제공.

## 상태

implemented

## 팩토리

```typescript
function pino(options?: LoggerOptions, destination?: Destination): Logger;
```

- `options` 생략 시 기본값 적용
- `destination` 생략 시 stdout

## Logger 인터페이스

```typescript
interface Logger {
  level: Level;
  trace(obj?: unknown, msg?: unknown, ...args: unknown[]): void;
  debug(obj?: unknown, msg?: unknown, ...args: unknown[]): void;
  info(obj?: unknown, msg?: unknown, ...args: unknown[]): void;
  warn(obj?: unknown, msg?: unknown, ...args: unknown[]): void;
  error(obj?: unknown, msg?: unknown, ...args: unknown[]): void;
  fatal(obj?: unknown, msg?: unknown, ...args: unknown[]): void;
  child(bindings: Record<string, unknown>): Logger;
}
```

## 로그 레벨

| 레벨 | 우선순위 |
|---|---|
| trace | 10 |
| debug | 20 |
| info | 30 |
| warn | 40 |
| error | 50 |
| fatal | 60 |
| silent | Infinity |

- 설정된 레벨 이상만 출력
- 기본 레벨: `info`

## LoggerOptions

```typescript
interface LoggerOptions {
  level?: Level | string;
  base?: Record<string, unknown>;
  messageKey?: string;          // 기본값: "msg"
  errorKey?: string;            // 기본값: "err"
  mixin?: () => Record<string, unknown>;
  serializers?: Record<string, (value: unknown) => unknown>;
  formatters?: {
    level?: (label: string, number: number) => Record<string, unknown>;
  };
}
```

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `level` | `"info"` | 로그 출력 임계 레벨 |
| `base` | - | 모든 로그에 포함될 고정 필드 |
| `messageKey` | `"msg"` | 메시지 필드 키 |
| `errorKey` | `"err"` | 에러 직렬화 필드 키 |
| `mixin` | - | 매 로그 호출 시 동적 필드 생성 함수 |
| `serializers` | - | 특정 키의 값을 변환하는 함수 맵 |

## Destination

```typescript
interface Destination {
  write(message: string): void;
}
```

- 포맷된 JSON 문자열을 출력할 대상
- 기본: `process.stdout`

## 정적 프로퍼티

```typescript
pino.stdSerializers = {
  err: (error: unknown) => unknown;
};
```

- `err`: Error 객체를 `{ type, message, stack }` 형태로 직렬화

## child logger

```typescript
const child = logger.child({ requestId: "abc" });
child.info("hello"); // { requestId: "abc", msg: "hello", ... }
```

- 부모 바인딩을 상속하고 추가 바인딩을 병합
- child에서 다시 child 생성 가능 (체이닝)
