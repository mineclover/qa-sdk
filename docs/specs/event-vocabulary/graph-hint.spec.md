---
def:
  id: graph-hint-spec
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  tags: [tier-system]
  links:
    - target: event-core-pattern
      type: depends_on
---

# Graph Hint — 이벤트 그래프 의미론

## 목적 ^purpose

Core Event가 실행 그래프에서 어떤 역할을 하는지 정적 힌트를 제공한다. engine의 reconstruction/matching이 이 힌트를 활용하여 그래프 구조를 더 정확히 해석할 수 있다.

## 구성 ^overview

- **핵심 개념**: GraphHint는 이벤트가 실행 그래프에서 어떤 역할을 하는지 정적으로 선언하는 메타데이터로, engine이 그래프 구조를 해석할 때 참고한다
- **GraphRole 4종**: entry(흐름 시작점 10개), transition(흐름 전진 23개), terminal(흐름 종착점 17개), observation(방향 불변 관측 10개)
- **goal_eligible**: 시나리오 goal node 후보 표시 — success, complete, conversion, form_submit_success 4개만 해당
- **loopable**: 단일 trace 내 반복 발생이 자연스러운 이벤트 표시 — 60개 중 40개가 loopable, false인 이벤트의 반복은 anomaly 후보
- **8개 카테고리별 매핑**: navigation, interaction, form, session, network, execution, outcome, quality — 총 60개 core event에 hint 할당
- **설계 원칙**: 힌트이지 규칙이 아님(engine override 가능), 정적 데이터(런타임 컨텍스트 불필요), category와 직교, custom event에도 적용 가능
- **Custom Event 기본값**: graph_hint 없이 등록된 custom event에는 `{ role: "transition", goal_eligible: false, loopable: false }` 적용
- **소비 패턴**: trace 시작점 추정(entry role), goal reachability 판단(goal_eligible), 비정상 반복 감지(loopable=false + 반복 발생)

## 상태

implemented

## 배경

event-catalog는 이벤트를 "무엇(what)"으로 정의한다 — category, channel, payload.
하지만 실행 그래프에서 이벤트가 **어떤 역할(role)**을 하는지는 표현하지 않는다.

비전: "먼저 관측하고, 나중에 평가한다."
관측을 정확히 하려면 이벤트가 흐름에서 어디에 위치하는지 힌트가 필요하다.

## 설계 원칙

1. **힌트이지 규칙이 아니다** — engine은 graph_hint를 참고하되 override 가능
2. **정적 데이터다** — 런타임 컨텍스트 없이 이벤트 정의만으로 결정
3. **category와 직교한다** — category는 도메인 분류, graph_hint는 그래프 위치
4. **custom event에도 적용 가능하다** — core event 전용이 아닌 범용 스키마

## 타입 정의

> 타입 정의: packages/event-catalog/src/types.ts — GraphRole, GraphHint

### GraphRole

| 값 | 의미 | 판별 기준 |
|---|---|---|
| `entry` | 흐름/trace의 시작점 | 세션/앱/페이지 진입, SDK 초기화 등 |
| `transition` | 흐름을 전진시키는 이벤트 | 상호작용, 네트워크 호출, 상태 변경 등 |
| `terminal` | 흐름의 종착점 | 성공/실패/완료/취소/이탈 등 결과 상태 |
| `observation` | 흐름 방향을 바꾸지 않는 관측 | 오류 기록, 검증, 마스킹, 경고 등 |

### goal_eligible

시나리오 그래프에서 **goal node 후보**가 될 수 있는 이벤트.
engine이 goal reachability를 판단할 때 이 이벤트만 goal 후보로 허용한다.

기준:
- 의도된 결과 달성을 표현하는 이벤트
- 주로 outcome 카테고리의 긍정적 결과
- terminal role과 독립 — terminal이면서 goal이 아닌 이벤트 존재 (failure, timeout)

### loopable

단일 trace 내에서 **반복 발생이 자연스러운** 이벤트.
engine이 loop 감지 시 이 플래그가 false인 이벤트의 반복을 anomaly 후보로 취급할 수 있다.

기준:
- 사용자 상호작용 반복 (click, scroll, input_change)
- 네트워크 재시도 (retry, http_request/response)
- 상태 전이 반복 (state_transition)

## 이벤트별 Graph Hint 매핑

### navigation

| event_key | role | goal_eligible | loopable | 근거 |
|---|---|---|---|---|
| page_view | entry | false | true | 흐름 시작점, SPA에서 반복 가능 |
| screen_view | entry | false | true | 앱 흐름 시작점, 탭 전환 반복 |
| route_change | transition | false | true | 라우트 이동은 흐름 전진 |
| app_open | entry | false | false | 앱 실행은 단발 진입 |
| deep_link_open | entry | false | false | 딥링크 진입은 단발 |
| app_background | terminal | false | true | 흐름 중단, 반복 가능 (멀티태스킹) |
| app_foreground | entry | false | true | 흐름 재개, 반복 가능 |

### interaction

| event_key | role | goal_eligible | loopable | 근거 |
|---|---|---|---|---|
| click | transition | false | true | 흐름 전진, 당연히 반복 |
| tap | transition | false | true | click의 모바일 버전 |
| scroll | transition | false | true | 반복 발생 자연스러움 |
| swipe | transition | false | true | 반복 제스처 |
| hover | observation | false | true | 흐름 방향 안 바꿈, 반복 |
| focus | transition | false | true | 입력 진입 |
| blur | transition | false | true | 입력 이탈 |
| select | transition | false | true | 항목 선택 |
| expand | transition | false | true | UI 상태 변경 |
| collapse | transition | false | true | UI 상태 변경 |

