---
def:
  tier: component
  id: skill-dkg-skill-decision
  address: def_document:v2:68803
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
      type: traces_to
    - target: skill-dkg-skill-cascade
      type: traces_to
    - target: skill-dkg-skill-version-event
      type: traces_to
---


## 탐색 ^navigation

skill-catalog-system > dkg-skill-group > **skill-dkg-skill-decision**

형제: `skill-dkg-skill-cascade` · `skill-dkg-skill-migrator` · `skill-dkg-skill-version-event` · `skill-dkg-skill-catalog`

## 목적 ^purpose

DKG 변경에 필요한 의사결정 템플릿과 evidence 수집 규칙을 제공해, 구조 변경이 항상 이유와 근거를 동반하게 만드는 스킬이다.

## 사용 맥락 ^context

새 축, prefix, merge/split, capacity 변경처럼 사람이 승인해야 할 DKG 결정을 기록할 때 사용한다.

## 설계 의도 ^intent

구조 변경을 즉흥적 선택이 아니라 Decision 템플릿과 evidence 세트로 남겨,
나중에 왜 그런 선택을 했는지 역추적할 수 있게 한다.

## 피드백 규칙 ^feedback

- 같은 종류의 결정에서 evidence 누락이 반복되면 템플릿 필수 항목을 더 강화한다.
- 결정 후 후속 수정이 자주 나오는 영역은 decision 질문 세트를 더 보수적으로 만든다.

## 주의사항 ^caveat

Decision 템플릿은 승인 기록을 돕는 것이지 정답을 보장하지 않는다.
영향 분석 없이 decision만 기록하면 형식적 문서로 전락한다.

## 관련 소스

- packages/spec-core/src/dkg/skills/
