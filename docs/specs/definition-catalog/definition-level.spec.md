---
def:
  id: definition-level
  level: leaf
  scope: data
  aspect: domain_data
  depth: specification
  lifecycle: approved
  layer: domain
  svc: definition-service
  tags: [entry-point, tier-system]
  links:
    - target: definition-taxonomy
      type: refines
---
# Definition Level — 분해 레벨

## 목적 ^purpose

시스템의 전체-부분 분해 구조에서 문서가 어떤 단위인지 표현한다. scope가 "분해된 후의 성격"을 분류한다면, level은 "어떤 단위로 분해되었는가"를 표현하는 상위 개념이다.

## 구성 ^overview

- 5종 레벨: system, area, unit, module, leaf
- 좌표에 인코딩하지 않음 — lifecycle과 동일한 메타데이터
- module은 재귀 가능 — module이 하위 module을 포함
- 기본값: leaf (미선언 시)

## 설계 근거 ^intent

### level이 필요한 이유

scope×aspect는 문서의 **성격**(기능인가, 데이터인가, API인가)을 분류한다. 하지만 분해 구조의 **상위 컨테이너 문서**는 성격 분류가 불안정하다.

```
system-root     → scope=flow/process_flow  (실제 흐름이 아님)
system-infra    → scope=flow/process_flow  (실제 흐름이 아님)
ingest-system   → scope=flow/process_flow  (얼추 맞음)
record-spec     → scope=data/domain_data   (정확함)
```

상위 레벨에서 scope가 작동하지 않는 이유: 영역 문서는 "어떤 종류의 것인가"보다 "시스템의 어떤 부분인가"가 본질적 정체성이다.

level은 이 **분해 위치**를 명시적으로 선언하여, scope가 불안정한 상위 문서도 정확히 식별할 수 있게 한다.

### scope와의 관계

```
분해 먼저:  "이것은 전체에서 어떤 단위인가?" → level
분류 다음:  "이 단위는 어떤 종류인가?" → scope
```

level이 결정된 후에 scope가 의미를 가진다:

| level | scope 동작 |
|-------|-----------|
| system | 무의미 — 전체는 분류 대상 아님 |
| area | 불안정 — 주제보다 소속이 중요 |
| unit | 작동 시작 — feature/interface/data 분산 |
| module | 잘 동작 — 세부 분류 가능 |
| leaf | 완전 작동 — scope가 정체성 결정 |

### 좌표에 인코딩하지 않는 이유

level은 **변할 수 있다**:

1. leaf 문서가 분해되면 module로 변경
2. module이 더 분해되면 module 유지 (재귀)
3. 시스템 구조가 재편되면 area↔unit이 바뀔 수 있음

좌표 주소는 불변이어야 한다 (모든 참조의 앵커). level이 주소에 포함되면 분해할 때마다 주소가 바뀌고 모든 링크가 깨진다.

따라서 level은 lifecycle과 동일하게 **메타데이터 필드**로 관리한다:
- 변경 가능 (주소 불변)
- 필터/검색에 사용 가능
- 검증에 사용 가능 (contains 체인과 level의 일관성)

### 재귀적 분해

고정된 5단계 계층이 아니다. 같은 level이 중첩될 수 있다:

```
unit → module → module → leaf     # module 중첩
unit → module → leaf              # 얕은 분해
unit → leaf                       # 직접 리프
module → module → module → leaf   # 깊은 재귀
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
