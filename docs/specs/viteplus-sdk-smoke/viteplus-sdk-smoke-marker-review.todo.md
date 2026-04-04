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

## 결정 완료 (OQ-1, OQ-4)

### OQ-1: scope-nesting = contract descent의 런타임 구현체 (결정됨)

PipeSpec 매핑 리뷰 결과, scope-nesting은 데이터 흐름 제어가 아니라 **계약 소유/전파 구조**임이 확인됨.
PipeFlow 31번째 유형(B안)은 카테고리 오류로 탈락.

**채택 방향**: contract descent 체계를 확장하여 scope-nesting 검증을 포함.

- Scope = 계약을 소유하는 Boundary. provides/consumes로 계약 명시
- Nesting = 계약 하향 경로. provider 순서 = contract descent 순서
- 검증 = "하위가 소비하는 계약의 제공자가 상위에 존재하는가"
- PipeSpec 측정 인프라(TestCase 좌표, QualityMetrics, drift 감지) 재사용
- handlers 계층은 PipeSpec transformer로 내부 경로 검증 병행

구현: `packages/core/src/scope-nesting.ts`

### OQ-4: module `^method` 방향 (결정됨)

"5개 boundary를 contract descent 순서로 중첩하고, 각 scope가 하위에 계약을 제공한다.
handlers 계층에서만 PipeSpec transformer 패턴이 적용된다."

## 오픈 퀘스천

### OQ-5: doc lifecycle의 시뮬레이션 역할

3계층→4계층 확장 시 L0(운영 상태 제약)에 GateEngine/GateState/하네스는 포함 결정됨.
doc lifecycle은 guard 의존 순서에서 "Doc approved → Gate complete" 전제 조건이지만, 시뮬레이션 목적(코드 경로 검증)에 부합하는지 미결.

**충돌 지점:** doc lifecycle은 문서 관리 상태이지 런타임 코드 실행 상태가 아님. 시뮬레이션이 코드 경로 검증이라면 문서 상태가 코드에 영향을 주는 실제 경로가 있는가?

**방향 후보:**
- A) L0 guard에 포함 — 문서 미승인 시 convention 전이 차단
- B) L0 guard에서 제외 — 런타임 검증으로 한정, doc lifecycle은 CI/CD gate
- C) 별도 스펙에서 연결점 재정의 — doc lifecycle이 영향 주는 "런타임 경로"를 특정하여 그것만 guard화
