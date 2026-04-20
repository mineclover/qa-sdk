---
def:
  id: df-taxonomy-cases
  type: spec
  tier: component
  scope: data
  aspect: user_scenario
  depth: validation
  lifecycle: approved
  layer: domain
  svc: decision-flow
  tags: [scenario, decision, taxonomy]
  links:
    - target: df-taxonomy
      type: refines
    - target: df-system
      type: depends_on
---

# DF Taxonomy — 소비자 기대 시나리오

## 목적 ^purpose

`df-taxonomy`(4개 층 분류 체계)가 `df-system`에 의존할 때 기대하는 계약. taxonomy는 df-system이 제공하는 축, prefix, governance 요소들을 한 뷰로 조립하며, 이 조립이 일관되려면 df-system 구성 요소들이 직교 · 안정 · 공유 가능해야 한다.

## 시나리오 1: 4개 층 경계 보존 ^overview

**전제**: df-taxonomy가 설명 축 / 관측 축 / 거버넌스 축 / 런타임 축 4개 층을 선언한다.

**동작**: 개발자가 신규 결정 유형을 추가할 때 taxonomy 뷰를 통해 어느 층에 속하는지 결정한다.

**기대**:
- 각 항목이 정확히 1개 층에 속한다 (설명 ∩ 관측 = ∅)
- 층 경계가 `df-constraint`의 `boundary` 규칙에 의해 강제됨
- 경계를 넘는 추가 (예: 설명 축이 런타임 상태를 직접 참조) → df-taxonomy validate 단계에서 거부

**실패 시 수정 대상**: `df-system`의 `df-constraint` 스펙. boundary validator가 없거나 약하면 층이 섞여 taxonomy 추적이 무력화.

## 시나리오 2: DecisionUnit 경계 불가침 ^overview

**전제**: `df-taxonomy`는 DecisionUnit이 `topic/objective/successCriteria`를 가지며 PM backlog item의 속성(owner, due date, milestone)을 소유하지 않음을 명시한다.

**동작**: 외부 시스템(예: PM 서비스)이 DecisionUnit에 `assignee` 필드를 확장 주입하려 시도한다.

**기대**:
- DecisionUnit 타입이 strict (`.strict()`) → 미정의 필드 거부
- PM 속성은 별도 `initiative_ref` 링크로만 연결 (값 복제 금지)
- df-taxonomy의 경계 규칙 위반 시 runtime validate error

**실패 시 수정 대상**: `df-system`의 `df-taxonomy` 경계 규칙 ^constraint 절. DecisionUnit 확장 경로를 명시적으로 막거나, cross-domain 확장을 `DecisionContext.imports`로 제한.

## 시나리오 3: FlowStatus vs delivery 상태 분리 ^overview

**전제**: `df-taxonomy`는 FlowStatus(판단 과정 상태)가 delivery 상태 체계를 대체하지 않음을 명시한다.

**동작**: 내부 UI/CLI가 FlowStatus를 기반으로 delivery progress를 집계하려 시도한다.

**기대**:
- FlowStatus 값 집합이 {pending, active, completed, abandoned} 4종으로 고정
- delivery 상태 (in_review, deployed, …) 매핑이 별도 projection 레이어에서만 수행 (df-system 코어에는 없음)
- taxonomy 문서가 이 분리를 경계 규칙으로 선언

**실패 시 수정 대상**: `df-system`의 `df-state-model`. FlowStatus 확장 제안이 들어오면 df-taxonomy 경계 규칙 리뷰 필수.

## 시나리오 4: Cognitive phase 재사용성 ^overview

**전제**: `df-taxonomy`의 설명 축 중 `cognitive_phase`, `mental_model`, `forcing_question`은 생각 추적 전용으로 PM taxonomy에 편입 금지.

**동작**: 외부 skill/CLI가 cognitive_phase를 PM taxonomy core 축으로 흡수하려 한다.

**기대**:
- df-taxonomy가 이 3개 축의 "PM core 편입 금지"를 경계 규칙으로 선언
- axis 공유 시도 시 `boundary-violation` warning
- 재사용은 `DecisionContext.exports` 리스트에 명시적으로 추가한 후에만 허용

**실패 시 수정 대상**: `df-system`의 `DecisionContext` 계약. export 목록이 없거나 강제되지 않으면 taxonomy 경계가 사실상 무의미해진다.
