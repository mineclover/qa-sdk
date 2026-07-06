---
def:
  id: df-analysis-group-cases
  type: spec
  tier: component
  scope: flow
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: decision-flow
  tags: [scenario, decision, analysis]
  links:
    - target: df-analysis-group
      type: refines
    - target: df-system
      type: depends_on
sources:
  - packages/decision-flow/src/comparison.ts
  - packages/decision-flow/src/core-analysis.ts
  - packages/decision-flow/src/monitor.ts
  - packages/decision-flow/src/orthogonality.ts
  - packages/decision-flow/src/self-analysis.ts
  - packages/decision-flow/src/core-analysis.test.ts
  - packages/decision-flow/src/monitor.test.ts
  - packages/decision-flow/src/proof.test.ts
---

# DF Analysis — 소비자 기대 시나리오

## 목적 ^purpose

`df-analysis-group`(벡터 분석, 시간 패턴, 인과 매핑)이 `df-system`에 의존할 때 기대하는 계약. 분석 계층은 df-system이 확정한 축 정의, 관측 공간, FlowInstance 상태에 기반해 파생 지표를 계산한다.

## 시나리오 1: 축 정의 직교성 보장 ^overview

**전제**: `df-system`이 `df-axis-model`에서 11개 설명 축을 정의한다.

**동작**: `df-vector-analysis`가 두 결정 벡터의 유사도/직교성을 계산한다.

**기대**:
- 11개 축이 직교(orthogonal) — 한 축의 entry 변경이 다른 축 entry 값 의미를 바꾸지 않는다
- capacity가 nextPowerOf2(entries × 2) 이상 (headroom 보장)
- 분석 결과 `orthogonality_score >= 0.9` 가 기본값

**실패 시 수정 대상**: `df-system`의 `df-axis-model` 스펙. 새 축 추가 시 직교성 회귀 테스트를 통과해야 하며, 기존 축의 entry 의미가 변해서는 안 된다.

## 시나리오 2: 관측 공간 좌표 안정성 ^overview

**전제**: `df-observation-space`가 5개 prefix(decision_event, decision_path, escalation_event, forcing_response, model_apply)를 관측 축으로 선언한다.

**동작**: `df-time-analysis`가 과거 1주일 decision_event를 가져와 빈도/속도 추이를 계산한다.

**기대**:
- 같은 시간 범위 쿼리 → 같은 결과 (prefix/axis entry는 릴리즈 사이에 불변)
- prefix 스키마 업데이트로 entry가 추가되면 이전 시점 데이터에는 `null` 또는 `unknown` 매핑 반환 (역사 보존)
- 삭제 금지 — entry removal 시도 → df-system 에서 거부

**실패 시 수정 대상**: `df-system`의 prefix 버저닝 정책. entry 삭제/재매핑을 허용하는 코드 경로는 분석 결과를 망가뜨리므로 `df-observation-space`에서 명시적으로 차단.

## 시나리오 3: 인과 매핑 그래프 무결성 ^overview

**전제**: `df-causal-mapping`이 X(비즈니스 요구) ↔ Y(기술 구현) 관계를 FlowInstance 링크로 구성한다.

**동작**: `df-system`이 제공하는 `FlowInstance.links` API로 두 결정 간 causal chain을 조회한다.

**기대**:
- 순환 (A→B→A) 감지 시 에러 반환
- 누락된 엔드포인트(삭제된 FlowInstance 참조) 시 `GRAPH_INCOMPLETE` 경고
- 인과 경로 길이가 `df-constraint`의 max depth(기본 5)를 초과 시 truncated 표시

**실패 시 수정 대상**: `df-system`의 `df-state-model` 또는 `decision-flow-store`. FlowInstance 삭제 시 링크 무결성 유지 정책이 필요 (soft-delete + 링크 보존 또는 cascade 차단).

## 시나리오 4: 분석 쿼리 읽기 전용 보장 ^overview

**전제**: 분석 계층은 FlowInstance 데이터를 읽기만 한다.

**동작**: `df-vector-analysis` / `df-time-analysis` 호출이 FlowInstance 상태를 변경하지 않는다.

**기대**:
- 분석 전후 FlowInstance `updated_at` 불변
- df-cli의 analysis 명령이 SQLite read-only connection 사용
- 우연한 write는 테스트에서 감지 (snapshot hash 비교)

**실패 시 수정 대상**: `df-system`의 `decision-flow-store` 계약. 분석 경로용 read-only view 또는 connection 분리가 강제되어야 한다.
