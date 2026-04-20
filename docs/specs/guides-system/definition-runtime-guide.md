---
def:
  id: definition-runtime-guide
  type: knowledge
  knowledge_kind: guide
  level: leaf
  tier: component
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [entry-point, cross-scope, runtime]
  links:
    - target: definition-management
      type: depends_on
    - target: harness-architecture
      type: depends_on
---

## 목적 ^purpose

좌표 기반 정의 체계(하네스, 게이트, Cross-Loop)를 서비스나 CLI에서 실제로 사용하기 위한 초기화 가이드. `createDefinitionRuntime()` 한 번 호출로 6개 피드백 루프가 연결된다.

## 구성 ^overview

- `빠른 시작`: `createDefinitionRuntime()` 초기화와 gate tracker 연결
- `서비스별 설정`: definition-service, ingest-server, CLI에서의 연결 위치
- `초기화 순서`: registry → definition-service → ingest-server → CLI 순서
- `guard 순서`: Decision success → Doc approved → Gate complete → Convention compliant

## 빠른 시작

```typescript
import { createDefinitionRuntime } from "definition-catalog";
import { createGateTracker, buildHarnessPlan } from "work-domain";

// 1. 런타임 초기화 (1회)
const runtime = createDefinitionRuntime({
  logger: myLogger,       // event_key + address_context를 emit하는 로거
  serviceName: "my-svc",  // 관측 이벤트의 서비스 식별자
});

// 2. 문서 상태 관리
runtime.harness.init("doc-lifecycle", "my-doc");
runtime.harness.transition("doc-lifecycle", "my-doc", "review", "user_action");

// 3. 품질 게이트 실행
const plan = buildHarnessPlan("my-anchor", docGraph);
const gate = createGateTracker({
  logger: myLogger,
  plan,
  listener: runtime.gateListener,  // ← Cross-Loop 자동 연결
});
gate.applyEvent(0, { type: "schedule" });
gate.applyEvent(0, { type: "gather_start" });
gate.applyEvent(0, { type: "gather_done" });
gate.applyEvent(0, { type: "exit", code: 0 });
// → 전체 gate pass 시 bundle "complete" → convention "compliant" 자동 전이

// 4. 의사결정 피드백
runtime.onDecisionCompleted({ verdict: "success", entityId: "my-doc" });
// → doc-lifecycle "approved" 자동 전이

// 5. 컨텍스트 조회 (의사결정 입력으로 사용)
const ctx = runtime.getHarnessContext("my-doc");
// { overallHealth: "healthy", machineStates: { "doc-lifecycle": "approved", ... } }
```

## 서비스별 설정

### definition-service (NestJS, port 3700)

```typescript
// src/app.module.ts 또는 src/harness.module.ts
import { createDefinitionRuntime } from "definition-catalog";
import { createLogger } from "@qa-sdk/logger";

const logger = createLogger("definition-service");

// 모듈 init 시 런타임 생성
const runtime = createDefinitionRuntime({
  logger: {
    log(params) {
      logger.info(params.payload, params.event_key);
    },
  },
  serviceName: "definition-service",
});

// sync 완료 후 문서별 상태 파생
for (const doc of syncedDocs) {
  runtime.harness.init("doc-lifecycle", doc.id);
  // deriveAllStates()로 자동 파생 후 tracker에 반영
}
```

### ingest-server (Hono, port 3200)

```typescript
// src/server.ts startServer() 내부
import { createDefinitionRuntime } from "definition-catalog";

const runtime = createDefinitionRuntime({
  logger: {
    log(params) {
      // ingest 자체 로거로 이벤트 기록
      appLogger.info(params.payload, params.event_key);
    },
  },
  serviceName: "ingest-server",
});

// convergence pipeline 완료 시 피드백
convergencePipeline.onFlush((result) => {
  // 메트릭 기반 관측 → 하네스 상태에 반영 가능
});
```

### CLI (qa-sdk)

```typescript
// src/commands/quality.ts
import { createDefinitionRuntime } from "definition-catalog";
import { createGateTracker, buildHarnessPlan } from "work-domain";

const runtime = createDefinitionRuntime({
  logger: { log(p) { /* 파일 또는 ingest-server로 전송 */ } },
});

// quality 명령: anchor 문서의 게이트 실행
const plan = buildHarnessPlan(anchorId, docGraph);
const gate = createGateTracker({
  logger: runtime.harness,  // 동일 로거 공유
  plan,
  listener: runtime.gateListener,
});

// 게이트 순차 실행
for (let i = 0; i < gate.getInstance().gates.length; i++) {
  gate.applyEvent(i, { type: "schedule" });
  // ... 실제 명령 실행 ...
  gate.applyEvent(i, { type: "exit", code: exitCode });
}

console.log("번들 상태:", gate.getBundleState());
```

## 환경 변수

| 변수 | 서비스 | 설명 | 기본값 |
|------|--------|------|--------|
| `SQLITE_PATH` | definition-service | DB 파일 경로 | `data/definition-service.sqlite` |
| `ROOT_DIR` | definition-service | 모노레포 루트 | 자동 감지 |
| `DOCS_DIR` | definition-service | 문서 디렉토리 | `docs` |
| `SYNC_ON_START` | definition-service | 시작 시 sync 실행 | `true` |
| `REGISTRY_URL` | definition-service | registry-service URL | `http://localhost:3300` |
| `INGEST_URL` | CLI | ingest-server URL | `http://localhost:3200` |
| `CONVERGENCE_ENABLED` | ingest-server | 수렴 파이프라인 활성화 | `false` |

## 초기화 순서

```
1. registry-service 시작 (port 3300)
   └── seedDemoCatalog() — 축/prefix SSOT 로드
   └── triggerSync() — definition-service에 sync 요청

2. definition-service 시작 (port 3700)
   └── DB 마이그레이션
   └── syncDocsToDb() — 문서 스캔 → DB 저장
   └── createDefinitionRuntime() — 하네스 + 브릿지 초기화

3. ingest-server 시작 (port 3200)
   └── createRuntimeStores() — 이벤트 저장소
   └── catalogValidator — prefix 검증
   └── convergencePipeline (optional) — 수렴 분석

4. CLI 사용
   └── qa-sdk def state — 상태 조회
   └── qa-sdk quality — 게이트 실행
   └── qa-sdk def audit — 문서 감사
```

## guard 순서 주의

```
Decision success → Doc approved → Gate complete → Convention compliant
```

doc-lifecycle이 approved가 아니면 convention → compliant 전이가 guard에 의해 차단된다. 순서를 지켜야 전체 루프가 순환한다.

## 관련 소스

| 파일 | 역할 |
|------|------|
| `definition-catalog/src/runtime.ts` | `createDefinitionRuntime()` 팩토리 |
| `definition-catalog/src/cross-loop-bridge.ts` | 3개 브릿지 |
| `work-domain/src/gate-tracker.ts` | 게이트 트래커 |
| `definition-catalog/src/harness-tracker.ts` | 하네스 트래커 |
| `definition-catalog/src/harness-derive.ts` | 자동 상태 파생 |
