---
def:
  id: behavioral-traversal
  address: def_document:v2:68743
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: deprecated
  layer: domain
  tags: [tier-infra]
  links:
    - target: coordinate-states-spec
      type: depends_on
    - target: data-design-spec
      type: depends_on
---

# 행위 축 탐색 — 데이터 흐름 경로 추적

## 목적 ^purpose

**Status: DRAFT — 목표 스펙 (전제 조건 미충족)**

좌표 타입 시스템이 "어떤 타입이 존재하는가"(정적)를 정의한다면,
행위 축 탐색은 "그 타입이 어떤 경로로 흘러가는가"(동적)를 정의한다.

서비스가 어떤 generate → transfer → consume → store를 하느냐,
어떻게 데이터가 전이되어 저장되고, 어떤 enum 데이터가 활용되느냐의 흐름.
결과적으로 **어떤 prefix가 단일 원천으로 존재하는가**를 담는다.
그래서 로깅 시스템이 들어간다.

기반: [coordinate-states.md](coordinate-states.md) · [data-design.md](data-design.md)

---

## 의존관계: 이 스펙은 QA 시스템이 전제다

```
좌표 타입 시스템 (완료)
│  고정축 정의. 타입 공유 인프라.
│
▼
QA 시스템 (다음 — 전제 조건)
│  데이터 관련 행위가 어디서 발생하는지 수집.
│  행위 지점(action point)을 관측으로 결정.
│
▼
행위 축 탐색 (이 문서 — 목표 스펙)
│  수집된 행위 지점을 기반으로 경로 추적.
```

행위 지점(어디서 generate가 일어나고, 어디서 store가 일어나는가)은 **아직 결정되지 않았다.** 설계로 결정하는 것이 아니라, QA 시스템이 관측하여 결정한다. 관측 데이터가 없으면 이 스펙의 action axis, resource, edge는 정의할 수 없다.

이 문서는 QA 시스템이 수집한 데이터 위에서 무엇을 할 수 있는지의 **목표**를 정의한다.

---

## 좌표 타입 시스템과의 관계

```
좌표 타입 시스템 (정적)           행위 축 탐색 (동적)
──────────────────────           ──────────────────────
axis = enum 타입 정의             event = 이 타입이 사용된 관측
prefix = 단일 원천 참조           path = 타입이 흘러간 경로
version = 타입 스냅샷             relation = 이벤트 간 연결
position = variant 항등성         traversal = 경로 위 탐색

좌표가 WHERE라면, 행위 축은 HOW.
```

---

## 1. 행위 축 (Action Axis)

고정된 6단계. 데이터 생명주기의 기본 어휘.

```
start → generate → consume → store → transfer → end
```

| Action | 의미 |
|---|---|
| **start** | 흐름의 시작점. 요청 수신, 트리거 발생. |
| **generate** | 데이터 생성. 새로운 값이 만들어짐. |
| **consume** | 데이터 소비. 기존 값을 읽거나 사용. |
| **store** | 데이터 저장. 영속성 계층에 기록. |
| **transfer** | 데이터 전달. 서비스 간 전송. |
| **end** | 흐름의 종료점. 응답 반환, 완료. |

---

## 2. 탐색의 최소 단위

### 2.1 이벤트 (Node)

```ts
type Event = {
  id: string
  action: "start" | "generate" | "consume" | "store" | "transfer" | "end"
  timestamp: number
  context_id: string       // trace/request 단위
  resource?: string        // 대상 리소스 (좌표 타입 시스템의 prefix 주소)
}
```

이벤트의 `resource`가 좌표 타입 시스템과의 접점. 어떤 prefix의 어떤 주소에서 이 행위가 발생했는지를 기록.

### 2.2 연결 (Edge)

```ts
type Edge = {
  from: EventID
  to: EventID
  type: "causal" | "temporal" | "resource" | "correlation"
}
```

---

## 3. 4가지 기본 관계

반드시 분리한다.

### 3.1 시간 기반 (Temporal)

순서: A → B. 조건: timestamp 증가.

기본 정렬. 로그의 자연 순서.

### 3.2 인과 관계 (Causal)

A가 B를 유발. ex: generate → consume.

**핵심 탐색 축.** 이것이 경로(path)를 형성한다.

### 3.3 자원 기반 (Resource)

같은 resource를 공유. ex: 같은 document, 같은 row, **같은 prefix 주소**.

상태 흐름 추적. 좌표 타입 시스템의 주소가 여기에 해당.

### 3.4 상관 관계 (Correlation)

같은 context / trace / request.

request 단위 추적. context_id로 묶인다.

---

## 4. 탐색 유형 (Query Pattern)

### 4.1 Forward 탐색 (→)

특정 시작점에서 이후 흐름.

```
start → ? → end
```

