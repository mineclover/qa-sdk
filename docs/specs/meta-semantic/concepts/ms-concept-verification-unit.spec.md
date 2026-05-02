---
def:
  tier: exempt
  id: ms-concept-verification-unit
  type: spec
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  links:
    - target: meta-semantic-concepts
      type: traces_to
    - target: ms-concept-folding
      type: traces_to
---

# 검증 단위 (Verification Unit)

## 목적 ^purpose

Semantic Folding의 L2 단계에서 산출되는, 독립적으로 테스트 가능한 함수를 정의한다.
검증 단위는 좌표를 부여할 가치가 있는 코드의 최소 단위다.

이 개념은 Folding의 "무엇을 산출하는가"를 정의하고,
Extraction의 "어떻게 식별하는가"의 판단 기준이 된다.

> Folding: 전략 (3단계 레벨에서 무엇을 접는가) — `ms-concept-folding` 참조
> Extraction: 구현 (LLM+AST로 어떻게 찾는가) — `meta-semantic-extraction` 참조

---

## 검증 가능 기준

- 명확한 입력/출력 타입이 있다
- 부수효과가 식별 가능하다 (또는 없다)
- 다른 함수와 독립적으로 테스트할 수 있다

## 이것이다 / 이것이 아니다

| 코드 | 검증 단위? | 이유 |
|------|-----------|------|
| `processOrder(order: Order): Receipt` | ✓ | 명확한 I/O, 독립 테스트 가능 |
| `validate(data: Input): boolean` | ✓ | 명확한 I/O |
| `UserComponent({ user }: Props)` | ✓ | 컴포넌트 = 입력→렌더 결과 |
| `private helper()` | ✗ | 외부 계약 없음, 독립 테스트 불가 |
| `get name() { return this._name }` | ✗ | 로직 없음 |
| `if (x == null) return` | ✗ | 분기이지만 검증 단위는 아님 |

## LLM의 역할

검증 단위의 식별은 LLM이 수행한다.
"이 함수는 독립 테스트 가능한가?"는 의미적 판단이지 구문적 사실이 아니다.
AST 파서는 함수 시그니처, 타입 정보 등 구조적 사실만 제공한다.
