---
def:
  id: dkg-skill-cascade
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
---
# analyzeImpact — 종단 Cascade

## 목적 ^purpose

DKG 그래프에서 특정 노드 변경의 영향을 종단까지 추적하는 skill. leaf → composite 역참조 그래프를 DFS 순회하여 영향받는 모든 노드를 수집한다.
