---
def:
  tier: component
  id: scope-classification-guide
  type: knowledge
  knowledge_kind: guide
  address: def_document:v2:136198
  scope: flow
  aspect: user_scenario
  depth: overview
  lifecycle: approved
  layer: domain
  tags: [cross-scope, entry-point]
  links:
    - target: definition-system-philosophy
      type: traces_to
    - target: dual-coordinate-system
      type: traces_to
---
# Scope 분류 가이드 — "이 정의는 어디에 속하는가"

## 목적 ^purpose

새 문서를 작성할 때 scope와 aspect를 선택하는 기준을 제시한다. 같은 코드/기능이라도 **보는 관점**에 따라 다른 scope에 속한다. 이 가이드는 "이 정의는 무엇에 대한 것인가?"라는 질문에 대한 의사결정 트리를 제공한다.

## Scope 7종 — 판별 기준 ^overview

### 선택 의사결정 트리

```
이 정의는...
├── 화면에 보이는 것인가?                    → ui
├── 시스템이 수행하는 동작인가?              → feature
├── 동작의 순서/조건/경로인가?               → flow
├── 시간에 따라 변하는 값인가?               → state
├── "이것은 허용/금지"라는 규칙인가?          → constraint
├── 저장/전달되는 구조화된 값인가?            → data
└── 외부와의 약속(API/CLI/이벤트)인가?        → interface
```

### 1. ui — 사용자가 보는 것

**판별**: "화면에 렌더링되는가?"

| aspect | 문서화 대상 | 예시 |
|--------|-----------|------|
| layout | 화면 구조, 그리드, 영역 배치 | 대시보드 3패널 레이아웃, 모바일 탭 구조 |
| component | 재사용 가능한 UI 단위 | 버튼, 모달, 테이블, 차트 위젯 |
| interaction | 사용자 입력에 대한 반응 | 드래그앤드롭, 키보드 단축키, 제스처 |

**소비 방식**: UX 설계서. 디자이너/프론트엔드 개발자가 소비.

### 2. feature — 시스템이 하는 일

**판별**: "코드가 실행하는 로직인가?"

| aspect | 문서화 대상 | 예시 |
|--------|-----------|------|
| func_def | 함수/모듈의 핵심 기능 | GateEngine.recompute(), WeightedIndex.encode() |
| scenario | 검증 시나리오와 기대 결과 | "composite activate 시 child capacity 재계산" |

**소비 방식**: 구현 명세. 개발자가 코드 작성 시 소비.

**가장 많이 사용** (99건) — 시스템의 핵심 기능이 여기에 모인다.

### 3. flow — 순서와 경로

**판별**: "A 다음에 B가 일어나는가? 조건에 따라 분기하는가?"

| aspect | 문서화 대상 | 예시 |
|--------|-----------|------|
| process_flow | 시스템 내부 처리 흐름 | encode→check→propagate, sync→validate→deploy |
| user_scenario | 사용자 관점 여정 | 로그인→장바구니→결제→완료 |
| relation | 엔티티 간 관계 구조 | prefix 의존 DAG, 서비스 토폴로그 |

**소비 방식**: 흐름도. 분기/합류 지점과 조건을 명시.

### 4. state — 변하는 값

**판별**: "시간이 지나면 값이 달라지는가?"

| aspect | 문서화 대상 | 예시 |
|--------|-----------|------|
| domain_state | 비즈니스 도메인 상태 모델 | GateEngine 4-state, 버전 lifecycle |
| app_state | 프론트엔드 앱 상태 | 장바구니 상태, 인증 세션, UI 탭 선택 |
| system_state | 인프라 운영 상태 | DB 연결 풀, 캐시 히트율, 큐 깊이 |

**소비 방식**: 상태 전이 다이어그램. 유효 전이와 금지 전이를 명시.

### 5. constraint — 규칙과 제약

**판별**: "이것을 위반하면 시스템이 깨지는가?"

