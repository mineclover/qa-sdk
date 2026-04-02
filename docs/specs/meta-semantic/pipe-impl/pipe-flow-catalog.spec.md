---
def:
  id: pipe-flow-catalog
  level: leaf
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: pipe-types
      type: refines
---

# PipeFlow 카탈로그 — 30종 표현·정의·검증·시각 방식

## 목적 ^purpose

PipeFlow 30종 각각의 표현 방식(어떻게 쓰는가), 정의 방식(무엇을 명시해야 하는가),
검증 방식(어떻게 증명하는가), 시각 표현(역할·관심사)을 정의한다.

## 시각 설계 요약 ^defines

각 flow kind가 `PipeSpec.flow`로 단독 사용될 때 `classifyPipeRole` / `extractPipeConcerns`가 도출하는 값.
`PipeSpec.produces` 설정 시 role이 `transformer`로 승격될 수 있음.

| kind | role | concerns | 노드 색상 (fill/stroke) |
|------|------|----------|------------------------|
| step | consumer | — ¹ | #f3e5f5 / #6a1b9a |
| sequence | consumer | — | #f3e5f5 / #6a1b9a |
| branch | router | — | #fff8e1 / #f57f17 |
| optional | consumer | — | #f3e5f5 / #6a1b9a |
| parallel | consumer | concurrency | #f3e5f5 / #6a1b9a |
| race | consumer | concurrency | #f3e5f5 / #6a1b9a |
| await | consumer | latency | #f3e5f5 / #6a1b9a |
| retry | consumer | resilience | #f3e5f5 / #6a1b9a |
| fallback | consumer | resilience | #f3e5f5 / #6a1b9a |
| circuit-breaker | consumer | resilience | #f3e5f5 / #6a1b9a |
| loop | consumer | — | #f3e5f5 / #6a1b9a |
| feedback | consumer | — | #f3e5f5 / #6a1b9a |
| compensate | consumer | — | #f3e5f5 / #6a1b9a |
| transition-scope | consumer³ | resilience⁴ | #f3e5f5 / #6a1b9a |
| finally | consumer | — | #f3e5f5 / #6a1b9a |
| emit | producer | async-coupling | #e3f2fd / #1565c0 |
| timeout | consumer | latency | #f3e5f5 / #6a1b9a |
| map | consumer² | — | #f3e5f5 / #6a1b9a |
| reduce | consumer² | — | #f3e5f5 / #6a1b9a |
| buffer | consumer² | — | #f3e5f5 / #6a1b9a |
| filter | consumer | data-filtering | #f3e5f5 / #6a1b9a |
| throttle | consumer | — | #f3e5f5 / #6a1b9a |
| debounce | consumer | — | #f3e5f5 / #6a1b9a |
| split | consumer² | — | #f3e5f5 / #6a1b9a |
| enrich | consumer² | — | #f3e5f5 / #6a1b9a |
| tap | observer | observability | #fce4ec / #c62828 |
| resequence | consumer² | — | #f3e5f5 / #6a1b9a |
| window | consumer² | — | #f3e5f5 / #6a1b9a |
| dedup | consumer | data-filtering | #f3e5f5 / #6a1b9a |
| correlation | consumer | async-coupling | #f3e5f5 / #6a1b9a |

