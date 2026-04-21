---
def:
  id: decision-service-spec-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: decision-service
  tags: [scenario, decision-service, persistence]
  links:
    - target: decision-service-spec
      type: refines
    - target: decision-service-system
      type: depends_on
---

# Decision Service Spec — 소비자 기대 시나리오

## 목적 ^purpose

`decision-service-spec`(의사결정 흐름 추적 + 결정 상태/근거 영속화 기능) 이 `decision-service-system`에 의존할 때 기대하는 계약. spec 은 runtime system(NestJS + Fastify + SQLite + 3 모듈) 이 제공하는 FlowSchema/FlowInstance/flow_links 영속 구조 위에서만 성립한다.

## 시나리오 1: FlowSchema → FlowInstance 영속 분리 ^overview

**전제**: `decision-service-system`이 schemas / instances / links 3개 모듈을 분리하고, flow_schemas + flow_instances + flow_links 3개 테이블로 관계를 명시.

**동작**: 클라이언트가 FlowSchema 를 등록 후 여러 FlowInstance 를 생성.

**기대**:
- FlowSchema 는 immutable (한번 등록 → 변경 시 새 버전으로 fork)
- FlowInstance 는 참조하는 FlowSchema 가 존재해야 생성 허용 (FK 제약)
- FlowSchema 삭제 시 연결된 FlowInstance 가 있으면 cascade 금지, 명시적 확인 필요

**실패 시 수정 대상**: `decision-service-system.md`의 3-모듈 분리 — FlowSchema/FlowInstance 관계가 명시되지 않으면 schema 편집이 이미 실행 중인 instance 해석을 깨뜨림.

## 시나리오 2: definition-service HTTP 참조 fail-open ^overview

**전제**: `decision-service-system`이 definition-service 를 HTTP 로 참조하여 flow_links 의 target 문서 존재를 확인(fail-open 정책).

**동작**: FlowInstance 에 flow_link 추가 요청이 들어오고, target 문서 ID 가 전달됨.

**기대**:
- definition-service 호출 성공 → target 존재 검증 후 link 생성
- definition-service 장애 → link 생성 허용 + warning metric (fail-open)
- link target 이 "pending" 상태 → 나중에 resync 이벤트로 재검증

**실패 시 수정 대상**: `decision-service-system.md`의 definition-service 참조 정책 — fail-open 이 명시되지 않으면 definition-service 일시 장애가 decision-service 전체 쓰기 중단으로 전파.

## 시나리오 3: FlowInstance 상태 전이 영속성 ^overview

**전제**: `decision-service-system`이 FlowInstance 의 상태 전이(pending → decided → archived 등) 를 SQLite 트랜잭션으로 처리.

**동작**: 결정자가 UI 또는 CLI 로 FlowInstance 상태를 업데이트.

**기대**:
- 상태 전이는 원자적 (partial 상태 금지)
- 같은 instance 에 동시 업데이트 → optimistic lock 또는 explicit conflict 에러
- 전이 이벤트는 audit trail 로 기록 (이력 조회 가능)

**실패 시 수정 대상**: `decision-service-system.md`의 instances 모듈 상태 전이 명세 — transaction 경계가 없으면 UI 가 중간 상태를 관측하여 의사결정 컨텍스트가 일관성 상실.

## 시나리오 4: decision-flow 라이브러리 타입 공유 ^overview

**전제**: `decision-service-system`이 decision-flow 라이브러리의 FlowSchema/FlowInstance 타입을 공유하고 런타임 validation 도 해당 스키마로 수행.

**동작**: 클라이언트가 decision-flow 로 만든 FlowSchema 를 decision-service 에 전송.

**기대**:
- 라이브러리 타입 버전과 서비스 스키마 버전이 같을 때만 등록 성공
- 버전 mismatch → 명시적 에러 (silent drop 금지)
- 서비스는 라이브러리 타입의 superset 필드 허용 안 함 (forward-compat 은 버전 bump 로 처리)

**실패 시 수정 대상**: `decision-service-system.md`의 "decision-flow 라이브러리 의존: FlowSchema/FlowInstance 타입 공유" — 타입 공유 메커니즘이 단순 JSON 덤프라면 버전 drift 감지 불가.
