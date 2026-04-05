---
def:
  id: ms-concept-folding
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
    - target: ms-concept-boundary
      type: depends_on
    - target: ms-concept-data-facets
      type: depends_on
    - target: ms-concept-pipe
      type: depends_on
---

# Semantic Folding

## 목적 ^purpose

하위 데이터 패싯을 접어서 상위의 인터페이스로 끌어올리는 개념을 정의한다.
Module과 Pipe 모두에 적용된다.
접으면 `^method`만 보이고, 펼치면 하위의 개별 패싯이 보인다.

---

## Folding이란

**하위의 패싯을 접어서 상위의 표현으로 끌어올리는 것이다.**

두 가지 대상에 적용된다:

```
Module = leaf가 접근 가능한 data의 묶음
  → Folding: 하위 leaf의 데이터 패싯을 모듈 인터페이스로 접음

Pipe = 실행 단위
  → Folding: 하위 실행 단계의 패싯을 파이프의 흐름 표현으로 접음
```

## Module Folding

module은 여러 leaf를 포함하고, leaf들의 패싯을 자신의 인터페이스로 끌어올린다.

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

## Pipe Folding

pipe는 실행 단계들을 포함하고, 각 단계의 패싯을 파이프의 흐름 표현으로 끌어올린다.

```
펼친 상태 (unfold):
  Pipe "validated-create"
    ├── step 1: 소비 (입력 읽기)
    ├── step 2: 관리 (검증)
    ├── step 3: 생산 (새 데이터 생성)
    └── step 4: 저장 (DB 저장)

접은 상태 (fold):
  Pipe "validated-create": "입력을 검증하고 생성하여 저장한다"
  → 개별 단계는 보이지 않음, 파이프의 흐름 요약만 노출
```

## Module과 Pipe의 차이

| 대상 | 하위 구성 | Folding 결과 |
|------|----------|-------------|
| Module | leaf (데이터 접근 단위) | 모듈 인터페이스 (^method) |
| Pipe | 실행 단계 (패싯 순서) | 흐름 요약 (패싯 체인) |

Module은 "어떤 데이터에 접근 가능한가"를 접고,
Pipe는 "어떤 순서로 실행되는가"를 접는다.

## ^method 마커와의 관계

`^method`는 Folding의 텍스트 표현이다.

"하위 구성요소를 주어로 써서 목적 달성 경로를 서술" = 하위 패싯을 접어서 상위 수준으로 끌어올린 것.

Module의 ^method:
```markdown
**X**가 데이터를 생산하고, **Y**가 검증하고, **Z**가 저장한다.
```

Pipe의 ^method (또는 흐름 요약):
```markdown
입력을 **소비**하고, 규칙으로 **관리**하고, 결과를 **생산**하여 **저장**한다.
```

## 다단계 Folding

Folding은 재귀적이다. module이 다른 module을 포함하면 다단계로 접힌다.
pipe가 다른 pipe를 호출하면 마찬가지로 다단계로 접힌다.

| 레벨 | 접었을 때 보이는 것 | 숨겨지는 것 |
|------|-------------------|-----------|
| L0 Group | group의 ^method | module 내부 |
| L1 Module | module의 ^method | leaf의 개별 패싯 |
| L2 Leaf | 패싯 자체 | — (최하위) |

Pipe에서:
| 레벨 | 접었을 때 보이는 것 | 숨겨지는 것 |
|------|-------------------|-----------|
| 상위 Pipe | 흐름 요약 | 하위 단계의 개별 패싯 |
| 하위 단계 | 개별 패싯 | — (최하위) |

## Folding ≠ Extraction

- **Folding**: 하위 패싯을 상위 인터페이스로 끌어올리는 **구조적 개념** (Module + Pipe 모두)
- **Extraction**: LLM+AST로 코드에서 바운더리와 패싯을 **식별하는 구현**

Folding은 "접힌 결과가 무엇인가"를 정의하고,
Extraction은 "코드에서 어떻게 그것을 찾는가"를 정의한다.