> ¹ `step`: timeout 필드가 있으면 latency, dataContract.accesses에 write/readwrite 있으면 data-mutation 추가
> ² `PipeSpec.produces` 설정 시 transformer (#e8f5e9 / #2e7d32) 로 승격
> ³ `transition-scope`: body 내용에 따라 역할 결정 (scope 자체는 역할에 영향 없음)
> ⁴ `transition-scope`: compensate 필드가 있을 때만 resilience 관심사 추가

**역할 색상표**

| role | fill | stroke | 노드 모양 |
|------|------|--------|----------|
| producer | #e3f2fd | #1565c0 | 오른쪽 뾰족 오각형 |
| consumer | #f3e5f5 | #6a1b9a | 둥근 직사각형 (stadium) |
| transformer | #e8f5e9 | #2e7d32 | 다이아몬드 컷 육각형 |
| router | #fff8e1 | #f57f17 | 마름모 (diamond) |
| observer | #fce4ec | #c62828 | 타원 (ellipse) |

---

## fold topology 분류

fold topology는 하위 패싯과 경로를 단일 `PipeSpec` 인터페이스로 접을 때
"몇 개의 실행면을 어떤 형태로 합성하는가"를 설명하는 분류다.
아래 포트 수는 접힌 파이프 외부에서 보이는 주 경로 기준이며, rollback·feedback·observe 같은
내부 side path는 `특이사항`에만 적는다.

| topology | flow kind | 입력 포트 수 | 출력 포트 수 | 특이사항 |
|------|------|------|------|------|
| atomic | step | 1 | 1 | 하위 자식 없음. 단일 facet 실행을 그대로 노출 |
| linear | sequence | 1 | 1 | 내부 `steps` N개를 직렬로 접고 ingress/egress만 유지 |
| conditional | branch, optional | 1 | 1 | 내부 후보 경로는 2+이지만 외부에는 선택된 결과 1개만 노출 |
| concurrent | parallel, race, await | 1 | 1 | fan-out/join 또는 조건 대기를 숨기고 주 경로 1개로 환원 |
| resilient | retry, fallback, circuit-breaker | 1 | 1 | 재시도·대체·차단 상태를 같은 계약에 흡수. 단락 실패는 내부 정책 |
| iterative | loop, feedback | 1 | 1 | back-edge를 숨기고 수렴한 결과만 egress로 노출 |
| transactional | compensate, finally, transition-scope | 1 | 1 | rollback/cleanup은 내부 보조 경로. 외부 계약은 본체와 동일 |
| signaling | emit | 0-1 | 1 | 입력 없이 신호 생성 가능. 있으면 payload를 event로 투영 |
| temporal | timeout, throttle, debounce | 1 | 0-1 | 시간 게이트가 지연·소거·우회를 결정. `timeout`은 대체 출력 가능 |
| batch | map, reduce, buffer, filter | 1 | 1 | 외부 포트는 collection/batch 단위 1쌍, 내부 요소 수는 N |
| transformation | split, enrich | 1-2 | 1-N | `split`은 1→N fan-out, `enrich`는 주 입력 + side input 병합 |
| streaming | resequence, window | 1 | 1 | 스트림 버퍼/윈도우 상태를 내부에 숨기고 동일 stream contract 유지 |
| stateful | dedup, correlation | 1-2 | 0-1 | 숨은 state store가 방출 시점을 결정. suppress/match 모두 포함 |
| observational | tap | 1 | 1 | 주 경로는 pass-through, 관측 branch는 side effect only |

총 14개 topology가 30개 flow kind 전체를 덮으며, 각 leaf 스펙은 이 분류를 기준으로 자신이
어떤 합성 패턴을 노출하는지 설명한다.

---

## 기본 (2종)

### step

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "step", facet: "소비", eventKey: "order_submitted" }` |
| 정의 | facet(필수), eventKey(선택), constraints(선택), timeout(선택), dataContract(선택) |
| 검증 | 단위 테스트 — 입력→facet 역할 수행→출력 확인. dataContract 있으면 스키마 호환 자동 검증 |
| constraint 예시 | `{ subject: {kind:"field"}, predicate: {op:"exists"}, context: {when:"on-pipe-execution"} }` |

### sequence

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "sequence", steps: [stepA, stepB, stepC] }` |
| 정의 | steps(필수, 2+). 순서가 실행 순서 |
| 검증 | steps[i].produces ↔ steps[i+1].consumes 호환 검증 (validateStepContracts). 순서 보장 확인 |
| constraint 예시 | `{ predicate: {op:"and", children: [각 step의 constraint]} }` |

---

## 분기 (2종)

### branch

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "branch", condition: "inventory > 0", paths: [pathA, pathB] }` |
| 정의 | condition(필수), paths(필수, 2+). 조건에 따라 하나만 실행 |
| 검증 | 각 경로별 시뮬레이션 (branchResolver로 경로 선택). 모든 경로 커버리지 확인 |
| 경로 수 | Σ paths — 합산 |
| constraint 예시 | `{ predicate: {op:"or", children: [pathA constraint, pathB constraint]} }` |

### optional

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "optional", step: innerStep }` |
| 정의 | step(필수). 실행해도 되고 안 해도 됨 |
| 검증 | 두 시나리오: 실행 시(filterResolver=true) + 미실행 시(filterResolver=false) 모두 정상 |
| 경로 수 | countPaths(step) + 1 |

---

## 동시성 (3종)

### parallel

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "parallel", steps: [stepA, stepB] }` |
| 정의 | steps(필수, 2+). 전부 동시 실행, 전부 완료 대기 |
| 검증 | 모든 step 결과가 수집됐는지 확인. 순서 무관, 완료 여부만 검증 |
| 경로 수 | Π steps — 곱 |

### race

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "race", steps: [stepA, stepB] }` |
| 정의 | steps(필수, 2+). 동시 실행, 먼저 완료된 것만 채택 |
| 검증 | 각 승자별 시뮬레이션 (raceResolver). 패자 결과가 무시되는지 확인 |
| 경로 수 | Σ steps — 합산 |

