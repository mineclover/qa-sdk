---
def:
  id: log-ingest-wiring
  scope: constraint
  aspect: infra_constraint
  depth: specification
  level: leaf
  lifecycle: approved
  layer: operation
  svc: logger
  tags: [logging, ingest, transport]
  links:
    - target: log-ingest-forwarder
      type: depends_on
defines:
  - createMultiDestination
  - CreateLoggerOptions
  - LoggerDestination
consumes:
  - "@qa-sdk/core :: createLogger"
  - "@qa-sdk/logger :: createIngestForwarder"
---

# Log → Ingest 서비스 배선

## 목적 ^purpose

`createLogger` 확장(multi-destination)과 서비스별 `lib/logger.ts` 공용 패턴으로 `QA_INGEST_ENDPOINT` 환경변수 하나로 좌표 로그 포워딩을 on/off한다.

## 구성 ^overview

- `createMultiDestination`: stdout(primary) + extras에 동시 write. extras에 level 필터 적용.
- `CreateLoggerOptions`: createLogger 확장 시그니처 — destinations 배열 옵션.
- `서비스 lib/logger.ts`: 7개 서비스 공용 패턴 — QA_INGEST_ENDPOINT 조건부 활성화.
- `좌표 주입 패턴`: 직접 주입, child logger, 명시 eventKey 3종.

---

## createLogger 확장 (core)

```typescript
// packages/core/src/lib/create-logger.ts

interface LoggerDestination {
  stream: Destination;  // { write(msg: string): void }
  level?: string;       // 이 레벨 이상만 전달
}

interface CreateLoggerOptions {
  destinations?: LoggerDestination[];
}

function createLogger(name: string, options?: CreateLoggerOptions): Logger;
```

- `destinations` 없으면 기존 동작 (stdout only)
- 있으면 `createMultiDestination(stdout, extras)`: primary에 무조건 write + extras에 level 필터 후 write
- level 필터: JSON parse → `level` 필드 비교 → threshold 미만이면 skip

## 서비스 공용 패턴

7개 서비스(ingest-server 제외)에 동일 패턴 적용 완료.

```typescript
// packages/*/src/lib/logger.ts
import { createLogger as _createLogger, type Logger } from "@qa-sdk/core";
import { createIngestForwarder } from "@qa-sdk/logger";

const ingestEndpoint = process.env["QA_INGEST_ENDPOINT"];

export function createLogger(name: string): Logger {
  if (!ingestEndpoint) return _createLogger(name);
  return _createLogger(name, {
    destinations: [{
      stream: createIngestForwarder({ endpoint: ingestEndpoint, serviceName: name }),
      level: "info",
    }],
  });
}
```

### 적용 현황

| 서비스 | lib/logger.ts | 상태 |
|--------|--------------|------|
| registry-service | forwarder-aware | 완료 |
| gate-service | forwarder-aware | 완료 |
| query-service | forwarder-aware | 완료 |
| decode-service | forwarder-aware | 완료 |
| decision-service | forwarder-aware | 완료 |
| definition-service | 신규 생성 + import 전환 (5파일) | 완료 |
| motion-workspace-service | 신규 생성 + import 전환 (2파일) | 완료 |
| **ingest-server** | **미적용** (자기 참조 방지) | 의도적 제외 |

### 활성화

```bash
# 개발: 로컬 ingest-server
QA_INGEST_ENDPOINT=http://localhost:3200/v1/ingest pnpm --filter gate-service dev

# 운영
QA_INGEST_ENDPOINT=https://ingest.prod.example.com/v1/ingest

# 비활성 (기본): 환경변수 미설정 → stdout only
```

## 자기 참조 방지

ingest-server는 `QA_INGEST_ENDPOINT`를 설정하지 않는다. 자기가 보낸 로그를 자기가 받는 루프 방지. 런타임 guard 불필요 — 설정 실수 수준이므로 문서화로 충분.

---

## pino level → event_key 매핑

| pino level | event_key | forwarder 도달 |
|-----------|-----------|---------------|
| trace | — | 도달 안 함 (level: "info" 필터) |
| debug | — | 도달 안 함 |
| info | `svc_log.info` | 도달 |
| warn | `svc_log.warn` | 도달 |
| error | `svc_log.error` | 도달 |
| fatal | `svc_log.fatal` | 도달 |

---

## 좌표 주입 패턴

### 패턴 1: 직접 주입

```typescript
logger.info({
  addressContext: {
    service: qa.encode("service"),
    permission: qa.encode("permission", { role: "admin" }),
  },
}, "관리자 요청 처리");
```

### 패턴 2: child logger로 요청 단위 바인딩

```typescript
app.use(async (c, next) => {
  const ctx = c.get("qaContext");
  c.set("logger", logger.child({
    addressContext: ctx.getAddressContext(),
    traceId: ctx.traceId,
  }));
  await next();
});
```

### 패턴 3: 명시적 eventKey

```typescript
logger.info({
  addressContext: { service: "service:v1:42" },
  eventKey: "auth.login.success",
}, "로그인 성공");
```

---

## 테스트 (createLogger 확장, 4건)

| 테스트 | 검증 |
|--------|------|
| 기본 동작 | destinations 없으면 stdout only |
| multi-destination | mockStream에 동시 write |
| level 필터 | warn 이상만 전달 |
| 빈 배열 | destinations: [] → 기본 동작 |
