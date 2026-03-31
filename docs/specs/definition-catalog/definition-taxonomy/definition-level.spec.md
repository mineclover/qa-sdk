---
def:
  id: definition-level
  level: leaf
  address: def_document:v2:342163
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: definition-service
  tags: [entry-point]
  links:
    - target: definition-taxonomy
      type: refines
---
# Definition Level — 분해 레벨

## 목적 ^purpose

시스템의 전체-부분 분해 구조에서 문서가 어떤 단위인지 표현한다. scope가 "분해된 후의 성격"을 분류한다면, level은 "어떤 단위로 분해되었는가"를 표현하는 상위 개념이다.

## 정의 ^defines

- DefLevel 3종 (group, module, leaf)
- 재귀 분해 규칙 (group → group, module → module)
- 좌표 미인코딩 원칙 (불변성 보존)
- 검증 행동 (group/module 자식 필수, leaf 자식 금지)

## 소비 ^consumes

- scope (taxonomy) — level과 직교. level은 역할, scope는 주제.

## 구성 ^overview

- 3종 레벨: group(묶임의 이유), module(개념 정의), leaf(구성 요소 명세)
- 좌표에 인코딩하지 않음 — lifecycle과 동일한 메타데이터
- group은 재귀 가능 — group이 하위 group을 포함
- module은 재귀 가능 — module이 하위 module을 포함
- 기본값: leaf (미선언 시)

## 설계 근거 ^intent

### level과 scope의 분리 — 두 축의 직교

level은 **"이 문서의 역할"**(묶임 설명 / 개념 정의 / 구성 요소 명세)을 결정한다.
scope는 **"이 문서의 관점"**(기능인가, 데이터인가, API인가)을 분류한다.

두 축은 직교한다. module(개념 정의)의 자식 leaf들이 서로 다른 scope를 가지는 것이 정상이다:

```
ingest-system (module, scope: flow)       ← 개념: "수집 시스템"
  ├── ingest-api (leaf, scope: interface)  ← API 관점
  ├── ingest-data (leaf, scope: data)      ← 데이터 관점
  └── ingest-constraint (leaf, scope: constraint) ← 제약 관점
```

level은 문서가 **트리에서 하는 역할**이고, scope는 **설명하는 대상**이다.

### 3종 level의 역할

| level | 질문 | 정의하는 것 | 검증 |
|-------|------|-----------|------|
| group | "왜 함께 있는가" | 묶임의 이유 | 자식 1건 이상 필수 |
| module | "이 개념은 무엇인가" | 단일 개념 + 구성 참조 | 자식 1건 이상 필수 |
| leaf | "어떻게 동작하는가" | 최종 명세 | 자식 금지 |

### 좌표에 인코딩하지 않는 이유

level은 **변할 수 있다**:

1. leaf 문서가 분해되면 module로 변경
2. module이 상위 구조를 설명하게 되면 group으로 변경
3. group이 개념 수준으로 축소되면 module로 변경

좌표 주소는 불변이어야 한다 (모든 참조의 앵커). level이 주소에 포함되면 역할이 바뀔 때마다 주소가 바뀌고 모든 링크가 깨진다.

### 재귀적 분해

고정된 계층이 아니다. 같은 level이 중첩될 수 있다:

```
group → group → module → leaf     # 그룹 중첩
group → module → leaf             # 얕은 구조
group → module → module → leaf    # module 재귀
module → leaf                     # 직접 명세
```

level은 "현재 이 문서가 어떤 역할인가"의 선언이지, "트리의 몇 번째 깊이인가"의 절대 위치가 아니다.

## 제약 조건 ^constraint

- level은 좌표 주소에 인코딩하지 않는다 (불변성 보존)
- level 미선언 시 기본값은 "leaf"
- contains 자식이 있는 문서는 leaf보다 상위 level을 선언해야 한다 (권장, 강제 아님)
- level 변경은 주소에 영향 없다 — 다른 문서의 링크가 깨지지 않는다

## 관련 소스

- `definition-catalog/src/types.ts:DefLevel` — 타입 정의
- `definition-catalog/src/vocabulary.ts:DEF_LEVEL` — 축 정의 (entries, capacity, ko)
- `definition-catalog/src/frontmatter.ts` — 파싱 (기본값 leaf)
