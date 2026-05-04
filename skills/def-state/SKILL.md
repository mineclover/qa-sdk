---
name: def-state
description: "문서/시스템 프로세스의 유한 상태 관리. lifecycle, 스펙 구현, 컨벤션 준수, DB 동기화 상태를 추적한다."
---

# Definition State — 유한 상태 관리

문서와 시스템 프로세스를 상태 머신으로 추적한다. 2계층 구조: definition-catalog 11개 머신 + work-domain 게이트 런타임.

## 2계층 상태 모델

### 계층 1: definition-catalog (11개 머신)

**기본 4개 머신** (`state-model.ts`):

| 머신 | 상태 | 용도 |
|------|------|------|
| doc-lifecycle | draft → review → approved → deprecated → archived | 문서 생명주기 |
| spec-impl | designed → implementing → implemented → verified → source-referenced | 스펙 구현 단계 |
| convention-compliance | unverified → partial → compliant ←→ violated | 컨벤션 준수 |
| db-sync | out-of-sync → syncing → synced → drift-detected | DB 동기화 |

**시스템 7개 머신** (`harness-state-model.ts`):

| 머신 | 상태 | 용도 |
|------|------|------|
| address-state | open → active → inactive → reserved | GateEngine 4-state |
| version-lifecycle | draft → released → active → deprecated | prefix 버전 |
| decision-flow | pending → active → completed/abandoned/blocked | 의사결정 흐름 |
| service-status | active → deprecated → retired | 서비스 상태 |
| event-status | active → deprecated → retired | 이벤트 상태 |
| metric-health | ok ↔ warning ↔ critical | 메트릭 건강도 |
| policy-candidate | candidate → approved/rejected/modified | 정책 후보 |

**머신 간 의존** (7건):
- cascade: version:deprecated → address:inactive, service:deprecated → event:deprecated, spec:verified → convention:compliant
- guard: version:active 필요 → address:active, doc:approved 필요 → convention:compliant
- notify: metric:critical → flow:blocked, flow:completed → doc:review

### 계층 2: work-domain (게이트 런타임)

| 상태 모델 | entries | prefix |
|----------|---------|--------|
| GateKind (19종) | typecheck, lint, unit-test, e2e-test 등 | gate_execution |
| GateScope (7종) | static, unit, integration, system, build, audit, ai | gate_execution |
| GateState (9종) | idle → blocked → ready → gathering → running → passed/failed/stale/skipped | gate_execution |
| BundleState (6종) | empty → pending → gathering → partial → complete → degraded | bundle_observation |

> SSOT: `packages/work-domain/src/gate-kind.ts` `GATE_KINDS`. 변경 시 `work-domain.test.ts` 의 `toHaveLength(19)` 단언과 함께 갱신. 관련 소스에 더 적게 적힌 카운트(예: 18종)가 보이면 그 자리도 SSOT 기준으로 통일.

## Cross-Loop 브릿지

6개 피드백 루프를 연결하는 브릿지 (`cross-loop-bridge.ts`):

```
③ Gate complete → ② Harness compliant     createGateHarnessBridge()
② Harness 상태  → ⑤ Decision context      buildHarnessContext()
⑤ Decision 결과 → ⑥ Doc lifecycle          createDecisionInfraBridge()
```

**guard 순서**: Decision success → Doc approved → Gate complete → Convention compliant

## 계층 구분 — validate green ≠ system green

> `def validate` (L2) 통과는 필요조건일 뿐이다. **`workflow-smoke` + `def doctor` 가 L3 sentinel** 로서 silent-empty 회귀 (Phase 3b Option B 류) 를 차단한다. 근거: `docs/specs/system/layer-separation.rule.md` §1.2 (L2 정의), §1.3 (L3 workflow smoke 원칙).

## 통합 헬스체크 (`def doctor`)

신규 기여자/에이전트는 개별 머신 트래킹 전에 **`qa-sdk def doctor`** 로 시스템 전반의 건강도부터 본다.

```bash
qa-sdk def doctor             # 사람 친화 출력
qa-sdk def doctor --json      # 기계 파싱용
```

출력 구조 (`packages/cli/src/commands/def.ts` `cmdDoctor`):

| 섹션 | 점검 항목 |
|------|----------|
| Core | `validate` (errors/warnings) + `sync stats` |
| Domains | `audit --by-domain` 도메인 루트 + 멤버 수, top 루트 N개 |
| Aspects | aspect hierarchy + completeness |
| Annotations | `@def.boundary` deprecated 여부 + valid 비율 |
| Summary | 총 errors / warnings + 후속 명령 안내 |

exit code 의미:

- `0` — 깨끗 (errors=0, warnings=0)
- `1` — errors 존재 — `def validate` 로 상세 확인
- `2` — warnings only — 즉시 차단은 아니나 누적 시 검토

