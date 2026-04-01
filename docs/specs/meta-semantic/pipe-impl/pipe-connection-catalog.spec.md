---
def:
  id: pipe-connection-catalog
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

# ConnectionKind 카탈로그 — 8종 파이프 간 연결

## 목적 ^purpose

PipeGraph에서 파이프 노드를 연결하는 8종 ConnectionKind의
표현 방식, 정의 방식, 검증 방식, 경로 계산 규칙을 정의한다.

> 타입: `core/src/types/pipe-spec.ts` `ConnectionKind`, `PipeConnection` 참조

---

## 순차 (2종)

### next

| 항목 | 내용 |
|------|------|
| 표현 | `{ from: "a", to: "b", kind: "next" }` |
| 의미 | from 완료 → to 시작 (무조건 순차) |
| 정의 | from(필수), to(필수) |
| 검증 | from 완료 후 to 실행 확인. from 미완료 시 to 미실행 확인 |
| 경로 계산 | 곱 (from 경로 × to 경로) |

### conditional

| 항목 | 내용 |
|------|------|
| 표현 | `{ from: "a", to: "b", kind: "conditional", condition: "status === 'ok'" }` |
| 의미 | from 완료 + 조건 충족 → to 시작 |
| 정의 | from(필수), to(필수), condition(필수) |
| 검증 | 조건 true → to 실행 + 조건 false → to 미실행 확인 |
| 경로 계산 | 합 (조건 분기) |

---

## 이벤트 (1종)

### event

| 항목 | 내용 |
|------|------|
| 표현 | `{ from: "a", to: "b", kind: "event" }` |
| 의미 | from.produces 이벤트 → to.trigger.eventKey 매칭 |
| 정의 | from(필수), to(필수). from.produces와 to.trigger.eventKey가 매칭되어야 유효 |
| 검증 | from이 이벤트 생산 → to가 트리거됨 확인. 이벤트 미생산 시 to 미실행 확인 |
| 경로 계산 | 곱 (이벤트 체인) |
| 검증 규칙 | event-mismatch: from.produces에 to.trigger.eventKey 없으면 warning |

---

## 에러 (2종)

### error

| 항목 | 내용 |
|------|------|
| 표현 | `{ from: "a", to: "error-handler", kind: "error" }` |
| 의미 | from 실패 → to 시작 (에러 핸들링) |
| 정의 | from(필수), to(필수) |
| 검증 | from 실패 시뮬레이션(failureResolver=false) → to 실행 확인 |
| 경로 계산 | 합 (정상 + 에러 대안) |

### compensate

| 항목 | 내용 |
|------|------|
| 표현 | `{ from: "payment", to: "cancel-order", kind: "compensate" }` |
| 의미 | from의 후속 파이프가 실패 → to가 from의 결과를 롤백 (saga) |
| 정의 | from(필수), to(필수) |
| 검증 | from 성공 후 후속 실패 → to(보상) 실행 확인. to 후 from의 부수효과 복원 확인 |
| 경로 계산 | 합 (정상 + 보상) |

---

## 동시성 (2종)

### fan-out

| 항목 | 내용 |
|------|------|
| 표현 | `{ from: "a", to: ["b", "c", "d"], kind: "fan-out" }` |
| 의미 | from 완료 → to[] 전부 동시 시작 (1:N) |
| 정의 | from(필수), to(필수, 2+). to가 단일이면 next로 충분 (warning) |
| 검증 | from 완료 후 to[] 전부 실행 확인. 병렬 실행 확인 |
| 경로 계산 | 곱 (to[0] × to[1] × ...) |

### join

| 항목 | 내용 |
|------|------|
| 표현 | `{ from: ["b", "c"], to: "d", kind: "join" }` |
| 의미 | from[] 전부 완료 → to 시작 (N:1) |
| 정의 | from(필수, 2+), to(필수). from이 단일이면 next로 충분 (warning) |
| 검증 | from[] 일부만 완료 → to 미실행 + from[] 전부 완료 → to 실행 확인 |
| 경로 계산 | 1 (합류점, 합류 후 to의 경로만) |
| 검증 규칙 | join-incomplete: from[] 중 entry에서 도달 불가능 파이프 있으면 error |

---

## 제어 (1종)

### feedback

| 항목 | 내용 |
|------|------|
| 표현 | `{ from: "controller", to: "sensor", kind: "feedback" }` |
| 의미 | from 출력 → to 입력 (폐루프 재트리거). 순환 허용 |
| 정의 | from(필수), to(필수). 종료 조건이 PipeFeedback.until에 정의 |
| 검증 | 수렴 조건 도달 시 루프 종료 확인. maxIterations 초과 시 정상 중단 확인 |
| 경로 계산 | countPaths(to) — 반복 횟수 무관 |
| 검증 규칙 | feedback-no-convergence: 종료 조건 없으면 warning |

---

## N:M PipeConnection

fan-out과 join은 `from: string | string[]`, `to: string | string[]`로 N:M을 표현한다.

| 패턴 | from | to | kind |
|------|------|-----|------|
| 1:1 순차 | `"a"` | `"b"` | next |
| 1:N 동시 | `"a"` | `["b", "c"]` | fan-out |
| N:1 합류 | `["b", "c"]` | `"d"` | join |
| 1:1 조건부 | `"a"` | `"b"` | conditional |

> 타입: `core/src/types/pipe-spec.ts` `PipeConnection` 참조
