# A-stage-1a — Shared types and decision SSOT

> 본 문서는 plan A-stage-1a 의 defect 등록을 위한 stub. 원본 plan 본체는
> 회의 컨텍스트로 진행되었으며, 본 stub 은 Task 1.5 / Task 1.7 의 두 결함과
> 해당 해결 결과만 영구 기록한다. 향후 plan 본체가 작성될 때 본 섹션은
> 그대로 흡수된다.

## Task 1.5 — sim-decision-view Input/View 타입 + conversion

### Defect note (2026-05-02)

초안 plan 의 `SafetyDecisionRecordInput.action` / `ResourceDecisionRecordInput.action`
이 View 타입을 forward-mirror 하면서 controller record 어휘와 어긋났다.

| 측 | safety action 어휘 | resource action 어휘 |
|----|------------------|------------------|
| controller record (D-stage-9) | `weight-update \| noop` | `scale(reason) \| noop` |
| Task 1.5 초안 Input | `weight-update \| rollback \| hold` | `scale \| rejected \| hold` |
| View | `weight-update \| rollback \| hold` | `scale \| rejected \| hold` |

원래 spec §4 의도는 "Input = producer (controller record) shape mirror, View =
API consumer shape, conversion 함수가 normalize". 따라서 Input 측 어휘를
controller 와 동일하게 정렬하고, normalize 로직을 추가한다.

### Resolution (commit `2442b0a6`)

`packages/sim-decision-view/src/conversion.ts`:

- `SafetyActionInput = { kind: "weight-update"; revision; weight: number } | { kind: "noop" }`
- `ResourceActionInput = { kind: "scale"; target; reason } | { kind: "noop" }`
- `normalizeSafetyAction`: `noop → hold`, `weight-update + verdict=rollback → rollback(reason=triggerSignals[0])`, 그 외 → 그대로
- `normalizeResourceAction`: `noop + verdict=rejected → rejected(reason=triggerSignals[0])`, `noop → hold`, `scale → reason drop`

### 추가된 conversion 테스트 (6 케이스)

1. safety: `noop` + `verdict=hold` → view `{ kind: "hold" }`
2. safety: `weight-update(weight=0)` + `verdict=rollback` + `triggerSignals=["perf-regression"]` → view `{ kind: "rollback", revision, reason: "perf-regression" }`
3. safety: `weight-update(weight=25)` + `verdict=promote` → view `{ kind: "weight-update", revision, weight: 25 }` (그대로)
4. resource: `scale(reason)` + `verdict=scale-up` → view `{ kind: "scale", target }` (reason drop)
5. resource: `noop` + `verdict=rejected` + `triggerSignals=["resource-headroom"]` → view `{ kind: "rejected", reason: "resource-headroom" }`
6. resource: `noop` + `verdict=hold` → view `{ kind: "hold" }`

총 7 conversion test pass (기존 1 + 신규 6).

## Task 1.7 — CycleScheduler ring buffer wiring

### Defect note #1 — red 단언 깨짐 (2026-05-02)

초안 plan 의 red 단언:

```typescript
expect(Object.getOwnPropertyDescriptor(CycleSchedulerService.prototype, "history"))
  .toBeUndefined();
```

class 인스턴스 필드 (`private history: boolean[] = []`) 는 prototype 이 아닌
instance 에 존재하므로 `getOwnPropertyDescriptor(prototype, "history")` 는
변경 전후 동일하게 `undefined` 를 반환한다. 즉 red→green 의 red 단계가
관측되지 않는다.

### Resolution (commit `c038803a`)

```typescript
expect(typeof CycleSchedulerService).toBe("function");
expect(DecisionRingBuffer).toBeDefined();
```

으로 단순 export 정합 단언으로 대체. `history` 필드 제거의 실질적
red→green 검증은 D-stage-9 Task 9.13 cycle-flow 통합 테스트가 담당
(runCycle 본체에서 ringBuffer.recentSafetyHistory(10) 호출 확인 +
appendSafety/appendResource 호출 확인 + history 필드 부재 검증).

### Defect note #2 — record→Input 타입 mismatch (해결 완료)

상기 Task 1.5 defect 와 동일한 어휘 mismatch 가 ring buffer push 시
typecheck 실패로 surfacing 됐다. Task 1.5 의 Input 타입 수정으로
controller record 가 직접 `appendSafety` / `appendResource` 에 push 가능.
별도 adapter 불필요.

### Resolution: 5 패치 + 신규 테스트

`cycle-scheduler.service.ts`:

1. `import { DecisionRingBuffer } from "../decision/decision-ring-buffer.js"` 추가
2. constructor 9번째 인자로 `private readonly ringBuffer: DecisionRingBuffer` 추가
3. `private history: boolean[] = []` 필드 제거
4. `safety.decide({ ... history: this.ringBuffer.recentSafetyHistory(10) ... })`
5. `safetyRecord` / `resourceRecord` 변수화 → `builder.write` 직후 `ringBuffer.appendSafety` / `appendResource` 호출. runCycle 끝의 `this.history = [...]` 라인 + FAIL_CATS 계산 제거

`cycle.module.ts`:

- `DecisionRingBuffer` provider 추가 (`useFactory` + `SIM_CONTROLLER_RING_SIZE` env override, default 100)
- `exports` 에 `DecisionRingBuffer` 추가 → endpoint controller 와 module-level singleton 공유

### Typecheck status (post-fix)

`pnpm --filter @qa-sdk/sim-canary-controller typecheck` — 2 ring buffer push site 에러
(TS2345) 모두 해결. 잔여 `src/main.ts(8,46): @qa-sdk/otel module not found` 는
pre-existing baseline noise (이번 작업 범위 외).
