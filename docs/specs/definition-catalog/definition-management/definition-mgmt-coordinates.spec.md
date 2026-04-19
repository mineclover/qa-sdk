---
def:
  id: definition-mgmt-coordinates
  type: design
  tier: component
  owner_system: definition-service
  projection_plane: intent
  intent_hierarchy: core
  scope: flow
  aspect: process_flow
  depth: specification
  lifecycle: approved
  layer: operation
  tags: [structural]
  links:
    - target: definition-management
      type: refines
    - target: definition-taxonomy
      type: depends_on
    - target: definition-level
      type: depends_on
    - target: definition-concern
      type: depends_on
---

# Definition Management — 좌표 부여

## 목적 ^purpose

definition 문서에 좌표를 부여하는 기준을 정리한다. layer, docType, level, scope×aspect, depth, tags를 어떤 질문으로 결정하는지 하나의 흐름으로 설명한다.

## 구성 ^overview

- `layer`: 이 문서가 왜 존재하는가를 판별하는 기준
- `docType`: spec과 knowledge를 동일 좌표 체계에서 구분하는 기준
- `level`: group/module/leaf의 역할 분리 기준
- `scope × aspect`: 무엇에 대한, 어떤 측면의 문서인지 고르는 기준
- `depth`: overview/specification/implementation/validation 구분 기준
- `tags`: concern/structural 태그를 부여하는 기준

## Layer — "왜 존재하는가"

| layer | 판별 | 영향 전파 |
|-------|------|----------|
| domain | 없으면 거짓 | → operation, mediation |
| operation | 없으면 느려짐 | → 자기 내부만 |
| mediation | 없으면 불편 | → experience |
| experience | 없으면 유도 소멸 | → 자기 내부만 |

## DocType — "무엇을 기록하는가"

| type | 질문 | 기록하는 것 |
|------|------|-----------|
| spec | 시스템이 무엇으로 구성되어 있는가 | 코드에서 파생 가능한 사실 |
| knowledge | 왜 이렇게 설계했는가 | 사람만이 기록할 수 있는 판단 근거 |

knowledge 문서는 `knowledge_kind`로 세분화한다.

| kind | 기록 | 예시 |
|------|------|------|
| philosophy | 시스템 철학/본질 | 왜 좌표계인가 |
| adr | 아키텍처 결정 | ADR-001: 불변 주소 |
| guide | 판단 기준/사용법 | scope 선택 가이드 |
| narrative | 진화 과정/맥락 | 시스템이 여기까지 온 경로 |
| convention | 합의된 규칙 | 에러 코드 컨벤션 |
| pattern | 반복 설계 패턴 | 이벤트 수집 패턴 |
| concept | 개념 정의 | 좌표란 무엇인가, taxonomy란 무엇인가 |

## Level — "이 문서의 역할"

| level | 질문 | 정의하는 것 | contains |
|-------|------|-----------|----------|
| group | 왜 함께 있는가 | 묶임의 이유 | → group \| module |
| module | 이 개념은 무엇인가 | 단일 개념 + 구성 참조 | → module \| leaf |
| leaf | 어떻게 동작하는가 | 최종 명세 | → 없음 |

## Scope × Aspect — "무엇에 대한, 어떤 측면"

scope가 주소 dim 1, aspect가 dim 2다. 유효 조합만 허용한다.

| scope | 유효 aspect |
|-------|------------|
| ui | layout, component, interaction |
| feature | func_def, scenario |
| flow | user_scenario, process_flow, relation |
| state | app_state, domain_state, system_state |
| constraint | tech_constraint, biz_constraint, infra_constraint |
| data | domain_data, system_data, external_data, prefix_schema, axis_catalog |
| interface | api_contract, cli_contract, event_contract |

## Depth — "얼마나 구체적인가"

| depth | 용도 | 필수 마커 |
|-------|------|----------|
| overview | 전체 조감도 | `^overview` |
| specification | 상세 명세 | `^purpose` |
| implementation | 구현 상세 | 코드 블록 |
| validation | 검증 명세 | 게이트 정의 |

## Tags — "횡단 관심사"

- concern: security, performance, accessibility, observability, testing, migration, deprecation
- structural: cross-scope, entry-point, decision, generated

## 판정 원칙 ^constraint

- 문서의 좌표는 scope × aspect × depth가 결정한다.
- level, lifecycle, tags는 메타데이터이므로 주소에 포함하지 않는다.
- 애매하면 "주 독자가 누구인가"와 "왜 존재하는가"를 먼저 판별한다.
