---
def:
  id: pipe-gate
  level: leaf
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: pipe-interpret
      type: depends_on
    - target: pipe-analyze
      type: depends_on
---

# PipeGraph 퀄리티 게이트

## 목적 ^purpose

PipeGraph에 대한 품질 기준을 **스펙으로 정의**하고,
테스트 실행 시 **자동으로 평가**하여 **pass / fail / review** 판정을 내린다.

## 정의 ^defines

- GateLevel 4종 (pipe / facet / scenario / graph)
- GateCriterion 9종 (평가 기준)
- GateVerdict 3종 (pass / fail / review)
- review 판정 규칙

## 소비 ^consumes

- `PipeSpec`, `PipeGraph` (pipe-spec.ts)
- `extractPipeConcerns`, `propagatePipeConcerns`, `analyzePipeImpact`, `classifyPipeRole` (pipe-interpret.ts)
- `countGraphPaths` (pipe-path.ts)
- `analyzePipeComplexity` (pipe-analyze.ts)

---

## GateLevel — 분류 태그

| 레벨 | 평가 대상 | 질문 |
|------|----------|------|
| `pipe` | 단일 파이프 | "이 파이프가 안정적인가" |
| `facet` | 데이터 역할 | "이 역할이 올바른가" |
| `scenario` | 실행 경로 | "이 시나리오가 검증되었나" |
| `graph` | 전체 그래프 | "이 그래프가 운영 가능한가" |

각 레벨은 **독립적으로 평가**된다. 상위 레벨이 하위 결과를 합성하지 않는다.

## GateCriterion — 9종 평가 기준

| type | 설명 | 예시 |
|------|------|------|
| `concern-present` | 지정 concern이 존재해야 함 | `{values: ["resilience"]}` |
| `concern-absent` | 지정 concern이 없어야 함 | `{values: ["concurrency"]}` |
| `role-is` | 파이프 역할이 일치해야 함 | `{value: "transformer"}` |
| `blast-radius-max` | 변경 영향 범위 상한 | `{value: 5}` |
| `path-coverage-min` | 경로 커버리지 하한 (`executedPathCount` 필수) | `{value: 0.8}` |
| `no-isolated-pipes` | 고립 파이프 없어야 함 | — |
| `max-complexity` | 총 경로 수 상한 | `{value: 100}` |
| `all-pipes-have-concerns` | 모든 파이프에 관심사 있어야 함 | — |
| `no-unhandled-resilience` | resilience 상속만 받고 자체 내결함 없는 파이프 없어야 함 | — |

## GateVerdict — 3종 판정

### pass

이 게이트의 모든 기준이 통과함. 추가 조치 불필요.

```
charge-resilience:
  criteria:
    - concern-present: [resilience, latency] → ✓
    - role-is: transformer              → ✓
    - blast-radius-max: 5               → ✓ (actual: 4)
  verdict: pass
```

### fail

하나 이상의 기준이 실패함. 수정 필요.

```
charge-resilience:
  criteria:
    - concern-present: [resilience, latency] → ✓
    - blast-radius-max: 2               → ✗ (actual: 4)
  verdict: fail
```

### review

**이 게이트 자체는 pass**이지만, 같은 배치에서 평가된 **하위 레벨 게이트에 fail이 있음**.
자동으로 차단하지 않지만, 하위 이슈를 검토해야 함.

#### review가 발생하는 조건

1. 배치 평가(`evaluateGates`)에서 여러 레벨의 게이트를 함께 평가
2. **하위 레벨** 게이트 중 fail이 존재
3. **상위 레벨** 게이트는 자기 기준으로 pass

#### 레벨 우선순위

```
pipe(0) < facet(1) < scenario(2) < graph(3)
```

하위 = 숫자가 작은 레벨. **같은 레벨**끼리는 review 발생하지 않음.

#### 케이스별 판정 예시