`workflow-smoke` Scenario F 는 doctor 가 5섹션 + `errors` 집계를 항상 출력하는지 단언한다 (`packages/cli/src/workflow-smoke.test.ts`).

## 사용법

### 하네스 트래커 (11개 머신)
```typescript
import { createHarnessRegistry, createHarnessTracker } from "definition-catalog";

const tracker = createHarnessTracker({ logger, registry: createHarnessRegistry() });
tracker.init("doc-lifecycle", "my-doc");
tracker.transition("doc-lifecycle", "my-doc", "review", "user_action");
tracker.runProcess("prefix-release", "service:v2");
```

### 게이트 트래커 (런타임)
```typescript
import { createGateTracker, buildHarnessPlan } from "work-domain";

const plan = buildHarnessPlan("my-anchor", docGraph);
const gateTracker = createGateTracker({ logger, plan, listener: gateHarnessBridge });
gateTracker.applyEvent(0, { type: "schedule" });
gateTracker.applyEvent(0, { type: "gather_start" });
gateTracker.applyEvent(0, { type: "gather_done" });
gateTracker.applyEvent(0, { type: "exit", code: 0 });
// → gate.execution + bundle.observation 이벤트 emit
// → BundleState complete 시 listener 호출 → Harness convention compliant
```

### Cross-Loop 연결
```typescript
import { createGateHarnessBridge, buildHarnessContext, createDecisionInfraBridge } from "definition-catalog";

// ③→② Gate → Harness
const bridge = createGateHarnessBridge({ harnessTracker: tracker });
gateTracker = createGateTracker({ logger, plan, listener: bridge });

// ②→⑤ Harness → Decision
const ctx = buildHarnessContext(tracker, entityId);
contextProvider.provide(schemaId, { harness_health: ctx.overallHealth, ...ctx.machineStates });

// ⑤→⑥ Decision → Infrastructure
const decBridge = createDecisionInfraBridge({ harnessTracker: tracker });
engine.addListener({ onFlowCompleted: (inst) => decBridge.onDecisionCompleted({ verdict: "success", entityId }) });
```

### 상태 파생 (자동 결정)
```typescript
import { deriveAllStates } from "definition-catalog";

const states = deriveAllStates({
  docId: "my-doc",
  frontmatter: { lifecycle: "approved", svc: "ingest-server" },
  sync: { configExists: true, configCount: 10, scanCount: 10, checksumMatch: true },
  specImpl: { hasSvc: true, hasCode: true, hasTests: true, testsPass: true, isSourceReferenced: false },
  convention: { evidenceCount: 5, coverage: 100, hasFailures: false },
  versionStatus: "active",
  flowStatus: null,
  policyStatus: null,
  address: { allDimsEncode: true, allDimsDecode: true },
  service: null,
  event: null,
  metric: null,
});
// → 11개 머신 상태를 한번에 파생
```

### 품질 하네스 quick loop

```bash
qa-sdk def sync
qa-sdk def validate
qa-sdk quality show <gate-doc-id>
qa-sdk quality run <gate-doc-id> --json
qa-sdk quality diagnose <gate-doc-id> --json
qa-sdk quality claims <bundle-doc-id>
qa-sdk quality status quality-gates-system --json
qa-sdk quality export quality-gates-system --output=artifacts/quality-gates-system.json
```

읽는 순서:

1. `quality run`이 `quality-ledger`를 최신화
2. `quality claims`가 contract marker 기반 claim verdict를 계산
3. `quality status/export`가 bundle/system 수준 snapshot을 만든다

## 관련 소스

- `definition-catalog/src/state-model.ts` — FSM 엔진 + 4개 기본 머신
- `definition-catalog/src/harness-state-model.ts` — 7개 시스템 머신 + 의존 + 프로세스
- `definition-catalog/src/harness-tracker.ts` — SDK 이벤트 수집 트래커
- `definition-catalog/src/harness-derive.ts` — 11개 머신 자동 파생
- `definition-catalog/src/cross-loop-bridge.ts` — Cross-Loop 브릿지 (③→②→⑤→⑥)
- `work-domain/src/harness.ts` — 게이트 FSM (순수 함수)
- `work-domain/src/gate-tracker.ts` — 게이트 트래커 (emit + listener)
- `work-domain/src/gate-kind.ts` — 19종 게이트 유형 택소노미 (GATE_KINDS SSOT)
- `definition-catalog/src/cross-loop-bridge.test.ts` — Cross-Loop 통합 테스트 (10건)
- `packages/cli/src/commands/def.ts` `cmdDoctor` — 통합 헬스체크 명령 진입점
- `packages/cli/src/workflow-smoke.test.ts` — L3 silent-empty 회귀 sentinel (Scenario A~F)