- 이 요청이 어디까지 갔나?
- generate 이후 어떤 consume이 발생했나?

### 4.2 Backward 탐색 (←)

결과에서 원인 추적.

```
end ← ? ← start
```

- 이 실패는 어디서 시작됐나?
- 이 데이터는 어디서 생성됐나?

### 4.3 Path 탐색 (경로 전체)

시작~종료까지 전체 흐름. **가장 중요한 탐색.**

```
start → generate → transfer → consume → store → end
```

### 4.4 Pattern 탐색

특정 패턴 찾기.

유실 탐지:
```
generate → transfer → (missing consume)
```

반복 패턴:
```
generate → consume → generate → consume
```

### 4.5 Fan-out / Fan-in

분기 (Fan-out):
```
generate → consume A
         → consume B
```

수렴 (Fan-in):
```
generate A → consume
generate B → consume
```

---

## 5. 탐색 DSL

### 5.1 기본 쿼리

```
FROM start
FOLLOW causal
UNTIL end
```

### 5.2 조건 포함

```
FROM generate
WHERE resource = "permission:v2:42"
FOLLOW causal
UNTIL store
```

`resource`에 좌표 타입 시스템의 주소가 들어간다.

### 5.3 패턴 탐색

```
MATCH
  generate → transfer → !consume
```

`!consume` = missing (유실).

### 5.4 역추적

```
FROM end
FOLLOW causal BACKWARD
UNTIL start
```

---

## 6. 내부 모델

### 6.1 Adjacency Index

```
event_id → next_event_ids     (forward)
event_id → prev_event_ids     (backward)
```

### 6.2 Multi-Index

```
by action        → 행위 유형별
by resource      → prefix 주소별 (좌표 타입 시스템 연동)
by context_id    → trace/request 단위
by timestamp     → 시간 순서
```

---

## 7. 설계 포인트

### 7.1 탐색은 그래프다

단순 로그 = 리스트 (시간 정렬).
탐색 시스템 = **그래프** (관계 기반 연결).

### 7.2 action만으로는 부족

action은 "무엇을 했나"만 알려준다. 경로를 형성하려면:
- **relation** (causal) — 왜 이 다음에 저것이 일어났나
- **context** (correlation) — 같은 요청/트레이스인가
- **resource** (좌표 주소) — 같은 대상에 대한 행위인가

### 7.3 start/end가 anchor

이것이 있어야:
- path 정의 가능 (시작~끝)
- latency 계산 가능 (start.timestamp ~ end.timestamp)
- 실패 구간 특정 가능 (end에 도달 못한 경로)

### 7.4 resource가 좌표 타입 시스템을 연결한다

이벤트의 resource 필드는 좌표 타입 시스템의 **prefix 주소**다.

```
Event { action: "store", resource: "permission:v2:42" }
                                    ↑
                         좌표 타입 시스템의 주소
                         → prefix: permission
                         → version: v2
                         → address: 42
                         → decode: { perm_svc: 40, role: "op" }
```

이 연결을 통해: "permission의 op 역할에 대해 어떤 generate → store 경로가 존재하는가"를 탐색할 수 있다.

---

## 8. 핵심 정의

```
E = (action, timestamp, context_id, resource?)
R = (causal | temporal | resource | correlation)
Traversal = (start_node, relation_type, direction, condition)
```

> **탐색은 "행위 축 이벤트들을 관계(edge)로 연결한 그래프 위에서 경로를 추출하는 것"이다.**

---

## 9. 단일 원천 추적과의 연결

행위 축 탐색의 최종 목적:

```
서비스 A: generate(permission:v2:42) → transfer → 서비스 B: consume → store
          ↑                                                        ↑
    "이 데이터의 원천은 서비스 A다"                    "서비스 B가 이것을 저장했다"
```

이 경로를 추적하면 **어떤 prefix가 어디서 단일 원천(SSOT)으로 작동하는지** 알 수 있다:
- generate한 곳 = 원천
- store한 곳 = 소비자
- 같은 데이터가 여러 곳에 store되면 = 정규화 위반 후보

로깅 시스템이 이 이벤트를 수집하고, 탐색 시스템이 경로를 구성하고, 좌표 타입 시스템이 주소의 의미를 해석한다.

---

## 10. 다음 단계: Relation 생성 전략

경로를 구성하려면 relation(edge)이 있어야 한다. 핵심 질문:

> **relation을 어떻게 생성/추론할 것인가?**

| 전략 | 방법 | 장단점 |
|---|---|---|
| **explicit** | 코드에서 명시적으로 edge 선언 | 정확. 코드 변경 필요. |
| **inferred** | resource/context_id로 자동 추론 | 자동. 오탐 가능. |
| **hybrid** | causal은 explicit, temporal/correlation은 inferred | 균형. 권장. |

이 전략 선택이 시스템 난이도를 결정한다.