### await

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "await", condition: "approval_received", timeout: 30000, then: nextStep }` |
| 정의 | condition(필수), then(필수), timeout(선택) |
| 검증 | 조건 충족 시 then 실행 + 타임아웃 시 동작(onTimeout 없으면 에러) |
| 경로 수 | countPaths(then) |

---

## 내결함 (2종)

### retry

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "retry", step: riskyStep, maxAttempts: 3, backoff: 1000 }` |
| 정의 | step(필수), maxAttempts(필수, >0), backoff(선택) |
| 검증 | failureResolver=false로 재시도 동작 확인. 최대 횟수 초과 시 실패 전파 확인 |
| 경로 수 | countPaths(step) — 재시도 횟수 무관 |

### fallback

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "fallback", try: primaryStep, catch: alternativeStep }` |
| 정의 | try(필수), catch(필수) |
| 검증 | failureResolver=true → try 경로. failureResolver=false → catch 경로. 양쪽 모두 검증 |
| 경로 수 | countPaths(try) + countPaths(catch) |

---

## 반복 (1종)

### loop

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "loop", body: processStep, until: "queue.empty", maxIterations: 100 }` |
| 정의 | body(필수), until(필수), maxIterations(권장 — 없으면 warning) |
| 검증 | 종료 조건 도달 확인. maxIterations 초과 시 정상 중단 확인 |
| 경로 수 | countPaths(body) — 반복 횟수 무관 |

---

## 트랜잭션 (2종)

### compensate

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "compensate", forward: createOrder, compensate: cancelOrder }` |
| 정의 | forward(필수), compensate(필수) |
| 검증 | forward 성공 후 후속 실패 시 compensate 실행 확인. compensate 후 상태 복원 확인 |
| 경로 수 | countPaths(forward) + countPaths(compensate) |

### transition-scope

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "transition-scope", transitionId: "transfer.execute", body: transferFlow, events: ["account.debit", "account.credit"], compensate?: rollbackFlow }` |
| 정의 | transitionId(필수), body(필수), events(필수, 1+), compensate(선택) |
| 검증 | transitionId가 event-catalog TransitionDef에 등록되어 있는지 확인. events ↔ TransitionDef.events 정합성 검증. body 실패 시 compensate 실행 확인 |
| 경로 수 | countPaths(body) + (compensate ? countPaths(compensate) : 0) |
| fold topology | transactional — compensate, finally와 동일 그룹 |

> `transition-scope`는 선언적 비즈니스 원자 경계. "전부 되거나 전부 안 되거나"를 설계 시점에 명시.
> 구현 메커니즘(DB transaction, saga, 수동 보상)은 이 선언의 소비자가 결정.
> `compensate`와의 차이: compensate는 보상 로직 쌍만 표현. transition-scope는 원자 경계 + 이벤트 소속 관계 + 선택적 보상을 포함하는 상위 개념.

---

## 비동기 (1종)

### emit

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "emit", eventKey: "notification_sent", payload: "order" }` |
| 정의 | eventKey(필수), payload(선택) |
| 검증 | 이벤트 발행 확인 (producedEvents에 포함). 후속 파이프 트리거 확인 |
| 경로 수 | 1 |

---

## 정리 (1종)

### finally

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "finally", body: mainFlow, cleanup: releaseResources }` |
| 정의 | body(필수), cleanup(필수) |
| 검증 | body 성공 시 cleanup 실행 + body 실패 시에도 cleanup 실행. 양쪽 모두 확인 |
| 경로 수 | countPaths(body) — cleanup은 항상 실행이므로 분기 아님 |

---

## 시간 (1종)

### timeout

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "timeout", body: slowFlow, duration: 5000, onTimeout: fallbackFlow }` |
| 정의 | body(필수), duration(필수, >0), onTimeout(선택) |
| 검증 | duration 이내 완료 확인 + 초과 시 onTimeout 실행 (또는 에러) 확인 |
| 경로 수 | countPaths(body) + (onTimeout ? countPaths(onTimeout) : 1) |

---

## 제어 (1종)

### feedback

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "feedback", body: adjustFlow, feedbackEvent: "sensor_reading", until: "converged", maxIterations: 50 }` |
| 정의 | body(필수), feedbackEvent(필수), until(필수), maxIterations(권장) |
| 검증 | 수렴 조건 도달 확인. maxIterations 초과 시 정상 중단 확인. 각 반복의 feedbackEvent 발행 확인 |
| 경로 수 | countPaths(body) |