| aspect | 문서화 대상 | 예시 |
|--------|-----------|------|
| tech_constraint | 기술적 불변 조건 | CON-001~007, capacity ≥ nextPowerOf2(N×2) |
| biz_constraint | 비즈니스 규칙 | "같은 prefix를 두 서비스가 소유 금지" |
| infra_constraint | 인프라 제약 | timeout 5초, SQLite WAL 모드 필수 |

**소비 방식**: 검증 규칙. 위반 시 에러/경고를 발생시키는 조건.

### 6. data — 구조화된 값

**판별**: "저장/전달/조회되는 데이터 구조인가?"

| aspect | 문서화 대상 | 예시 |
|--------|-----------|------|
| domain_data | 비즈니스 엔티티 | EventRecord, DocRecord, TraceRecord |
| system_data | 인프라 데이터 | 메트릭, DLQ, 캐시 엔트리 |
| external_data | 외부 시스템 데이터 | 3rd party API 응답, import 포맷 |
| prefix_schema | prefix 좌표 정의 | order_event: env×region×order_action |
| axis_catalog | 축 정의 카탈로그 | def_scope(16), def_aspect(64) |

**가장 다양한 aspect** (5종) — 데이터는 도메인/시스템/외부/좌표 4계층으로 나뉜다.

### 7. interface — 외부와의 약속

**판별**: "시스템 경계를 넘는 계약인가?"

| aspect | 문서화 대상 | 예시 |
|--------|-----------|------|
| api_contract | HTTP/RPC 엔드포인트 | `GET /docs/:id`, `PATCH /docs/:id` |
| cli_contract | CLI 명령어 규격 | `qa-sdk def list --scope=data` |
| event_contract | 이벤트 스키마 규격 | EventRecord 필드, address_context 포맷 |

**소비 방식**: 계약 명세. 요청/응답 형식, 에러 코드, 인증 요구.

## Aspect 선택 기준

같은 scope 안에서 aspect를 고를 때:

| 질문 | 선택 |
|------|------|
| "이것은 재사용 가능한 단위인가?" | component (ui), func_def (feature) |
| "이것은 순서가 있는 흐름인가?" | process_flow (시스템), user_scenario (사용자) |
| "이것은 저장되는 값인가?" | domain_data (비즈니스), system_data (인프라) |
| "이것은 좌표계 정의인가?" | prefix_schema (prefix), axis_catalog (축) |
| "이것은 금지/허용 규칙인가?" | tech_constraint (기술), biz_constraint (비즈니스) |

## 현재 커버리지와 빈 슬롯

| scope | 사용 중 | 빈 슬롯 | 우선 보강 대상 |
|-------|--------|---------|--------------|
| data | 5/5 aspect | 없음 | axis_catalog 1건 추가 (메타 참조) |
| feature | 2/2 | 없음 | — |
| flow | 3/3 | 없음 | relation 보강 (ER 다이어그램) |
| interface | 3/3 | 없음 | event_contract 보강 |
| constraint | 3/3 | 없음 | biz_constraint 보강 |
| state | 3/3 | 없음 | app_state 보강 (프론트엔드 상태) |
| ui | 2/3 | **interaction** | interaction 패턴 신규 작성 |

## 다각도 해석 예시: definition-service

하나의 서비스를 scope별로 분해하면:

| scope/aspect | 정의 | definition-service 예시 |
|---|---|---|
| data/domain_data | 저장 구조 | DocRecord, document_links, FTS5 |
| feature/func_def | 핵심 기능 | updateMetadata, syncDbToFiles, computeAddress |
| flow/process_flow | 처리 흐름 | file→DB→reverse sync→frontmatter |
| state/domain_state | 상태 모델 | lifecycle (draft→approved), version 증가 |
| constraint/tech_constraint | 기술 제약 | scope×aspect 유효 조합, 5Q 검증 |
| interface/api_contract | API 계약 | PATCH /docs/:id, POST /sync/to-files, /graphql |
| feature/scenario | 검증 시나리오 | "메타데이터 변경 시 address 재계산" |
