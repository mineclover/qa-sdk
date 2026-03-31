---
def:
  id: ms-concept-folding
  type: knowledge
  knowledge_kind: concept
  level: leaf
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: draft
  layer: domain
  links:
    - target: meta-semantic-concepts
      type: depends_on
    - target: ms-concept-contract-descent
      type: depends_on
---

# Semantic Folding

## 목적 ^purpose

코드를 접고 펼쳐서 바운더리를 찾는 메커니즘을 정의한다.
시각화가 아니라 "무엇을 좌표화할 것인가"를 결정하는 사전 단계다.
모든 코드에 좌표를 부여하면 주소 공간이 폭발하므로,
접어서 바운더리를 찾고 그 안의 검증 단위만 좌표화한다.

---

## 3단계

| 레벨 | 접었을 때 | 판단 |
|------|----------|------|
| L0 System | 시스템 간 데이터 흐름만 | "이 패키지는 하나의 바운더리인가?" |
| L1 Module | 모듈 간 계약만 | "이 클래스는 패싯 중 일부를 가진 검증 가능 단위인가?" |
| L2 Leaf | 함수 단위 로직 | "이 함수는 독립 검증 가능한가?" |

## Folding의 산출물

검증 단위 목록 — 좌표를 부여할 대상.

## Folding은 시각화가 아닌 이유

시각화는 Folding의 부산물이다. 접기/펼치기가 자연스럽게 줌 레벨을 만들지만,
Folding의 본질적 목적은 **좌표화 대상 선별**이다.
