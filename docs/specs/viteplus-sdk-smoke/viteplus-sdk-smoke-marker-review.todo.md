---
def:
  id: viteplus-sdk-smoke-marker-review
  scope: process
  aspect: quality_check
  depth: task
  lifecycle: draft
  layer: mediation
  svc: viteplus-sdk-smoke
  links:
    - target: viteplus-sdk-smoke-system
      type: refines
---

# Vite+ SDK Smoke 스펙 리뷰 — 오픈 퀘스천

## 완료 (2026-04-04 마커 정비)

- [x] leaf 문서 6건 `^defines`/`^consumes` 마커 보충
- [x] provider-stack `traces_to` 양방향 링크 제거, `^constraint` 비표준 마커 제거
- [x] incident-escalation-validation `^preconditions` 추가
- [x] incident-escalation-implementation `actions/*`, `hooks/*` 추가 (OQ-3 대칭 강제)

## 결정 완료

### OQ-2: svc 필드 — 패키지 식별자로 확장 (결정됨)

`svc` = registry-service 등록 서비스 한정이 아니라, 문서가 소속된 패키지 식별자.
viteplus-sdk-smoke은 마이크로서비스가 아니지만 `svc: viteplus-sdk-smoke` 유효.

### OQ-3: 두 feature 간 구조 대칭 강제 (결정됨)

template 재사용 증명이 목적이므로 canonical-review와 incident-escalation은 동일 계층 구조를 가져야 한다.
incident-escalation-implementation에 `actions/*`, `hooks/*` 추가.

## 오픈 퀘스천

### OQ-1: context-action 패턴 정의 — 패싯 시뮬레이션 매핑 선행

context-action 패턴을 독립 정의하기 전에, 기존 meta-semantic 패싯 시뮬레이션 체계에 대입하여 매핑이 성립하는지 검증한다.

**예비 매핑 (context-action → PipeGraph):**

| context-action 계층 | PipeSpec 역할 | 패싯 분포 |
|---|---|---|
| Page Root | entry trigger (이벤트 발생점) | — |
| qa-bridge facade | observer (tap) — 흐름 차단 없이 관측 | 소비 (session/trace) |
| feature context | producer — store/refs/persist 경계 생성 | 정의 (state shape), 저장 (persist) |
| handlers/actions | transformer — 입력→검증→결과 변환 | 소비 (context), 관리 (validation), 생산 (result) |
| view render | consumer — 상태를 DOM으로 표현 | 소비 (state → render) |

**대응 관계:**

| context-action 개념 | PipeGraph 개념 |
|---|---|
| provider composition order | PipeGraph connection topology (next 연결 순서) |
| boundary 단위 5종 | PipeSpec 노드 5개 |
| state shape (app-state) | StepDataContract (파이프 간 데이터 계약) |
| interaction 규칙 | conditional flow (branch/filter) within handler pipe |
| template 재사용 | PipeSpec 공유 — 동일 pipe를 다른 graph에서 참조 |

**검증 필요 사항:**

1. provider stack의 "상위가 하위를 감싸는" 제약이 PipeGraph의 connection 방향성만으로 표현 가능한가?  
   → wrapping은 단순 순차(`next`)가 아니라 scope/lifecycle 포함 관계. PipeTransitionScope의 body 패턴이 더 적합할 수 있음

2. qa-bridge의 "흐름 차단 없이 관측" 특성이 tap flow와 정확히 일치하는가?  
   → tap의 "observe 에러 격리" 특성과 qa-bridge의 fail-open 특성이 대응

3. feature context의 store/refs가 StepDataContract으로 표현될 때, 하위 파이프들이 동일 context를 공유하는 구조를 어떻게 모델링하는가?  
   → PipeGraph의 fan-out(1→N) + 공유 데이터 참조? 아니면 단일 pipe 내부의 step 순서?

**다음 단계:** 매핑 검증 후, context-action이 PipeGraph의 특수 인스턴스라면 별도 spec 불필요 (module `^method`에서 "이 PipeGraph 패턴을 따른다"로 충분). 매핑이 불완전하면 gap을 별도 spec으로 정의.

### OQ-4: module 문서의 `^method` 내용

OQ-1의 매핑 결과에 의존한다.

- 매핑 성립 시: `^method`는 "context-action = PipeGraph 패턴이며, 5개 boundary를 이 topology로 조립한다"
- 매핑 불완전 시: `^method`에 gap 보완이 필요하고, 그 gap이 별도 spec의 대상