### form

| event_key | role | goal_eligible | loopable | 근거 |
|---|---|---|---|---|
| input_change | transition | false | true | 입력 반복 자연스러움 |
| form_submit | transition | false | true | 재시도 가능 |
| form_submit_success | terminal | true | false | 성공 결과, goal 후보 |
| form_submit_failure | terminal | false | true | 실패 후 재시도 가능 |
| validation_error | observation | false | true | 흐름 안 바꿈, 반복 발생 |

### session

| event_key | role | goal_eligible | loopable | 근거 |
|---|---|---|---|---|
| session_start | entry | false | false | 세션 시작 단발 |
| session_end | terminal | false | false | 세션 종료 단발 |
| session_timeout | terminal | false | false | 비활성 종료 단발 |
| enter_flow | entry | false | true | 시나리오 진입, 중첩 가능 |
| exit_flow | terminal | false | true | 시나리오 이탈, 중첩 가능 |
| bounce | terminal | false | false | 조기 이탈 단발 |

### network

| event_key | role | goal_eligible | loopable | 근거 |
|---|---|---|---|---|
| http_request | transition | false | true | API 호출 반복 |
| http_response | transition | false | true | 응답 반복 |
| rpc_request | transition | false | true | RPC 호출 반복 |
| rpc_response | transition | false | true | RPC 응답 반복 |
| websocket_open | transition | false | false | 연결 수립 단발 |
| websocket_message | transition | false | true | 메시지 반복 |
| websocket_close | terminal | false | false | 연결 종료 |
| retry | transition | false | true | 재시도 핵심 반복 이벤트 |

### execution

| event_key | role | goal_eligible | loopable | 근거 |
|---|---|---|---|---|
| task_start | entry | false | true | 작업 시작, 여러 작업 가능 |
| task_finish | terminal | false | true | 작업 종료, 여러 작업 가능 |
| job_start | entry | false | false | 배치 시작 단발 |
| job_finish | terminal | false | false | 배치 종료 단발 |
| sdk_init | entry | false | false | SDK 초기화 단발 |
| sdk_flush | transition | false | true | flush 반복 |
| tool_invoke | transition | false | true | 에이전트 도구 반복 호출 |
| tool_result | transition | false | true | 도구 결과 반복 |
| state_transition | transition | false | true | 상태 전이 반복 |

### outcome

| event_key | role | goal_eligible | loopable | 근거 |
|---|---|---|---|---|
| success | terminal | **true** | false | 성공 = 핵심 goal |
| failure | terminal | false | false | 실패는 goal 아님 |
| complete | terminal | **true** | false | 완료 = goal 후보 |
| cancel | terminal | false | false | 취소는 goal 아님 |
| timeout | terminal | false | false | 시간 초과는 goal 아님 |
| drop_off | terminal | false | false | 이탈은 goal 아님 |
| conversion | terminal | **true** | false | 전환 = 핵심 goal |

### quality

| event_key | role | goal_eligible | loopable | 근거 |
|---|---|---|---|---|
| error | observation | false | true | 오류 관측, 반복 가능 |
| warning | observation | false | true | 경고 관측, 반복 가능 |
| assertion | observation | false | true | 검증 관측, 반복 가능 |
| mask_applied | observation | false | true | 마스킹 관측, 반복 가능 |
| field_present | observation | false | true | 필드 확인, 반복 가능 |
| field_missing | observation | false | true | 필드 누락, 반복 가능 |
| policy_violation | observation | false | true | 정책 위반, 반복 가능 |
| unexpected_event | observation | false | false | 예상 외 이벤트 단발 기록 |

## 통계 요약

| role | 이벤트 수 |
|---|---|
| entry | 10 |
| transition | 23 |
| terminal | 17 |
| observation | 10 |

| 플래그 | true 수 |
|---|---|
| goal_eligible | 4 (success, complete, conversion, form_submit_success) |
| loopable | 40 |

## CoreEventDef 확장

> 타입 정의: packages/event-catalog/src/types.ts — CoreEventDef

## 소비 패턴

```typescript
// engine reconstruction — entry 이벤트로 trace 시작점 추정
import { getCoreEvent } from "@qa-sdk/event-catalog";
const def = getCoreEvent("page_view");
if (def?.graph_hint.role === "entry") { /* trace root 후보 */ }

// engine matching — goal reachability 판단
if (def?.graph_hint.goal_eligible) { /* goal node 후보 허용 */ }

// engine anomaly — 비정상 반복 감지
if (!def?.graph_hint.loopable && occurrenceCount > 1) { /* anomaly 후보 */ }
```

## Custom Event 가이드

Custom event 등록 시에도 graph_hint를 설정할 수 있다.

```typescript
// registry-server 등록 시
{
  event_key: "purchase_confirmed",
  graph_hint: { role: "terminal", goal_eligible: true, loopable: false }
}
```

registry-server는 graph_hint 없이 등록된 custom event에 대해 기본값을 적용한다:

```typescript
const DEFAULT_GRAPH_HINT: GraphHint = {
  role: "transition",
  goal_eligible: false,
  loopable: false,
};
```

## 제약 조건

- graph_hint는 **정적 메타데이터**다 — 런타임에 변경하지 않는다
- engine은 graph_hint를 **참고**하되 시나리오 DSL의 명시적 설정이 우선한다
- goal_eligible은 **후보 표시**일 뿐, 실제 goal 지정은 시나리오 스펙에서 한다
- loopable=false인 이벤트가 반복되면 **경고**하되 거부하지 않는다