```
케이스 1: pipe fail + graph pass → graph = review

  평가 대상:
    [pipe] charge-resilience    → blast-radius-max: 2 초과 → fail
    [graph] order-flow-stability → no-isolated-pipes: ✓     → pass

  판정:
    charge-resilience:     verdict = fail
    order-flow-stability:  verdict = review
      subIssues: [{
        gateId: "charge-resilience",
        level: "pipe",
        failedCriteria: ["blastRadius=4 (최대: 2)"]
      }]

  의미: 그래프 전체는 안정적이지만, charge 파이프의 영향 범위가
        기준을 넘었으므로 검토가 필요하다.
```

```
케이스 2: pipe fail + pipe pass → 둘 다 원래 verdict 유지

  평가 대상:
    [pipe] charge-resilience    → fail
    [pipe] validate-role        → pass

  판정:
    charge-resilience:  verdict = fail
    validate-role:      verdict = pass  (같은 레벨이므로 review 아님)

  의미: 같은 레벨의 게이트는 서로 독립적. 하나의 실패가
        다른 같은 레벨 게이트에 영향을 주지 않는다.
```

```
케이스 3: pipe fail + scenario pass + graph pass → scenario/graph 모두 review

  평가 대상:
    [pipe]     charge-blast     → fail
    [scenario] happy-path       → pass
    [graph]    overall-stability → pass

  판정:
    charge-blast:        verdict = fail
    happy-path:          verdict = review  (pipe < scenario)
    overall-stability:   verdict = review  (pipe < graph)

  의미: 하위 이슈는 상위 모든 레벨에 전파된다.
        시나리오 레벨에서도, 그래프 레벨에서도 검토가 필요.
```

```
케이스 4: 전부 pass → 전부 pass

  평가 대상:
    [pipe]  charge-resilience    → pass
    [graph] order-flow-stability → pass

  판정:
    charge-resilience:     verdict = pass
    order-flow-stability:  verdict = pass

  의미: 하위에 이슈가 없으므로 상위도 깨끗.
```

#### review는 차단이 아니라 검토 요청

- CI에서: review verdict → warning 로그 + 이슈 리포트 생성
- 로컬에서: 테스트 pass (review는 pass의 변형), 콘솔에 검토 항목 출력
- **review가 누적되면**: 하위 게이트 기준을 조정하거나, 코드를 수정하여 해소

## 게이트 스펙 예시

```typescript
const chargeResilience: PipeGateSpec = {
  id: "charge-resilience",
  level: "pipe",
  target: "charge",
  description: "결제 파이프는 resilience + latency 관심사를 갖추어야 한다",
  criteria: [
    { type: "concern-present", values: ["resilience", "latency"] },
    { type: "role-is", value: "transformer" },
    { type: "blast-radius-max", value: 5 },
  ],
};

const graphStability: PipeGateSpec = {
  id: "order-flow-stability",
  level: "graph",
  target: "order-flow",
  description: "주문 처리 그래프 전체 안정성",
  criteria: [
    { type: "no-isolated-pipes" },
    { type: "max-complexity", value: 100 },
    { type: "concern-present", values: ["resilience", "data-mutation", "observability"] },
  ],
};
```

## 제약

### path-coverage-min은 실제 경로 수 필수

`path-coverage-min` 기준은 `executedPathCount`(실행된 경로 수)를 반드시 제공해야 한다.
미제공 시 **fail** 판정 + "계산 불가" 메시지를 반환한다.

- 파이프 수(pipe count)를 경로 수(path count)의 근사치로 사용하지 않는다
- `analyzeCoverage`의 `pathCoverage`도 `executedPathCount` 미제공 시 `null` 반환

```typescript
// ✗ 잘못된 사용 — executedPathCount 없으면 fail
evaluateGate(spec, graph, executedPipeIds);

// ✓ 올바른 사용
evaluateGate(spec, graph, executedPipeIds, executedPathCount);
```

## 구현 소스

- `packages/core/src/pipe-gate.ts`
- 테스트: `pipe-gate.test.ts` (17건)
- 퀄리티 게이트: `pipe-interpret-gate.test.ts` (spec-tracker 연동)
