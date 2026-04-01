---
def:
  id: pipe-flow-catalog
  level: leaf
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: draft
  layer: domain
  links:
    - target: meta-semantic-pipe-impl
      type: depends_on
    - target: pipe-types
      type: refines
---

# PipeFlow 카탈로그 — 29종 표현·정의·검증 방식

## 목적 ^purpose

PipeFlow 29종 각각의 표현 방식(어떻게 쓰는가), 정의 방식(무엇을 명시해야 하는가),
검증 방식(어떻게 증명하는가)을 정의한다.

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

## 트랜잭션 (1종)

### compensate

| 항목 | 내용 |
|------|------|
| 표현 | `{ kind: "compensate", forward: createOrder, compensate: cancelOrder }` |
| 정의 | forward(필수), compensate(필수) |
| 검증 | forward 성공 후 후속 실패 시 compensate 실행 확인. compensate 후 상태 복원 확인 |
| 경로 수 | countPaths(forward) + countPaths(compensate) |

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
