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
    - target: ms-concept-boundary
      type: depends_on
    - target: ms-concept-data-facets
      type: depends_on
---

# Semantic Folding

## 목적 ^purpose

모듈이 하위 데이터 패싯을 접어서 자신의 인터페이스로 끌어올리는 개념을 정의한다.
접으면 모듈의 `^method`만 보이고, 펼치면 하위의 개별 패싯이 보인다.

---

## Folding이란

**모듈 단위에서 하위를 접는 것이다.**

leaf는 개별 패싯(생산, 소비, 정의, 관리, 저장 등)을 가진다.
module은 여러 leaf를 포함하고, 그 leaf들의 패싯을 자신의 인터페이스로 끌어올린다.
이 끌어올리는 행위가 Folding이다.

```
펼친 상태 (unfold):
  Module A
    ├── leaf X: 정의 + 생산
    ├── leaf Y: 소비 + 관리
    └── leaf Z: 저장

접은 상태 (fold):
  Module A: ^method "X가 데이터를 생산하고, Y가 검증하고, Z가 저장한다"
  → 하위 패싯은 보이지 않음, 모듈의 인터페이스만 노출
```

## ^method 마커와의 관계

`^method`는 Folding의 텍스트 표현이다.

"하위 구성요소를 주어로 써서 목적 달성 경로를 서술" = 하위 패싯을 접어서 모듈 수준으로 끌어올린 것.

```markdown
## 방법 ^method

**X**가 데이터를 생산하고,
**Y**가 검증하고,
**Z**가 저장한다.
```

이것이 곧 X·Y·Z의 패싯을 Module A의 인터페이스로 Fold한 결과다.

## 다단계 Folding

Folding은 재귀적이다. module이 다른 module을 포함하면 다단계로 접힌다.

```
접힌 상태:
  Group (L0): "시스템 간 데이터 흐름만 보임"

한 단계 펼침:
  Module (L1): "모듈 간 계약만 보임 (각 모듈의 ^method)"

완전히 펼침:
  Leaf (L2): "개별 패싯이 보임 (생산, 소비, 정의, 관리, 저장)"
```

| 레벨 | 접었을 때 보이는 것 | 숨겨지는 것 |
|------|-------------------|-----------|
| L0 Group | group의 ^method | module 내부 |
| L1 Module | module의 ^method | leaf의 개별 패싯 |
| L2 Leaf | 패싯 자체 | — (최하위) |

## Folding ≠ Extraction

- **Folding**: 모듈이 하위 패싯을 자신의 인터페이스로 끌어올리는 **구조적 개념**
- **Extraction**: LLM+AST로 코드에서 바운더리와 패싯을 **식별하는 구현**

Folding은 "접힌 결과가 무엇인가"를 정의하고,
Extraction은 "코드에서 어떻게 그것을 찾는가"를 정의한다.
