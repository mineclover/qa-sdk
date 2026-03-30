---
def:
  id: skill-dkg-skill-cascade
  address: def_document:v2:68801
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  layer: experience
  tags: [generated]
  links:
    - target: dkg-skill-group
      type: refines
    - target: skill-dkg-skill-catalog
      type: depends_on
    - target: skill-dkg-skill-decision
      type: depends_on
---


## 탐색 ^navigation

skill-catalog-system > dkg-skill-group > **skill-dkg-skill-cascade**

형제: `skill-dkg-skill-migrator` · `skill-dkg-skill-version-event` · `skill-dkg-skill-decision` · `skill-dkg-skill-catalog`

## 목적 ^purpose

DKG 노드 변경이 어떤 domain, DSL, consumer, leaf까지 전파되는지 추적해, 구조 변경의 연쇄 효과를 파악하게 하는 스킬이다.

## 사용 맥락 ^context

축이나 prefix, service ownership을 바꾸기 전에 어떤 downstream 노드가 연쇄적으로 영향을 받는지 보고 싶을 때 사용한다.

## 설계 의도 ^intent

한 노드의 변경을 국소 수정으로 오해하지 않도록, graph 위에서 연쇄 전파를 먼저 보게 한다.
이렇게 해야 구조적 영향과 작업 충돌을 early stage에서 발견할 수 있다.

## 피드백 규칙 ^feedback

- 같은 노드에서 cascade 조회가 반복되면 해당 노드의 overview나 consumer 문서를 보강한다.
- cascade 결과가 너무 넓게 퍼지면 domain 경계 재설계 후보로 기록한다.

## 주의사항 ^caveat

graph 전파 범위는 실제 런타임 장애 범위와 동일하지 않을 수 있다.
authoring이 부족한 노드는 cascade도 과소평가될 수 있다.

## 관련 소스

- packages/spec-core/src/dkg/skills/
