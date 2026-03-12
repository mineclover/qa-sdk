# Event Registry Core Pattern v1

> QA Scenario DSL과 Runtime Matching Engine이 공통으로 참조할 수 있는 최소 실행 패턴 집합.

## 상태

implemented

## 목적

- QA 시나리오 DSL의 공통 언어
- SDK 자동 수집의 기본 타깃
- 서비스별 커스텀 이벤트를 감싸는 기준 축

## 설계 원칙

1. **적어야 한다** — 너무 많으면 표준이 아니라 잡동사니
2. **반복적으로 등장해야 한다** — 여러 환경에서 재사용 가능한 것만 core
3. **의미가 추상적이되 실행 가능해야 한다** — 비즈니스 특화 X, 너무 추상적 X
4. **Custom Event를 대체하지 않는다** — core는 최소 공통 패턴, 도메인 의미는 custom

## 레코드 구조

```typescript
interface CoreEventDef {
  event_key: string;
  event_version: string;
  mode: "core";
  category: EventCategory;
  channel: Channel[];
  display_name: string;
  description: string;
  auto_collectable: boolean;
  graph_hint: GraphHint;
}
```

`graph_hint`는 이벤트가 실행 그래프에서 어떤 역할을 하는지 정적 힌트를 제공한다. 상세 스펙은 [graph-hint.spec.md](graph-hint.spec.md) 참조.

## 8개 카테고리

| 카테고리 | 의미 | 이벤트 수 |
|---|---|---|
| navigation | 화면/페이지/라우트 이동 | 7 |
| interaction | 사용자 상호작용 | 10 |
| form | 입력/제출 | 5 |
| session | 세션/진입/이탈 | 6 |
| network | 네트워크/API | 8 |
| execution | 시스템/작업 실행 | 9 |
| outcome | 성공/실패/완료 결과 | 7 |
| quality | 오류/경고/검증/마스킹 | 8 |

전체 60개, v1 최소 핵심 세트 20개. 각 이벤트는 graph_hint를 통해 entry/transition/terminal/observation 역할과 goal_eligible, loopable 플래그를 갖는다.

## v1 최소 핵심 세트 (20개)

page_view, screen_view, route_change, app_open, click, tap, input_change, form_submit, session_start, session_end, http_request, http_response, sdk_init, sdk_flush, task_start, task_finish, success, failure, error, assertion

## Core vs Custom 분기 기준

### Core로 둘 것

- 여러 서비스에서 반복됨
- 자동 수집 가능성 있음
- QA 엔진이 일반화해서 다룰 수 있음
- 특정 비즈니스에 종속되지 않음

### Custom으로 둘 것

- 서비스/도메인 특화 의미
- 조직 내부 용어
- 기획 특화 KPI 이벤트
- 제품 고유 전환 이벤트

## 활용 규칙

1. Core event는 **실행 패턴**을 표현 (click, http_request, sdk_flush)
2. 도메인 의미는 payload 또는 custom event가 채움 (click + payload.element_id)
3. 강한 도메인 의미가 필요하면 custom event (signup_completed, purchase_confirmed)

## 소비 패턴

```typescript
// engine에서 — constraint 비교 시 이벤트 조회 + payload 필드명 참조
import { getCoreEvent, getPayloadGuide, isCoreEvent } from "@qa-sdk/event-catalog";

// engine에서 — graph_hint 활용 (trace 시작점 추정, goal 후보 판단, loop 감지)
const def = getCoreEvent("page_view");
if (def?.graph_hint.role === "entry") { /* trace root 후보 */ }
if (def?.graph_hint.goal_eligible) { /* goal node 후보 */ }

// registry-server에서 — DB 초기 seed용 전체 목록 (graph_hint 포함)
import { allCoreEvents } from "@qa-sdk/event-catalog";

// SDK에서 — 자동 수집 대상 확인
import { v1MinimalSet, isV1MinimalEvent } from "@qa-sdk/event-catalog";
```

## 제약 조건

- 런타임 의존성 0개 — 순수 타입 + const 데이터
- DB 없음 — 버전은 패키지 버전으로 추적
- registry-server가 이 패키지를 import해서 DB에 seed하는 구조
