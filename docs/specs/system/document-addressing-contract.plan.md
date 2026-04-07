---
def:
  id: document-addressing-contract
  level: leaf
  scope: flow
  aspect: process_flow
  depth: specification
  layer: operation
  tags: [cross-scope, structural]
  links:
    - target: document-addressing-contract
      type: refines
    - target: definition-taxonomy
      type: depends_on
    - target: doc-type-convention
      type: depends_on
    - target: taxonomy-boundaries
      type: depends_on
---

# Document Addressing Contract — 계획

## 목적 ^purpose

문서 교집합 모델을 실제 계약 문서로 승격하기 위한 설계 단계를 정리한다. 목표는 문서의 본질 주소와 표현 경로를 분리하고, role/spec/test/plan/todo 분할이 같은 family 안에서 일관되게 작동하도록 만드는 것이다.

## 현재 목표 ^overview

- 문서를 `subject × placement × role × state` 교차점으로 보는 모델 정리
- `identity / family / path` 3계층 주소 모델 정리
- 파일 경로와 링크 그래프의 책임 분리
- 이후 spec 승격 기준 마련

## 단계

### 1. identity 모델 고정

- `doc_id`
- `family_id`
- `role`
- `subject_coord`
- `placement_coord`
- `state_coord`

결정 질문:
- `doc_id`를 opaque id로 둘지
- `family_id`를 사람이 읽는 안정 id로 둘지

### 2. placement 모델 고정

- `placement_coord`가 무엇을 포함하는지 결정
- `level`, `contains`, `parent`, `boundary` 중 무엇이 canonical인지 정리

결정 질문:
- placement를 문서 트리 기준으로 볼지
- structural boundary 기준으로 볼지
- 둘을 분리할지

### 3. role family 규칙 고정

- 같은 family 안에서 어떤 role이 공존 가능한지
- `spec -> rule -> test`
- `plan -> todo -> spec`
- `memo`의 위치와 참조 규칙

결정 질문:
- 같은 family에 `spec/rule/test/plan/todo/memo`를 전부 허용할지
- 일부 role만 허용할지

### 4. projection view 정의

- subject view
- role view
- structure view

결정 질문:
- 어떤 projection을 first-class로 둘지
- 어떤 projection은 단순 query 결과로 둘지

### 5. contract spec 승격

아래 문서로 분리 가능:

- `document-addressing-contract.spec.md`
- `document-family-model.spec.md`
- `document-projection-view.spec.md`

## 경계

- 이 plan은 주소 계약의 방향만 다룬다
- definition taxonomy 자체를 재정의하지 않는다
- document type taxonomy 자체를 재정의하지 않는다
- business taxonomy 세부 구조는 별도 토론 대상으로 둔다

## 완료 조건

1. 문서 identity와 family의 차이가 명시된다
2. file path와 identity address의 차이가 명시된다
3. role taxonomy가 family 분할 규칙으로 정리된다
4. projection view 목록이 고정된다
5. spec 승격 후보 문서가 결정된다
