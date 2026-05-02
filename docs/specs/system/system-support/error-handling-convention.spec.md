---
def:
  id: error-handling-convention
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [cross-scope, entry-point]
  links:
    - target: system-concepts
      type: constrains
---
# 에러 처리 공통 컨벤션

## 목적 ^purpose

모노레포 전체의 에러 클래스 계층, 인터페이스 규칙, 로깅 패턴, 핸들링 원칙을 정의한다. 모든 패키지가 동일한 에러 계약을 따르도록 강제하여, 서비스 간 에러 전파와 클라이언트 에러 처리를 일관되게 만든다.

## 구성 ^overview

- 에러 3계층: AppError(서비스), ServiceClientError(클라이언트), 라이브러리 에러(독립)
- 에러 코드 표준 (INVALID_INPUT, NOT_FOUND, CONFLICT, INTERNAL_ERROR)
- 에러 로깅 패턴 (pino `err` 키)
- 에러 핸들링 원칙 (fail-open, 에러 격리, 삼킴 금지)

## 에러 3계층 ^constraint

### 1. AppError — 서비스 에러

참조: `packages/core/src/lib/app-error.ts`

서비스(ingest, registry, decode, gate, definition, motion-workspace)가 내부에서 throw.

```
AppError(code: string, message: string, statusCode?: number, extras?: Record)
```

| 필드 | 타입 | 역할 |
|------|------|------|
| `code` | string | 에러 종류 식별자 (INVALID_INPUT, NOT_FOUND 등) |
| `message` | string | 사람이 읽는 설명 |
| `statusCode` | number | HTTP 상태 코드 (기본 400) |
| `extras` | Record | 추가 데이터 (디버깅용) |

### 2. ServiceClientError — HTTP 클라이언트 에러

참조: `packages/core/src/lib/app-error.ts`

서비스 클라이언트(definition-client, gate-client)가 외부 서비스 호출 실패 시 throw.

```
ServiceClientError(message: string, status: number, payload?: unknown)
```

| 필드 | 타입 | 역할 |
|------|------|------|
| `status` | number | HTTP 응답 상태 코드 |
| `payload` | unknown | 원본 응답 body (디버깅용) |

AppError와의 차이: AppError는 **내부에서 발생**, ServiceClientError는 **외부 호출 실패**.

### 3. 라이브러리 에러 — 독립 계층

각 라이브러리가 자체 에러 계층을 소유. AppError와 독립.

| 라이브러리 | 루트 에러 | 하위 클래스 |
|-----------|----------|-----------|
| weighted-index | WeightedIndexError | ShapeError, CoordError, IndexRangeError 등 8종 |
| index-meta | IndexMetaError | IndexNotFoundError, EntryNotFoundError 등 9종 |
| spec-core | SpecError | DuplicateRegistrationError, NotFoundError, ValidationError |

서비스에서 라이브러리 에러를 catch하면 AppError로 변환:

```typescript
// decode-service/src/lib/errors.ts — fromIndexMetaError()
if (err instanceof EntryNotFoundError) {
  return new AppError("NOT_FOUND", err.message, 404);
}
```

## 에러 코드 표준

| code | HTTP | 의미 |
|------|------|------|
| `INVALID_INPUT` | 400 | 요청 파라미터/body 유효하지 않음 |
| `NOT_FOUND` | 404 | 리소스 미존재 |
| `CONFLICT` | 409 | 이미 존재, revision 충돌 |
| `RANGE_EXCEEDED` | 400 | 좌표 범위 초과 |
| `PARSE_ERROR` | 400 | 파싱 실패 |
| `INTERNAL_ERROR` | 500 | 내부 오류 |

새 에러 코드 추가 시 이 테이블에 등록.

## 에러 로깅 패턴

```typescript
// ✅ 올바른 패턴 — pino err serializer 사용
logger.error({ err }, "작업 실패");
logger.error({ err, docId: "gate-api" }, "문서 처리 실패");

// ❌ 잘못된 패턴 — Error가 {} 로 직렬화됨
logger.error({ error: err }, "작업 실패");
```

- pino는 `err` 키를 자동으로 Error 직렬화 (type, message, stack)
- `error` 키를 쓰면 빈 객체 `{}` 출력

## 에러 핸들링 원칙

### fail-open

gate check 실패 → 허용 + warning diagnostic. 차단하지 않음.

### 에러 격리

convergence 실패가 Phase 2 verdict/활성화를 절대 차단하지 않음.

### 에러 삼킴 금지

try-catch 후 빈 catch 블록 금지. 최소한 logger.warn.

```typescript
// ❌ 에러 삼킴
try { await riskyOp(); } catch { /* noop */ }

// ✅ 경고 로깅
try { await riskyOp(); } catch (err) { logger.warn({ err }, "riskyOp 실패"); }
```

### 브라우저 SDK 예외

`emitWithCoords`/`browserTrack`은 try-catch 필수 — UI 크래시 방지.
인코딩 실패 시 coordinate 없이 emit (이벤트 유실보다 좌표 누락이 낫다).

### 서비스 네트워크 호출

서버 시작 시 외부 fetch: `AbortSignal.timeout(5_000)` 필수.
`JSON.parse(외부 데이터)` try-catch 필수.

## 에러 핸들러 미들웨어 패턴

```typescript
// 서비스 에러 핸들러 (Hono/Fastify)
if (err instanceof AppError) {
  return c.json({ code: err.code, message: err.message }, err.statusCode);
}
return c.json({ code: "INTERNAL_ERROR", message: "internal server error" }, 500);
```

## 준수 검증

`packages/core/src/error-convention.test.ts`에서 spec-tracker로 이 컨벤션의 준수를 검증한다.

검증 항목:
- AppError/ServiceClientError 인터페이스 계약
- 에러 코드→HTTP 상태 매핑
- 7개 서비스 소스 코드 정적 스캔 (잘못된 로깅 패턴 0건)
- 에러 핸들러 AppError 사용 확인

실행: `cd packages/core && npx vitest run src/error-convention.test.ts`

## 관련 소스

- `packages/core/src/lib/app-error.ts` — AppError, ServiceClientError
- `packages/core/src/error-convention.test.ts` — 컨벤션 준수 테스트 + spec-tracker 연동
- `packages/decode-service/src/lib/errors.ts` — fromIndexMetaError (라이브러리→서비스 변환)
- `packages/decode-service/src/middleware/error-handler.ts` — 에러 핸들러 참조 구현
