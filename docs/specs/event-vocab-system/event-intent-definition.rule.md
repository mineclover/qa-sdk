---
def:
  id: event-intent-definition-rule
  type: spec
  tier: component
  scope: constraint
  aspect: tech_constraint
  depth: specification
  lifecycle: approved
  layer: operation
  svc: event-catalog
  tags: [observability, event, contract]
  links:
    - target: event-vocab-system
      type: constrains
    - target: payload-guide
      type: traces_to
    - target: event-logging-lifecycle
      type: traces_to
    - target: state-event-terminology
      type: traces_to
    - target: bdd-contract-system
      type: traces_to
    - target: event-intent-definition-cases
      type: traces_to
---

# Event Intent Definition — Requester/Data Effect Rule

## 목적 ^purpose

event를 raw backend mutation이 아니라 "누가 어떤 행동/요청 경로로 어떤 데이터 효과를 발생시켰는가"를 담는 관측 사실로 정의한다. 목표는 같은 backend state change라도 요청자, 요청 경로, frontend behavior unit, data delta, 적재 결과에 따라 add/delete/update 같은 의미가 달라지는 것을 event taxonomy와 alerting에서 일관되게 해석하게 하는 것이다.

## 핵심 원칙 ^defines

### 1. Raw mutation은 event intent가 아니다

Backend 함수는 내부적으로 `1 -> 2`, `2 -> 1`, `1 -> 11` 같은 값 변경만 수행할 수 있다. 그러나 event 의미는 이 값 변화만으로 결정되지 않는다.

의미 있는 event는 최소 다음 입력의 결합이다.

| 입력 | 질문 |
|------|------|
| requester | 누가 요청했는가 |
| request path | 어떤 route/command/job 경로로 들어왔는가 |
| frontend behavior unit | 사용자가 어떤 행동 단위를 실행했는가 |
| data subject | 어떤 데이터 객체가 대상인가 |
| data delta | before/after 또는 changed fields는 무엇인가 |
| persistence outcome | 실제로 생성/갱신/삭제/무시/실패 중 무엇이 일어났는가 |

### 2. Frontend는 behavior unit을 정의한다

Frontend event는 사용자의 행동 단위를 정의한다.

예:
- `cart.item.remove.clicked`
- `profile.avatar.upload.submitted`
- `policy.rule.disable.requested`

이 event는 사용자가 하려는 행동과 UI/flow context를 설명한다. DB row가 실제로 삭제됐는지, soft-delete인지, 상태값이 변경됐는지는 backend data-effect event가 소유한다.

### 3. Backend는 requester-aware data-effect event를 정의한다

Backend event는 요청이 data layer에 어떤 효과를 냈는지 기록한다.

예:

| raw change | request path | semantic event |
|------------|--------------|----------------|
| `status: 1 -> 2` | `POST /items` | `item.created` 또는 `item.added` |
| `status: 1 -> 2` | `PATCH /items/:id/disable` | `item.disabled` |
| `status: 1 -> 2` | retention job | `item.expired` |
| `deleted_at: null -> timestamp` | user delete route | `item.deleted` |
| `deleted_at: null -> timestamp` | compliance hold route | `item.suppressed` |

같은 mutation이라도 요청 경로와 requester context가 다르면 event key가 달라질 수 있다.

### 4. Alerting은 semantic event를 소비한다

Alert는 raw table diff가 아니라 requester-aware semantic event를 소비한다.

잘못된 패턴:
- `value changed from 1 to 2, alert delete`

올바른 패턴:
- `actor=user:123`, `behavior=policy.rule.disable.requested`, `route=PATCH /policy/rules/:id/disable`, `data_effect=disabled`, `event_key=policy.rule.disabled`

## 공통 payload envelope

Event payload는 서비스별 확장을 허용하되, request/data-effect event는 아래 필드를 우선 고려한다.

| 필드 | 의미 |
|------|------|
| `request_id` | 요청 단위 correlation id |
| `requester_id` | 요청 주체 |
| `requester_type` | user, service, job, system |
| `actor_role` | 요청 당시 역할/권한 맥락 |
| `behavior_unit` | frontend/BDD behavior contract id |
| `request_route` | HTTP route, command name, job name |
| `request_method` | HTTP method 또는 command action |
| `subject_type` | 데이터 대상 종류 |
| `subject_id` | 데이터 대상 id |
| `effect_kind` | created, updated, deleted, restored, disabled, ignored, failed 등 |
| `before_state` | 이전 상태 또는 masked summary |
| `after_state` | 이후 상태 또는 masked summary |
| `changed_fields` | 변경된 필드 목록 |
| `outcome` | success, failure, noop |

민감 데이터는 실제 값보다 `_present`, `_masked`, field list, state label을 우선 기록한다.

## Event key 결정 규칙

1. 사용자 행동 단위는 frontend/BDD가 정의한다.
2. backend event key는 request path와 data effect를 함께 보고 결정한다.
3. event key는 raw CRUD 단어만으로 끝내지 않는다. 가능하면 domain verb를 사용한다.
4. 같은 backend mutation function이 여러 request path에서 호출되면 event key 선택은 caller/request context가 주입해야 한다.
5. requester가 system/job/service이면 human actor와 구분되는 event key 또는 payload discriminator를 둔다.

## Anti-pattern

- event key를 DB operation 이름(`row_update`, `status_changed`)으로만 정의한다.
- requester 없이 data-effect event를 alert에 사용한다.
- frontend click event를 backend persistence success로 해석한다.
- backend data delta만 보고 add/delete/update intent를 추론한다.
- event를 state authority로 사용한다. state authority는 state model/DB/replay rule이 소유한다.
