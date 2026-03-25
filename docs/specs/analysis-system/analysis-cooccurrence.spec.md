---
def:
  id: analysis-cooccurrence
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
  tags: [observability, tier-system]
  links:
    - target: analysis-prefix
      type: depends_on
    - target: analysis-transition
      type: depends_on
---
# Co-occurrence — 세션 기반 공출현 패턴

## 목적 ^purpose

세션 단위로 어떤 prefix가 함께 나타나는지 Jaccard 분석. Jaccard ≥ 0.5인 쌍에서 connected component를 찾아 Auto IntentLink 후보를 생성한다.
