---
def:
  id: ms-concept-branch-path
  type: knowledge
  knowledge_kind: concept
  level: leaf
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-concepts
      type: depends_on
---

# 분기 경로 (Branch Path)

## 목적 ^purpose

검증 단위 내에서 도달 가능한 분기점을 따라가며 경우의 수를 세는 방법을 정의한다.
전체 변수의 전곱(N×M)이 아니라, 이벤트별 도달 가능한 경로의 합이다.

---

## 곱과 합의 규칙

```
전곱:  A(3) × B(4) × C(2) = 24    ← 도달 불가능한 조합 포함
경로:  A(3)→B(4) = 12,  A(3)→C(2) = 6  → 합: 18  ← 도달 가능한 것만
```

- 분기점 A에서 다음에 **순차 도달**하는 분기점 B → A × B (곱)
- A에서 도달하는 B와 C가 **독립** → (A×B) + (A×C) (합)

**"독립"의 판별:** B에서 C에 도달 불가능하고, C에서 B에 도달 불가능하면 독립.
B→C가 도달 가능하면 B와 C는 순차 관계이므로 곱.

## 의미 없는 분기 제외

| 분기 | 포함? | 이유 |
|------|-------|------|
| `if (type === 'card')` | ✓ | 비즈니스 로직 분기 |
| `switch (status)` | ✓ | 상태 기반 분기 |
| `if (x == null)` | ✗ | 방어적 체크 |
| `try/catch` | ✗ | 에러 처리 |
| `if (DEBUG)` | ✗ | 개발 도구 |

## WeightedIndex와의 관계

각 독립 경로를 별도 WeightedIndex 인스턴스로 인코딩하고,
주소 범위를 연접(concatenation)한다.
