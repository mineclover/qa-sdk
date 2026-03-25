---
def:
  id: analysis-intent-link
  scope: feature
  aspect: func_def
  depth: specification
  lifecycle: approved
---
# IntentLink — Prefix 공출현 조건

## 목적 ^purpose

특정 prefix들이 함께 관측되어야 하는 조건(IntentLink)을 정의하고, 위반 시 invariant violation을 감지한다. 순서 없는 공출현 — 같은 서비스 컨텍스트에서 동시에 나타나기만 하면 된다.