---

## 배치 (4종)

### map

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "map", itemFlow: processItem, collection: "orders", concurrency: 5 }` |
| 정의 | itemFlow(필수), collection(필수), concurrency(선택, 기본 1) |
| 검증 | 컬렉션 각 항목에 itemFlow 적용 확인. concurrency 준수 확인 |

### reduce

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "reduce", step: accumulateStep, initial: "0", accumulator: "total" }` |
| 정의 | step(필수), initial(필수), accumulator(필수) |
| 검증 | 누적 결과가 기대값과 일치 확인 |

### buffer

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "buffer", body: batchProcess, count: 100, duration: 5000 }` |
| 정의 | body(필수), count 또는 duration 중 1+ 필수 |
| 검증 | count 도달 또는 duration 경과 시 body 실행 확인 |

### filter

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "filter", condition: "amount > 0", step: processValid }` |
| 정의 | condition(필수), step(필수). 조건 불만족 항목은 소멸 |
| 검증 | 통과 항목에 step 적용 + 탈락 항목 소멸 확인. filterResolver로 시뮬 |
| 경로 수 | countPaths(step) + 1 |

---

## 안정화 (3종)

### circuit-breaker

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "circuit-breaker", step: externalCall, failureThreshold: 5, cooldown: 30000 }` |
| 정의 | step(필수), failureThreshold(필수, >0), cooldown(필수), halfOpenAttempts(선택) |
| 검증 | N회 연속 실패 → 회로 개방(차단) → 쿨다운 후 반개방 → 성공 시 폐쇄 |
| 경로 수 | countPaths(step) + 1 |

### throttle

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "throttle", step: apiCall, rate: 10, interval: 1000 }` |
| 정의 | step(필수), rate(필수), interval(필수) |
| 검증 | interval 동안 rate 초과 호출 시 지연/거부 확인 |

### debounce

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "debounce", step: searchQuery, wait: 300 }` |
| 정의 | step(필수), wait(필수) |
| 검증 | wait 동안 추가 트리거 없으면 실행. 추가 트리거 시 타이머 리셋 확인 |

---

## 데이터 변환 (2종)

### split

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "split", splitBy: "order.items", itemFlow: processItem }` |
| 정의 | splitBy(필수), itemFlow(필수) |
| 검증 | 분할된 각 항목에 itemFlow 적용 확인 |

### enrich

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "enrich", source: "userService", mergeField: "user", step: enrichedFlow, timeout: 3000 }` |
| 정의 | source(필수), mergeField(필수), step(필수), timeout(선택) |
| 검증 | 외부 소스에서 데이터 조회 + mergeField에 병합 + step 실행 확인 |

---

## 관측 (1종)

### tap

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "tap", observe: logStep, step: mainFlow }` |
| 정의 | observe(필수), step(필수). observe는 step에 영향 없음 |
| 검증 | observe 실행 확인 + step 결과가 observe 유무와 무관함을 확인 |

---

## 스트리밍 (2종)

### resequence

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "resequence", orderBy: "seq_num", windowSize: 10, step: orderedProcess }` |
| 정의 | orderBy(필수), windowSize(필수), step(필수) |
| 검증 | 무순서 입력 → orderBy 기준 정렬 → step 실행 순서 확인 |

### window

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "window", type: "tumbling", size: 1000, body: aggregateStep }` |
| 정의 | type(필수: tumbling/sliding/session), size(필수), slide(sliding시), gap(session시), body(필수) |
| 검증 | 윈도우 경계에서 body 실행 확인. type별 경계 규칙 준수 |

---

## 상태 (2종)

### dedup

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "dedup", keyField: "orderId", ttl: 60000, step: processUnique }` |
| 정의 | keyField(필수), ttl(선택), step(필수) |
| 검증 | 같은 key 재입력 시 소멸 확인. ttl 경과 후 재입력 시 통과 확인 |
| 경로 수 | countPaths(step) + 1 |

### correlation

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "correlation", requestEvent: "order_placed", responseEvent: "payment_result", correlationKey: "orderId", timeout: 30000, onMatch: processResult, onTimeout: handleTimeout }` |
| 정의 | requestEvent(필수), responseEvent(필수), correlationKey(필수), onMatch(필수), timeout(선택), onTimeout(선택) |
| 검증 | 매칭 성공 시 onMatch 실행 + 타임아웃 시 onTimeout 실행 + correlationKey 일치 확인 |
| 경로 수 | countPaths(onMatch) + (onTimeout ? countPaths(onTimeout) : 1) |
